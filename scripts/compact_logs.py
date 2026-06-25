#!/usr/bin/env python3
"""
compact_logs — age-banded retention plan for memory/logs (hardening §10).

Logs are the only memory that grows linearly (~5 KB/day → ~2 MB/yr on the live
instance). This gives `reflect` a principled compaction rule instead of curating by
vibes: fidelity as a function of age, like human memory.

  age ≤ 7d    -> keep verbatim
  8–30d       -> summarize (reflect's LLM folds these into a topic note, then drops)
  > 30d       -> drop (or archive)

This module is the *planner* (pure, testable). `reflect` reads the plan, summarizes
the middle band, and the `--apply` flag drops the old band. Bounded context per run,
regardless of how long Aeon's been running.

Usage:
  compact_logs.py memory/logs --today 2026-06-17           # print the plan
  compact_logs.py memory/logs --today 2026-06-17 --apply   # also delete the drop band
"""
import argparse
import json
import os
import re
from datetime import date

_LOG_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})\.md$")


def plan(filenames, today, verbatim_days=7, summarize_days=30):
    """Bucket dated log filenames by age. Non-dated files are left as 'keep'."""
    today_d = date.fromisoformat(today)
    keep, summarize, drop = [], [], []
    for fn in filenames:
        base = os.path.basename(fn)
        m = _LOG_RE.match(base)
        if not m:
            keep.append(fn)
            continue
        try:
            d = date.fromisoformat(m.group(1))
        except ValueError:
            keep.append(fn)
            continue
        age = (today_d - d).days
        if age <= verbatim_days:
            keep.append(fn)
        elif age <= summarize_days:
            summarize.append(fn)
        else:
            drop.append(fn)
    return {"keep": sorted(keep), "summarize": sorted(summarize), "drop": sorted(drop)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("logs_dir")
    ap.add_argument("--today", required=True, help="YYYY-MM-DD (pass explicitly for determinism)")
    ap.add_argument("--verbatim-days", type=int, default=7)
    ap.add_argument("--summarize-days", type=int, default=30)
    ap.add_argument("--apply", action="store_true", help="delete the drop band")
    args = ap.parse_args()

    files = []
    if os.path.isdir(args.logs_dir):
        files = [os.path.join(args.logs_dir, f) for f in os.listdir(args.logs_dir)]
    p = plan(files, args.today, args.verbatim_days, args.summarize_days)

    if args.apply:
        for f in p["drop"]:
            try:
                os.remove(f)
            except OSError:
                pass
        p["dropped"] = len(p["drop"])

    print(json.dumps(p, indent=2))


if __name__ == "__main__":
    main()
