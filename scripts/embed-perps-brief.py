#!/usr/bin/env python3
"""Discord bot embed driver for perps-brief — Stage 3 (edit-in-place).

Delivers perps-brief signals to the five-channel Discord layout, using
edit-in-place semantics for entities that persist (market sentiment,
current positions, watchlist) and fresh posts for one-off events (new
positions, outcomes, weekly summary).

Channel routing (read from env):
  DISCORD_BOT_CHANNEL_PERPS_CONTEXT      market sentiment (edit-in-place)
  DISCORD_BOT_CHANNEL_PERPS_POSITIONS    current positions (edit-in-place,
                                          24h-delete-on-close)
  DISCORD_BOT_CHANNEL_PERPS_SIGNALS      new positions (fresh, event log)
  DISCORD_BOT_CHANNEL_PERPS_WATCHLIST    watchlist entries (edit-in-place,
                                          24h-delete-on-exit)
  DISCORD_BOT_CHANNEL_PERPS_OUTCOMES     closed-trade outcomes (fresh,
                                          event log)

Tracker file: memory/topics/state/bot-messages.json
  Persists Discord message IDs across runs so the driver can EDIT
  existing embeds instead of POSTing fresh duplicates. See
  scripts/lib/bot_messages.py for the schema.

Behaviour summary by run:
  1. Cleanup queue — delete any messages whose 24h deadline has passed.
  2. Market sentiment:
        - AM run → POST fresh; record in tracker.
        - PM run with today's AM record → EDIT existing.
        - Else → POST fresh.
  3. New positions (data.new_positions) → POST to #signals AND POST to
     #positions; record positions tracker.
  4. Current positions (data.current_positions, call == RIDE) → EDIT in
     #positions if tracker has prior, else POST.
  5. Closes (data.current_positions, call == CLOSE) →
        - POST OUTCOME embed to #outcomes (event log)
        - If tracker has the CURRENT POSITION embed in #positions, EDIT
          it to terminal CLOSED state + queue 24h delete; remove from
          tracker.open[].
  6. Watchlist (data.watchlist) → EDIT in #watchlist if tracker has prior,
     else POST.
  7. Watchlist exits (in tracker.watchlist but not in data.watchlist) →
     find matching ledger.watchlist_closed[] entry, EDIT the embed to
     terminal state (PROMOTED/INVALIDATED/DROPPED), queue 24h delete,
     remove from tracker.watchlist[].

Modes:
  --dry-run    Print embed JSON + edit/post intentions to stderr; no API.
  --live       POST/EDIT/DELETE for real. Requires DISCORD_BOT_TOKEN env.
  (default)    --dry-run is the safe default.

Best-effort delivery: failures warn but don't abort. The webhook path
keeps firing in parallel until it's retired.

Exit codes:
  0 — completed (live or dry-run; partial failures warned, not raised)
  1 — script error / fatal config
  2 — schema or data error in perps-brief.data.json
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import bot_messages as BM  # noqa: E402
from lib import discord_bot as DB  # noqa: E402
from lib import embeds as E  # noqa: E402
from lib import ledger as L  # noqa: E402


DATA_JSON = Path(".outputs/perps-brief.data.json")
CLEANUP_DELAY_HOURS = 24


# ---------------------------------------------------------------------------
# Logging helpers


def warn(msg: str) -> None:
    sys.stderr.write(f"embed-perps-brief: WARN {msg}\n")


def info(msg: str) -> None:
    print(f"embed-perps-brief: {msg}")


def fail(msg: str, code: int) -> None:
    sys.stderr.write(f"embed-perps-brief: ERROR {msg}\n")
    sys.exit(code)


# ---------------------------------------------------------------------------
# Setup helpers


def resolve_channels(dry_run: bool = False) -> dict:
    """Read channel IDs from env. Returns {label: channel_id} for the five
    canonical channels. In dry-run, missing channels get mocks so
    composition still proceeds for design review."""
    raw = {
        "context":   os.environ.get("DISCORD_BOT_CHANNEL_PERPS_CONTEXT", ""),
        "positions": os.environ.get("DISCORD_BOT_CHANNEL_PERPS_POSITIONS", ""),
        "signals":   os.environ.get("DISCORD_BOT_CHANNEL_PERPS_SIGNALS", ""),
        "watchlist": os.environ.get("DISCORD_BOT_CHANNEL_PERPS_WATCHLIST", ""),
        "outcomes":  os.environ.get("DISCORD_BOT_CHANNEL_PERPS_OUTCOMES", ""),
    }
    if dry_run:
        for k, v in raw.items():
            if not v:
                raw[k] = f"MOCK-CHANNEL-{k.upper()}"
    return raw


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def cleanup_deadline_iso() -> str:
    return (
        datetime.now(timezone.utc) + timedelta(hours=CLEANUP_DELAY_HOURS)
    ).strftime("%Y-%m-%dT%H:%M:%SZ")


# ---------------------------------------------------------------------------
# Result tracking — every Discord op (POST/EDIT/DELETE) records a result
# row. Driver prints a summary at the end.


def _record_result(results: list, label: str, op: str, **kwargs) -> None:
    row = {"label": label, "op": op}
    row.update(kwargs)
    results.append(row)


def safe_post(
    bot: DB.DiscordBot,
    channel_id: str,
    embed: dict,
    label: str,
    results: list,
) -> str | None:
    """POST an embed. Returns message_id on success, None on failure."""
    if not channel_id:
        warn(f"no channel ID for POST {label} — skipping")
        _record_result(results, label, "post", skipped=True, reason="no channel")
        return None
    try:
        r = bot.post_embed(channel_id=channel_id, embeds=embed)
        mid = r["message_id"]
        info(f"POST {label} → {channel_id} (msg {mid})")
        _record_result(results, label, "post", message_id=mid, channel_id=channel_id)
        return mid
    except DB.DiscordError as e:
        warn(f"POST {label} → {channel_id} failed: {e}")
        _record_result(results, label, "post", error=str(e))
        return None


def safe_edit(
    bot: DB.DiscordBot,
    channel_id: str,
    message_id: str,
    embed: dict,
    label: str,
    results: list,
) -> str | None:
    """EDIT an embed. Returns message_id on success.

    Special handling: if Discord returns 404 (message deleted by operator
    or never existed), the caller is expected to fall back to POST. We
    re-raise DiscordNotFoundError here so the caller can catch it
    distinctly from other failures.
    """
    if not channel_id:
        warn(f"no channel ID for EDIT {label} — skipping")
        _record_result(results, label, "edit", skipped=True, reason="no channel")
        return None
    try:
        r = bot.edit_embed(
            channel_id=channel_id, message_id=message_id, embeds=embed
        )
        info(f"EDIT {label} → {channel_id}/{message_id}")
        _record_result(results, label, "edit", message_id=r["message_id"])
        return r["message_id"]
    except DB.DiscordNotFoundError:
        info(f"EDIT {label}: message gone (404), will fall back to POST")
        _record_result(results, label, "edit", recovered_from_404=True)
        raise
    except DB.DiscordError as e:
        warn(f"EDIT {label} → {channel_id}/{message_id} failed: {e}")
        _record_result(results, label, "edit", error=str(e))
        return None


def safe_delete(
    bot: DB.DiscordBot,
    channel_id: str,
    message_id: str,
    label: str,
    results: list,
) -> bool:
    """DELETE a message. Returns True on success or if already gone (404)."""
    if not channel_id:
        warn(f"no channel ID for DELETE {label} — skipping")
        _record_result(results, label, "delete", skipped=True, reason="no channel")
        return False
    try:
        bot.delete_message(channel_id=channel_id, message_id=message_id)
        info(f"DELETE {label} → {channel_id}/{message_id}")
        _record_result(results, label, "delete", message_id=message_id)
        return True
    except DB.DiscordNotFoundError:
        # Already gone — treat as success
        info(f"DELETE {label}: already gone (404)")
        _record_result(results, label, "delete", already_gone=True)
        return True
    except DB.DiscordError as e:
        warn(f"DELETE {label} → {channel_id}/{message_id} failed: {e}")
        _record_result(results, label, "delete", error=str(e))
        return False


# ---------------------------------------------------------------------------
# Stage 0 — Cleanup queue


def run_cleanup_queue(
    bot: DB.DiscordBot, tracker: dict, channels: dict, results: list
) -> None:
    """Delete messages whose 24h deadline has passed."""
    due = BM.take_due_cleanups(tracker)
    if not due:
        info("cleanup queue: nothing due")
        return
    info(f"cleanup queue: {len(due)} message(s) due for deletion")
    for entry in due:
        channel_label = entry.get("channel", "?")
        channel_id = channels.get(channel_label, "")
        msg_id = entry.get("message_id", "")
        label = f"cleanup:{entry.get('label', '?')}"
        ok = safe_delete(bot, channel_id, msg_id, label, results)
        if not ok:
            # Re-queue with a small extra delay so it doesn't get retried
            # on every single run if Discord is having issues.
            entry["delete_after_utc"] = (
                datetime.now(timezone.utc) + timedelta(hours=1)
            ).strftime("%Y-%m-%dT%H:%M:%SZ")
            tracker["stale_cleanup"].append(entry)


# ---------------------------------------------------------------------------
# Stage 1 — Market sentiment (edit-in-place semantics)


def handle_market_sentiment(
    bot: DB.DiscordBot,
    tracker: dict,
    channels: dict,
    data: dict,
    slot: str,
    chain_run_id: str,
    results: list,
) -> None:
    today = data.get("date") or now_iso()[:10]
    embed = E.compose_market_sentiment(data, chain_run_id=chain_run_id, slot=slot)
    prior = BM.get_market_sentiment_for_today(tracker, today)

    if prior:
        info(
            f"market sentiment: today's embed already posted "
            f"(slot={prior.get('slot')}) — editing in place"
        )
        try:
            safe_edit(
                bot,
                channels["context"],
                prior["message_id"],
                embed,
                "market_sentiment:edit",
                results,
            )
            # Update tracker slot to reflect the latest edit
            BM.record_market_sentiment(
                tracker, prior["message_id"], slot, posted_date=today
            )
            # NOTE: record_market_sentiment overwrites posted_at_utc,
            # which is fine — we want to know when the latest edit was.
            return
        except DB.DiscordNotFoundError:
            # Fall through to fresh POST
            warn("market sentiment edit hit 404 — posting fresh instead")

    # Fresh post (AM, or PM with no prior)
    msg_id = safe_post(
        bot, channels["context"], embed, "market_sentiment:post", results
    )
    if msg_id:
        BM.record_market_sentiment(tracker, msg_id, slot, posted_date=today)


# ---------------------------------------------------------------------------
# Stage 2 — Current positions (edit-in-place + close handling)


def _find_open_ledger_entry_by_asset(ledger: dict, asset: str) -> dict | None:
    asset = (asset or "").upper()
    for e in ledger.get("open", []):
        if e.get("asset", "").upper() == asset:
            return e
    return None


def _find_closed_ledger_entry_by_asset(
    ledger: dict, asset: str, closed_today: str
) -> dict | None:
    """Find a closed[] entry for `asset` that closed on `closed_today`.
    Used to enrich the OUTCOME embed with the full trade arc the data.json
    summary omits (evaluations[], watchlist_provenance, etc.)."""
    asset = (asset or "").upper()
    for e in reversed(ledger.get("closed", [])):
        if (
            e.get("asset", "").upper() == asset
            and e.get("closed_date") == closed_today
        ):
            return e
    return None


def handle_current_positions_and_closes(
    bot: DB.DiscordBot,
    tracker: dict,
    channels: dict,
    data: dict,
    ledger: dict,
    slot: str,
    chain_run_id: str,
    results: list,
) -> None:
    """Iterate the brief's current_positions list. RIDE entries edit-in-place
    (or first-time POST). CLOSE entries fire the OUTCOME embed in #outcomes
    AND transition the existing position embed in #positions to its
    terminal CLOSED state, queueing 24h delete."""
    today = data.get("date") or now_iso()[:10]
    positions = data.get("current_positions", []) or []

    for p in positions:
        asset = (p.get("ticker") or p.get("asset", "")).upper()
        # Resolve the matching ledger.open[] (for RIDE) or ledger.closed[]
        # (for CLOSE) entry to get the canonical id.
        if p.get("call") == "CLOSE":
            # The position closed THIS run. Look it up in ledger.closed[]
            # (apply-ledger-ops already moved it before we run).
            closed_entry = _find_closed_ledger_entry_by_asset(ledger, asset, today)
            # Compose a rich entry by merging data + ledger when possible.
            # The data.json brief carries the operator-facing summary; the
            # ledger carries the full evaluations / watchlist provenance.
            merged = dict(p)
            if closed_entry:
                # Pull in fields that aren't typically in data.json's
                # current_positions[] payload but matter for the outcome
                # composer.
                for k in (
                    "evaluations",
                    "watchlist_provenance",
                    "mae_date",
                    "mfe_date",
                    "fired_date",
                    "fired_price",
                    "auto_flipped",
                    "outcome",
                    "horizon",
                    "horizon_realized",
                    "return_pct",
                    "return_vs_btc_pct",
                    "return_vs_eth_pct",
                    "mae_pct",
                    "mfe_pct",
                    "closed_date",
                    "close_reason",
                    "confluence_fired",
                ):
                    merged.setdefault(k, closed_entry.get(k))
                ledger_id = closed_entry.get("id")
            else:
                warn(
                    f"close {asset}: no matching ledger.closed[] entry "
                    f"for closed_date={today}. OUTCOME embed will be "
                    f"composed from data.json only."
                )
                ledger_id = None

            # 1. Post the OUTCOME embed to #outcomes (always fresh)
            outcome_embed = E.compose_outcome(
                merged, chain_run_id=chain_run_id, slot=slot
            )
            safe_post(
                bot,
                channels["outcomes"],
                outcome_embed,
                f"outcome:{asset}",
                results,
            )

            # 2. Transition the position card in #positions, if it exists
            if ledger_id:
                prior = BM.get_open(tracker, ledger_id)
                if prior:
                    closed_card = E.compose_closed_position(
                        merged, chain_run_id=chain_run_id, slot=slot
                    )
                    try:
                        safe_edit(
                            bot,
                            channels["positions"],
                            prior["message_id"],
                            closed_card,
                            f"current:{asset}:closed",
                            results,
                        )
                        # Queue for 24h delete
                        BM.queue_for_cleanup(
                            tracker,
                            channel="positions",
                            message_id=prior["message_id"],
                            label=f"{ledger_id} CLOSED",
                            delete_after_utc=cleanup_deadline_iso(),
                        )
                    except DB.DiscordNotFoundError:
                        info(
                            f"close {asset}: position card already gone "
                            f"(404) — nothing to transition"
                        )
                    BM.remove_open(tracker, ledger_id)
                else:
                    info(
                        f"close {asset}: no position card in tracker — "
                        f"position may have closed before Stage 3 shipped "
                        f"(or the migration hasn't run yet)"
                    )
            continue

        # RIDE — edit-in-place or first-time post
        open_entry = _find_open_ledger_entry_by_asset(ledger, asset)
        if open_entry is None:
            warn(
                f"current {asset}: no matching ledger.open[] entry. "
                f"Posting without tracker linkage (will re-post on next run)."
            )
            position_embed = E.compose_current_position(
                p, chain_run_id=chain_run_id, slot=slot
            )
            safe_post(
                bot,
                channels["positions"],
                position_embed,
                f"current:{asset}",
                results,
            )
            continue

        ledger_id = open_entry["id"]
        position_embed = E.compose_current_position(
            p, chain_run_id=chain_run_id, slot=slot
        )
        prior = BM.get_open(tracker, ledger_id)
        if prior:
            try:
                safe_edit(
                    bot,
                    channels["positions"],
                    prior["message_id"],
                    position_embed,
                    f"current:{asset}",
                    results,
                )
                continue
            except DB.DiscordNotFoundError:
                warn(f"current {asset}: prior message gone — posting fresh")
                BM.remove_open(tracker, ledger_id)

        msg_id = safe_post(
            bot,
            channels["positions"],
            position_embed,
            f"current:{asset}",
            results,
        )
        if msg_id:
            BM.record_open(tracker, ledger_id, msg_id)


# ---------------------------------------------------------------------------
# Stage 3 — New positions (fresh in #signals AND fresh in #positions)


def handle_new_positions(
    bot: DB.DiscordBot,
    tracker: dict,
    channels: dict,
    data: dict,
    ledger: dict,
    slot: str,
    chain_run_id: str,
    results: list,
) -> None:
    new_positions = data.get("new_positions", []) or []
    for p in new_positions:
        ticker = (p.get("ticker") or "").upper()
        direction = p.get("direction", "?")
        # Match to the ledger.open[] entry (apply-ledger-ops created it
        # before we run).
        open_entry = _find_open_ledger_entry_by_asset(ledger, ticker)

        # 1. NEW POSITION embed → #signals (event log; permanent)
        signal_embed = E.compose_new_position(
            p, chain_run_id=chain_run_id, slot=slot
        )
        safe_post(
            bot,
            channels["signals"],
            signal_embed,
            f"new:{ticker} {direction}",
            results,
        )

        # 2. ALSO fresh CURRENT POSITION embed → #positions (active card)
        if open_entry is None:
            warn(
                f"new {ticker}: no matching ledger.open[] entry to seed "
                f"the tracker. Position card not posted."
            )
            continue

        # Synthesize an early-life current position view from the new
        # position fields + the ledger entry. We use compose_current_position
        # so the visual style matches what subsequent runs will show.
        seed = {
            "ticker": ticker,
            "direction": direction,
            "entry_zone": p.get("entry_zone") or "market",
            "invalidation": p.get("invalidation", ""),
            "horizon": p.get("horizon", ""),
            "day_of": "1",
            "day_total": p.get("horizon", "?"),
            "entry": open_entry.get("fired_price"),
            "fired_date": open_entry.get("fired_date"),
            "now": open_entry.get("fired_price"),  # day 1 — no PnL yet
            "pnl": 0.0,
            "mae": 0.0,
            "mfe": 0.0,
            "mae_day": "1",
            "mfe_day": "1",
            "call": "RIDE",
            "thesis_note": (p.get("thesis", [None]) or [None])[0] or "",
            "watch": p.get("watch", ""),
        }
        position_embed = E.compose_current_position(
            seed, chain_run_id=chain_run_id, slot=slot
        )
        msg_id = safe_post(
            bot,
            channels["positions"],
            position_embed,
            f"current:{ticker}:seed",
            results,
        )
        if msg_id:
            BM.record_open(tracker, open_entry["id"], msg_id)


# ---------------------------------------------------------------------------
# Stage 4 — Watchlist (edit-in-place + terminal-state handling)


def _find_watchlist_ledger_entry(ledger: dict, ledger_id: str) -> dict | None:
    for e in ledger.get("watchlist", []):
        if e.get("id") == ledger_id:
            return e
    return None


def _find_watchlist_closed_entry(ledger: dict, ledger_id: str) -> dict | None:
    """Search the watchlist_closed[] array for an entry with the given id.
    Returns the most-recent match (last appended) if multiple exist."""
    for e in reversed(ledger.get("watchlist_closed", [])):
        if e.get("id") == ledger_id:
            return e
    return None


def _resolve_watchlist_ledger_id(ledger: dict, data_entry: dict) -> str | None:
    """The data.json watchlist[] entries don't always carry the ledger id
    directly. Resolve by (asset, direction) — there's at most one active
    watchlist entry per (asset, direction)."""
    asset = (data_entry.get("ticker") or data_entry.get("asset", "")).upper()
    direction = data_entry.get("direction", "")
    for e in ledger.get("watchlist", []):
        if e.get("asset", "").upper() == asset and e.get("direction") == direction:
            return e.get("id")
    return None


def handle_watchlist(
    bot: DB.DiscordBot,
    tracker: dict,
    channels: dict,
    data: dict,
    ledger: dict,
    slot: str,
    chain_run_id: str,
    results: list,
) -> None:
    """Edit existing watchlist embeds in place. Detect exits (entries that
    were in tracker.watchlist but no longer in ledger.watchlist) and edit
    each to its terminal state before queueing for 24h delete."""
    # --- Active entries: edit or post fresh
    active_ledger_ids: set[str] = set()
    for w in data.get("watchlist", []) or []:
        ledger_id = _resolve_watchlist_ledger_id(ledger, w)
        if not ledger_id:
            warn(
                f"watchlist {w.get('ticker', '?')}: no matching ledger "
                f"entry. Posting without tracker linkage."
            )
            embed = E.compose_watchlist(w, chain_run_id=chain_run_id, slot=slot)
            safe_post(
                bot,
                channels["watchlist"],
                embed,
                f"watch:{w.get('ticker', '?')}",
                results,
            )
            continue
        active_ledger_ids.add(ledger_id)
        embed = E.compose_watchlist(w, chain_run_id=chain_run_id, slot=slot)
        prior = BM.get_watchlist(tracker, ledger_id)
        if prior:
            try:
                safe_edit(
                    bot,
                    channels["watchlist"],
                    prior["message_id"],
                    embed,
                    f"watch:{w.get('ticker', '?')}",
                    results,
                )
                continue
            except DB.DiscordNotFoundError:
                warn(
                    f"watchlist {w.get('ticker', '?')}: prior message gone, "
                    f"posting fresh"
                )
                BM.remove_watchlist(tracker, ledger_id)
        msg_id = safe_post(
            bot,
            channels["watchlist"],
            embed,
            f"watch:{w.get('ticker', '?')}",
            results,
        )
        if msg_id:
            BM.record_watchlist(tracker, ledger_id, msg_id)

    # --- Exits: tracked entries that are no longer active in ledger
    tracked_ids = set(tracker["watchlist"].keys())
    exited_ids = tracked_ids - active_ledger_ids
    for ledger_id in exited_ids:
        wc = _find_watchlist_closed_entry(ledger, ledger_id)
        if wc is None:
            warn(
                f"watchlist exit {ledger_id}: no matching watchlist_closed "
                f"entry in ledger. Cleaning up tracker entry to avoid stale state."
            )
            BM.remove_watchlist(tracker, ledger_id)
            continue
        prior = BM.get_watchlist(tracker, ledger_id)
        if not prior:
            continue
        terminal_embed = E.compose_watchlist_terminal(
            wc, chain_run_id=chain_run_id, slot=slot
        )
        label = f"watch:{wc.get('asset', '?')}:{wc.get('close_reason', '?')}"
        try:
            safe_edit(
                bot,
                channels["watchlist"],
                prior["message_id"],
                terminal_embed,
                label,
                results,
            )
            BM.queue_for_cleanup(
                tracker,
                channel="watchlist",
                message_id=prior["message_id"],
                label=f"{ledger_id} {wc.get('close_reason', '?')}",
                delete_after_utc=cleanup_deadline_iso(),
            )
        except DB.DiscordNotFoundError:
            info(f"watchlist exit {ledger_id}: message already gone")
        BM.remove_watchlist(tracker, ledger_id)


# ---------------------------------------------------------------------------
# Main


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Post perps-brief embeds to Discord via bot (Stage 3)"
    )
    parser.add_argument(
        "--live", action="store_true",
        help="Actually POST/EDIT/DELETE on Discord (default is dry-run)",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Print embed JSON + intentions, no API calls (default)",
    )
    parser.add_argument(
        "--chain-run-id", default=os.environ.get("GITHUB_RUN_ID", ""),
        help="Optional chain run ID; passed through to composers",
    )
    parser.add_argument(
        "--slot",
        default=os.environ.get("CHAIN_SLOT", ""),
        choices=["", "am", "pm"],
        help="Twice-daily chain slot ('am' or 'pm'). Falls back to CHAIN_SLOT env.",
    )
    args = parser.parse_args()

    dry_run = not args.live
    slot = (args.slot or "").lower()

    if not DATA_JSON.exists():
        fail(f"{DATA_JSON} not present — nothing to render", code=2)

    try:
        data = json.loads(DATA_JSON.read_text())
    except json.JSONDecodeError as e:
        fail(f"{DATA_JSON} not valid JSON: {e}", code=2)

    if data.get("schema_version") != "v4.1":
        warn(
            f"data.json schema_version is {data.get('schema_version')!r}, "
            "designed for v4.1"
        )

    # Load ledger (source of truth for entity ids, watchlist_closed, etc.).
    try:
        ledger = L.load()
    except L.LedgerError as e:
        fail(f"ledger failed to load: {e}", code=1)

    # Load tracker (empty on first run after Stage 3 ships).
    try:
        tracker = BM.load()
    except BM.BotMessagesError as e:
        fail(f"tracker failed to load: {e}", code=1)

    channels = resolve_channels(dry_run=dry_run)
    bot = DB.DiscordBot(dry_run=dry_run)

    results: list = []

    # ----- Stage 0: cleanup queue
    run_cleanup_queue(bot, tracker, channels, results)

    # ----- Stage 1: market sentiment
    handle_market_sentiment(
        bot, tracker, channels, data, slot, args.chain_run_id, results,
    )

    # ----- Stage 2: current positions + closes
    handle_current_positions_and_closes(
        bot, tracker, channels, data, ledger, slot, args.chain_run_id, results,
    )

    # ----- Stage 3: new positions (signals + position cards)
    handle_new_positions(
        bot, tracker, channels, data, ledger, slot, args.chain_run_id, results,
    )

    # ----- Stage 4: watchlist active + exits
    handle_watchlist(
        bot, tracker, channels, data, ledger, slot, args.chain_run_id, results,
    )

    # ----- Persist tracker (LIVE only; dry-run is side-effect-free)
    if dry_run:
        info("tracker NOT persisted (dry-run)")
    else:
        try:
            BM.save(tracker)
            info(f"tracker saved to {BM.TRACKER_PATH}")
        except BM.BotMessagesError as e:
            warn(f"tracker save failed: {e}")

    # ----- Summary
    by_op: dict = {}
    errored = 0
    for r in results:
        op = r.get("op", "?")
        by_op.setdefault(op, 0)
        by_op[op] += 1
        if r.get("error"):
            errored += 1

    parts = [f"{n} {op}" for op, n in sorted(by_op.items())]
    info(
        f"done — {', '.join(parts) if parts else 'no ops'} "
        f"({errored} errored, dry_run={dry_run})"
    )
    if errored > 0 and not dry_run:
        warn(f"{errored} Discord op(s) failed — see warnings above")
    return 0


if __name__ == "__main__":
    sys.exit(main())
