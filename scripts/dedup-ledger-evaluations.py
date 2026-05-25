#!/usr/bin/env python3
"""One-time cleanup: dedup evaluations[] entries in the ledger by date.

Pre-V1, apply-ledger-ops.py appended every evaluation without deduping by
date. Multi-dispatches on the same day produced duplicate eval rows. The
V1 fix prevents new duplicates but doesn't clean up historical state.

This script reads memory/topics/state/active-setups.json, walks every
open[] and closed[] entry's evaluations[] array, and de-duplicates by
date keeping the LAST entry for each date (most recent re-evaluation
wins). Writes back atomically via scripts/lib/ledger.py.

Idempotent — run as many times as you want, no-op after the first run.

Dry-run mode: pass --dry to preview changes without writing.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import ledger as L  # noqa: E402


def dedup_evals(entries: list, label: str, dry_run: bool) -> int:
    """Returns count of entries that had duplicates removed."""
    total_removed = 0
    for e in entries:
        evals = e.get("evaluations", [])
        if not evals:
            continue
        # Keep the LAST eval for each date (most-recent re-eval semantics)
        seen_dates: dict[str, dict] = {}
        for ev in evals:
            d = ev.get("date")
            if d:
                seen_dates[d] = ev
        new_evals = list(seen_dates.values())
        # Restore ordering — sort by date ascending
        new_evals.sort(key=lambda ev: ev.get("date", ""))
        if len(new_evals) < len(evals):
            removed = len(evals) - len(new_evals)
            total_removed += removed
            print(
                f"  {label} {e.get('id', '?'):30s} "
                f"{len(evals)} → {len(new_evals)} evals "
                f"(removed {removed} duplicate{'s' if removed > 1 else ''})"
            )
            if not dry_run:
                e["evaluations"] = new_evals
    return total_removed


def main() -> int:
    dry_run = "--dry" in sys.argv

    ledger = L.load()

    print(f"Pre-state: open={len(ledger['open'])}, "
          f"watchlist={len(ledger['watchlist'])}, "
          f"closed={len(ledger['closed'])}")
    print()

    removed_open = dedup_evals(ledger["open"], "open", dry_run)
    removed_closed = dedup_evals(ledger["closed"], "closed", dry_run)

    total = removed_open + removed_closed
    print()
    print(f"Total duplicates removed: {total} "
          f"({removed_open} from open[], {removed_closed} from closed[])")

    if total == 0:
        print("Ledger is already deduplicated. No-op.")
        return 0

    if dry_run:
        print("Dry-run mode — no write performed.")
        return 0

    L.save(ledger)
    print(f"Wrote deduplicated ledger.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
