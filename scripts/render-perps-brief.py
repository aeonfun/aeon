#!/usr/bin/env python3
"""Render .outputs/perps-brief.md deterministically from .outputs/perps-brief.data.json.

v4 schema. Same structural pattern as the v3 renderer (ISS-004 fix): Claude
writes the JSON intermediate; this script produces the locked markdown
output. No LLM in the render path so the format cannot be corrupted by an
end-of-task ## Summary blob.

v4 differences from v3:
- Output begins with header + RISK REGIME placeholder line (B2 fills in
  Phase 3; v4-Phase-1 emits a single empty `RISK REGIME: pending (v4 Phase 3)`
  line until then so the structural slot is reserved).
- OPEN POSITIONS section between MARKET SENTIMENT and NEW SETUPS.
- NEW SETUPS replaces HIGH CONVICTION. Two flavors per entry: (now) and (wait).
- FADE line when new_setups[] is empty.
- TRACK RECORD section is rendered only when Phase 2 lands (v4-Phase-1 leaves
  the slot dormant — absent track_record block means no rendering).

The matching skills/perps-brief/SKILL.md describes how Claude composes the
JSON. This file is the renderer + schema gate only.

Render emits exit 0 on success, 2 on schema violation. On schema violation
it writes a "skill ran but render failed" placeholder artifact so
daily-ops-review surfaces the issue.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import List, Optional


DATA_JSON = Path(".outputs/perps-brief.data.json")
MD_OUT = Path(".outputs/perps-brief.md")

VALID_DIRECTIONS = {"LONG", "SHORT"}
VALID_HORIZONS = {"24h", "3d", "7d", "multi-week"}
VALID_CALLS = {"RIDE", "SELL (now)", "SELL (wait)"}
VALID_MODES = {"now", "wait"}


def fail(msg: str, code: int = 1) -> None:
    sys.stderr.write(f"render-perps-brief: {msg}\n")
    sys.exit(code)


def write_failure_placeholder(reason: str) -> None:
    MD_OUT.parent.mkdir(parents=True, exist_ok=True)
    MD_OUT.write_text(
        "Perps Brief · unknown date · render failed\n\n"
        f"{reason}\n"
        "perps-brief should be re-dispatched.\n"
    )


def render_open_position(p: dict) -> List[str]:
    """One OPEN POSITIONS block."""
    ticker = p.get("ticker", "?")
    direction = p.get("direction", "?")
    fired_date = p.get("fired_date", "?")
    fired_price = p.get("fired_price", "?")
    horizon = p.get("horizon", "?")
    day_of = p.get("day_of", "")  # e.g. "2/7"
    call = p.get("call", "?")
    status = p.get("thesis_status", "intact")
    note = p.get("thesis_note", "")
    invalidation = p.get("invalidation", "")
    watch = p.get("watch") or "-"

    day_suffix = f" · day {day_of}" if day_of else ""
    header = (
        f"{ticker} · {direction} · fired {fired_date} @ ${fired_price} "
        f"· {horizon} horizon{day_suffix}"
    )
    out = [header]
    out.append(f"  call: {call}")
    out.append(f"  thesis {status}: {note}")
    out.append(f"  invalidation: {invalidation}")
    out.append(f"  watch: {watch}")
    return out


def render_new_setup(s: dict) -> List[str]:
    """One NEW SETUPS block."""
    ticker = s.get("ticker", "?")
    direction = s.get("direction", "?")
    mode = s.get("mode", "?")
    horizon = s.get("horizon", "?")
    thesis = s.get("thesis", "")
    invalidation = s.get("invalidation", "")
    confluence = s.get("confluence_fired", [])
    risks = s.get("risks", [])

    # Header: "TICKER · LONG (now) · 7d horizon"
    header = f"{ticker} · {direction} ({mode}) · {horizon} horizon"
    out = [header]

    if mode == "now":
        entry = s.get("entry_zone") or "market"
        out.append(f"  entry: {entry}")
    else:  # wait
        trigger = s.get("trigger") or "(unspecified)"
        out.append(f"  trigger: {trigger}")

    out.append(f"  thesis: {thesis}")
    out.append(f"  invalidation: {invalidation}")
    out.append(f"  confluence: {', '.join(confluence) if confluence else '-'}")
    out.append(f"  risks: {'; '.join(risks) if risks else '-'}")
    return out


def validate_schema(data: dict) -> Optional[str]:
    """Return None if valid, else a human error string. No exception."""
    if data.get("schema_version") != "v4":
        return f"schema_version must be 'v4', got '{data.get('schema_version')}'"
    for k in ("date", "market_sentiment"):
        if k not in data:
            return f"missing required key '{k}'"
    ms = data["market_sentiment"]
    if "paragraphs" not in ms or "bias_line" not in ms:
        return "market_sentiment must contain 'paragraphs' and 'bias_line'"

    # OPEN POSITIONS validation (may be empty)
    open_positions = data.get("open_positions", [])
    if not isinstance(open_positions, list):
        return "open_positions must be array"
    for i, p in enumerate(open_positions):
        if not isinstance(p, dict):
            return f"open_positions[{i}] must be object"
        for k in ("ticker", "direction", "call"):
            if k not in p:
                return f"open_positions[{i}] missing '{k}'"
        if p["direction"] not in VALID_DIRECTIONS:
            return f"open_positions[{i}].direction invalid"
        if p["call"] not in VALID_CALLS:
            return f"open_positions[{i}].call must be one of {sorted(VALID_CALLS)}"

    # NEW SETUPS validation
    new_setups = data.get("new_setups", [])
    if not isinstance(new_setups, list):
        return "new_setups must be array"
    if len(new_setups) > 5:
        return f"new_setups capped at 5; got {len(new_setups)}"
    for i, s in enumerate(new_setups):
        if not isinstance(s, dict):
            return f"new_setups[{i}] must be object"
        for k in ("ticker", "direction", "mode", "horizon", "thesis",
                 "invalidation", "confluence_fired", "risks"):
            if k not in s:
                return f"new_setups[{i}] missing '{k}'"
        if s["direction"] not in VALID_DIRECTIONS:
            return f"new_setups[{i}].direction invalid"
        if s["mode"] not in VALID_MODES:
            return f"new_setups[{i}].mode must be 'now' or 'wait'"
        if s["horizon"] not in VALID_HORIZONS:
            return f"new_setups[{i}].horizon invalid"
        if not isinstance(s["confluence_fired"], list) or not s["confluence_fired"]:
            return f"new_setups[{i}].confluence_fired must be non-empty array"
        if not isinstance(s["risks"], list) or not s["risks"]:
            return f"new_setups[{i}].risks must be non-empty array"
        if s["mode"] == "now" and not s.get("entry_zone"):
            # entry_zone can be "market" — but the field must be present and non-empty string
            return f"new_setups[{i}] mode=now requires entry_zone"
        if s["mode"] == "wait" and not s.get("trigger"):
            return f"new_setups[{i}] mode=wait requires trigger"

    return None


def main() -> int:
    if not DATA_JSON.exists():
        sys.stderr.write(
            f"render-perps-brief: no {DATA_JSON} — nothing to render\n"
        )
        return 0

    try:
        data = json.loads(DATA_JSON.read_text())
    except json.JSONDecodeError as e:
        write_failure_placeholder(
            f"perps-brief.data.json was not valid JSON ({e})."
        )
        fail(f"{DATA_JSON} is not valid JSON: {e}", code=2)

    err = validate_schema(data)
    if err:
        write_failure_placeholder(
            f"perps-brief.data.json failed schema validation: {err}"
        )
        fail(err, code=2)

    lines: List[str] = []

    # Title
    title = f"Perps Brief · {data['date']}"
    if data.get("qualifier"):
        title += f" · {data['qualifier']}"
    lines.append(title)
    lines.append("")

    # RISK REGIME line — placeholder slot. Phase 3 (Workstream B2) populates
    # this line from market-context-refresh + perps-scan aggregate verdict.
    risk_regime = data.get("risk_regime")
    if risk_regime:
        # risk_regime: {label, detail, dominance_line}
        lab = risk_regime.get("label", "")
        det = risk_regime.get("detail", "")
        dom = risk_regime.get("dominance_line", "")
        lines.append(f"RISK REGIME: {lab} · {det}")
        if dom:
            lines.append(dom)
        lines.append("")
    # else: omit the section entirely in Phase 1.

    # MARKET SENTIMENT
    ms = data["market_sentiment"]
    lines.append("MARKET SENTIMENT")
    lines.append("")
    for para in ms.get("paragraphs", []):
        lines.append(para)
        lines.append("")
    lines.append(ms["bias_line"])
    lines.append("")

    # OPEN POSITIONS — rendered only when non-empty
    open_positions = data.get("open_positions", [])
    if open_positions:
        lines.append(f"OPEN POSITIONS ({len(open_positions)})")
        lines.append("")
        for i, p in enumerate(open_positions):
            lines.extend(render_open_position(p))
            if i < len(open_positions) - 1:
                lines.append("")
        lines.append("")

    # NEW SETUPS — rendered when non-empty; otherwise emit FADE line
    new_setups = data.get("new_setups", [])
    if new_setups:
        lines.append(f"NEW SETUPS ({len(new_setups)})")
        lines.append("")
        for i, s in enumerate(new_setups):
            lines.extend(render_new_setup(s))
            if i < len(new_setups) - 1:
                lines.append("")
        lines.append("")
    else:
        fade_note = data.get("fade_note") or "no new conviction setups today"
        lines.append(f"FADE — {fade_note}")
        lines.append("")

    # SKIP-DAY best-near-miss (only meaningful when new_setups empty)
    if not new_setups and data.get("skip_day_best_near_miss"):
        lines.append(f"Best near-miss: {data['skip_day_best_near_miss']}")
        lines.append("")

    # TRACK RECORD — Phase 2 produces .outputs/outcome-tracker.md and feeds
    # a track_record block here. v4-Phase-1: dormant slot.
    tr = data.get("track_record")
    if tr:
        lines.append("TRACK RECORD")
        lines.append("")
        for line in tr.get("lines", []):
            lines.append(line)
        lines.append("")

    MD_OUT.parent.mkdir(parents=True, exist_ok=True)
    MD_OUT.write_text("\n".join(lines).rstrip() + "\n")
    print(
        f"render-perps-brief: wrote {MD_OUT} ({MD_OUT.stat().st_size} bytes, "
        f"{len(open_positions)} open positions, {len(new_setups)} new setups)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
