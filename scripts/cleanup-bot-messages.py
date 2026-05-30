#!/usr/bin/env python3
"""One-shot cleanup helper: delete stale Aeon bot embeds from the
active-only Discord channels.

After Stage 3 (edit-in-place) shipped, the channels accumulated stale
embeds from the pre-Stage-3 twice-daily duplication era plus old
position cards for trades that closed before the 24h-cleanup queue
existed. This script identifies those and deletes them via the bot.

Channels and policies:

  #perps-positions   ACTIVE-ONLY
    Keep:   messages in tracker.open[*].message_id
            messages in tracker.stale_cleanup[channel=positions].message_id
    Delete: anything else by our bot

  #perps-watchlist   ACTIVE-ONLY
    Keep:   messages in tracker.watchlist[*].message_id
            messages in tracker.stale_cleanup[channel=watchlist].message_id
    Delete: anything else by our bot

  #perps-context     LATEST-ONLY (market sentiment)
    Keep:   tracker.market_sentiment.message_id (current AM/PM card)
    Delete: anything else by our bot

  #perps-outcomes    SELECTIVE — keep OUTCOME embeds, delete misrouted audits
    Keep:   embeds where author.name == "OUTCOME"
            embeds where author.name starts with "WEEKLY"
    Delete: embeds where author.name starts with "JUDGEMENT AUDIT"
            (those should be in #aeon-ops now; PR #57)

  #perps-signals     SKIPPED — event log, never cleaned

  #aeon-ops          SKIPPED — mixed webhook + embed history is fine

Usage:
    DISCORD_BOT_TOKEN=... \\
    DISCORD_BOT_CHANNEL_PERPS_CONTEXT=... \\
    DISCORD_BOT_CHANNEL_PERPS_POSITIONS=... \\
    DISCORD_BOT_CHANNEL_PERPS_WATCHLIST=... \\
    DISCORD_BOT_CHANNEL_PERPS_OUTCOMES=... \\
    python3 scripts/cleanup-bot-messages.py [--dry-run] [--max-pages 5]

ALWAYS start with --dry-run. It prints every candidate deletion with
the message author, embed title, posted-at — you eyeball the list
before re-running with --live.

Limitations:
  - Only deletes messages POSTED BY the bot. Operator-posted messages
    (manual replies, reactions) are never touched.
  - Discord doesn't allow bulk-delete of messages > 14 days old. Older
    stale messages need to be deleted one-by-one (the script does this
    with rate-limit handling, but it's slower).
  - Discord rate limit: 5 deletes per 2s per channel. Script paces
    itself via discord_bot.py's _throttle().
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import bot_messages as BM  # noqa: E402
from lib import discord_bot as DB  # noqa: E402


# Active-state author labels — embeds with these in author.name on the
# active-only channels are CANDIDATES for cleanup if their message_id
# isn't in the tracker. The list documents what shapes Aeon's composers
# produce; the actual cleanup decision is by message_id membership in
# the tracker, not by author label.
KNOWN_AEON_AUTHOR_LABELS = {
    "NEW POSITION",
    "WATCHLIST",
    "OUTCOME",
    "CLOSED POSITION",
    "WEEKLY TRACK RECORD",
    "JUDGEMENT AUDIT",
    "AEON OPS",
}


def warn(msg: str) -> None:
    sys.stderr.write(f"cleanup-bot-messages: WARN {msg}\n")


def info(msg: str) -> None:
    print(f"cleanup-bot-messages: {msg}")


def fail(msg: str, code: int) -> None:
    sys.stderr.write(f"cleanup-bot-messages: ERROR {msg}\n")
    sys.exit(code)


def get_bot_user_id(token: str) -> str:
    """Resolve the bot's own user ID via /users/@me."""
    req = urllib.request.Request(
        f"{DB.DISCORD_API_BASE}/users/@me",
        headers={
            "Authorization": f"Bot {token}",
            "User-Agent": DB.DEFAULT_USER_AGENT,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            return str(data["id"])
    except (urllib.error.URLError, urllib.error.HTTPError, KeyError) as e:
        fail(f"could not resolve bot user id: {e}", code=1)


def fetch_messages(token: str, channel_id: str, max_pages: int) -> list:
    """Fetch up to max_pages * 100 messages from a channel, newest-first."""
    all_msgs: list = []
    before: str | None = None
    for page in range(max_pages):
        url = f"{DB.DISCORD_API_BASE}/channels/{channel_id}/messages?limit=100"
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
            fail(f"channel {channel_id} page {page}: {e.reason}", code=2)
        if not page_msgs:
            break
        all_msgs.extend(page_msgs)
        before = page_msgs[-1]["id"]
        time.sleep(0.3)  # politeness
        if len(page_msgs) < 100:
            break
    info(f"  channel {channel_id}: fetched {len(all_msgs)} messages")
    return all_msgs


def _embed_summary(msg: dict) -> str:
    """One-line summary for human review of a deletion candidate."""
    embeds = msg.get("embeds") or []
    if not embeds:
        return "(no embed)"
    e = embeds[0]
    title = (e.get("title") or "")[:60]
    author = (e.get("author") or {}).get("name", "")[:30]
    return f"author={author!r} title={title!r}"


# ---------------------------------------------------------------------------
# Per-channel cleanup policies


def plan_positions_cleanup(
    messages: list, tracker: dict, bot_user_id: str
) -> list[dict]:
    """Identify stale messages in #perps-positions.

    Keep: any message_id in tracker.open[*].message_id
          any message_id in tracker.stale_cleanup[channel=positions].message_id
    Delete: any other message authored by our bot that has an embed.
    """
    keep = {v["message_id"] for v in tracker["open"].values()}
    keep |= {
        c["message_id"]
        for c in tracker["stale_cleanup"]
        if c.get("channel") == "positions"
    }
    stale = []
    for msg in messages:
        if str(msg.get("author", {}).get("id")) != bot_user_id:
            continue  # not our bot
        if msg["id"] in keep:
            continue
        if not msg.get("embeds"):
            continue  # plain message; skip
        stale.append(msg)
    return stale


def plan_watchlist_cleanup(
    messages: list, tracker: dict, bot_user_id: str
) -> list[dict]:
    """Same logic as positions for #perps-watchlist."""
    keep = {v["message_id"] for v in tracker["watchlist"].values()}
    keep |= {
        c["message_id"]
        for c in tracker["stale_cleanup"]
        if c.get("channel") == "watchlist"
    }
    stale = []
    for msg in messages:
        if str(msg.get("author", {}).get("id")) != bot_user_id:
            continue
        if msg["id"] in keep:
            continue
        if not msg.get("embeds"):
            continue
        stale.append(msg)
    return stale


def plan_context_cleanup(
    messages: list, tracker: dict, bot_user_id: str
) -> list[dict]:
    """Keep only the current tracker market sentiment message.

    Older fresh-post market sentiment embeds from the pre-Stage-3 era
    are stale (only the AM card is being edited in place now).
    """
    ms = tracker.get("market_sentiment") or {}
    keep_id = ms.get("message_id")
    stale = []
    for msg in messages:
        if str(msg.get("author", {}).get("id")) != bot_user_id:
            continue
        if keep_id and msg["id"] == keep_id:
            continue
        if not msg.get("embeds"):
            continue
        stale.append(msg)
    return stale


def plan_outcomes_cleanup(
    messages: list, tracker: dict, bot_user_id: str
) -> list[dict]:
    """In #perps-outcomes, delete JUDGEMENT AUDIT embeds only.

    PR #57 routed those to #aeon-ops. Pre-#57 audits landed here. The
    rest of #perps-outcomes (OUTCOME embeds for closed trades, weekly
    summaries) is permanent event log — never touched.
    """
    stale = []
    for msg in messages:
        if str(msg.get("author", {}).get("id")) != bot_user_id:
            continue
        embeds = msg.get("embeds") or []
        if not embeds:
            continue
        author_name = (embeds[0].get("author") or {}).get("name", "")
        if author_name.startswith("JUDGEMENT AUDIT"):
            stale.append(msg)
    return stale


CLEANUP_POLICIES = {
    "positions": plan_positions_cleanup,
    "watchlist": plan_watchlist_cleanup,
    "context":   plan_context_cleanup,
    "outcomes":  plan_outcomes_cleanup,
}


# ---------------------------------------------------------------------------
# Main


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Delete stale Aeon bot embeds from active-only channels"
    )
    parser.add_argument(
        "--dry-run", action="store_true", default=True,
        help="Print deletion candidates without deleting (default)",
    )
    parser.add_argument(
        "--live", action="store_true",
        help="Actually DELETE messages on Discord",
    )
    parser.add_argument(
        "--max-pages", type=int, default=5,
        help="Pages of channel history per channel (100 msgs each)",
    )
    parser.add_argument(
        "--channels",
        default="positions,watchlist,context,outcomes",
        help="Comma-separated channel labels to clean "
             "(positions, watchlist, context, outcomes)",
    )
    args = parser.parse_args()

    dry_run = not args.live
    channel_labels = [c.strip() for c in args.channels.split(",") if c.strip()]

    token = os.environ.get("DISCORD_BOT_TOKEN", "")
    if not token:
        fail("DISCORD_BOT_TOKEN env var required", code=1)

    channel_envs = {
        "context":   "DISCORD_BOT_CHANNEL_PERPS_CONTEXT",
        "positions": "DISCORD_BOT_CHANNEL_PERPS_POSITIONS",
        "watchlist": "DISCORD_BOT_CHANNEL_PERPS_WATCHLIST",
        "outcomes":  "DISCORD_BOT_CHANNEL_PERPS_OUTCOMES",
    }
    channels: dict[str, str] = {}
    for label in channel_labels:
        env = channel_envs.get(label)
        if not env:
            fail(f"unknown channel label '{label}'", code=1)
        cid = os.environ.get(env, "")
        if not cid:
            warn(f"{env} not set — skipping {label}")
            continue
        channels[label] = cid

    if not channels:
        fail("no channels configured (need at least one *_CHANNEL_PERPS_* env)", code=1)

    try:
        tracker = BM.load()
    except BM.BotMessagesError as e:
        fail(f"tracker load failed: {e}", code=1)
    info(
        f"tracker: market_sentiment={'yes' if tracker['market_sentiment'] else 'no'}, "
        f"open={len(tracker['open'])}, watchlist={len(tracker['watchlist'])}, "
        f"stale_cleanup={len(tracker['stale_cleanup'])}"
    )

    bot_user_id = get_bot_user_id(token)
    info(f"bot user id: {bot_user_id}")

    if dry_run:
        info("DRY-RUN mode — no deletes will happen")
    else:
        info("LIVE mode — deletions WILL happen")

    # Plan + summarise
    all_planned: list[tuple[str, str, dict]] = []  # (channel_label, channel_id, msg)
    for label, channel_id in channels.items():
        info(f"\n--- scanning {label} ({channel_id}) ---")
        msgs = fetch_messages(token, channel_id, args.max_pages)
        planner = CLEANUP_POLICIES[label]
        stale = planner(msgs, tracker, bot_user_id)
        info(f"  candidates for deletion: {len(stale)}")
        for m in stale:
            print(
                f"    msg {m['id']} · {m.get('timestamp', '')[:16]} · "
                f"{_embed_summary(m)}"
            )
            all_planned.append((label, channel_id, m))

    if not all_planned:
        info("\nnothing to clean up")
        return 0

    info(f"\nTOTAL deletion candidates: {len(all_planned)}")
    if dry_run:
        info("re-run with --live to actually delete")
        return 0

    # Live: delete each
    bot = DB.DiscordBot(token=token, dry_run=False)
    n_deleted = 0
    n_errored = 0
    for label, channel_id, msg in all_planned:
        try:
            bot.delete_message(channel_id=channel_id, message_id=msg["id"])
            n_deleted += 1
            info(f"DELETE {label} {msg['id']}")
        except DB.DiscordNotFoundError:
            info(f"already gone {label} {msg['id']}")
            n_deleted += 1
        except DB.DiscordError as e:
            warn(f"failed to delete {label} {msg['id']}: {e}")
            n_errored += 1

    info(f"\ndone — {n_deleted} deleted, {n_errored} errored")
    return 0 if n_errored == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
