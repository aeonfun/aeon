#!/usr/bin/env python3
"""CLI driver for the judgement-audit stats module.

Reads memory/topics/state/active-setups.json, computes audit stats over
one or more time windows, and writes the result to a JSON artifact for
downstream consumption by the judgement-audit skill (Claude reads it
to synthesise narrative + insights) and the embed driver.

Default behaviour writes three windows (7d, 30d, all) into a single
output so the embed can show them side-by-side. Single-window output
also supported.

Usage:
    # Default — 7d + 30d + all + V1-lock-aware
    python3 scripts/audit-judgement.py

    # Single window
    python3 scripts/audit-judgement.py --window 30d

    # Write to a specific path
    python3 scripts/audit-judgement.py --output .outputs/judgement-audit.stats.json

Environment:
    V1_LOCK_DATE — when set, "all"-window filters from this date forward
                   (matches the operator's partial-reset baseline used
                   by outcome-tracker).

Exit codes:
    0 — stats written successfully
    1 — fatal error (ledger load, write failure)
    2 — ledger validation error
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import audit as A  # noqa: E402
from lib import ledger as L  # noqa: E402


DEFAULT_OUTPUT = Path(".outputs/judgement-audit.stats.json")
DEFAULT_WINDOWS = ["7d", "30d", "all"]


def warn(msg: str) -> None:
    sys.stderr.write(f"audit-judgement: WARN {msg}\n")


def info(msg: str) -> None:
    print(f"audit-judgement: {msg}")


def fail(msg: str, code: int) -> None:
    sys.stderr.write(f"audit-judgement: ERROR {msg}\n")
    sys.exit(code)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Compute judgement-audit stats from the perps ledger",
    )
    parser.add_argument(
        "--window",
        action="append",
        choices=["7d", "30d", "all"],
        help="Window(s) to compute. May be passed multiple times. "
             "Defaults to all three (7d, 30d, all).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Output JSON path (default {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--ledger",
        type=Path,
        default=None,
        help="Override ledger path (default scripts/lib/ledger.py:LEDGER_PATH)",
    )
    args = parser.parse_args()

    windows = args.window or DEFAULT_WINDOWS
    v1_lock = os.environ.get("V1_LOCK_DATE") or None

    try:
        ledger = L.load(args.ledger or L.LEDGER_PATH)
    except L.LedgerError as e:
        fail(f"ledger load failed: {e}", code=2)

    info(
        f"loaded ledger: open={len(ledger['open'])}, "
        f"closed={len(ledger['closed'])}, "
        f"watchlist={len(ledger['watchlist'])}, "
        f"watchlist_closed={len(ledger['watchlist_closed'])}"
    )
    if v1_lock:
        info(f"V1_LOCK_DATE filter: {v1_lock}")

    stats_by_window: dict[str, dict] = {}
    for w in windows:
        stats_by_window[w] = A.build_audit(ledger, window=w, v1_lock_date=v1_lock)
        h = stats_by_window[w]["headline"]
        info(
            f"  window {w}: n_closed={h['n_closed']} "
            f"win_rate={h['win_rate_pct']}% "
            f"avg_return={h['avg_return_pct']}%"
        )

    out = {
        "schema_version": "v1",
        "generated_at_utc": datetime.now(timezone.utc).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        ),
        "v1_lock_date": v1_lock,
        "windows": stats_by_window,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
    info(f"wrote {args.output} ({args.output.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
