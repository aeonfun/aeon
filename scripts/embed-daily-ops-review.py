#!/usr/bin/env python3
"""Discord bot embed driver for daily-ops-review.

Reads .outputs/daily-ops-review.md (produced by the daily-ops-review
skill) and posts an embed to the unified #aeon-ops developer channel.

Channel routing:
  DISCORD_BOT_CHANNEL_AEON_OPS — primary destination
  Falls back to DISCORD_BOT_CHANNEL_PERPS_OUTCOMES if the dedicated
  ops channel isn't configured (smooths the migration; warns).

Modes:
  --dry-run  Print embed JSON to stderr (default)
  --live     POST to Discord. Requires DISCORD_BOT_TOKEN.

Exit codes:
  0 — posted (or dry-run completed)
  1 — fatal error / partial delivery failure
  2 — input artifact missing
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import discord_bot as DB  # noqa: E402
from lib import embeds as E  # noqa: E402


ARTIFACT_PATH = Path(".outputs/daily-ops-review.md")


def warn(msg: str) -> None:
    sys.stderr.write(f"embed-daily-ops-review: WARN {msg}\n")


def info(msg: str) -> None:
    print(f"embed-daily-ops-review: {msg}")


def fail(msg: str, code: int) -> None:
    sys.stderr.write(f"embed-daily-ops-review: ERROR {msg}\n")
    sys.exit(code)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Post daily-ops-review embed to Discord via bot"
    )
    parser.add_argument(
        "--live", action="store_true",
        help="Actually POST to Discord (default is dry-run)",
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
        help="Twice-daily chain slot for embed footer",
    )
    parser.add_argument(
        "--artifact-path",
        type=Path,
        default=ARTIFACT_PATH,
        help=f"Override artifact path (default {ARTIFACT_PATH})",
    )
    args = parser.parse_args()

    dry_run = not args.live

    if not args.artifact_path.exists():
        fail(f"{args.artifact_path} not present — skill didn't run?", code=2)

    try:
        body = args.artifact_path.read_text()
    except OSError as e:
        fail(f"failed to read {args.artifact_path}: {e}", code=1)

    if not body.strip():
        warn(f"{args.artifact_path} is empty — posting placeholder embed")

    # Channel routing — prefer the unified aeon-ops channel, fall back
    # to the older OUTCOMES channel during migration.
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

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    embeds = E.compose_daily_ops_review(
        markdown_text=body,
        date_str=today,
        chain_run_id=args.chain_run_id,
        slot=args.slot,
    )
    info(f"composed {len(embeds)} embed(s) for delivery")

    bot = DB.DiscordBot(dry_run=dry_run)
    posted = 0
    errored = 0
    for i, embed in enumerate(embeds):
        label = embed.get("author", {}).get("name", f"embed[{i}]")
        try:
            result = bot.post_embed(channel_id=channel_id, embeds=embed)
            info(
                f"posted {label} → "
                f"{channel_id} (msg {result['message_id']})"
            )
            posted += 1
        except DB.DiscordError as e:
            warn(f"failed to post {label}: {e}")
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
