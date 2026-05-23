#!/usr/bin/env python3
"""Render .outputs/perps-brief.md from .outputs/perps-brief.data.json (v4.1 cards).

v4.1 card layout (per operator UX redesign 2026-05-23):

  - MARKET CONTEXT — single message, paragraphs + bias line
  - CURRENT POSITIONS — single message, table + per-row prose
  - NEW POSITIONS — one message per signal, card with labeled fields,
                    bulleted thesis, bulleted risks
  - WATCHLIST — one message per signal, same card layout, no risks

Section + per-card boundaries are marked with `─────────  LABEL  ─────────`
dividers. The postprocess script splits the markdown on these dividers and
delivers each chunk as a separate Discord message wrapped in a code block.

Schema change from prior v4.1: `thesis` and `risks` are now arrays of
bullet strings (was single string for thesis). Each bullet is a complete
self-contained sentence following Pattern 7 from writing-style.md.

Exit 0 on success, 2 on schema violation.
"""

from __future__ import annotations

import json
import sys
import textwrap
from datetime import date
from pathlib import Path
from typing import Iterable, List, Optional


DATA_JSON = Path(".outputs/perps-brief.data.json")
MD_OUT = Path(".outputs/perps-brief.md")

VALID_DIRECTIONS = {"LONG", "SHORT"}
VALID_HORIZONS = {"24h", "3d", "7d", "multi-week"}
VALID_CALLS = {"RIDE", "CLOSE"}
VALID_OUTCOMES = {"WIN", "LOSS", "SCARE", "NEUTRAL"}

WATCHLIST_CAP = 5
NEW_POSITIONS_CAP = 5

DIVIDER = "─" * 9

# Card layout columns
LABEL_INDENT = "  "           # 2 spaces before label
LABEL_WIDTH = 9               # "direction" is the longest label
LABEL_PADDING = "  "          # 2 spaces between label and value/bullet
VALUE_INDENT = len(LABEL_INDENT) + LABEL_WIDTH + len(LABEL_PADDING)  # 13
BULLET = "·"
BULLET_PREFIX = "· "
BULLET_TEXT_INDENT = VALUE_INDENT + len(BULLET_PREFIX)  # 15
MAX_LINE = 64                 # target line width before wrap


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


# ---------------------------------------------------------------------------
# Formatting helpers


def fmt_date(iso: str) -> str:
    try:
        d = date.fromisoformat(iso)
        return d.strftime("%-d %b")
    except (ValueError, TypeError):
        return iso


def fmt_price(p) -> str:
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
        return "—"
    try:
        f = float(p)
        return f"{f:+.1f}%" if sign else f"{f:.1f}%"
    except (ValueError, TypeError):
        return str(p)


def divider(label: str) -> str:
    return f"{DIVIDER}  {label}  {DIVIDER}"


def label_line(label: str, value: str) -> List[str]:
    """Emit `  label      value` with wrapped continuation aligned to the
    value column. Returns a list of lines (one for short values, more for
    long ones that need to wrap)."""
    first_prefix = LABEL_INDENT + label.ljust(LABEL_WIDTH) + LABEL_PADDING
    cont_prefix = " " * len(first_prefix)
    wrapped = textwrap.wrap(
        value,
        width=MAX_LINE,
        initial_indent=first_prefix,
        subsequent_indent=cont_prefix,
        break_long_words=False,
        break_on_hyphens=False,
    )
    if not wrapped:
        return [first_prefix.rstrip()]
    return wrapped


def bullet_lines(label: str, bullets: List[str]) -> List[str]:
    """Render a bulleted list with the label on the first bullet's row.

    First bullet line:  `  thesis      · text...`
    Subsequent bullets:               `· text...` (aligned to value column)
    Wrapped continuation:             `  text...` (aligned to text column)
    """
    out: List[str] = []
    for i, bullet in enumerate(bullets):
        # Prefix for the FIRST line of this bullet
        if i == 0:
            first_prefix = (
                LABEL_INDENT + label.ljust(LABEL_WIDTH) + LABEL_PADDING + BULLET_PREFIX
            )
        else:
            first_prefix = " " * VALUE_INDENT + BULLET_PREFIX
        # Prefix for CONTINUATION lines of a wrapped bullet
        cont_prefix = " " * BULLET_TEXT_INDENT

        wrapped = textwrap.wrap(
            bullet,
            width=MAX_LINE,
            initial_indent=first_prefix,
            subsequent_indent=cont_prefix,
            break_long_words=False,
            break_on_hyphens=False,
        )
        if not wrapped:
            # Empty bullet — emit just the prefix
            wrapped = [first_prefix.rstrip()]
        out.extend(wrapped)
    return out


