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
    "AUDIT":         0x375a7f,   # steel blue — judgement audit
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


def _slot_suffix(slot: str) -> str:
    """Format a chain-slot tag for inclusion in a footer.

    Empty string when slot is falsy or unrecognized. Returns ' · AM run'
    / ' · PM run' otherwise. The leading separator means callers can
    safely append to any non-empty footer text.
    """
    s = (slot or "").strip().lower()
    if s in ("am", "pm"):
        return f" · {s.upper()} run"
    return ""


# ---------------------------------------------------------------------------
# Section composers


def compose_market_sentiment(
    data: dict, chain_run_id: str = "", slot: str = ""
) -> dict:
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

    # --- Bias line: render with only "Bias" bolded, body in plain text.
    # Operator-approved format: **Bias** · <body>
    # If upstream already prefixed the string with "Bias" / "Bias ·" / "Bias —",
    # strip that prefix before applying the standardized format so we don't
    # bold the entire sentence.
    if bias:
        body = bias.strip()
        low = body.lower()
        if low.startswith("bias"):
            body = body[4:].lstrip(" ·—-:").strip()
        bias_rendered = f"**Bias** · {body}" if body else "**Bias**"
        description = (description + "\n\n" + bias_rendered) if description else bias_rendered

    embed["description"] = description[:4096]
    # Slot tag in the title line — market sentiment has no footer.
    suffix = _slot_suffix(slot)
    if suffix:
        embed["title"] = f"{title}{suffix}"
    return embed


def compose_current_position(p: dict, chain_run_id: str = "", slot: str = "") -> dict:
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
    # Slot tag goes into a minimal footer when the chain slot is known.
    # Without slot, no footer — Discord's native relative timestamp
    # ("Today at 12:12 AM") on the embed already conveys "last updated."
    suffix = _slot_suffix(slot).lstrip(" ·").strip()
    if suffix:
        embed["footer"] = _footer(suffix)
    return embed


def compose_new_position(p: dict, chain_run_id: str = "", slot: str = "") -> dict:
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
    footer_text += _slot_suffix(slot)

    return {
        "color": color,
        "author": {"name": "NEW POSITION"},
        "title": f"{ticker} · {direction} · {horizon}",
        "description": description,
        "fields": fields,
        "footer": _footer(footer_text),
        "timestamp": _now_iso(),
    }


def compose_watchlist(p: dict, chain_run_id: str = "", slot: str = "") -> dict:
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

    footer_text = f"Day {day_of} on watchlist" + _slot_suffix(slot)

    return {
        "color": COLORS["WATCHLIST"],
        "author": {"name": "WATCHLIST"},
        "title": f"{ticker} · {direction} · day {day_of}",
        "description": description[:4096],
        "fields": fields,
        "footer": _footer(footer_text),
        "timestamp": _now_iso(),
    }


def _outcome_color_emoji_label(outcome: str) -> tuple[int, str, str]:
    """Map an outcome enum to (color, emoji, display_label)."""
    if outcome == "WIN":
        return COLORS["WIN"], "✅", "WIN"
    if outcome == "LOSS":
        return COLORS["LOSS"], "❌", "LOSS"
    if outcome == "SCARE":
        return COLORS["SCARE"], "⚠️", "WIN-WITH-SCARE"
    return COLORS["NEUTRAL_CLOSE"], "➖", "NEUTRAL"


def _summarise_journey(closed_entry: dict) -> str:
    """Compose a one-paragraph summary of the trade arc from MAE/MFE
    timing and notable evaluation notes. Used in the beefed-up outcome
    embed to preserve the trade story that's lost when the 24h cleanup
    deletes the CURRENT POSITION embed.
    """
    parts: list[str] = []
    mae = closed_entry.get("mae_pct")
    mfe = closed_entry.get("mfe_pct")
    mae_date = closed_entry.get("mae_date")
    mfe_date = closed_entry.get("mfe_date")
    fired_date = closed_entry.get("fired_date")
    if mae is not None and mae_date:
        try:
            d = (
                datetime.fromisoformat(mae_date).date()
                - datetime.fromisoformat(fired_date).date()
            ).days + 1
            parts.append(f"Worst drawdown {fmt_pct(mae)} on day {d}.")
        except (ValueError, TypeError):
            parts.append(f"Worst drawdown {fmt_pct(mae)}.")
    if mfe is not None and mfe_date:
        try:
            d = (
                datetime.fromisoformat(mfe_date).date()
                - datetime.fromisoformat(fired_date).date()
            ).days + 1
            parts.append(f"Peak gain {fmt_pct(mfe)} on day {d}.")
        except (ValueError, TypeError):
            parts.append(f"Peak gain {fmt_pct(mfe)}.")

    evals = closed_entry.get("evaluations") or []
    n_evals = len(evals)
    n_ride = sum(1 for e in evals if (e or {}).get("call") == "RIDE")
    if n_evals:
        parts.append(f"{n_ride}/{n_evals} evals carried RIDE.")
    return " ".join(parts)


