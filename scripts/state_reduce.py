#!/usr/bin/env python3
"""
state_reduce — fold append-only run events into the cron-state schema (hardening §3).

Today `memory/cron-state.json` is a shared file rewritten on every skill run, which
forces the rebase-retry + auto-conflict-resolver loop in aeon.yml (git used as a
concurrent DB). The fix: each run *appends* an immutable event (a GitHub Issue
comment — no commit, no conflict), and the canonical state is *derived* by folding
the events. This module is that fold, kept pure so it's unit-testable.

Event (one JSON object per line on stdin):
  {"skill":"x","status":"success|failed","ts":"2026-06-17T12:00:00Z",
   "quality_score":4,"error":"sig"}   # quality_score/error optional

Output: the same aggregate shape aeon.yml's apply_state_update produces, so heartbeat
/ skill-health read it unchanged.
"""
import json
import sys


def _blank():
    return {
        "last_status": None, "last_success": None, "last_failed": None,
        "total_runs": 0, "total_successes": 0, "total_failures": 0,
        "consecutive_failures": 0, "success_rate": 0.0,
        "last_quality_score": None, "last_error": None,
    }


def reduce_events(events):
    """Fold a list of event dicts (any order) into {skill: aggregate}."""
    state = {}
    for e in sorted(events, key=lambda x: (x.get("ts") or "")):
        skill = e.get("skill")
        if not skill:
            continue
        s = state.setdefault(skill, _blank())
        status = "success" if e.get("status") == "success" else "failed"
        s["total_runs"] += 1
        if status == "success":
            s["total_successes"] += 1
            s["consecutive_failures"] = 0
            s["last_status"] = "success"
            if e.get("ts"):
                s["last_success"] = e["ts"]
        else:
            s["total_failures"] += 1
            s["consecutive_failures"] += 1
            s["last_status"] = "failed"
            if e.get("ts"):
                s["last_failed"] = e["ts"]
            if e.get("error"):
                s["last_error"] = e["error"]
        if e.get("quality_score") not in (None, 0):
            s["last_quality_score"] = e["quality_score"]
        s["success_rate"] = round(s["total_successes"] / s["total_runs"], 2)
    return state


def parse_jsonl(text):
    """Lenient JSONL: skip blank lines and non-JSON lines (e.g. comment chatter)."""
    out = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except ValueError:
            continue
        if isinstance(obj, dict):
            out.append(obj)
        elif isinstance(obj, list):
            out.extend(x for x in obj if isinstance(x, dict))
    return out


def main():
    events = parse_jsonl(sys.stdin.read())
    json.dump(reduce_events(events), sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