def paragraph_lines(label: str, text: str) -> List[str]:
    """Wrap a paragraph under a label, with continuation lines aligned to the
    value column. Used for `thesis_note` in the table row prose."""
    first_prefix = LABEL_INDENT + label.ljust(LABEL_WIDTH) + LABEL_PADDING
    cont_prefix = " " * VALUE_INDENT
    return textwrap.wrap(
        text,
        width=MAX_LINE,
        initial_indent=first_prefix,
        subsequent_indent=cont_prefix,
        break_long_words=False,
        break_on_hyphens=False,
    )


# ---------------------------------------------------------------------------
# Section renderers


def render_market_context(date_str: str, ms: dict, qualifier: Optional[str]) -> List[str]:
    out: List[str] = []
    title = f"Perps Brief · {fmt_date(date_str)}"
    if qualifier:
        title += f" · {qualifier}"
    out.append(title)
    out.append("")
    out.append(divider("MARKET SENTIMENT"))
    out.append("")
    paragraphs = ms.get("paragraphs", [])
    for i, para in enumerate(paragraphs):
        wrapped = textwrap.wrap(
            para,
            width=MAX_LINE + 8,
            initial_indent=LABEL_INDENT,
            subsequent_indent=LABEL_INDENT,
            break_long_words=False,
            break_on_hyphens=False,
        )
        out.extend(wrapped)
        if i < len(paragraphs) - 1:
            out.append("")
    out.append("")
    bias_line = ms.get("bias_line", "")
    if bias_line:
        wrapped = textwrap.wrap(
            bias_line,
            width=MAX_LINE + 8,
            initial_indent=LABEL_INDENT,
            subsequent_indent=LABEL_INDENT + "  ",
            break_long_words=False,
            break_on_hyphens=False,
        )
        out.extend(wrapped)
    return out


