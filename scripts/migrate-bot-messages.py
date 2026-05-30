#!/usr/bin/env python3
"""One-shot migration helper: pre-populate bot-messages.json from existing
channel history.

When Stage 3 ships, the embed driver starts using edit-in-place semantics
based on the bot-messages.json tracker. On first run the tracker is
empty, so the driver would POST fresh embeds for every active position +
watchlist + market sentiment — duplicating the embeds already in your
channels from prior Stage 2 runs.

This script reads recent message history from each channel via the
Discord bot REST API, matches the latest embed for each ledger entity by
title, and writes the resulting tracker so the next chain run can edit
those existing embeds in place.

Usage:
    DISCORD_BOT_TOKEN=... \\
    DISCORD_BOT_CHANNEL_PERPS_CONTEXT=... \\
    DISCORD_BOT_CHANNEL_PERPS_POSITIONS=... \\
    DISCORD_BOT_CHANNEL_PERPS_WATCHLIST=... \\
    python3 scripts/migrate-bot-messages.py [--dry-run] [--max-pages 5]

The script is IDEMPOTENT but designed to run once. Subsequent runs
overwrite any tracker entries with newly-discovered matches. If you
already have an active tracker with valid entries, prefer NOT to
re-run this script.

What it does NOT do:
  - Delete duplicate embeds in channels. You can either (a) leave them
    as historical record or (b) manually delete after migration.
  - Touch #perps-signals or #perps-outcomes. Those are event-log
    channels — fresh posts are correct semantics, no tracker needed.

What it DOES do:
  - Reads up to N pages (50 msgs/page) of recent history from
    #perps-context, #perps-positions, #perps-watchlist.
  - For #perps-context: picks the most recent market_sentiment embed
    (matched by title prefix "Perps Brief").
  - For #perps-positions: matches embeds to ledger.open[] by ticker +
    direction parsing.
  - For #perps-watchlist: matches embeds to ledger.watchlist[] by
    ticker + direction.
  - Writes the tracker only after collecting all matches (atomic via
    the bot_messages module).

Limitations:
  - Multiple embeds for the same entity → picks the MOST RECENT. Older
    duplicate embeds are left in the channel.
  - If a position was opened today and the embed is older than the
    history we read, we won't find it. Increase --max-pages.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import bot_messages as BM  # noqa: E402
from lib import discord_bot as DB  # noqa: E402
from lib import ledger as L  # noqa: E402


def warn(msg: str) -> None:
    sys.stderr.write(f"migrate-bot-messages: WARN {msg}\n")


def info(msg: str) -> None:
    print(f"migrate-bot-messages: {msg}")


def fail(msg: str, code: int) -> None:
    sys.stderr.write(f"migrate-bot-messages: ERROR {msg}\n")
    sys.exit(code)


def fetch_messages(token: str, channel_id: str, max_pages: int) -> list:
    """Fetch recent messages from a Discord channel via REST API.

    Uses GET /channels/{id}/messages with `limit=100` and `before` cursor
    paging. Returns the combined list newest-first.
    """
    import json
    all_msgs: list = []
    before: str | None = None
    for page in range(max_pages):
        url = (
            f"{DB.DISCORD_API_BASE}/channels/{channel_id}/messages?limit=100"
        )
        if before:
            url += f"&before={before}"
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bot {token}",
                "User-Agent": DB.DEFAULT_USER_AGENT,
            },
            method="GET",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                page_msgs = json.loads(resp.read())
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")[:200]
            fail(
                f"channel {channel_id} page {page}: HTTP {e.code} {body}",
                code=2,
            )
        except urllib.error.URLError as e:
            fail(f"channel {channel_id} page {page}: network: {e.reason}", code=2)
        if not page_msgs:
            break
        all_msgs.extend(page_msgs)
        before = page_msgs[-1]["id"]
        time.sleep(0.3)  # be polite to the Discord API
        if len(page_msgs) < 100:
            break
    info(f"  channel {channel_id}: fetched {len(all_msgs)} messages")
    return all_msgs


def _is_aeon_embed(msg: dict, embed_title_prefix: str = "") -> bool:
    """Returns True if the message looks like one of OUR bot's embeds.

    Discord history includes messages from any author. We need to filter
    to only those posted by our bot — and ideally match the embed shape.
    """
    embeds = msg.get("embeds") or []
    if not embeds:
        return False
    title = (embeds[0].get("title") or "")
    if embed_title_prefix and not title.startswith(embed_title_prefix):
        return False
    return True


def _parse_ticker_and_direction(title: str) -> tuple[str, str] | None:
    """Extract (TICKER, DIRECTION) from common embed title patterns:
      'EIGEN · LONG · day 4/21'  → ('EIGEN', 'LONG')
      'HYPE · LONG · day 2'      → ('HYPE', 'LONG')
      'BCH · SHORT · day 5/7'    → ('BCH', 'SHORT')

    Returns None if the title doesn't match a recognised shape.
    """
    parts = [p.strip() for p in title.split("·")]
    if len(parts) < 2:
        return None
    ticker = parts[0].upper()
    direction_raw = parts[1].upper()
    if direction_raw not in ("LONG", "SHORT"):
        return None
    return ticker, direction_raw


def match_market_sentiment(messages: list) -> dict | None:
    """Pick the most recent embed whose title starts with 'Perps Brief'."""
    for msg in messages:
        if not _is_aeon_embed(msg, "Perps Brief"):
            continue
        return {
            "message_id": msg["id"],
            "timestamp": msg["timestamp"],
        }
    return None


def match_positions(messages: list, ledger: dict) -> dict[str, str]:
    """Build {ledger_id → message_id} for active open[] positions.

    Iterates ledger.open[] and picks the most recent matching embed by
    (asset, direction). Positions that closed within the lookback window
    are skipped (they'll be handled by the CLOSED-card flow once the
    next chain run fires; we don't try to revive them here)."""
    out: dict[str, str] = {}
    # Map (asset, direction) → ledger_id for active positions only
    open_map = {
        (e["asset"].upper(), e["direction"]): e["id"]
        for e in ledger.get("open", [])
    }
    seen_keys: set = set()
    for msg in messages:
        if not _is_aeon_embed(msg):
            continue
        title = (msg["embeds"][0].get("title") or "")
        parsed = _parse_ticker_and_direction(title)
        if not parsed:
            continue
        # Skip CLOSED/PROMOTED/INVALIDATED/DROPPED embeds — we want the
        # active-state cards only.
        if any(
            tag in title.upper()
            for tag in ("CLOSED", "PROMOTED", "INVALIDATED", "DROPPED")
        ):
            continue
        key = parsed
        if key in seen_keys:
            continue  # take only the most recent
        seen_keys.add(key)
        ledger_id = open_map.get(key)
        if ledger_id:
            out[ledger_id] = msg["id"]
    return out


def match_watchlist(messages: list, ledger: dict) -> dict[str, str]:
    """Build {ledger_id → message_id} for active watchlist[] entries."""
    out: dict[str, str] = {}
    wl_map = {
        (e["asset"].upper(), e["direction"]): e["id"]
        for e in ledger.get("watchlist", [])
    }
    seen_keys: set = set()
    for msg in messages:
        if not _is_aeon_embed(msg):
            continue
        title = (msg["embeds"][0].get("title") or "")
        parsed = _parse_ticker_and_direction(title)
        if not parsed:
            continue
        if any(
            tag in title.upper()
            for tag in ("CLOSED", "PROMOTED", "INVALIDATED", "DROPPED")
        ):
            continue
        key = parsed
        if key in seen_keys:
            continue
        seen_keys.add(key)
        ledger_id = wl_map.get(key)
        if ledger_id:
            out[ledger_id] = msg["id"]
    return out


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Migrate existing Discord embeds into bot-messages.json"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Print matches but don't write the tracker.",
    )
    parser.add_argument(
        "--max-pages", type=int, default=3,
        help="Max pages of channel history to fetch (100 msgs each). "
             "Increase if you have a backlog older than ~300 msgs.",
    )
    args = parser.parse_args()

    token = os.environ.get("DISCORD_BOT_TOKEN", "")
    if not token:
        fail("DISCORD_BOT_TOKEN env var required", code=1)

    channels = {
        "context":   os.environ.get("DISCORD_BOT_CHANNEL_PERPS_CONTEXT", ""),
        "positions": os.environ.get("DISCORD_BOT_CHANNEL_PERPS_POSITIONS", ""),
        "watchlist": os.environ.get("DISCORD_BOT_CHANNEL_PERPS_WATCHLIST", ""),
    }
    missing = [k for k, v in channels.items() if not v]
    if missing:
        fail(
            f"missing channel ID env var(s): "
            f"{', '.join(f'DISCORD_BOT_CHANNEL_PERPS_{m.upper()}' for m in missing)}",
            code=1,
        )

    try:
        ledger = L.load()
    except L.LedgerError as e:
        fail(f"ledger load failed: {e}", code=1)
    info(
        f"loaded ledger: open={len(ledger['open'])}, "
        f"watchlist={len(ledger['watchlist'])}"
    )

    try:
        tracker = BM.load()
    except BM.BotMessagesError as e:
        fail(f"tracker load failed: {e}", code=1)

    # --- Fetch + match
    info(f"fetching {channels['context']} (#perps-context)...")
    ctx_msgs = fetch_messages(token, channels["context"], args.max_pages)
    ms_match = match_market_sentiment(ctx_msgs)
    if ms_match:
        info(f"  market_sentiment match: msg {ms_match['message_id']}")
    else:
        info("  no market_sentiment embed found")

    info(f"fetching {channels['positions']} (#perps-positions)...")
    pos_msgs = fetch_messages(token, channels["positions"], args.max_pages)
    pos_matches = match_positions(pos_msgs, ledger)
    info(f"  matched {len(pos_matches)}/{len(ledger['open'])} active positions")
    for lid, mid in pos_matches.items():
        info(f"    {lid}  → msg {mid}")
    unmatched_open = [e["id"] for e in ledger["open"] if e["id"] not in pos_matches]
    for uid in unmatched_open:
        info(f"    {uid}  → NO MATCH (driver will POST fresh on next run)")

    info(f"fetching {channels['watchlist']} (#perps-watchlist)...")
    wl_msgs = fetch_messages(token, channels["watchlist"], args.max_pages)
    wl_matches = match_watchlist(wl_msgs, ledger)
    info(f"  matched {len(wl_matches)}/{len(ledger['watchlist'])} active watchlist entries")
    for lid, mid in wl_matches.items():
        info(f"    {lid}  → msg {mid}")
    unmatched_wl = [
        e["id"] for e in ledger["watchlist"] if e["id"] not in wl_matches
    ]
    for uid in unmatched_wl:
        info(f"    {uid}  → NO MATCH (driver will POST fresh on next run)")

    # --- Apply matches to tracker
    if ms_match:
        # We don't know the slot — leave it as empty string; the next AM
        # run will overwrite with fresh post anyway. posted_date defaults
        # to the date of the message's timestamp.
        posted_date = (ms_match.get("timestamp") or "")[:10]
        BM.record_market_sentiment(
            tracker, ms_match["message_id"], slot="", posted_date=posted_date,
        )

    for lid, mid in pos_matches.items():
        BM.record_open(tracker, lid, mid)
    for lid, mid in wl_matches.items():
        BM.record_watchlist(tracker, lid, mid)

    # --- Save
    if args.dry_run:
        info("dry-run — tracker NOT written")
        return 0
    BM.save(tracker)
    info(
        f"tracker written: market_sentiment="
        f"{'yes' if tracker['market_sentiment'] else 'no'}, "
        f"open={len(tracker['open'])}, watchlist={len(tracker['watchlist'])}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
