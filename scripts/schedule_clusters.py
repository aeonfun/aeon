#!/usr/bin/env python3
"""
schedule_clusters — find cache-reuse opportunities in aeon.yml cron schedules.

Every skill run pays for a static prefix (CLAUDE.md + STRATEGY.md) sent to the
model. Anthropic prompt-caching is server-side and keyed by the prefix, so two
runs whose cron times fall inside the cache TTL window share one cache creation
— the first warms it, the rest read it. Staggering skills hours apart (e.g.
10:00, 10:10, 15:00, 16:00 …) defeats that: each becomes a cold start.

This tool groups enabled skills' daily fire-times into windows and reports how
many cold starts you have vs how many you'd have if neighbours were clustered.
It's advisory — it never edits schedules (enabling/moving skills is the operator's
call); it just shows where the cheap wins are.

Usage:
  scripts/schedule_clusters.py [aeon.yml] [--window 5] [--json]
"""
import argparse
import json
import sys

try:
    import yaml
except ImportError:
    sys.stderr.write("schedule_clusters: needs PyYAML\n")
    sys.exit(2)

NON_CRON = {"workflow_dispatch", "reactive", ""}


def _field(spec, lo, hi):
    """Expand one cron field (minute or hour) into the set of matching values."""
    vals = set()
    for part in spec.split(","):
        part = part.strip()
        step = 1
        if "/" in part:
            part, s = part.split("/", 1)
            step = int(s)
        if part in ("*", ""):
            rng = range(lo, hi + 1)
        elif "-" in part:
            a, b = part.split("-", 1)
            rng = range(int(a), int(b) + 1)
        else:
            rng = [int(part)]
        for v in rng:
            if lo <= v <= hi and (v - (rng[0] if hasattr(rng, "__getitem__") else lo)) % step == 0:
                vals.add(v)
    return vals


def fire_minutes(cron):
    """Daily fire-times of a 5-field cron, as minutes-of-day (ignores DOW/month
    for time-of-day clustering; DOW is surfaced separately as a caveat)."""
    parts = cron.split()
    if len(parts) < 5:
        return [], False
    minutes = _field(parts[0], 0, 59)
    hours = _field(parts[1], 0, 23)
    dow_restricted = parts[4].strip() != "*" or parts[2].strip() != "*"
    return sorted(h * 60 + m for h in hours for m in minutes), dow_restricted


def hhmm(mins):
    return f"{mins // 60:02d}:{mins % 60:02d}"


def cluster(events, window):
    """Greedy-group (minute, skill) events into <=window clusters by time."""
    events = sorted(events)
    clusters, cur = [], []
    for ev in events:
        if cur and ev[0] - cur[0][0] > window:
            clusters.append(cur)
            cur = []
        cur.append(ev)
    if cur:
        clusters.append(cur)
    return clusters


def analyze(config, window):
    skills = (config or {}).get("skills") or {}
    events, dow_notes = [], []
    for name, cfg in skills.items():
        if not isinstance(cfg, dict) or not cfg.get("enabled"):
            continue
        sched = str(cfg.get("schedule", "")).strip()
        if sched in NON_CRON:
            continue
        mins, dow = fire_minutes(sched)
        for m in mins:
            events.append((m, name))
        if dow:
            dow_notes.append(name)
    clusters = cluster(events, window)
    cold = [c for c in clusters if len(c) == 1]
    return {
        "enabled_cron_skills": len({e[1] for e in events}),
        "fire_events": len(events),
        "clusters": len(clusters),
        "cold_starts": len(clusters),       # one prefix-cache creation per cluster
        "singletons": len(cold),
        "reuse_if_clustered": max(0, len(events) - len(clusters)),
        "cluster_detail": [
            {"window": f"{hhmm(c[0][0])}-{hhmm(c[-1][0])}", "skills": [e[1] for e in c]}
            for c in clusters
        ],
        "dow_restricted": sorted(set(dow_notes)),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("config", nargs="?", default="aeon.yml")
    ap.add_argument("--window", type=int, default=5, help="cache window minutes (default 5)")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    config = yaml.safe_load(open(args.config, encoding="utf-8"))
    r = analyze(config, args.window)

    if args.json:
        print(json.dumps(r, indent=2))
        return

    print(f"Schedule cache analysis ({args.config}, window={args.window}m)")
    print(f"  enabled cron skills : {r['enabled_cron_skills']}")
    print(f"  daily fire events   : {r['fire_events']}")
    print(f"  cache clusters      : {r['clusters']}  (= prefix-cache creations/day)")
    print(f"  lone cold starts    : {r['singletons']}")
    print(f"  reuse if clustered  : {r['reuse_if_clustered']} more cached runs/day")
    if r["cluster_detail"]:
        print("  clusters:")
        for c in r["cluster_detail"]:
            tag = "  <- singleton (cold)" if len(c["skills"]) == 1 else ""
            print(f"    {c['window']}  {', '.join(c['skills'])}{tag}")
    if r["dow_restricted"]:
        print(f"  note: day/week-restricted (cache shared only on matching days): "
              f"{', '.join(r['dow_restricted'])}")
    if r["singletons"] > 1:
        print(f"\n  → {r['singletons']} skills fire alone. Nudging neighbours into shared "
              f"{args.window}m windows would warm-cache {r['reuse_if_clustered']} runs/day.")


if __name__ == "__main__":
    main()
