#!/usr/bin/env python3
"""Embed driver for the judgement-audit output.

Reads .outputs/judgement-audit.stats.json (produced by
scripts/audit-judgement.py) and, optionally, .outputs/judgement-audit.data.json
(produced by the judgement-audit skill, carrying Claude's narrative +
insights). Posts a single audit embed to #perps-outcomes.

The audit embed is a FRESH POST every time — no edit-in-place. It's an
event log entry, like new positions and outcomes.

Modes:
  --dry-run    Print embed JSON to stderr (default if --live unset)
  --live       POST to Discord for real. Requires DISCORD_BOT_TOKEN.

Window selection:
  --window 7d|30d|all   Which audit window to feature in the embed.
                         Defaults to '30d'.

Exit codes:
  0 — posted (or dry-run completed)
  1 — fatal error
  2 — input data missing
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


STATS_PATH = Path(".outputs/judgement-audit.stats.json")
DATA_PATH = Path(".outputs/judgement-audit.data.json")


def warn(msg: str) -> None:
    sys.stderr.write(f"embed-judgement-audit: WARN {msg}\n")


def info(msg: str) -> None:
    print(f"embed-judgement-audit: {msg}")


def fail(msg: str, code: int) -> None:
    sys.stderr.write(f"embed-judgement-audit: ERROR {msg}\n")
    sys.exit(code)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Post judgement-audit embed to Discord via bot"
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
        "--window",
        default="30d",
        choices=["7d", "30d", "all"],
        help="Which audit window to feature in the embed (default 30d)",
    )
    parser.add_argument(
        "--slot",
        default=os.environ.get("CHAIN_SLOT", ""),
        choices=["", "am", "pm"],
        help="Chain slot for footer tag",
    )
    parser.add_argument(
        "--chain-run-id",
        default=os.environ.get("GITHUB_RUN_ID", ""),
        help="Optional chain run ID",
    )
    parser.add_argument(
        "--stats-path",
        type=Path,
        default=STATS_PATH,
        help=f"Override stats input path (default {STATS_PATH})",
    )
    parser.add_argument(
        "--data-path",
        type=Path,
        default=DATA_PATH,
        help=f"Override Claude-synthesised data path (default {DATA_PATH})",
    )
    args = parser.parse_args()

    dry_run = not args.live

    if not args.stats_path.exists():
        fail(
            f"{args.stats_path} not present — run "
            f"scripts/audit-judgement.py first",
            code=2,
        )

    try:
        stats = json.loads(args.stats_path.read_text())
    except json.JSONDecodeError as e:
        fail(f"{args.stats_path} not valid JSON: {e}", code=2)

    # Optional Claude-synthesised narrative + insights + postmortems
    narrative = ""
    insights: list = []
    postmortems: list = []
    regime_observations: list = []
    if args.data_path.exists():
        try:
            data = json.loads(args.data_path.read_text())
            narrative = (data.get("narrative") or "").strip()
            insights = data.get("insights") or []
            postmortems = data.get("per_trade_postmortems") or []
            regime_observations = data.get("regime_observations") or []
            if narrative:
                info(f"loaded Claude narrative ({len(narrative)} chars)")
            if insights:
                info(f"loaded {len(insights)} Claude insight(s)")
            if postmortems:
                info(f"loaded {len(postmortems)} per-trade postmortem(s)")
            if regime_observations:
                info(f"loaded {len(regime_observations)} regime observation(s)")
        except json.JSONDecodeError as e:
            warn(
                f"{args.data_path} present but not valid JSON: {e}. "
                f"Proceeding with stats-only embed."
            )

    # Compose audit message. compose_judgement_audit returns a LIST of
    # embeds (1 stats-only when there's no Claude analysis, 2 when there
    # is — Discord's 6000-char/embed cap can't hold both stats + full
    # narrative + postmortems in a single embed for non-trivial audits).
    embeds = E.compose_judgement_audit(
        stats=stats,
        window=args.window,
        chain_run_id=args.chain_run_id,
        slot=args.slot,
        narrative=narrative,
        insights=insights,
        postmortems=postmortems,
        regime_observations=regime_observations,
    )
    info(f"composed {len(embeds)} embed(s) for delivery")

    # Channel routing — audit embeds go to the unified #aeon-ops developer
    # channel (same destination as daily-ops-review). Operator can mute that
    # channel without losing #perps-outcomes (trade-by-trade event log).
    # Falls back to #perps-outcomes during migration if AEON_OPS isn't
    # configured yet.
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
            "DISCORD_BOT_CHANNEL_PERPS_OUTCOMES env vars are set, "
            "and not in dry-run mode",
            code=1,
        )

    # Discord enforces a per-message cap of 6000 chars across ALL embeds
    # in a single message (not just per-embed). With Claude's full audit
    # routinely producing 3 embeds totalling ~7000 chars, sending them in
    # one message fails MAX_EMBED_SIZE_EXCEEDED (50035).
    #
    # Workaround: post each embed as a separate message. Each is a
    # standalone artifact (stats / analysis / postmortems) so this also
    # reads cleanly — the operator gets three distinct posts in the
    # outcomes channel, easy to scroll.
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
        # Non-zero exit so the postprocess script logs a warning, but
        # partial success is still useful — the operator at least sees
        # what got through.
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
