"""Discord bot message-ID tracker for edit-in-place delivery (Stage 3).

The bot driver needs to know which Discord message corresponds to which
ledger entity (open[] position, watchlist[] entry, or the persistent
market sentiment embed) so it can edit those messages in place each run
instead of posting fresh duplicates.

This module owns the on-disk tracker at memory/topics/state/bot-messages.json.

Schema:

    {
      "schema_version": "v1",
      "last_updated":   "YYYY-MM-DDTHH:MM:SSZ",
      "market_sentiment": MarketSentimentTrack | null,
      "open":             {ledger_id: PositionTrack, ...},
      "watchlist":        {ledger_id: WatchlistTrack, ...},
      "stale_cleanup":    [StaleCleanupEntry, ...]
    }

    MarketSentimentTrack:
      {"message_id": str, "posted_at_utc": ISO, "posted_date": "YYYY-MM-DD",
       "slot": "am"|"pm"}

      Allows the PM run to detect "today's AM embed exists" and edit
      it in place instead of posting fresh. New day → fresh post.

    PositionTrack / WatchlistTrack:
      {"message_id": str, "posted_at_utc": ISO}

      Keyed by the ledger entity id. The bot driver edits this message
      each run with refreshed PnL/MAE/MFE/day-counter content.

    StaleCleanupEntry:
      {"channel": "positions"|"watchlist"|...,
       "message_id": str,
       "label": str,                 # human-readable, for logs
       "delete_after_utc": ISO}

      Closed positions and exited watchlist entries get edited to a
      terminal state (CLOSED/INVALIDATED/DROPPED/PROMOTED) then queued
      here for deletion after 24h. Cleanup runs at the start of each
      chain run.

Atomic write: tmpfile + fsync + os.replace, same pattern as ledger.py.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


TRACKER_PATH = Path("memory/topics/state/bot-messages.json")
SCHEMA_VERSION = "v1"

# Channels the cleanup queue can target. Keep in sync with the
# DISCORD_BOT_CHANNEL_PERPS_* env var labels used by the driver.
VALID_CLEANUP_CHANNELS = {
    "context", "positions", "signals", "watchlist", "outcomes",
    # Path-B-PR2-equivalent for narratives — same edit-in-place +
    # 24h-cleanup pattern.
    "narratives",
}


class BotMessagesError(Exception):
    """Raised on tracker load/validate failures."""


def _empty_tracker() -> dict:
    return {
        "schema_version": SCHEMA_VERSION,
        "last_updated": None,
        "market_sentiment": None,
        "open": {},
        "watchlist": {},
        "narratives": {},
        "stale_cleanup": [],
    }


def _ensure_shape(tracker: dict) -> dict:
    """Coerce a loaded tracker into the canonical shape, adding any
    missing fields so callers can always treat the structure as complete.
    Returns the same dict (mutated in place) for convenience."""
    if not isinstance(tracker, dict):
        raise BotMessagesError(
            f"tracker root must be object, got {type(tracker).__name__}"
        )
    tracker.setdefault("schema_version", SCHEMA_VERSION)
    tracker.setdefault("last_updated", None)
    tracker.setdefault("market_sentiment", None)
    tracker.setdefault("open", {})
    tracker.setdefault("watchlist", {})
    tracker.setdefault("narratives", {})
    tracker.setdefault("stale_cleanup", [])
    for k in ("open", "watchlist", "narratives"):
        if not isinstance(tracker[k], dict):
            raise BotMessagesError(f"tracker.{k} must be object")
    if not isinstance(tracker["stale_cleanup"], list):
        raise BotMessagesError("tracker.stale_cleanup must be array")
    return tracker


def load(path: Path = TRACKER_PATH) -> dict:
    """Load the tracker. Returns an empty tracker if the file doesn't
    exist yet (first run after Stage 3 ships)."""
    if not path.exists():
        return _empty_tracker()
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError as e:
        raise BotMessagesError(f"tracker {path} is not valid JSON: {e}")
    return _ensure_shape(data)


def save(tracker: dict, path: Path = TRACKER_PATH) -> None:
    """Atomically write the tracker. Updates last_updated to now (UTC)."""
    _ensure_shape(tracker)
    tracker["last_updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    payload = json.dumps(tracker, indent=2, ensure_ascii=False) + "\n"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(payload)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


# ---------------------------------------------------------------------------
# Convenience accessors / mutators


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def record_market_sentiment(
    tracker: dict, message_id: str, slot: str, posted_date: str
) -> None:
    """Set the persistent market sentiment record. Slot is 'am' or 'pm'."""
    tracker["market_sentiment"] = {
        "message_id": str(message_id),
        "posted_at_utc": _now_iso(),
        "posted_date": posted_date,
        "slot": slot,
    }


def get_market_sentiment_for_today(tracker: dict, today: str) -> Optional[dict]:
    """Return the existing market sentiment record IF it was posted today
    (UTC date), else None. Caller uses this to decide POST vs EDIT.

    A None return means: post fresh (no prior, or prior is from another day).
    """
    ms = tracker.get("market_sentiment")
    if not ms:
        return None
    if ms.get("posted_date") != today:
        return None
    return ms


def record_open(tracker: dict, ledger_id: str, message_id: str) -> None:
    tracker["open"][ledger_id] = {
        "message_id": str(message_id),
        "posted_at_utc": _now_iso(),
    }


def get_open(tracker: dict, ledger_id: str) -> Optional[dict]:
    return tracker["open"].get(ledger_id)


def remove_open(tracker: dict, ledger_id: str) -> Optional[dict]:
    return tracker["open"].pop(ledger_id, None)


def record_watchlist(tracker: dict, ledger_id: str, message_id: str) -> None:
    tracker["watchlist"][ledger_id] = {
        "message_id": str(message_id),
        "posted_at_utc": _now_iso(),
    }


def get_watchlist(tracker: dict, ledger_id: str) -> Optional[dict]:
    return tracker["watchlist"].get(ledger_id)


def remove_watchlist(tracker: dict, ledger_id: str) -> Optional[dict]:
    return tracker["watchlist"].pop(ledger_id, None)


def record_narrative(tracker: dict, narrative_id: str, message_id: str) -> None:
    tracker["narratives"][narrative_id] = {
        "message_id": str(message_id),
        "posted_at_utc": _now_iso(),
    }


def get_narrative(tracker: dict, narrative_id: str) -> Optional[dict]:
    return tracker["narratives"].get(narrative_id)


def remove_narrative(tracker: dict, narrative_id: str) -> Optional[dict]:
    return tracker["narratives"].pop(narrative_id, None)


def queue_for_cleanup(
    tracker: dict,
    channel: str,
    message_id: str,
    label: str,
    delete_after_utc: str,
) -> None:
    """Enqueue a message for deletion after `delete_after_utc`. Idempotent —
    duplicate (channel, message_id) entries are de-duped."""
    if channel not in VALID_CLEANUP_CHANNELS:
        raise BotMessagesError(
            f"queue_for_cleanup: unknown channel '{channel}' "
            f"(allowed: {sorted(VALID_CLEANUP_CHANNELS)})"
        )
    # Dedup
    for existing in tracker["stale_cleanup"]:
        if (
            existing.get("channel") == channel
            and existing.get("message_id") == str(message_id)
        ):
            return
    tracker["stale_cleanup"].append({
        "channel": channel,
        "message_id": str(message_id),
        "label": label,
        "delete_after_utc": delete_after_utc,
    })


def take_due_cleanups(tracker: dict, now_utc: Optional[datetime] = None) -> list:
    """Return + REMOVE all stale cleanup entries whose deadline has passed.

    Caller is responsible for actually DELETE-ing the messages on Discord.
    If a delete fails, the caller may re-queue the entry with a fresh
    deadline.
    """
    now = now_utc or datetime.now(timezone.utc)
    due: list = []
    remaining: list = []
    for entry in tracker["stale_cleanup"]:
        try:
            deadline = datetime.fromisoformat(
                entry["delete_after_utc"].replace("Z", "+00:00")
            )
        except (KeyError, ValueError):
            # Bad entry — drop it from the queue silently
            continue
        if deadline <= now:
            due.append(entry)
        else:
            remaining.append(entry)
    tracker["stale_cleanup"] = remaining
    return due


# ---------------------------------------------------------------------------
# CLI


def _cli_main() -> int:
    """Print a summary of the tracker for ops review."""
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else TRACKER_PATH
    try:
        tracker = load(path)
    except BotMessagesError as e:
        sys.stderr.write(f"tracker {path}: INVALID — {e}\n")
        return 2
    print(f"tracker {path}: schema {tracker['schema_version']}")
    ms = tracker["market_sentiment"]
    if ms:
        print(
            f"  market_sentiment: msg={ms['message_id']} "
            f"slot={ms.get('slot')} date={ms.get('posted_date')}"
        )
    else:
        print("  market_sentiment: (none)")
    print(f"  open positions tracked: {len(tracker['open'])}")
    for k, v in tracker["open"].items():
        print(f"    {k}  msg={v['message_id']}")
    print(f"  watchlist entries tracked: {len(tracker['watchlist'])}")
    for k, v in tracker["watchlist"].items():
        print(f"    {k}  msg={v['message_id']}")
    print(f"  pending cleanups: {len(tracker['stale_cleanup'])}")
    for entry in tracker["stale_cleanup"]:
        print(
            f"    {entry['channel']}  msg={entry['message_id']}  "
            f"delete_after={entry['delete_after_utc']}  ({entry['label']})"
        )
    return 0


if __name__ == "__main__":
    sys.exit(_cli_main())
