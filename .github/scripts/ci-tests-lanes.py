#!/usr/bin/env python3
# Usage: gh run view <ci-tests run id> --log -R aeonfun/aeon | python3 .github/scripts/ci-tests-lanes.py [--lanes 10]
"""Rebalance scripts/tests/ci-lanes.txt from a ci-tests run's suite timings.

Reads the `suite-time: <secs>s <name>` lines that scripts/tests/run_ci_lane.sh
prints, then reassigns every suite to a lane, longest first, each to the lane
with the least total time so far (0.5s floor per suite). Suites with no
timing count as the median.
Rewrites only the lane column; order, names, commands and comments stay. Keep
--lanes equal to the number of lane steps in ci-tests.yml (GitHub runs at most
10 parallel steps at once); run_ci_lane.sh --check fails on a mismatch.
"""

import argparse
import re
import statistics
import sys
from pathlib import Path

LIST = Path(__file__).resolve().parents[2] / "scripts" / "tests" / "ci-lanes.txt"
TIME_RE = re.compile(r"suite-time: ([0-9.]+)s (.+?)\s*$")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lanes", type=int, default=10)
    args = ap.parse_args()
    if not 1 <= args.lanes <= 10:
        sys.exit("--lanes must be 1-10")

    times: dict[str, list[float]] = {}
    for line in sys.stdin:
        m = TIME_RE.search(line)
        if m:
            times.setdefault(m.group(2), []).append(float(m.group(1)))
    if not times:
        sys.exit("no 'suite-time:' lines on stdin")
    # 0.5s floor: a suite never costs nothing (process start, log group).
    med = {n: max(statistics.median(v), 0.5) for n, v in times.items()}

    lines = LIST.read_text().splitlines()
    rows = []  # (index in lines, name, command)
    for i, line in enumerate(lines):
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        _, name, cmd = (p.strip() for p in line.split("|", 2))
        rows.append((i, name, cmd))

    default = statistics.median(med.values())
    missing = [n for _, n, _ in rows if n not in med]
    if missing:
        print(f"no timing for {len(missing)} suite(s), using {default:.1f}s: " + ", ".join(missing), file=sys.stderr)

    totals = [0.0] * args.lanes
    lane_of = {}
    for _, name, _ in sorted(rows, key=lambda r: (-med.get(r[1], default), r[1])):
        lane = min(range(args.lanes), key=lambda k: (totals[k], k))
        totals[lane] += med.get(name, default)
        lane_of[name] = lane + 1

    for i, name, cmd in rows:
        lines[i] = f"{lane_of[name]} | {name} | {cmd}"
    LIST.write_text("\n".join(lines) + "\n")

    for k, t in enumerate(totals, 1):
        n = sum(1 for v in lane_of.values() if v == k)
        print(f"lane {k}: {t:5.1f}s  {n} suites", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
