#!/usr/bin/env python3
"""Discord bot embed driver for the perps-brief signal types.

Reads `.outputs/perps-brief.data.json` (the brief's structured output)
and posts one embed per signal to the appropriate channel via the bot
REST API.

Modes:
  --dry-run      Print embed JSON to stderr, return synthetic IDs.
                 Use to preview embeds in discohook.org before live test.
  --live         POST to Discord for real. Requires DISCORD_BOT_TOKEN env.
  (default)      --dry-run is the safe default. Add --live to actually post.

Channel routing (read from env):
  DISCORD_BOT_CHANNEL_PERPS_CONTEXT      ← market sentiment
  DISCORD_BOT_CHANNEL_PERPS_POSITIONS    ← current positions (RIDE)
  DISCORD_BOT_CHANNEL_PERPS_SIGNALS      ← new positions (NEW)
  DISCORD_BOT_CHANNEL_PERPS_WATCHLIST    ← watchlist entries
  DISCORD_BOT_CHANNEL_PERPS_OUTCOMES     ← closed positions (OUTCOME)

For Stage 1 (parallel deployment), the existing webhook delivery in
postprocess-perps-brief.sh remains untouched. This script runs ALONGSIDE
the webhook path. Both deliver. Operator compares side-by-side.

Stage 3 will add edit-in-place support — message IDs returned here will
be persisted to the ledger so subsequent runs can PATCH the embeds.

Exit codes:
  0 — all embeds posted successfully (or dry-run completed)
  1 — script error / fatal config
  2 — schema or data error in perps-brief.data.json
  Partial failures (some posts succeed, some fail) print warnings but
  exit 0 — bot delivery is best-effort, doesn't break webhook path.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import discord_bot as DB  # noqa: E402
from lib import embeds as E  # noqa: E402


DATA_JSON = Path(".outputs/perps-brief.data.json")


def warn(msg: str) -> None:
    sys.stderr.write(f"embed-perps-brief: WARN {msg}\n")


def info(msg: str) -> None:
    print(f"embed-perps-brief: {msg}")


def fail(msg: str, code: int) -> None:
    sys.stderr.write(f"embed-perps-brief: ERROR {msg}\n")
    sys.exit(code)


def resolve_channels(dry_run: bool = False) -> dict:
    """Read channel IDs from env. Returns dict mapping section name → channel ID.

    In dry-run mode, missing channels are tolerated (placeholders used so
    the embed JSON still gets printed for design review).
    In live mode, every section's channel must be set for delivery to happen.
    """
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


def post_to(
    bot: DB.DiscordBot,
    channel_id: str,
    embed: dict,
    label: str,
    results: list,
) -> None:
    """Try to post a single embed; on failure, append a warning to results
    list but don't raise. Best-effort delivery semantics."""
    if not channel_id:
        warn(f"no channel ID for {label} — skipping")
        results.append({"label": label, "skipped": True, "reason": "no channel"})
        return
    try:
        result = bot.post_embed(channel_id=channel_id, embeds=embed)
        info(f"posted {label} → {channel_id} (msg {result['message_id']})")
        results.append({"label": label, "message_id": result["message_id"], "channel_id": channel_id})
    except DB.DiscordError as e:
        warn(f"failed to post {label} to {channel_id}: {e}")
        results.append({"label": label, "error": str(e)})


def main() -> int:
    parser = argparse.ArgumentParser(description="Post perps-brief embeds to Discord via bot")
    parser.add_argument("--live", action="store_true", help="Actually POST to Discord (default is dry-run)")
    parser.add_argument("--dry-run", action="store_true", help="Print embed JSON only (default)")
    parser.add_argument("--chain-run-id", default=os.environ.get("GITHUB_RUN_ID", ""), help="Optional chain run ID for footer")
    args = parser.parse_args()

    dry_run = not args.live  # default to dry-run unless --live explicitly set

    if not DATA_JSON.exists():
        fail(f"{DATA_JSON} not present — nothing to render", code=2)

    try:
        data = json.loads(DATA_JSON.read_text())
    except json.JSONDecodeError as e:
        fail(f"{DATA_JSON} not valid JSON: {e}", code=2)

    if data.get("schema_version") != "v4.1":
        warn(
            f"data.json schema_version is {data.get('schema_version')!r}, "
            "embeds composer designed for v4.1"
        )

    channels = resolve_channels(dry_run=dry_run)
    bot = DB.DiscordBot(dry_run=dry_run)

    results = []
    chain_run_id = args.chain_run_id

    # -----------------------------------------------------------
    # 1. MARKET SENTIMENT → #perps-context (always posted)
    info(f"composing market sentiment")
    market_embed = E.compose_market_sentiment(data, chain_run_id=chain_run_id)
    post_to(bot, channels["context"], market_embed, "market_sentiment", results)

    # -----------------------------------------------------------
    # 2. CURRENT POSITIONS → #perps-positions
    # One embed per RIDE position. CLOSE entries go to OUTCOMES instead.
    current_positions = data.get("current_positions", [])
    for p in current_positions:
        if p.get("call") == "CLOSE":
            # Route to outcomes channel
            outcome_embed = E.compose_outcome(p, chain_run_id=chain_run_id)
            post_to(
                bot,
                channels["outcomes"],
                outcome_embed,
                f"outcome:{p.get('ticker', '?')}",
                results,
            )
        else:
            # RIDE — stays in positions channel
            position_embed = E.compose_current_position(p, chain_run_id=chain_run_id)
            post_to(
                bot,
                channels["positions"],
                position_embed,
                f"current:{p.get('ticker', '?')}",
                results,
            )

    # -----------------------------------------------------------
    # 3. NEW POSITIONS → #perps-signals
    new_positions = data.get("new_positions", [])
    for p in new_positions:
        embed = E.compose_new_position(p, chain_run_id=chain_run_id)
        post_to(
            bot,
            channels["signals"],
            embed,
            f"new:{p.get('ticker', '?')} {p.get('direction', '?')}",
            results,
        )

    # -----------------------------------------------------------
    # 4. WATCHLIST → #perps-watchlist
    watchlist = data.get("watchlist", [])
    for w in watchlist:
        embed = E.compose_watchlist(w, chain_run_id=chain_run_id)
        post_to(
            bot,
            channels["watchlist"],
            embed,
            f"watch:{w.get('ticker', '?')} {w.get('direction', '?')}",
            results,
        )

    # -----------------------------------------------------------
    # Summary
    posted = sum(1 for r in results if r.get("message_id"))
    skipped = sum(1 for r in results if r.get("skipped"))
    errored = sum(1 for r in results if r.get("error"))

    info(
        f"done — {posted} posted, {skipped} skipped, {errored} errored "
        f"({len(results)} attempted, dry_run={dry_run})"
    )
    if errored > 0 and not dry_run:
        warn(f"{errored} embed(s) failed to post — see warnings above")
    return 0


if __name__ == "__main__":
    sys.exit(main())