def _notable_evals(closed_entry: dict, n: int = 2) -> list[str]:
    """Pick a small number of evaluation notes most likely to be informative
    — preferring the most recent evals + ones that flagged invalidation.
    Used in the beefed-up outcome embed."""
    evals = closed_entry.get("evaluations") or []
    if not evals:
        return []
    # Prefer evals that flagged a breach, then the most recent ones
    breach_evals = [e for e in evals if (e or {}).get("invalidation_breached_today")]
    rest = [e for e in evals if not (e or {}).get("invalidation_breached_today")]
    picked = breach_evals + list(reversed(rest))
    out: list[str] = []
    seen: set[str] = set()
    for e in picked[: n + 2]:  # over-pick then dedupe
        note = (e.get("note") or "").strip()
        if not note or note in seen:
            continue
        seen.add(note)
        date_label = fmt_date_short(e.get("date", ""))
        out.append(f"_{date_label}_: {note}")
        if len(out) >= n:
            break
    return out


def compose_outcome(closed_entry: dict, chain_run_id: str = "", slot: str = "") -> dict:
    """One embed per closed trade. Posted to #outcomes when CLOSE fires.

    Carries the FULL trade arc — watchlist provenance (if applicable),
    MAE/MFE timing, evaluation journey summary, and notable per-day
    notes. The 24h cleanup deletes the CURRENT POSITION embed in
    #perps-positions after close, so the OUTCOME embed in #perps-outcomes
    is the permanent record of the trade.
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
    watchlist_prov = closed_entry.get("watchlist_provenance") or {}

    color, emoji, label = _outcome_color_emoji_label(outcome)

    title = f"CLOSED · {ticker} {direction} · {label}"
    if auto_flipped:
        title += " (auto-flip)"

    # Compose fields — Watched (from provenance) goes in the top row when
    # we have it, providing the "lifecycle" view the operator wants.
    fields: list[dict] = []
    days_watched = watchlist_prov.get("days_on_watchlist")
    if days_watched is not None:
        fields.append({
            "name": "Watched",
            "value": f"**{int(days_watched)}d**\nbefore entry",
            "inline": True,
        })
    else:
        fields.append({
            "name": "Watched",
            "value": "—\ndirect entry",
            "inline": True,
        })
    fields.extend([
        {
            "name": "Held",
            "value": f"**{horizon_realized}**\nhorizon {horizon}",
            "inline": True,
        },
        {
            "name": "Outcome",
            "value": f"**{label}** {emoji}",
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
            "name": "vs ETH" if return_vs_eth is not None else "MAE / MFE",
            "value": (
                f"**{fmt_pct(return_vs_eth)}**\nvs ETH"
                if return_vs_eth is not None
                else f"{fmt_pct(mae)} / {fmt_pct(mfe)}"
            ),
            "inline": True,
        },
    ])
    # When vs ETH took the slot, add MAE/MFE on a second row
    if return_vs_eth is not None:
        fields.append({
            "name": "MAE / MFE",
            "value": f"{fmt_pct(mae)} / {fmt_pct(mfe)}",
            "inline": True,
        })

    # Beefed-up description: close reason + trade journey + notable evals
    desc_parts: list[str] = []
    if close_reason:
        desc_parts.append(f"**Close reason:** {close_reason}")
    journey = _summarise_journey(closed_entry)
    if journey:
        desc_parts.append(f"**Trade journey:** {journey}")
    notables = _notable_evals(closed_entry, n=2)
    if notables:
        desc_parts.append("**Notable evaluations**\n" + "\n".join(notables))
    if watchlist_prov.get("original_trigger"):
        desc_parts.append(
            f"**Watchlist origin:** {watchlist_prov['original_trigger']}"
        )
    if confluence:
        desc_parts.append(f"**Confluence:** {', '.join(confluence)}")
    description = "\n\n".join(desc_parts)[:4096]

    footer_text = f"Fired {fired_date} · Closed {closed_date}" + _slot_suffix(slot)

    return {
        "color": color,
        "author": {"name": "OUTCOME"},
        "title": title,
        "description": description,
        "fields": fields,
        "footer": _footer(footer_text),
        "timestamp": _now_iso(),
    }


def compose_closed_position(
    closed_entry: dict, chain_run_id: str = "", slot: str = ""
) -> dict:
    """Terminal-state version of the CURRENT POSITION embed.

    Used to edit the existing in-channel CURRENT POSITION embed when a
    position closes, before the 24h cleanup deletes it from
    #perps-positions. Preserves the position-card visual shape (so the
    operator's eye doesn't lose its place) but transitions to the
    outcome colour + adds a CLOSED indicator.
    """
    ticker = closed_entry.get("ticker") or closed_entry.get("asset", "?")
    direction = closed_entry.get("direction", "?")
    outcome = closed_entry.get("outcome", "NEUTRAL")
    return_pct = closed_entry.get("return_pct")
    return_vs_btc = closed_entry.get("return_vs_btc_pct")
    mae = closed_entry.get("mae_pct")
    mfe = closed_entry.get("mfe_pct")
    horizon = closed_entry.get("horizon", "?")
    horizon_realized = closed_entry.get("horizon_realized", "?")
    closed_date = fmt_date_short(closed_entry.get("closed_date", _now_iso()[:10]))
    close_reason = closed_entry.get("close_reason", "")

    color, emoji, label = _outcome_color_emoji_label(outcome)

    title = f"CLOSED · {ticker} {direction} · {label} {emoji}"

    fields = [
        {
            "name": "Held",
            "value": f"**{horizon_realized}**\nhorizon {horizon}",
            "inline": True,
        },
        {
            "name": "Return",
            "value": f"**{fmt_pct(return_pct)}**\nvs entry",
            "inline": True,
        },
        {
            "name": "vs BTC",
            "value": f"**{fmt_pct(return_vs_btc)}**",
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

    desc_parts = []
    if close_reason:
        desc_parts.append(f"**Close reason:** {close_reason}")
    desc_parts.append(
        "_This card will be removed in 24h — full outcome record is "
        "in #perps-outcomes._"
    )
    description = "\n\n".join(desc_parts)[:4096]

    footer_text = f"Closed {closed_date}" + _slot_suffix(slot)

    return {
        "color": color,
        "author": {"name": "CLOSED POSITION"},
        "title": title,
        "description": description,
        "fields": fields,
        "footer": _footer(footer_text),
        "timestamp": _now_iso(),
    }


# Watchlist terminal-state composers — used to edit the existing watchlist
# embed when an entry exits the active list (promoted, invalidated,
# decayed, or stale). The driver queues the message for 24h delete after.

WATCHLIST_TERMINAL_BADGES = {
    "promoted":       ("PROMOTED",     "🟢", "WIN"),
    "invalidated":    ("INVALIDATED",  "❌", "LOSS"),
    "thesis_decayed": ("DROPPED",      "➖", "NEUTRAL_CLOSE"),
    "stale":          ("DROPPED · stale", "➖", "NEUTRAL_CLOSE"),
}


def compose_watchlist_terminal(
    watchlist_closed_entry: dict,
    chain_run_id: str = "",
    slot: str = "",
    promoted_signal_link: str = "",
) -> dict:
    """Terminal-state version of the WATCHLIST embed.

    Used to edit the existing in-channel WATCHLIST embed when a watchlist
    entry exits (promoted to position / invalidated / dropped / stale).
    Carries Claude's close_note so the operator can see the reasoning
    before the 24h cleanup deletes the embed.
    """
    ticker = watchlist_closed_entry.get("asset", "?")
    direction = watchlist_closed_entry.get("direction", "?")
    days_watched = watchlist_closed_entry.get("days_on_watchlist", "?")
    reason = watchlist_closed_entry.get("close_reason", "stale")
    note = watchlist_closed_entry.get("close_note", "")
    promoted_to_open_id = watchlist_closed_entry.get("promoted_to_open_id")
    closed_date = fmt_date_short(
        watchlist_closed_entry.get("closed_date", _now_iso()[:10])
    )

    badge_label, badge_emoji, color_key = WATCHLIST_TERMINAL_BADGES.get(
        reason,
        ("EXITED", "—", "NEUTRAL_CLOSE"),
    )
    color = COLORS[color_key]

    title = f"{ticker} · {direction} · {badge_label} {badge_emoji}"

    fields: list[dict] = [
        {
            "name": "Watched",
            "value": f"**{days_watched}d**\nbefore exit",
            "inline": True,
        },
        {
            "name": "Exit",
            "value": f"**{badge_label}**",
            "inline": True,
        },
        {
            "name": "Exited",
            "value": closed_date,
            "inline": True,
        },
    ]
    if reason == "promoted" and promoted_to_open_id:
        fields.append({
            "name": "Promoted to",
            "value": (
                f"[{promoted_to_open_id}]({promoted_signal_link})"
                if promoted_signal_link
                else f"`{promoted_to_open_id}`"
            ),
            "inline": False,
        })

    desc_parts: list[str] = []
    if note:
        desc_parts.append(f"**{badge_label}:** {note}")
    desc_parts.append(
        "_This card will be removed in 24h — full outcome data is "
        "preserved in the ledger._"
    )
    description = "\n\n".join(desc_parts)[:4096]

    footer_text = f"Exited {closed_date}" + _slot_suffix(slot)

    return {
        "color": color,
        "author": {"name": f"WATCHLIST · {badge_label}"},
        "title": title,
        "description": description,
        "fields": fields,
        "footer": _footer(footer_text),
        "timestamp": _now_iso(),
    }


def compose_weekly_summary(
    track_record: dict, chain_run_id: str = "", slot: str = ""
) -> dict:
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
        "footer": _footer(f"V1 sample n={n_closed}" + _slot_suffix(slot)),
        "timestamp": _now_iso(),
    }


# ---------------------------------------------------------------------------
# Judgement audit — V2 validation layer
#
# Renders the output of scripts/lib/audit.py as a single embed for
# #perps-outcomes. Designed to be operator-readable at a glance, with
# the most discriminating data surfaced first.


def _fmt_pct_field(p, dash: str = "—") -> str:
    """Render a percentage with no sign for stat fields."""
    if p is None:
        return dash
    try:
        return f"{float(p):.1f}%"
    except (ValueError, TypeError):
        return dash


def _fmt_n(n) -> str:
    if n is None:
        return "—"
    try:
        return f"{int(n)}"
    except (ValueError, TypeError):
        return "—"


def _fmt_postmortem_line(pm: dict) -> str:
    """Compress one postmortem into a single-line field row.

    Layout: TICKER DIR · OUTCOME ±X% · failure/success type · setup_type
            one-sentence what_went_wrong / what_was_right
            └ top lesson (if any)
    """
    asset = pm.get("asset", "?")
    direction = pm.get("direction", "?")
    outcome = pm.get("outcome", "?")
    ret = pm.get("return_pct")
    setup = pm.get("setup_type", "")

    # Pick the categorisation tag — failure_type if loss-side, success_type
    # otherwise.
    cat = pm.get("failure_type") or pm.get("success_type") or "?"

    if outcome in ("LOSS", "SCARE", "NEUTRAL"):
        diagnosis = (pm.get("what_went_wrong") or "").strip()
    else:
        diagnosis = (pm.get("what_was_right") or "").strip()

    header = f"**{asset} {direction}** · {outcome} {fmt_pct(ret)} · {cat}"
    if setup:
        header += f" · {setup}"

    parts = [header]
    if diagnosis:
        parts.append(diagnosis[:500])
    lessons = pm.get("lessons") or []
    if lessons:
        top = (lessons[0] or "").strip()
        if top:
            parts.append(f"└ {top[:300]}")
    return "\n".join(parts)


def compose_judgement_audit(
    stats: dict,
    window: str = "30d",
    chain_run_id: str = "",
    slot: str = "",
    narrative: str = "",
    insights: Optional[list] = None,
    postmortems: Optional[list] = None,
    regime_observations: Optional[list] = None,
) -> list[dict]:
    """Compose the judgement-audit message as a LIST of embeds.

    Returns 1 or 2 embeds depending on whether Claude analysis is present:
      - Stats-only mode (no narrative/insights/postmortems): single embed
        with all stat fields.
      - Full audit mode: two embeds.
          Embed 1: stats fields only (no description) — fits well under
            Discord's 6000-char total limit.
          Embed 2: Claude analysis — narrative + insights + regime
            backdrop in description, top winners/losers postmortems
            as fields.

    Splitting is necessary because Claude-narrative + insights + 3+
    postmortems + the full stats block routinely exceeds Discord's
    6000-char/embed cap (observed 7203 chars in production 2026-05-30).
    Splitting also gives the operator a visual separation between
    'numbers' and 'analysis'.

    Args:
        stats: full stats artifact (dict with 'windows' keyed by window name)
        window: which window to feature (default '30d'). Must exist in stats.
        narrative: optional Claude-written synthesis paragraph
        insights: optional list of Claude-identified insights
        postmortems: optional list of per-trade postmortems produced by
            the judgement-audit skill. Each dict carries trade_id, asset,
            direction, outcome, return_pct, failure_type | success_type,
            setup_type, what_went_wrong | what_was_right, lessons[].
        regime_observations: optional list of macro regime observations
            for the audit window.
    """
    windows = stats.get("windows") or {}
    w_stats = windows.get(window) or {}
    if not w_stats:
        # Fall back to any available window
        w_stats = next(iter(windows.values()), {})
        if not w_stats:
            return [{
                "color": COLORS["AUDIT"],
                "title": "Judgement Audit · no data",
                "description": "No closed trades within the audit window.",
                "timestamp": _now_iso(),
            }]

    headline = w_stats.get("headline", {})
    by_dir = w_stats.get("by_direction", {})
    by_hor = w_stats.get("by_horizon", {})
    by_crit = w_stats.get("by_criterion", []) or []
    wl_funnel = w_stats.get("watchlist_funnel", {})
    auto_flips = w_stats.get("auto_flips", {})
    time_to = w_stats.get("time_to_outcome", {})

    since = w_stats.get("since") or "—"
    to = w_stats.get("to") or "—"

    n_closed = headline.get("n_closed", 0)
    win_rate = headline.get("win_rate_pct")
    clean_win_rate = headline.get("clean_win_rate_pct")
    avg_return = headline.get("avg_return_pct")
    avg_return_btc = headline.get("avg_return_vs_btc_pct")
    max_dd = headline.get("max_drawdown_pct")
    best = headline.get("best_trade") or {}
    worst = headline.get("worst_trade") or {}

    title = f"Judgement Audit · {window} window · n={n_closed}"

    # --- Headline metrics (inline fields)
    fields: list[dict] = [
        {
            "name": "Closed",
            "value": f"**{n_closed}**\ntrades",
            "inline": True,
        },
        {
            "name": "Win rate",
            "value": (
                f"**{_fmt_pct_field(win_rate)}**\n"
                f"clean {_fmt_pct_field(clean_win_rate)}"
            ),
            "inline": True,
        },
        {
            "name": "Avg return",
            "value": (
                f"**{fmt_pct(avg_return)}**\nvs entry\n"
                f"{fmt_pct(avg_return_btc)} vs BTC"
            ),
            "inline": True,
        },
        {
            "name": "Best trade",
            "value": (
                f"**{best.get('asset', '—')}** {best.get('direction', '')}\n"
                f"{fmt_pct(best.get('return_pct'))}"
                if best.get("asset")
                else "—"
            ),
            "inline": True,
        },
        {
            "name": "Worst trade",
            "value": (
                f"**{worst.get('asset', '—')}** {worst.get('direction', '')}\n"
                f"{fmt_pct(worst.get('return_pct'))}"
                if worst.get("asset")
                else "—"
            ),
            "inline": True,
        },
        {
            "name": "Max drawdown",
            "value": f"**{fmt_pct(max_dd)}**\nMAE (worst day)",
            "inline": True,
        },
    ]

    # --- By direction
    long_s = by_dir.get("LONG", {}) or {}
    short_s = by_dir.get("SHORT", {}) or {}
    fields.append({
        "name": "Direction breakdown",
        "value": (
            f"**LONG** n={_fmt_n(long_s.get('n'))} · "
            f"wr {_fmt_pct_field(long_s.get('win_rate_pct'))} · "
            f"avg {fmt_pct(long_s.get('avg_return_pct'))}\n"
            f"**SHORT** n={_fmt_n(short_s.get('n'))} · "
            f"wr {_fmt_pct_field(short_s.get('win_rate_pct'))} · "
            f"avg {fmt_pct(short_s.get('avg_return_pct'))}"
        ),
        "inline": False,
    })

    # --- By horizon
    horizon_lines = []
    for h in ("24h", "3d", "7d", "multi-week"):
        s = by_hor.get(h, {}) or {}
        n = s.get("n", 0) or 0
        if n == 0:
            continue
        horizon_lines.append(
            f"**{h}** n={n} · wr {_fmt_pct_field(s.get('win_rate_pct'))} · "
            f"avg {fmt_pct(s.get('avg_return_pct'))}"
        )
    if horizon_lines:
        fields.append({
            "name": "Horizon breakdown",
            "value": "\n".join(horizon_lines),
            "inline": False,
        })

    # --- Top criteria by edge (excluding zero-fired)
    surfaced = [c for c in by_crit if (c.get("n_fired") or 0) >= 1][:6]
    if surfaced:
        lines = []
        for c in surfaced:
            crit = c["criterion"]
            n_f = c.get("n_fired", 0)
            wr_f = c.get("win_rate_when_fired_pct")
            edge = c.get("edge_pct")
            wr_m = c.get("win_rate_when_missing_pct")
            edge_str = (
                f"edge **{edge:+.1f}**"
                if edge is not None
                else "edge —"
            )
            lines.append(
                f"`{crit}`  n={n_f}  "
                f"fired {_fmt_pct_field(wr_f)} / "
                f"missing {_fmt_pct_field(wr_m)} · {edge_str}"
            )
        fields.append({
            "name": "Top confluence criteria by edge",
            "value": "\n".join(lines)[:1024],
            "inline": False,
        })

    # --- Watchlist funnel
    n_total = wl_funnel.get("n_total", 0) or 0
    if n_total > 0:
        promoted_outcomes = wl_funnel.get("promoted_position_outcomes") or {}
        lines = [
            f"**Added:** {n_total}",
            f"**Promoted:** {wl_funnel.get('n_promoted', 0)} "
            f"({_fmt_pct_field(wl_funnel.get('promote_rate_pct'))})  •  "
            f"**Invalidated:** {wl_funnel.get('n_invalidated', 0)} "
            f"({_fmt_pct_field(wl_funnel.get('invalidation_rate_pct'))})  •  "
            f"**Decayed:** {wl_funnel.get('n_thesis_decayed', 0)}  •  "
            f"**Stale:** {wl_funnel.get('n_stale', 0)}",
        ]
        if promoted_outcomes.get("n_resolved", 0) > 0:
            lines.append(
                f"**Promoted → resolved positions:** "
                f"{promoted_outcomes.get('n_wins', 0)}W / "
                f"{promoted_outcomes.get('n_losses', 0)}L "
                f"(win rate {_fmt_pct_field(promoted_outcomes.get('win_rate_pct'))})"
            )
        fields.append({
            "name": "Watchlist funnel",
            "value": "\n".join(lines)[:1024],
            "inline": False,
        })

    # --- Auto-flips + time-to-outcome (compact tail field)
    tail_parts = []
    n_flips = auto_flips.get("n", 0) or 0
    if n_flips > 0:
        tail_parts.append(
            f"**Auto-flips:** {n_flips} fired · "
            f"followup win rate {_fmt_pct_field(auto_flips.get('followup_win_rate_pct'))}"
        )
    if time_to.get("median_days_win") is not None:
        tail_parts.append(
            f"**Median days to:** WIN {time_to.get('median_days_win')}d · "
            f"LOSS {time_to.get('median_days_loss')}d · "
            f"SCARE {time_to.get('median_days_scare') or '—'}d"
        )
    if tail_parts:
        fields.append({
            "name": "Trade tempo",
            "value": "\n".join(tail_parts),
            "inline": False,
        })

    footer_text = (
        f"Window {window} · {since} → {to}" + _slot_suffix(slot)
    )

    # --- Embed 1: stats (no description — keeps it well under 6000 chars)
    stats_embed = {
        "color": COLORS["AUDIT"],
        "author": {"name": "JUDGEMENT AUDIT"},
        "title": title,
        "fields": fields,
        "footer": _footer(footer_text),
        "timestamp": _now_iso(),
    }

    # If no Claude analysis was provided, stop here (stats-only mode).
    has_analysis = bool(narrative or insights or postmortems or regime_observations)
    if not has_analysis:
        return [stats_embed]

    # --- Embed 2: Claude analysis prose (narrative + regime + insights)
    #
    # Description-heavy embed; no fields. Production data 2026-05-30 showed
    # Claude routinely writes ~4000 chars of analysis (narrative + 5 regime
    # observations + 5 insights), which combined with 2 postmortem fields
    # (1024 each) blew past the 6000 cap. Splitting prose and postmortems
    # into separate embeds gives each room to breathe.
    desc_parts: list[str] = []
    if narrative:
        desc_parts.append(narrative.strip())
    if regime_observations:
        regime_block = "\n".join(
            f"• {o.strip()}" for o in regime_observations if (o or "").strip()
        )
        if regime_block:
            desc_parts.append("**Regime backdrop**\n" + regime_block)
    if insights:
        bullet_block = "\n".join(
            f"• {i.strip()}" for i in insights if (i or "").strip()
        )
        if bullet_block:
            desc_parts.append("**Key insights**\n" + bullet_block)
    analysis_description = ("\n\n".join(desc_parts))[:4096]

    analysis_embed = {
        "color": COLORS["AUDIT"],
        "author": {"name": "JUDGEMENT AUDIT · analysis"},
        "title": f"Analysis · {window}",
        "description": analysis_description,
        "footer": _footer(footer_text),
        "timestamp": _now_iso(),
    }

    out = [stats_embed, analysis_embed]

    # --- Embed 3: per-trade postmortems
    #
    # Always its own embed when Claude produced any. Two fields max
    # (winners, losers), each 1024 chars — total well under 6000.
    if postmortems:
        winners = [p for p in postmortems if p.get("outcome") in ("WIN", "SCARE")]
        losers = [p for p in postmortems if p.get("outcome") in ("LOSS", "NEUTRAL")]
        pm_fields: list[dict] = []
        if winners:
            rendered = "\n\n".join(_fmt_postmortem_line(p) for p in winners[:3])
            pm_fields.append({
                "name": "Top winners — postmortem",
                "value": rendered[:1024],
                "inline": False,
            })
        if losers:
            rendered = "\n\n".join(_fmt_postmortem_line(p) for p in losers[:3])
            pm_fields.append({
                "name": "Top losers — postmortem",
                "value": rendered[:1024],
                "inline": False,
            })
        if pm_fields:
            postmortem_embed = {
                "color": COLORS["AUDIT"],
                "author": {"name": "JUDGEMENT AUDIT · postmortems"},
                "title": f"Postmortems · {window}",
                "fields": pm_fields,
                "footer": _footer(footer_text),
                "timestamp": _now_iso(),
            }
            out.append(postmortem_embed)

    return out


# ---------------------------------------------------------------------------
# Daily ops review — operator self-monitoring
#
# Renders the daily-ops-review skill's markdown artifact as a single
# embed for the unified #aeon-ops developer channel. Same channel
# receives judgement-audit output (see channel routing in
# scripts/embed-judgement-audit.py).


import re as _re_ops


def _count_glyphs(text: str) -> tuple[int, int, int]:
    """Count ✓ ⚠ ✗ glyph markers in the ops-review markdown body.

    Prefers parsing the explicit summary line the skill writes (which
    has the canonical counts), e.g. "10 ✓, 0 ⚠, 0 ✗". Falls back to
    counting status-line glyphs only (lines starting with whitespace +
    glyph) so the "0 ⚠" / "0 ✗" tokens inside the summary line don't
    inflate the warn/err counts.
    """
    summary = _re_ops.search(
        r"(\d+)\s*✓\s*,\s*(\d+)\s*⚠\s*,\s*(\d+)\s*✗",
        text,
    )
    if summary:
        return (
            int(summary.group(1)),
            int(summary.group(2)),
            int(summary.group(3)),
        )
    # Fallback: count only status-line glyphs (lines that START with
    # whitespace + glyph). This excludes the summary line which embeds
    # the numbers inside a sentence, and excludes prose mentions.
    ok = warn = err = 0
    for line in text.splitlines():
        s = line.lstrip()
        if s.startswith("✓"):
            ok += 1
        elif s.startswith("⚠"):
            warn += 1
        elif s.startswith("✗"):
            err += 1
    return ok, warn, err


def _ops_color(n_ok: int, n_warn: int, n_err: int) -> int:
    """Pick a color based on overall ops health.
      err > 0 → LOSS red
      warn > 0 → SCARE amber
      otherwise → WIN green
    """
    if n_err > 0:
        return COLORS["LOSS"]
    if n_warn > 0:
        return COLORS["SCARE"]
    return COLORS["WIN"]


def compose_daily_ops_review(
    markdown_text: str,
    date_str: str = "",
    chain_run_id: str = "",
    slot: str = "",
) -> list[dict]:
    """Compose the daily-ops-review markdown as a single embed.

    Returns a list of embeds (1 element) for consistency with the other
    composers — the driver iterates the list and posts each embed.

    Args:
        markdown_text: contents of .outputs/daily-ops-review.md
        date_str: optional date label (defaults to today UTC)
        chain_run_id, slot: routing context (footer)
    """
    body = (markdown_text or "").strip()
    if not body:
        return [{
            "color": COLORS["NEUTRAL_CLOSE"],
            "author": {"name": "AEON OPS"},
            "title": "Daily Ops Review · no content",
            "description": "Skill produced no artifact body.",
            "timestamp": _now_iso(),
        }]

    n_ok, n_warn, n_err = _count_glyphs(body)
    color = _ops_color(n_ok, n_warn, n_err)

    # Title prefers an explicit date_str, else parse the first line
    # of the markdown which the skill writes as "Ops Review · {date} · ...".
    title = ""
    first_line = body.split("\n", 1)[0].strip()
    if first_line.lower().startswith("ops review"):
        title = first_line
    if not title:
        date_label = fmt_date_short(date_str or _now_iso()[:10])
        title = f"Daily Ops Review · {date_label}"

    # Description = the markdown body, capped at 4096. The skill writes
    # an artifact that's already operator-readable; we pass it through
    # verbatim. Strip the title line if we hoisted it into the embed
    # title so we don't double-print.
    body_for_desc = body
    if title == first_line:
        body_for_desc = body.split("\n", 1)[1].lstrip() if "\n" in body else ""
    description = body_for_desc[:4096]

    fields = [
        {
            "name": "Chain health",
            "value": (
                f"✓ **{n_ok}** ok"
                + (f" · ⚠ **{n_warn}** warn" if n_warn else "")
                + (f" · ✗ **{n_err}** error" if n_err else "")
            ),
            "inline": False,
        },
    ]

    footer_text = ""
    if chain_run_id:
        footer_text = f"chain run {chain_run_id}"
    footer_text += _slot_suffix(slot)

    embed: dict = {
        "color": color,
        "author": {"name": "AEON OPS · daily review"},
        "title": title,
        "description": description,
        "fields": fields,
        "timestamp": _now_iso(),
    }
    if footer_text:
        embed["footer"] = _footer(footer_text.strip(" ·"))

    return [embed]


# ---------------------------------------------------------------------------
# Engine poller summary — Path B PR2
#
# Posted to #aeon-ops every poll cycle that has at least one fire. Lists
# fired conditions per asset with the metric reading, the condition's
# threshold, and the proposed action. PR2 takes no actions — this is
# purely diagnostic to validate which conditions actually fire before
# enabling PR3's Claude-confirmation execution.


def _format_metric_value(metric_key: str, value) -> str:
    """Render a metric value in its natural unit for the summary embed."""
    if value is None:
        return "—"
    try:
        v = float(value)
    except (TypeError, ValueError):
        return str(value)
    if metric_key in ("funding", "basis"):
        return f"{v * 100:.4f}%"  # rates rendered as %
    if metric_key in (
        "pct_24h_pct", "oi_change_24h_pct",
        "taker_buy_pct",
    ):
        return f"{v:.2f}%"
    if metric_key in ("vol_ratio",):
        return f"{v:.2f}×"
    if metric_key in ("lsr", "lsr_delta_7d"):
        return f"{v:.3f}"
    if metric_key in ("price",):
        return fmt_price(v)
    if metric_key in ("oi",):
        if abs(v) >= 1e9:
            return f"${v / 1e9:.2f}B"
        if abs(v) >= 1e6:
            return f"${v / 1e6:.2f}M"
        return f"${v:,.0f}"
    return f"{v:g}"


def _action_emoji(action: str) -> str:
    return {
        "exit":  "📉",
        "enter": "📈",
        "drop":  "🗑",
        "alert": "🔔",
    }.get(action or "alert", "🔔")


def compose_poller_summary(
    fires: list,
    n_scanned_conditions: int,
    n_scanned_assets: int,
    n_in_cooldown: int = 0,
    n_missing_data: int = 0,
    chain_run_id: str = "",
    slot: str = "",
) -> list[dict]:
    """Compose the hourly poller summary embed.

    Args:
        fires: list of dicts with keys:
            asset, direction, entity ("open" or "watchlist"),
            entity_id, condition_index, condition (the full dict),
            current_value
        n_scanned_conditions: total conditions evaluated this cycle
        n_scanned_assets: distinct assets the conditions cover
        n_in_cooldown: conditions skipped due to cooldown
        n_missing_data: conditions where the metric was unavailable

    Returns a list of embeds (single element). Posted to #aeon-ops.
    """
    n_fired = len(fires)

    # Color signals severity of the highest-severity fire
    has_critical = any((f["condition"].get("severity") == "critical") for f in fires)
    has_warning = any((f["condition"].get("severity") == "warning") for f in fires)
    if has_critical:
        color = COLORS["LOSS"]
    elif has_warning:
        color = COLORS["SCARE"]
    elif n_fired:
        color = COLORS["NEUTRAL_CLOSE"]
    else:
        color = COLORS["WIN"]  # quiet hour

    title = (
        f"Engine Poll · {n_fired} fire(s)" if n_fired else "Engine Poll · quiet"
    )

    fields: list[dict] = [
        {
            "name": "Scan summary",
            "value": (
                f"Conditions evaluated: **{n_scanned_conditions}**\n"
                f"Assets covered: **{n_scanned_assets}**\n"
                f"In cooldown: **{n_in_cooldown}** · "
                f"Missing data: **{n_missing_data}**\n"
                f"Fired: **{n_fired}**"
            ),
            "inline": False,
        },
    ]

    # Group fires by asset for readability
    by_asset: dict[str, list] = {}
    for f in fires:
        by_asset.setdefault(f["asset"], []).append(f)

    for asset, asset_fires in by_asset.items():
        lines = []
        for f in asset_fires[:6]:  # cap per-asset fires shown
            cond = f["condition"]
            metric_key, _ = _CONDITION_MAP_FOR_EMBED.get(
                cond.get("type"), (None, None)
            )
            value_str = _format_metric_value(metric_key, f.get("current_value"))
            threshold_str = _format_metric_value(metric_key, cond.get("threshold"))
            severity = cond.get("severity", "warning")
            action = cond.get("action", "alert")
            label = cond.get("trigger_label", cond.get("type", "?"))
            entity_marker = (
                "OPEN" if f.get("entity") == "open" else "WATCH"
            )
            lines.append(
                f"{_action_emoji(action)} `{label[:60]}`\n"
                f"   {cond.get('type', '?')}: **{value_str}** vs threshold {threshold_str} "
                f"· {severity} · {action} · {entity_marker}"
            )
        if len(asset_fires) > 6:
            lines.append(f"…and {len(asset_fires) - 6} more on {asset}")
        # Direction tag from the first fire (positions are direction-tagged)
        direction = asset_fires[0].get("direction") or ""
        name = f"{asset}" + (f" {direction}" if direction else "")
        fields.append({
            "name": name,
            "value": "\n".join(lines)[:1024],
            "inline": False,
        })

    if not n_fired:
        fields.append({
            "name": "All conditions held",
            "value": "No fires this cycle. Engine watchers nominal.",
            "inline": False,
        })

    description_parts = []
    if n_fired:
        description_parts.append(
            "Path B PR2 is read-only — this summary is diagnostic. "
            "No ledger changes, no embeds posted to perps channels. "
            "PR3 will add Claude-confirmation execution on fires."
        )
    description = "\n\n".join(description_parts)

    footer_text = ""
    if chain_run_id:
        footer_text = f"poll run {chain_run_id}"
    footer_text += _slot_suffix(slot)

    embed: dict = {
        "color": color,
        "author": {"name": "ENGINE POLL"},
        "title": title,
        "description": description,
        "fields": fields,
        "timestamp": _now_iso(),
    }
    if footer_text:
        embed["footer"] = _footer(footer_text.strip(" ·"))

    return [embed]


# Local copy of the condition-type → metric mapping for use in embed
# rendering (lib/condition_evaluator.py owns the canonical map). Listed
# here so embeds.py doesn't import condition_evaluator (avoids any
# circular-import risk at the module level).
_CONDITION_MAP_FOR_EMBED: dict[str, tuple[str, str]] = {
    "price_close_above":      ("price",            ">="),
    "price_close_below":      ("price",            "<="),
    "funding_above":          ("funding",          ">"),
    "funding_below":          ("funding",          "<"),
    "oi_change_above_pct":    ("oi_change_24h_pct", ">"),
    "oi_change_below_pct":    ("oi_change_24h_pct", "<"),
    "lsr_above":              ("lsr",              ">"),
    "lsr_below":              ("lsr",              "<"),
    "lsr_delta_above":        ("lsr_delta_7d",     ">"),
    "lsr_delta_below":        ("lsr_delta_7d",     "<"),
    "taker_buy_above_pct":    ("taker_buy_pct",    ">"),
    "taker_buy_below_pct":    ("taker_buy_pct",    "<"),
    "basis_above":            ("basis",            ">"),
    "basis_below":            ("basis",            "<"),
    "volume_ratio_above":     ("vol_ratio",        ">"),
}
