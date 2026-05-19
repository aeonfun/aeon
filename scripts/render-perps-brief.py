#!/usr/bin/env python3
"""Render .outputs/perps-brief.md deterministically from .outputs/perps-brief.data.json.

Same structural pattern as scripts/render-perps-scan.py (ISS-004 fix), applied
to perps-brief. Claude writes the JSON intermediate; this script produces the
locked markdown output. No LLM in the render path so the format cannot be
corrupted by an end-of-task ## Summary blob.

The matching skills/perps-brief/SKILL.md step describes the JSON schema and
the field-level rules in detail. Summary:

    {
      "date": "2026-05-19",
      "qualifier": null | "no high-conviction setups" | "degraded (...)" | "quiet",
      "market_sentiment": {
        "paragraphs": [str, ...],          # one or more paragraphs of prose
        "bias_line": str                    # "Bias · ..." or similar
      },
      "high_conviction": [
        {
          "ticker": str,
          "bias_label": str,                # the framing after ASSET ·
          "repeat_days_suffix": str | null, # " (day N)" if same ticker on prior days
          "blocks": {
            "perps":      {"header_suffix": str | null, "lines": [str, ...]},
            "narrative":  {"header_suffix": str | null, "lines": [str, ...]},
            "context":    {"header_suffix": str | null, "lines": [str, ...]},
            "enrichment": {"header_suffix": str | null, "lines": [str, ...]},
            "thesis":     {"header_suffix": str | null, "lines": [str, ...]}
          }
        }
      ],
      "overflow": [                          # optional. setups that qualify but didn't
        ...                                  # make the top-5 cap. Same shape as high_conviction.
      ],
      "watchlist": [
        {
          "ticker": str,
          "conflict_label": str,             # the framing after ASSET ·
          "risk": {"header_suffix": str | null, "lines": [str, ...]}
        }
      ],
      "skip_day_best_near_miss": str | null  # one-sentence near-miss for skip-day variant
    }

Render emits HTTP 0 on success, 2 on schema violation. On schema violation it
writes a "skill ran but render failed" placeholder artifact so daily-ops-review
surfaces the issue.
"""

import json
import sys
from pathlib import Path
from typing import List, Optional


def fail(msg: str, code: int = 1) -> None:
    sys.stderr.write(f"render-perps-brief: {msg}\n")
    sys.exit(code)


def render_block(label: str, block: Optional[dict]) -> List[str]:
    """Render a single sub-header block under a setup.

    Sub-header is "{label}" or "{label} · {header_suffix}". Each line in the
    block's lines list is indented four spaces under the header (two for the
    sub-header, two more for the body).
    """
    if not block:
        return []
    suffix = block.get("header_suffix")
    header = f"  {label}"
    if suffix:
        header = f"  {label} · {suffix}"
    out = [header]
    for line in block.get("lines", []):
        out.append(f"    {line}")
    return out


def render_high_conviction_setup(setup: dict) -> List[str]:
    ticker = setup.get("ticker", "?")
    bias_label = setup.get("bias_label", "")
    suffix = setup.get("repeat_days_suffix") or ""
    out = [f"{ticker} · {bias_label}{suffix}", ""]
    blocks = setup.get("blocks", {})
    block_order = ["perps", "narrative", "context", "enrichment", "thesis"]
    for i, key in enumerate(block_order):
        block = blocks.get(key)
        if not block:
            continue
        label = key.capitalize()
        rendered = render_block(label, block)
        out.extend(rendered)
        # blank line between blocks within a setup
        if i < len(block_order) - 1:
            out.append("")
    return out


def render_watchlist_setup(setup: dict) -> List[str]:
    ticker = setup.get("ticker", "?")
    conflict = setup.get("conflict_label", "")
    out = [f"{ticker} · {conflict}", ""]
    risk = setup.get("risk")
    if risk:
        out.extend(render_block("Risk", risk))
    return out


def main() -> int:
    json_path = Path(".outputs/perps-brief.data.json")
    md_path = Path(".outputs/perps-brief.md")

    if not json_path.exists():
        sys.stderr.write(
            "render-perps-brief: no .outputs/perps-brief.data.json — nothing to render\n"
        )
        return 0

    try:
        data = json.loads(json_path.read_text())
    except json.JSONDecodeError as e:
        md_path.parent.mkdir(parents=True, exist_ok=True)
        md_path.write_text(
            f"Perps Brief · unknown date · render failed\n\n"
            f"perps-brief.data.json was not valid JSON ({e}).\n"
            "perps-brief should be re-dispatched.\n"
        )
        fail(f"perps-brief.data.json is not valid JSON: {e}", code=2)

    required = ["date", "market_sentiment"]
    for k in required:
        if k not in data:
            fail(f"perps-brief.data.json missing required key '{k}'", code=2)

    ms = data["market_sentiment"]
    if "paragraphs" not in ms or "bias_line" not in ms:
        fail("market_sentiment must contain 'paragraphs' and 'bias_line'", code=2)

    lines: List[str] = []

    # Title — append qualifier when set
    title = f"Perps Brief · {data['date']}"
    if data.get("qualifier"):
        title += f" · {data['qualifier']}"
    lines.append(title)
    lines.append("")

    # MARKET SENTIMENT
    lines.append("MARKET SENTIMENT")
    lines.append("")
    for para in ms.get("paragraphs", []):
        lines.append(para)
        lines.append("")
    lines.append(ms["bias_line"])
    lines.append("")

    # Skip-day variant — emits a best-near-miss line after the bias
    if data.get("skip_day_best_near_miss"):
        lines.append(f"Best near-miss: {data['skip_day_best_near_miss']}")
        lines.append("")

    # HIGH CONVICTION
    hc = data.get("high_conviction", [])
    if hc:
        lines.append("HIGH CONVICTION")
        lines.append("")
        for i, setup in enumerate(hc):
            lines.extend(render_high_conviction_setup(setup))
            if i < len(hc) - 1:
                lines.append("")
        lines.append("")

    # OVERFLOW — visible in artifact only (post-run trim policy is upstream)
    overflow = data.get("overflow", [])
    if overflow:
        lines.append("OVERFLOW")
        lines.append("")
        for i, setup in enumerate(overflow):
            lines.extend(render_high_conviction_setup(setup))
            if i < len(overflow) - 1:
                lines.append("")
        lines.append("")

    # WATCHLIST
    wl = data.get("watchlist", [])
    if wl:
        lines.append("WATCHLIST")
        lines.append("")
        for i, setup in enumerate(wl):
            lines.extend(render_watchlist_setup(setup))
            if i < len(wl) - 1:
                lines.append("")
        lines.append("")

    md_path.parent.mkdir(parents=True, exist_ok=True)
    md_path.write_text("\n".join(lines).rstrip() + "\n")
    print(
        f"render-perps-brief: wrote {md_path} ({md_path.stat().st_size} bytes, "
        f"{len(hc)} high-conviction, {len(overflow)} overflow, {len(wl)} watchlist)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
