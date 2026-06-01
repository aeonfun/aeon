#!/usr/bin/env python3
"""Discord bot embed driver for the narrative-tracker output.

Reads memory/topics/state/narratives.json (the source of truth, updated
by scripts/apply-narrative-ops.py) and posts/edits embeds in
#perps-narratives via the bot REST API. Mirrors the Stage 3 watchlist
pattern: edit-in-place for active narratives, terminal-state edit +
24h cleanup queue for archived narratives.

Channel routing:
  DISCORD_BOT_CHANNEL_PERPS_NARRATIVES — primary destination
  Falls back to DISCORD_BOT_CHANNEL_AEON_OPS if unset (so missing-secret
  cases don't lose data silently; warns).

Modes:
  --dry-run  Print embed JSON to stderr (default)
  --live     POST/EDIT/DELETE on Discord. Requires DISCORD_BOT_TOKEN.

Exit codes:
  0 — completed (live or dry-run)
  1 — fatal error
  2 — narratives ledger missing
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import bot_messages as BM  # noqa: E402
from lib import discord_bot as DB  # noqa: E402
from lib import embeds as E  # noqa: E402
from lib import narratives as N  # noqa: E402


CLEANUP_DELAY_HOURS = 24


def warn(msg: str) -> None:
    sys.stderr.write(f"embed-narrative-tracker: WARN {msg}\n")


def info(msg: str) -> None:
    print(f"embed-narrative-tracker: {msg}")


def fail(msg: str, code: int) -> None:
    sys.stderr.write(f"embed-narrative-tracker: ERROR {msg}\n")
    sys.exit(code)


def cleanup_deadline_iso() -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=CLEANUP_DELAY_HOURS)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Post narrative-tracker embeds to Discord via bot"
    )
    parser.add_argument(
        "--live", action="store_true",
        help="POST/EDIT/DELETE on Discord (default is dry-run)",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Print embed JSON only (default)",
    )
    parser.add_argument(
        "--chain-run-id",
        default=os.environ.get("GITHUB_RUN_ID", ""),
        help="Optional chain run ID for footer",
    )
    parser.add_argument(
        "--slot",
        default=os.environ.get("CHAIN_SLOT", ""),
        choices=["", "am", "pm"],
        help="Twice-daily chain slot for footer tag",
    )
    args = parser.parse_args()

    dry_run = not args.live

    # Channel routing — dedicated narratives channel preferred
    channel_id = os.environ.get("DISCORD_BOT_CHANNEL_PERPS_NARRATIVES", "")
    if not channel_id:
        channel_id = os.environ.get("DISCORD_BOT_CHANNEL_AEON_OPS", "")
        if channel_id and not dry_run:
            warn(
                "DISCORD_BOT_CHANNEL_PERPS_NARRATIVES not set — "
                "falling back to #aeon-ops"
            )
    if dry_run and not channel_id:
        channel_id = "MOCK-CHANNEL-NARRATIVES"
    if not channel_id:
        fail(
            "neither DISCORD_BOT_CHANNEL_PERPS_NARRATIVES nor "
            "DISCORD_BOT_CHANNEL_AEON_OPS env vars are set",
            code=1,
        )

    # Load narratives ledger
    try:
        ledger = N.load()
    except N.NarrativesError as e:
        fail(f"narratives ledger load failed: {e}", code=2)

    # Load bot-messages tracker
    try:
        tracker = BM.load()
    except BM.BotMessagesError as e:
        fail(f"tracker load failed: {e}", code=1)

    info(
        f"loaded: active={len(ledger['active'])}, "
        f"closed={len(ledger['closed'])}, "
        f"tracker narratives={len(tracker['narratives'])}"
    )

    bot = DB.DiscordBot(dry_run=dry_run)

    # --- Stage 0: process 24h cleanup queue for narratives channel only
    due = []
    remaining = []
    now = datetime.now(timezone.utc)
    for entry in tracker["stale_cleanup"]:
        if entry.get("channel") != "narratives":
            remaining.append(entry)
            continue
        try:
            deadline = datetime.fromisoformat(
                entry["delete_after_utc"].replace("Z", "+00:00")
            )
        except (KeyError, ValueError):
            continue
        if deadline <= now:
            due.append(entry)
        else:
            remaining.append(entry)
    tracker["stale_cleanup"] = remaining
    if due:
        info(f"cleanup: {len(due)} message(s) due for deletion")
        for c in due:
            try:
                bot.delete_message(
                    channel_id=channel_id, message_id=c["message_id"],
                )
                info(f"  DELETE {c.get('label', '?')}")
            except DB.DiscordNotFoundError:
                info(f"  DELETE {c.get('label', '?')}: already gone (404)")
            except DB.DiscordError as e:
                warn(f"  DELETE {c.get('label', '?')} failed: {e}")
                # Re-queue with 1h backoff
                c["delete_after_utc"] = (
                    now + timedelta(hours=1)
                ).strftime("%Y-%m-%dT%H:%M:%SZ")
                tracker["stale_cleanup"].append(c)

    # --- Stage 1: edit-in-place for each active narrative
    posted = 0
    edited = 0
    transitioned = 0
    errored = 0

    for entry in ledger["active"]:
        nid = entry["narrative_id"]
        embed = E.compose_narrative(entry, chain_run_id=args.chain_run_id, slot=args.slot)
        prior = BM.get_narrative(tracker, nid)
        if prior:
            try:
                bot.edit_embed(
                    channel_id=channel_id,
                    message_id=prior["message_id"],
                    embeds=embed,
                )
                info(f"EDIT narrative:{nid}")
                edited += 1
                continue
            except DB.DiscordNotFoundError:
                warn(f"narrative {nid}: prior message gone, posting fresh")
                BM.remove_narrative(tracker, nid)
            except DB.DiscordError as e:
                warn(f"EDIT narrative:{nid} failed: {e}")
                errored += 1
                continue
        # First-time post (or post after 404 recovery)
        try:
            r = bot.post_embed(channel_id=channel_id, embeds=embed)
            mid = r["message_id"]
            info(f"POST narrative:{nid} → msg {mid}")
            BM.record_narrative(tracker, nid, mid)
            posted += 1
        except DB.DiscordError as e:
            warn(f"POST narrative:{nid} failed: {e}")
            errored += 1

    # --- Stage 2: terminal-state edits for newly-closed narratives
    # Detect: anything in tracker.narratives but not in ledger.active is
    # newly archived. Find the most recent closed[] entry per id and edit
    # to terminal state, then queue 24h delete.
    active_ids = {e["narrative_id"] for e in ledger["active"]}
    tracker_ids = set(tracker["narratives"].keys())
    transitioned_ids = tracker_ids - active_ids

    # Build a lookup of closed entries by id (latest first)
    closed_by_id: dict[str, dict] = {}
    for ce in reversed(ledger["closed"]):
        if ce["narrative_id"] not in closed_by_id:
            closed_by_id[ce["narrative_id"]] = ce

    for nid in transitioned_ids:
        ce = closed_by_id.get(nid)
        if ce is None:
            # Lost track of it somehow — just remove from tracker
            warn(f"narrative {nid} not in active or closed — cleaning tracker")
            BM.remove_narrative(tracker, nid)
            continue
        prior = BM.get_narrative(tracker, nid)
        if not prior:
            continue
        embed = E.compose_narrative_terminal(
            ce, chain_run_id=args.chain_run_id, slot=args.slot,
        )
        try:
            bot.edit_embed(
                channel_id=channel_id,
                message_id=prior["message_id"],
                embeds=embed,
            )
            info(f"EDIT narrative:{nid}:terminal ({ce.get('close_reason')})")
            transitioned += 1
            BM.queue_for_cleanup(
                tracker,
                channel="narratives",
                message_id=prior["message_id"],
                label=f"{nid} {ce.get('close_reason', '?')}",
                delete_after_utc=cleanup_deadline_iso(),
            )
        except DB.DiscordNotFoundError:
            info(f"narrative {nid} terminal: message already gone")
        except DB.DiscordError as e:
            warn(f"EDIT narrative:{nid}:terminal failed: {e}")
            errored += 1
        BM.remove_narrative(tracker, nid)

    # --- Persist tracker (live only — dry-run is side-effect-free)
    if dry_run:
        info("tracker NOT persisted (dry-run)")
    else:
        try:
            BM.save(tracker)
            info(f"tracker saved")
        except BM.BotMessagesError as e:
            warn(f"tracker save failed: {e}")

    info(
        f"done — {posted} post, {edited} edit, {transitioned} terminal, "
        f"{errored} errored (dry_run={dry_run})"
    )
    return 0 if errored == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