def render_current_positions(positions: List[dict]) -> List[str]:
    """One section: a table + per-row prose below.

    Table columns (fixed widths):
      TICKER  9   DIR  6   ENTRY  10   NOW  10   PNL  8   MAE/MFE  16   CALL  rest
    """
    out: List[str] = []
    out.append(divider(f"CURRENT POSITIONS ({len(positions)})"))
    out.append("")

    # Column widths (uniform 2-space gap between every column)
    GAP = "  "
    TICKER_W = 8
    DIR_W = 5
    PRICE_W = 10
    PNL_W = 8
    MAEMFE_W = 16

    # Widen ticker column if needed for long tickers (e.g. FARTCOIN)
    ticker_w = max(TICKER_W, max((len(p.get("ticker") or "") for p in positions), default=0))

    def col(value: str, width: int, align: str = "<") -> str:
        fmt = f"{{:{align}{width}}}"
        return fmt.format(value)

    def row_cells(cells: list) -> str:
        """Each cell is (value, width, align). Joined with 2-space gaps."""
        return "  " + GAP.join(col(v, w, a) for v, w, a in cells)

    # Header
    header = row_cells([
        ("TICKER", ticker_w, "<"),
        ("DIR", DIR_W, "<"),
        ("ENTRY", PRICE_W, ">"),
        ("NOW", PRICE_W, ">"),
        ("PNL", PNL_W, ">"),
        ("MAE / MFE", MAEMFE_W, ">"),
        ("CALL", 0, "<"),
    ])
    rule = row_cells([
        ("─" * ticker_w, ticker_w, "<"),
        ("─" * DIR_W, DIR_W, "<"),
        ("─" * PRICE_W, PRICE_W, "<"),
        ("─" * PRICE_W, PRICE_W, "<"),
        ("─" * PNL_W, PNL_W, "<"),
        ("─" * MAEMFE_W, MAEMFE_W, "<"),
        ("─" * 12, 0, "<"),
    ])
    out.append(header)
    out.append(rule)

    for p in positions:
        ticker = p.get("ticker") or "?"
        direction = p.get("direction") or "?"
        fired_price = p.get("fired_price")
        call = p.get("call", "?")

        entry_str = f"${fmt_price(fired_price)}"

        # NOW + PNL columns
        if call == "RIDE":
            now_pct = p.get("now_pct")
            if now_pct is not None and fired_price is not None:
                # now_pct is PnL %; back into a display price
                if direction == "LONG":
                    now_price = float(fired_price) * (1 + float(now_pct) / 100.0)
                else:  # SHORT
                    now_price = float(fired_price) * (1 - float(now_pct) / 100.0)
                now_str = f"${fmt_price(now_price)}"
                pnl_str = fmt_pct(now_pct)
            else:
                now_str = "—"
                pnl_str = "—"
        else:  # CLOSE
            closed_price = p.get("closed_price") or fired_price
            now_str = f"${fmt_price(closed_price)}"
            pnl_str = fmt_pct(p.get("return_pct"))

        # MAE / MFE
        mae = p.get("mae_pct")
        mfe = p.get("mfe_pct")
        mae_str = fmt_pct(mae) if mae is not None else "—"
        mfe_str = fmt_pct(mfe) if mfe is not None else "—"
        mae_mfe_str = f"{mae_str} / {mfe_str}"

        # CALL column
        if call == "CLOSE":
            outcome = p.get("outcome", "")
            outcome_label = "WIN-WITH-SCARE" if outcome == "SCARE" else outcome
            auto_flip = " (flip)" if p.get("auto_flipped") else ""
            call_str = f"CLOSE  {outcome_label}{auto_flip}"
        else:
            call_str = "RIDE"

        row = row_cells([
            (ticker, ticker_w, "<"),
            (direction, DIR_W, "<"),
            (entry_str, PRICE_W, ">"),
            (now_str, PRICE_W, ">"),
            (pnl_str, PNL_W, ">"),
            (mae_mfe_str, MAEMFE_W, ">"),
            (call_str, 0, "<"),
        ])
        out.append(row)

    out.append("")

    # Per-row prose. Use the same ticker_w as the table so the ▸ markers
    # align vertically and create a clear left-margin for scanning.
    for p in positions:
        ticker = p.get("ticker") or "?"
        note = p.get("thesis_note", "")
        if note:
            prefix = f"  {ticker.ljust(ticker_w)}  ▸ "
            cont = " " * len(prefix)
            wrapped = textwrap.wrap(
                note,
                width=MAX_LINE + 12,
                initial_indent=prefix,
                subsequent_indent=cont,
                break_long_words=False,
                break_on_hyphens=False,
            )
            out.extend(wrapped)
            out.append("")

    return out


def render_new_position_card(p: dict) -> List[str]:
    """One per-card message for a single NEW POSITION."""
    ticker = p.get("ticker", "?")
    direction = p.get("direction", "?")
    out: List[str] = []
    out.append(divider(f"NEW POSITION · {ticker} {direction}"))
    out.append("")

    # Metadata block
    out.extend(label_line("ticker", ticker))
    out.extend(label_line("direction", direction))
    out.extend(label_line("horizon", p.get("horizon", "?")))
    out.extend(label_line("entry", p.get("entry_zone") or "market"))
    out.extend(label_line("stop", p.get("invalidation", "")))

    # Two blank lines between metadata and thesis (operator UX call)
    out.append("")
    out.append("")

    # Thesis bullets
    thesis = p.get("thesis", [])
    if isinstance(thesis, str):
        thesis = [thesis]  # back-compat
    if thesis:
        out.extend(bullet_lines("thesis", thesis))

    # Two blank lines between thesis and risks
    out.append("")
    out.append("")

    # Risks bullets
    risks = p.get("risks", [])
    if isinstance(risks, str):
        risks = [risks]
    if risks:
        out.extend(bullet_lines("risks", risks))

    return out


