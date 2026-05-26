"""Embed composers for the perps-brief signal types.

Each function takes a section of the brief data (or a ledger entry) and
returns a Discord embed dict matching the schema at
https://discord.com/developers/docs/resources/message#embed-object

Design rules (locked with operator 2026-05-25):
- Color = state (sage green LONG, rust red SHORT, etc — see COLORS)
- Bold metric values, regular labels
- Markdown sparingly (no italics / strikethrough / spoilers)
- Bullets via Discord native `\\n• ` (renders as proper bullets)
- Footer = 1 line of metadata (timestamp / chain run ID)
- Author block = category badge (optional)
- One embed per signal in NEW POSITIONS, WATCHLIST, OUTCOMES
- One embed with multi-position fields for CURRENT POSITIONS overview
- Multi-position layout: max 3 inline fields per row on desktop, stacks on mobile
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional


# ---------------------------------------------------------------------------
# Color palette (locked 2026-05-25)


COLORS = {
    "LONG":          0x6aa977,   # sage green — active long
    "SHORT":         0xc06060,   # rust red — active short
    "WIN":           0x2e8b57,   # forest green — clean win close
    "LOSS":          0xa83232,   # brick red — loss close
    "SCARE":         0xd68a3e,   # amber — win despite breach
    "NEUTRAL_CLOSE": 0x6c757d,   # slate — neutral close
    "WATCHLIST":     0xbf953f,   # muted gold — pending trigger
    "CONTEXT":       0x445566,   # deep blue-grey — market sentiment
    "WEEKLY":        0x6a5acd,   # royal purple — weekly summary
}


# ---------------------------------------------------------------------------
# Formatting helpers


def fmt_pct(p, sign: bool = True, dash: str = "—") -> str:
    if p is None:
        return dash
    try:
        f = float(p)
        return f"{f:+.1f}%" if sign else f"{f:.1f}%"
    except (ValueError, TypeError):
        return dash


def fmt_price(p) -> str:
    if p is None:
        return "—"
    try:
        f = float(p)
        if f >= 100:
            return f"${f:,.0f}"
        if f >= 1:
            return f"${f:.2f}"
        if f >= 0.01:
            return f"${f:.4f}".rstrip("0").rstrip(".")
        return f"${f:.6f}".rstrip("0").rstrip(".")
    except (ValueError, TypeError):
        return "—"


def fmt_date_short(iso: str) -> str:
    """YYYY-MM-DD → 'DD MMM' (e.g. '22 May')."""
    try:
        d = datetime.fromisoformat(iso).date()
        return d.strftime("%-d %b")
    except (ValueError, TypeError):
        return iso or "—"


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def _bullets(items: list[str], cap: int = 4) -> str:
    """Render a list of bullets as a Discord-native markdown list.
    Caps at `cap` items + adds '…and N more' if over."""
    if not items:
        return ""
    if isinstance(items, str):
        items = [items]
    visible = items[:cap]
    suffix = ""
    if len(items) > cap:
        suffix = f"\n…and {len(items) - cap} more"
    return "\n".join(f"• {item}" for item in visible) + suffix


def _footer(text: str, icon_url: Optional[str] = None) -> dict:
    out = {"text": text[:2048]}
    if icon_url:
        out["icon_url"] = icon_url
    return out


# ---------------------------------------------------------------------------
# Section composers


def compose_market_sentiment(data: dict, chain_run_id: str = "") -> dict:
    """One embed summarising daily market context.

    Reads the `market_sentiment` block from perps-brief.data.json. Supports
    two shapes:

    v1 (current production):
        market_sentiment: {
            paragraphs: [str, ...],
            bias_line: str
        }

    v2 (new, after SKILL.md update lands):
        market_sentiment: {
            headline_metrics: [{label, value_top, value_bottom}, ...],
            sections:         [{label, body}, ...],
            bias_line:        str
        }

    v2 renders with inline metric fields at top + bold-labeled sub-sections
    in description (operator-approved layout 2026-05-26). v1 falls back to
    plain paragraphs.

    chain_run_id is captured for internal logging only — NOT rendered
    in the operator-facing footer (operator decision 2026-05-26: chain
    IDs are noise to the operator, daily-ops-review surfaces them for
    debugging).
    """
    date_str = data.get("date") or _now_iso()[:10]
    title = f"Perps Brief · {fmt_date_short(date_str)}"

    ms = data.get("market_sentiment", {})
    bias = ms.get("bias_line", "")

    embed: dict = {
        "color": COLORS["CONTEXT"],
        "title": title,
        "timestamp": _now_iso(),
    }

    # --- Headline metrics (v2 shape) ---
    headline_metrics = ms.get("headline_metrics") or []
    if headline_metrics:
        fields = []
        for m in headline_metrics:
            label = (m.get("label") or "").strip()
            top = (m.get("value_top") or "").strip()
            bottom = (m.get("value_bottom") or "").strip()
            value = top
            if bottom:
                value = f"{top}\n{bottom}" if top else bottom
            if label and value:
                fields.append({"name": label[:256], "value": value[:1024], "inline": True})
        if fields:
            embed["fields"] = fields[:25]

    # --- Description: prefer sections (v2), fall back to paragraphs (v1) ---
    sections = ms.get("sections") or []
    if sections:
        section_parts = []
        for s in sections:
            label = (s.get("label") or "").strip()
            body = (s.get("body") or "").strip()
            if label and body:
                section_parts.append(f"**{label}**\n{body}")
            elif body:
                section_parts.append(body)
        description = "\n\n".join(section_parts)
    else:
        # Fallback: legacy paragraphs shape
        paragraphs = ms.get("paragraphs") or []
        description = "\n\n".join(p for p in paragraphs if p)

    # --- Bias line, always bold-rendered at the bottom ---
    if bias:
        if bias.lower().startswith("bias"):
            bias_rendered = f"**{bias}**"
        else:
            bias_rendered = f"**Bias** · {bias}"
        description = (description + "\n\n" + bias_rendered) if description else bias_rendered

    embed["description"] = description[:4096]
    return embed


def compose_current_position(p: dict, chain_run_id: str = "") -> dict:
    """One embed per CURRENT POSITION (RIDE state).

    On CLOSE, use compose_outcome instead — that goes to a different
    channel and uses different colors.
    """
    ticker = p.get("ticker", "?")
    direction = p.get("direction", "?")
    fired_date = fmt_date_short(p.get("fired_date", ""))
    fired_price = p.get("fired_price")
    day_of = p.get("day_of", "?")

    call = p.get("call", "RIDE")
    if call != "RIDE":
        # Caller mis-routed — they should compose this as an outcome
        # Still produce a sane embed but warn via the description
        pass

    color = COLORS.get(direction, COLORS["CONTEXT"])

    # Compute "now" + PnL from fired_price + now_pct
    now_pct = p.get("now_pct")
    now_price_str = "—"
    if now_pct is not None and fired_price:
        try:
            fp = float(fired_price)
            if direction == "LONG":
                now_price = fp * (1 + float(now_pct) / 100.0)
            else:
                now_price = fp * (1 - float(now_pct) / 100.0)
            now_price_str = fmt_price(now_price)
        except (ValueError, TypeError):
            pass

    mae = p.get("mae_pct")
    mfe = p.get("mfe_pct")
    mae_day = p.get("mae_day_of", "?")
    mfe_day = p.get("mfe_day_of", "?")

    invalidation = p.get("invalidation", "")
    watch = p.get("watch") or ""
    thesis_note = p.get("thesis_note", "")

    # Breach warning emoji if invalidation has been breached
    breach_marker = " ⚠️" if p.get("invalidation_breached") else ""

    fields = [
        {
            "name": "Entry",
            "value": f"{fmt_price(fired_price)}\n{fired_date}",
            "inline": True,
        },
        {
            "name": "Now",
            "value": f"{now_price_str}",
            "inline": True,
        },
        {
            "name": "PnL",
            "value": f"**{fmt_pct(now_pct)}**\nvs entry",
            "inline": True,
        },
        {
            "name": "MAE",
            "value": f"{fmt_pct(mae)}\nday {mae_day}{breach_marker}",
            "inline": True,
        },
        {
            "name": "MFE",
            "value": f"{fmt_pct(mfe)}\nday {mfe_day}",
            "inline": True,
        },
        {
            "name": "Stop",
            "value": invalidation[:1024] or "—",
            "inline": True,
        },
    ]

    # Description: call + thesis_note + watch
    desc_parts = []
    desc_parts.append(f"**Call:** {call} — {thesis_note}" if thesis_note else f"**Call:** {call}")
    if watch:
        desc_parts.append(f"**Watch:** {watch}")
    description = "\n\n".join(desc_parts)

    embed = {
        "color": color,
        "title": f"{ticker} · {direction} · day {day_of}",
        "description": description[:4096],
        "fields": fields,
        "timestamp": _now_iso(),
    }
    # No footer for current-position embeds — Discord's native relative
    # timestamp ("Today at 12:12 AM") on the embed already conveys "last
    # updated." chain_run_id stays in the workflow log for debugging.
    return embed


def compose_new_position(p: dict, chain_run_id: str = "") -> dict:
    """One embed per NEW POSITION fired today."""
    ticker = p.get("ticker", "?")
    direction = p.get("direction", "?")
    horizon = p.get("horizon", "?")
    entry_zone = p.get("entry_zone") or "market"
    invalidation = p.get("invalidation", "")

    color = COLORS.get(direction, COLORS["CONTEXT"])

    thesis = p.get("thesis", [])
    if isinstance(thesis, str):
        thesis = [thesis]
    risks = p.get("risks", [])
    if isinstance(risks, str):
        risks = [risks]

    fields = [
        {
            "name": "Entry",
            "value": entry_zone[:1024],
            "inline": True,
        },
        {
            "name": "Stop",
            "value": invalidation[:1024] or "—",
            "inline": True,
        },
        {
            "name": "Horizon",
            "value": horizon,
            "inline": True,
        },
    ]

    description_parts = []
    if thesis:
        description_parts.append("**Thesis**\n" + _bullets(thesis, cap=4))
    if risks:
        description_parts.append("**Risks**\n" + _bullets(risks, cap=3))
    description = "\n\n".join(description_parts)[:4096]

    confluence_count = len(p.get("confluence_fired", []))
    footer_text = f"Fired {fmt_date_short(_now_iso()[:10])}"
    if confluence_count:
        footer_text += f" · {confluence_count} confluence criteria"

    return {
        "color": color,
        "author": {"name": "NEW POSITION"},
        "title": f"{ticker} · {direction} · {horizon}",
        "description": description,
        "fields": fields,
        "footer": _footer(footer_text),
        "timestamp": _now_iso(),
    }


def compose_watchlist(p: dict, chain_run_id: str = "") -> dict:
    """One embed per WATCHLIST entry (pending trigger)."""
    ticker = p.get("ticker", "?")
    direction = p.get("direction", "?")
    day_of = p.get("day_of_watchlist", 1)
    trigger = p.get("trigger", "")
    invalidation = p.get("invalidation", "")
    horizon = p.get("horizon")

    thesis = p.get("thesis", [])
    if isinstance(thesis, str):
        thesis = [thesis]

    fields = [
        {"name": "Trigger", "value": trigger[:1024] or "—", "inline": False},
        {"name": "Stop", "value": invalidation[:1024] or "—", "inline": False},
    ]
    if horizon:
        fields.insert(
            0, {"name": "Horizon", "value": horizon, "inline": True}
        )

    description = ""
    if thesis:
        description = "**Thesis**\n" + _bullets(thesis, cap=4)

    footer_text = f"Day {day_of} on watchlist"

    return {
        "color": COLORS["WATCHLIST"],
        "author": {"name": "WATCHLIST"},
        "title": f"{ticker} · {direction} · day {day_of}",
        "description": description[:4096],
        "fields": fields,
        "footer": _footer(footer_text),
        "timestamp": _now_iso(),
    }


def compose_outcome(closed_entry: dict, chain_run_id: str = "") -> dict:
    """One embed per closed trade. Posted to #outcomes when CLOSE fires.

    Takes a closed[] ledger entry (or the equivalent shape from
    current_positions with call=CLOSE), produces a celebratory or
    cautionary embed depending on outcome.
    """
    ticker = closed_entry.get("ticker") or closed_entry.get("asset", "?")
    direction = closed_entry.get("direction", "?")
    outcome = closed_entry.get("outcome", "NEUTRAL")
    return_pct = closed_entry.get("return_pct")
    return_vs_btc = closed_entry.get("return_vs_btc_pct")
    return_vs_eth = closed_entry.get("return_vs_eth_pct")
    mae = closed_entry.get("mae_pct")
    mfe = closed_entry.get("mfe_pct")
    horizon = closed_entry.get("horizon", "?")
    horizon_realized = closed_entry.get("horizon_realized", "?")
    fired_date = fmt_date_short(closed_entry.get("fired_date", ""))
    closed_date = fmt_date_short(closed_entry.get("closed_date", _now_iso()[:10]))
    close_reason = closed_entry.get("close_reason") or closed_entry.get("thesis_note", "")
    confluence = closed_entry.get("confluence_fired", [])
    auto_flipped = closed_entry.get("auto_flipped", False)

    # Color + emoji by outcome
    if outcome == "WIN":
        color = COLORS["WIN"]
        emoji = "✅"
        label = "WIN"
    elif outcome == "LOSS":
        color = COLORS["LOSS"]
        emoji = "❌"
        label = "LOSS"
    elif outcome == "SCARE":
        color = COLORS["SCARE"]
        emoji = "⚠️"
        label = "WIN-WITH-SCARE"
    else:
        color = COLORS["NEUTRAL_CLOSE"]
        emoji = "➖"
        label = "NEUTRAL"

    title = f"CLOSED · {ticker} {direction} · {label}"
    if auto_flipped:
        title += " (auto-flip)"

    # Compose fields
    fields = [
        {
            "name": "Held",
            "value": f"{horizon_realized}\nhorizon {horizon}",
            "inline": True,
        },
        {
            "name": "Return",
            "value": f"**{fmt_pct(return_pct)}**\nvs entry",
            "inline": True,
        },
        {
            "name": "vs BTC",
            "value": f"**{fmt_pct(return_vs_btc)}**\nvs BTC",
            "inline": True,
        },
        {
            "name": "MAE",
            "value": fmt_pct(mae),
            "inline": True,
        },
        {
            "name": "MFE",
            "value": fmt_pct(mfe),
            "inline": True,
        },
        {
            "name": "Outcome",
            "value": f"**{label}** {emoji}",
            "inline": True,
        },
    ]
    if return_vs_eth is not None:
        # Add as a 4th-row field if present
        pass  # keeping the embed simple; eth comparison is rare in our briefs

    description_parts = []
    if close_reason:
        description_parts.append(f"**Close reason:** {close_reason}")
    if confluence:
        confluence_str = ", ".join(confluence)
        description_parts.append(f"**Confluence that fired:** {confluence_str}")
    description = "\n\n".join(description_parts)[:4096]

    footer_text = f"Fired {fired_date} · Closed {closed_date}"

    return {
        "color": color,
        "author": {"name": "OUTCOME"},
        "title": title,
        "description": description,
        "fields": fields,
        "footer": _footer(footer_text),
        "timestamp": _now_iso(),
    }


def compose_weekly_summary(track_record: dict, chain_run_id: str = "") -> dict:
    """One embed per weekly track-record summary. Posted to #outcomes.

    Takes the parsed output of scripts/lib/track_record.py's
    build_track_record() result.
    """
    headline = track_record.get("headline", {})
    by_dir = track_record.get("by_direction", {})

    n_closed = headline.get("count", 0)
    n_long = headline.get("longs", 0)
    n_short = headline.get("shorts", 0)
    wins = headline.get("wins", 0)
    scares = headline.get("scares", 0)
    losses = headline.get("losses", 0)
    win_rate = headline.get("win_rate_pct")
    avg_return = headline.get("avg_return_pct")
    avg_vs_btc = headline.get("avg_return_vs_btc_pct")
    avg_holding = headline.get("avg_horizon_realized_days")

    since = track_record.get("since") or "—"

    fields = [
        {
            "name": "Closed",
            "value": f"**{n_closed}**\ntrades",
            "inline": True,
        },
        {
            "name": "Win rate",
            "value": f"**{fmt_pct(win_rate, sign=False)}**\n{wins + scares}W ({scares} SCARE) / {losses}L",
            "inline": True,
        },
        {
            "name": "Avg vs BTC",
            "value": f"**{fmt_pct(avg_vs_btc)}**\navg",
            "inline": True,
        },
        {
            "name": "LONG / SHORT",
            "value": f"{n_long} / {n_short}",
            "inline": True,
        },
        {
            "name": "Avg holding",
            "value": f"{avg_holding:.1f}d" if avg_holding is not None else "—",
            "inline": True,
        },
        {
            "name": "Since",
            "value": since,
            "inline": True,
        },
    ]

    return {
        "color": COLORS["WEEKLY"],
        "author": {"name": "WEEKLY TRACK RECORD"},
        "title": f"Track Record · since V1 lock ({since})",
        "fields": fields,
        "footer": _footer(f"V1 sample n={n_closed}"),
        "timestamp": _now_iso(),
    }
