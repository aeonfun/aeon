#!/usr/bin/env python3
"""Render .outputs/perps-brief.md from .outputs/perps-brief.data.json (v4.1).

v4.1 template:

    Perps Brief · DD MMM

    ─────────  MARKET SENTIMENT  ─────────

      <paragraph>

      Bias · <bias line>

    ─────────  CURRENT POSITIONS (N)  ─────────

      TICKER · DIRECTION · fired DD MMM @ $price · day N/M
        RIDE | CLOSE — <thesis_note>
        invalidation: <invalidation>
        watch: <watch>           (only for RIDE)
        MAE −X% (day N) · MFE +Y% (day N) · now +Z%   (RIDE)
        final +X% vs entry · +Y% vs BTC · WIN|LOSS|NEUTRAL|WIN-WITH-SCARE   (CLOSE)
        MAE −X% · MFE +Y%        (CLOSE)

    ─────────  NEW POSITIONS (N)  ─────────

      TICKER · DIRECTION · horizon · entry: <zone>
        invalidation: <invalidation>
        thesis: <thesis>
        confluence (N): name1, name2, ...
        risks: <risk1>; <risk2>

    ─────────  WATCHLIST (N)  ─────────

      TICKER · DIRECTION · day N on watchlist · confluence (N)
        trigger: <trigger>
        invalidation: <invalidation>
        thesis: <thesis>

Section markers `─────────  XXX  ─────────` are deterministic — the
postprocess script reads them to split the brief into per-section Discord
messages.

Empty sections are omitted entirely. Title + MARKET SENTIMENT are combined
into the first section (no divider between them).

Exit 0 on success, 2 on schema violation.
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path
from typing import List, Optional


DATA_JSON = Path(".outputs/perps-brief.data.json")
MD_OUT = Path(".outputs/perps-brief.md")

VALID_DIRECTIONS = {"LONG", "SHORT"}
VALID_HORIZONS = {"24h", "3d", "7d", "multi-week"}
VALID_CALLS = {"RIDE", "CLOSE"}
VALID_OUTCOMES = {"WIN", "LOSS", "SCARE", "NEUTRAL"}

WATCHLIST_CAP = 5
NEW_POSITIONS_CAP = 5

DIVIDER = "─" * 9


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


def fmt_date(iso: str) -> str:
    """YYYY-MM-DD → "DD MMM"."""
    try:
        d = date.fromisoformat(iso)
        return d.strftime("%-d %b") if hasattr(d, "strftime") else iso
    except (ValueError, TypeError):
        return iso


def fmt_price(p) -> str:
    """Format price for display.

    Rules:
      - >= 100        no decimals, comma-grouped:  95,210
      - 1 to 100      exactly 2 decimals:          28.40
      - 0.01 to 1     up to 4 decimals, trimmed:   0.68
      - < 0.01        up to 6 decimals, trimmed:   0.000034
    """
    if p is None:
        return "?"
    try:
        f = float(p)
        if f >= 100:
            return f"{f:,.0f}"
        if f >= 1:
            return f"{f:.2f}"
        if f >= 0.01:
            return f"{f:.4f}".rstrip("0").rstrip(".")
        return f"{f:.6f}".rstrip("0").rstrip(".")
    except (ValueError, TypeError):
        return str(p)


def fmt_pct(p, sign: bool = True) -> str:
    if p is None:
        return "?"
    try:
        f = float(p)
        if sign:
            return f"{f:+.1f}%"
        return f"{f:.1f}%"
    except (ValueError, TypeError):
        return str(p)


def section_header(name: str, count: int | None) -> str:
    if count is None:
        return f"{DIVIDER}  {name}  {DIVIDER}"
    return f"{DIVIDER}  {name} ({count})  {DIVIDER}"


# ---------------------------------------------------------------------------
# Section renderers


def render_market_sentiment(date_str: str, ms: dict, qualifier: str | None) -> List[str]:
    out: List[str] = []
    title = f"Perps Brief · {fmt_date(date_str)}"
    if qualifier:
        title += f" · {qualifier}"
    out.append(title)
    out.append("")
    out.append(section_header("MARKET SENTIMENT", None))
    out.append("")
    for para in ms.get("paragraphs", []):
        # indent paragraph body by 2 spaces, soft-wrap respected as-written
        for line in para.splitlines() or [para]:
            out.append(f"  {line}")
        out.append("")
    out.append(f"  {ms['bias_line']}")
    out.append("")
    return out


def render_current_position(p: dict) -> List[str]:
    ticker = p.get("ticker", "?")
    direction = p.get("direction", "?")
    fired_date = fmt_date(p.get("fired_date", ""))
    fired_price = fmt_price(p.get("fired_price"))
    day_of = p.get("day_of", "")
    call = p.get("call", "?")
    note = p.get("thesis_note", "")
    invalidation = p.get("invalidation", "")
    watch = p.get("watch")
    mae = p.get("mae_pct")
    mfe = p.get("mfe_pct")
    mae_day = p.get("mae_day_of")
    mfe_day = p.get("mfe_day_of")

    day_suffix = f" · day {day_of}" if day_of else ""
    out = [f"  {ticker} · {direction} · fired {fired_date} @ ${fired_price}{day_suffix}"]
    # Auto-flip marker on CLOSE — the original position is being closed
    # because an opposite-direction high-conviction entry fires today.
    # Same ticker will appear in NEW POSITIONS with the new direction.
    call_label = call
    if call == "CLOSE" and p.get("auto_flipped"):
        call_label = "CLOSE (auto-flip)"
    out.append(f"    {call_label} — {note}")
    out.append(f"    invalidation: {invalidation}")

    if call == "RIDE":
        if watch:
            out.append(f"    watch: {watch}")
        now_pct = p.get("now_pct")
        mae_str = f"MAE {fmt_pct(mae)}" + (f" (day {mae_day})" if mae_day else "") if mae is not None else "MAE —"
        mfe_str = f"MFE {fmt_pct(mfe)}" + (f" (day {mfe_day})" if mfe_day else "") if mfe is not None else "MFE —"
        now_str = f"now {fmt_pct(now_pct)}" if now_pct is not None else ""
        bits = [mae_str, mfe_str]
        if now_str:
            bits.append(now_str)
        out.append(f"    {' · '.join(bits)}")
    else:  # CLOSE
        ret = p.get("return_pct")
        ret_btc = p.get("return_vs_btc_pct")
        outcome = p.get("outcome", "?")
        outcome_label = "WIN-WITH-SCARE" if outcome == "SCARE" else outcome
        final_bits = [f"final {fmt_pct(ret)} vs entry"]
        if ret_btc is not None:
            final_bits.append(f"{fmt_pct(ret_btc)} vs BTC")
        final_bits.append(outcome_label)
        out.append(f"    {' · '.join(final_bits)}")
        if mae is not None or mfe is not None:
            mae_str = f"MAE {fmt_pct(mae)}" if mae is not None else "MAE —"
            mfe_str = f"MFE {fmt_pct(mfe)}" if mfe is not None else "MFE —"
            out.append(f"    {mae_str} · {mfe_str}")

    return out


def render_new_position(p: dict) -> List[str]:
    ticker = p.get("ticker", "?")
    direction = p.get("direction", "?")
    horizon = p.get("horizon", "?")
    entry_zone = p.get("entry_zone") or "market"
    invalidation = p.get("invalidation", "")
    thesis = p.get("thesis", "")
    confluence = p.get("confluence_fired", [])
    risks = p.get("risks", [])

    out = [f"  {ticker} · {direction} · {horizon} horizon · entry: {entry_zone}"]
    out.append(f"    invalidation: {invalidation}")
    out.append(f"    thesis: {thesis}")
    out.append(f"    confluence ({len(confluence)}): {', '.join(confluence)}")
    out.append(f"    risks: {'; '.join(risks)}")
    return out


def render_watchlist_entry(p: dict) -> List[str]:
    ticker = p.get("ticker", "?")
    direction = p.get("direction", "?")
    day_of = p.get("day_of_watchlist", 1)
    confluence = p.get("confluence_fired", [])
    trigger = p.get("trigger", "")
    invalidation = p.get("invalidation", "")
    thesis = p.get("thesis", "")

    out = [f"  {ticker} · {direction} · day {day_of} on watchlist · confluence ({len(confluence)})"]
    out.append(f"    trigger: {trigger}")
    out.append(f"    invalidation: {invalidation}")
    out.append(f"    thesis: {thesis}")
    return out


# ---------------------------------------------------------------------------
# Schema validation


def validate_schema(data: dict) -> Optional[str]:
    if data.get("schema_version") != "v4.1":
        return f"schema_version must be 'v4.1', got '{data.get('schema_version')}'"
    for k in ("date", "market_sentiment"):
        if k not in data:
            return f"missing required key '{k}'"
    ms = data["market_sentiment"]
    if "paragraphs" not in ms or "bias_line" not in ms:
        return "market_sentiment must contain 'paragraphs' and 'bias_line'"

    current = data.get("current_positions", [])
    if not isinstance(current, list):
        return "current_positions must be array"
    for i, p in enumerate(current):
        if not isinstance(p, dict):
            return f"current_positions[{i}] must be object"
        for k in ("ticker", "direction", "call"):
            if k not in p:
                return f"current_positions[{i}] missing '{k}'"
        if p["direction"] not in VALID_DIRECTIONS:
            return f"current_positions[{i}].direction invalid"
        if p["call"] not in VALID_CALLS:
            return f"current_positions[{i}].call must be one of {sorted(VALID_CALLS)}"
        if p["call"] == "CLOSE" and p.get("outcome") not in VALID_OUTCOMES:
            return f"current_positions[{i}] CLOSE missing valid 'outcome'"

    new_positions = data.get("new_positions", [])
    if not isinstance(new_positions, list):
        return "new_positions must be array"
    if len(new_positions) > NEW_POSITIONS_CAP:
        return f"new_positions capped at {NEW_POSITIONS_CAP}; got {len(new_positions)}"
    for i, s in enumerate(new_positions):
        if not isinstance(s, dict):
            return f"new_positions[{i}] must be object"
        for k in (
            "ticker",
            "direction",
            "horizon",
            "entry_zone",
            "thesis",
            "invalidation",
            "confluence_fired",
            "risks",
        ):
            if k not in s:
                return f"new_positions[{i}] missing '{k}'"
        if s["direction"] not in VALID_DIRECTIONS:
            return f"new_positions[{i}].direction invalid"
        if s["horizon"] not in VALID_HORIZONS:
            return f"new_positions[{i}].horizon invalid"
        if not isinstance(s["confluence_fired"], list) or not s["confluence_fired"]:
            return f"new_positions[{i}].confluence_fired must be non-empty array"
        if not isinstance(s["risks"], list) or not s["risks"]:
            return f"new_positions[{i}].risks must be non-empty array"

    watchlist = data.get("watchlist", [])
    if not isinstance(watchlist, list):
        return "watchlist must be array"
    if len(watchlist) > WATCHLIST_CAP:
        return f"watchlist capped at {WATCHLIST_CAP}; got {len(watchlist)}"
    for i, w in enumerate(watchlist):
        if not isinstance(w, dict):
            return f"watchlist[{i}] must be object"
        for k in (
            "ticker",
            "direction",
            "trigger",
            "invalidation",
            "thesis",
            "confluence_fired",
        ):
            if k not in w:
                return f"watchlist[{i}] missing '{k}'"
        if w["direction"] not in VALID_DIRECTIONS:
            return f"watchlist[{i}].direction invalid"

    return None


# ---------------------------------------------------------------------------
# Main


def main() -> int:
    if not DATA_JSON.exists():
        sys.stderr.write(f"render-perps-brief: no {DATA_JSON} — nothing to render\n")
        return 0

    try:
        data = json.loads(DATA_JSON.read_text())
    except json.JSONDecodeError as e:
        write_failure_placeholder(f"perps-brief.data.json was not valid JSON ({e}).")
        fail(f"{DATA_JSON} is not valid JSON: {e}", code=2)

    err = validate_schema(data)
    if err:
        write_failure_placeholder(f"perps-brief.data.json failed schema validation: {err}")
        fail(err, code=2)

    lines: List[str] = []

    # Section 1: Title + MARKET SENTIMENT (combined per operator decision)
    lines.extend(
        render_market_sentiment(
            data["date"], data["market_sentiment"], data.get("qualifier")
        )
    )

    # Section 2: CURRENT POSITIONS — only if non-empty
    current = data.get("current_positions", [])
    if current:
        lines.append(section_header("CURRENT POSITIONS", len(current)))
        lines.append("")
        for i, p in enumerate(current):
            lines.extend(render_current_position(p))
            if i < len(current) - 1:
                lines.append("")
        lines.append("")

    # Section 3: NEW POSITIONS — only if non-empty
    new_positions = data.get("new_positions", [])
    if new_positions:
        lines.append(section_header("NEW POSITIONS", len(new_positions)))
        lines.append("")
        for i, p in enumerate(new_positions):
            lines.extend(render_new_position(p))
            if i < len(new_positions) - 1:
                lines.append("")
        lines.append("")

    # Section 4: WATCHLIST — only if non-empty
    watchlist = data.get("watchlist", [])
    if watchlist:
        lines.append(section_header("WATCHLIST", len(watchlist)))
        lines.append("")
        for i, w in enumerate(watchlist):
            lines.extend(render_watchlist_entry(w))
            if i < len(watchlist) - 1:
                lines.append("")
        lines.append("")

    MD_OUT.parent.mkdir(parents=True, exist_ok=True)
    MD_OUT.write_text("\n".join(lines).rstrip() + "\n")
    print(
        f"render-perps-brief: wrote {MD_OUT} ({MD_OUT.stat().st_size} bytes, "
        f"{len(current)} current, {len(new_positions)} new, {len(watchlist)} watchlist)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