def render_watchlist_card(p: dict) -> List[str]:
    """One per-card message for a single WATCHLIST entry."""
    ticker = p.get("ticker", "?")
    direction = p.get("direction", "?")
    day_of = p.get("day_of_watchlist", 1)
    out: List[str] = []
    out.append(divider(f"WATCHLIST · {ticker} {direction} · day {day_of}"))
    out.append("")

    # Metadata block — horizon is optional for watchlist entries
    out.extend(label_line("ticker", ticker))
    out.extend(label_line("direction", direction))
    if p.get("horizon"):
        out.extend(label_line("horizon", p["horizon"]))
    out.extend(label_line("trigger", p.get("trigger", "")))
    out.extend(label_line("stop", p.get("invalidation", "")))

    # Two blank lines between metadata and thesis
    out.append("")
    out.append("")

    # Thesis bullets
    thesis = p.get("thesis", [])
    if isinstance(thesis, str):
        thesis = [thesis]
    if thesis:
        out.extend(bullet_lines("thesis", thesis))

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
            "ticker", "direction", "horizon", "entry_zone", "thesis",
            "invalidation", "confluence_fired", "risks",
        ):
            if k not in s:
                return f"new_positions[{i}] missing '{k}'"
        if s["direction"] not in VALID_DIRECTIONS:
            return f"new_positions[{i}].direction invalid"
        if s["horizon"] not in VALID_HORIZONS:
            return f"new_positions[{i}].horizon invalid"
        if not isinstance(s["confluence_fired"], list) or not s["confluence_fired"]:
            return f"new_positions[{i}].confluence_fired must be non-empty array"
        # thesis MUST be array of strings in v4.1+ card layout
        if not isinstance(s["thesis"], list) or not s["thesis"]:
            return f"new_positions[{i}].thesis must be non-empty array of bullet strings"
        if not all(isinstance(b, str) and b.strip() for b in s["thesis"]):
            return f"new_positions[{i}].thesis bullets must be non-empty strings"
        # risks MUST be array of strings
        if not isinstance(s["risks"], list) or not s["risks"]:
            return f"new_positions[{i}].risks must be non-empty array of bullet strings"
        if not all(isinstance(b, str) and b.strip() for b in s["risks"]):
            return f"new_positions[{i}].risks bullets must be non-empty strings"

    watchlist = data.get("watchlist", [])
    if not isinstance(watchlist, list):
        return "watchlist must be array"
    if len(watchlist) > WATCHLIST_CAP:
        return f"watchlist capped at {WATCHLIST_CAP}; got {len(watchlist)}"
    for i, w in enumerate(watchlist):
        if not isinstance(w, dict):
            return f"watchlist[{i}] must be object"
        # horizon is OPTIONAL for watchlist entries — the trade may not have
        # a committed horizon until the trigger fires and it promotes to a
        # new position.
        for k in (
            "ticker", "direction", "trigger", "invalidation", "thesis",
            "confluence_fired",
        ):
            if k not in w:
                return f"watchlist[{i}] missing '{k}'"
        if w["direction"] not in VALID_DIRECTIONS:
            return f"watchlist[{i}].direction invalid"
        if "horizon" in w and w["horizon"] not in VALID_HORIZONS:
            return f"watchlist[{i}].horizon invalid"
        # thesis MUST be array of strings
        if not isinstance(w["thesis"], list) or not w["thesis"]:
            return f"watchlist[{i}].thesis must be non-empty array of bullet strings"
        if not all(isinstance(b, str) and b.strip() for b in w["thesis"]):
            return f"watchlist[{i}].thesis bullets must be non-empty strings"

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

    # Message 1: Title + MARKET CONTEXT
    lines.extend(
        render_market_context(
            data["date"], data["market_sentiment"], data.get("qualifier")
        )
    )
    lines.append("")  # blank line between messages

    # Message 2: CURRENT POSITIONS (table + per-row prose) — only if non-empty
    current = data.get("current_positions", [])
    if current:
        lines.extend(render_current_positions(current))
        lines.append("")

    # Message N: each NEW POSITION as its own card
    new_positions = data.get("new_positions", [])
    for p in new_positions:
        lines.extend(render_new_position_card(p))
        lines.append("")

    # Message M: each WATCHLIST entry as its own card
    watchlist = data.get("watchlist", [])
    for w in watchlist:
        lines.extend(render_watchlist_card(w))
        lines.append("")

    # FADE line when nothing fires
    if not new_positions and not watchlist:
        fade_note = data.get("fade_note") or "no new conviction setups today"
        lines.append(divider("FADE"))
        lines.append("")
        lines.append(f"  {fade_note}")
        if data.get("skip_day_best_near_miss"):
            lines.append("")
            lines.append(f"  Best near-miss: {data['skip_day_best_near_miss']}")
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
