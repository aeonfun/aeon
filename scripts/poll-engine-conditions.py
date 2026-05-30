#!/usr/bin/env python3
"""Path B PR2 — read-only engine condition poller.

Reads the ledger, iterates all engine_watch_conditions on open[] positions
and trigger_conditions / invalidation_conditions on watchlist[] entries,
evaluates each against the Coinglass cache, and posts a summary embed
to #aeon-ops listing the fires.

This PR is READ-ONLY. No ledger mutations, no actions, no Claude.
Purpose: validate that conditions Claude writes actually fire under
real market data before PR3 enables Claude-confirmation execution.

Usage:
    python3 scripts/poll-engine-conditions.py [--dry-run]

Modes:
    --dry-run  Print summary to stderr, do NOT post to Discord (default)
    --live     POST to Discord. Requires DISCORD_BOT_TOKEN + channel ID.

Cooldowns are honoured: conditions with recent last_fired_at_utc or
last_defer_at_utc are skipped. PR3's review skill writes those fields
after Claude reviews a fire.

The summary embed lands in #aeon-ops (DISCORD_BOT_CHANNEL_AEON_OPS).
Quiet hours (no fires) ALSO post a summary so we have a heartbeat —
silence and bot-down are easy to confuse otherwise.

Exit codes:
    0 — completed (live or dry-run)
    1 — fatal config error
    2 — ledger load error
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import condition_evaluator as CE  # noqa: E402
from lib import discord_bot as DB  # noqa: E402
from lib import embeds as E  # noqa: E402
from lib import ledger as L  # noqa: E402


def warn(msg: str) -> None:
    sys.stderr.write(f"poll-engine-conditions: WARN {msg}\n")


def info(msg: str) -> None:
    print(f"poll-engine-conditions: {msg}")


def fail(msg: str, code: int) -> None:
    sys.stderr.write(f"poll-engine-conditions: ERROR {msg}\n")
    sys.exit(code)


# ---------------------------------------------------------------------------
# Condition collection


def _collect_conditions(ledger: dict) -> list[dict]:
    """Walk the ledger and emit one work-item per condition.

    Each work-item:
      {
        "asset":           "EIGEN",
        "direction":       "LONG" | "SHORT" | None,
        "entity":          "open" | "watchlist",
        "entity_id":       "EIGEN-2026-05-24-001",
        "condition_index": 2,
        "condition":       {<the raw condition dict from the ledger>},
      }
    """
    work: list[dict] = []

    for p in ledger.get("open", []) or []:
        asset = (p.get("asset") or "").upper()
        direction = p.get("direction")
        conds = p.get("engine_watch_conditions") or []
        for i, c in enumerate(conds):
            if not isinstance(c, dict):
                continue
            work.append({
                "asset": asset,
                "direction": direction,
                "entity": "open",
                "entity_id": p.get("id"),
                "condition_index": i,
                "condition": c,
            })

    for w in ledger.get("watchlist", []) or []:
        asset = (w.get("asset") or "").upper()
        direction = w.get("direction")
        wl_id = w.get("id")

        # trigger_conditions can be {match_mode, conditions} OR bare list
        for field in ("trigger_conditions", "invalidation_conditions"):
            block = w.get(field)
            if block is None:
                continue
            if isinstance(block, list):
                conds = block
                # bare-list shorthand carries implicit match_mode=all,
                # but for fire-detection we evaluate each individually
                # and the caller composes the group semantics.
            elif isinstance(block, dict):
                conds = block.get("conditions") or []
            else:
                continue
            for i, c in enumerate(conds):
                if not isinstance(c, dict):
                    continue
                work.append({
                    "asset": asset,
                    "direction": direction,
                    "entity": "watchlist",
                    "entity_id": wl_id,
                    "condition_index": i,
                    "condition_group": field,
                    "condition": c,
                })

    return work


# ---------------------------------------------------------------------------
# Evaluation


def evaluate_all(work: list[dict]) -> dict:
    """Evaluate every work item. Returns a result summary."""
    now = datetime.now(timezone.utc)

    # Cache asset metrics so we only load each asset once
    metrics_cache: dict[str, dict] = {}

    fires: list[dict] = []
    n_in_cooldown = 0
    n_missing_data = 0
    n_evaluated = 0

    for item in work:
        cond = item["condition"]
        if CE.is_in_cooldown(cond, now_utc=now):
            n_in_cooldown += 1
            continue
        asset = item["asset"]
        if asset not in metrics_cache:
            metrics_cache[asset] = CE.load_asset_metrics(asset)
        metrics = metrics_cache[asset]
        fired, current = CE.evaluate_condition(cond, metrics)
        n_evaluated += 1
        if current is None:
            n_missing_data += 1
            continue
        if fired:
            fires.append({
                "asset": asset,
                "direction": item.get("direction"),
                "entity": item["entity"],
                "entity_id": item.get("entity_id"),
                "condition_index": item.get("condition_index"),
                "condition_group": item.get("condition_group"),
                "condition": cond,
                "current_value": current,
            })

    return {
        "fires": fires,
        "n_in_cooldown": n_in_cooldown,
        "n_missing_data": n_missing_data,
        "n_evaluated": n_evaluated,
        "n_scanned_conditions": len(work),
        "n_scanned_assets": len(metrics_cache),
    }


# ---------------------------------------------------------------------------
# Main


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Read-only engine condition poller (Path B PR2)",
    )
    parser.add_argument(
        "--live", action="store_true",
        help="POST summary embed to Discord (default is dry-run)",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Print embed JSON, do NOT post (default)",
    )
    parser.add_argument(
        "--quiet-skip-post", action="store_true",
        help="When no conditions fire, skip the Discord post entirely "
             "(saves channel noise during clean hours). Default is to "
             "post a heartbeat embed every poll.",
    )
    args = parser.parse_args()

    dry_run = not args.live

    try:
        ledger = L.load()
    except L.LedgerError as e:
        fail(f"ledger load failed: {e}", code=2)
    info(
        f"ledger: open={len(ledger['open'])}, watchlist={len(ledger['watchlist'])}, "
        f"closed={len(ledger['closed'])}, watchlist_closed={len(ledger['watchlist_closed'])}"
    )

    work = _collect_conditions(ledger)
    info(f"collected {len(work)} condition(s) to evaluate")

    result = evaluate_all(work)
    fires = result["fires"]
    info(
        f"evaluated {result['n_evaluated']}, fired {len(fires)}, "
        f"in_cooldown {result['n_in_cooldown']}, "
        f"missing_data {result['n_missing_data']}"
    )

    if not fires and args.quiet_skip_post:
        info("quiet hour with --quiet-skip-post — no embed posted")
        return 0

    # Compose summary embed
    embeds = E.compose_poller_summary(
        fires=fires,
        n_scanned_conditions=result["n_scanned_conditions"],
        n_scanned_assets=result["n_scanned_assets"],
        n_in_cooldown=result["n_in_cooldown"],
        n_missing_data=result["n_missing_data"],
        chain_run_id=os.environ.get("GITHUB_RUN_ID", ""),
    )
    info(f"composed {len(embeds)} embed(s)")

    channel_id = os.environ.get("DISCORD_BOT_CHANNEL_AEON_OPS", "")
    if not channel_id:
        channel_id = os.environ.get("DISCORD_BOT_CHANNEL_PERPS_OUTCOMES", "")
        if channel_id and not dry_run:
            warn(
                "DISCORD_BOT_CHANNEL_AEON_OPS not set — "
                "falling back to #perps-outcomes"
            )
    if dry_run and not channel_id:
        channel_id = "MOCK-CHANNEL-AEON-OPS"
    if not channel_id:
        fail(
            "neither DISCORD_BOT_CHANNEL_AEON_OPS nor "
            "DISCORD_BOT_CHANNEL_PERPS_OUTCOMES env vars are set",
            code=1,
        )

    bot = DB.DiscordBot(dry_run=dry_run)
    posted = 0
    errored = 0
    for emb in embeds:
        try:
            result_post = bot.post_embed(channel_id=channel_id, embeds=emb)
            info(
                f"posted poller_summary → {channel_id} "
                f"(msg {result_post['message_id']})"
            )
            posted += 1
        except DB.DiscordError as e:
            warn(f"failed to post poller summary: {e}")
            errored += 1

    info(
        f"done — {posted} embed(s) posted, {errored} errored "
        f"(dry_run={dry_run})"
    )
    if errored > 0 and not dry_run:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
