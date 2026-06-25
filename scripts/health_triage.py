#!/usr/bin/env python3
"""
health_triage — decide when a skill's health warrants a votable Issue, and rank the
open ones for the repair loop (hardening §7).

Two pure decisions, kept testable:
  - needs_comment(record): post to the skill's health Issue ONLY on a regression
    (score < 3, or a failure flag). A clean run says nothing — no Issue spam,
    mirroring how heartbeat notifies on state change only.
  - prioritize(records): rank open health items by human VOTES first, then severity,
    so self-improve / skill-repair fix what people care about + what's worst.

The GitHub glue (ensure issue, comment, read 👍/👎 reactions) lives in
scripts/health_issue.sh; this module is offline and unit-tested.
"""
import json
import sys

FAILURE_FLAGS = {"api_error", "empty_output", "rate_limited", "dead_citation", "stale_data"}
HIGH_FLAGS = {"api_error", "empty_output"}
MED_FLAGS = {"dead_citation", "stale_data", "rate_limited"}
_SEV_RANK = {"high": 3, "medium": 2, "low": 1, "none": 0}


def _flags(record):
    return set(record.get("flags") or [])


def needs_comment(record):
    """Regression = score in 1..2, or any failure flag present."""
    score = record.get("score")
    if isinstance(score, (int, float)) and 0 < score < 3:
        return True
    return bool(_flags(record) & FAILURE_FLAGS)


def severity(record):
    score = record.get("score")
    flags = _flags(record)
    if score == 1 or (flags & HIGH_FLAGS):
        return "high"
    if score == 2 or (flags & MED_FLAGS):
        return "medium"
    if needs_comment(record):
        return "low"
    return "none"


def prioritize(records):
    """Open health items (those needing attention), ranked by votes then severity."""
    items = []
    for r in records:
        if not needs_comment(r):
            continue
        items.append({
            "skill": r.get("skill"),
            "score": r.get("score"),
            "votes": int(r.get("votes", 0)),
            "severity": severity(r),
            "flags": sorted(_flags(r)),
        })
    items.sort(key=lambda x: (x["votes"], _SEV_RANK[x["severity"]]), reverse=True)
    return items


def main():
    records = []
    for line in sys.stdin.read().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except ValueError:
            continue
        if isinstance(obj, dict):
            records.append(obj)
        elif isinstance(obj, list):
            records.extend(x for x in obj if isinstance(x, dict))
    json.dump(prioritize(records), sys.stdout, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
