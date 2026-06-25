#!/usr/bin/env python3
"""
prune_skills — evolutionary pressure toward fewer, better skills, and cross-skill fix
propagation (hardening §4.5 / new idea #4).

Aeon can create skills but barely retires them (sprawl). Two pure helpers:

  retirement_candidates(records) — flag skills that earn removal: enabled-but-never-run,
    chronically-low-scoring, or dormant dead weight (disabled + never chained + never
    run). Core/meta skills are never flagged. ADVISORY — emits candidates + reasons; a
    human (or a gated skill) decides. The ratchet applied to whole skills.

  find_siblings(target, records) — skills sharing an API host with `target`. When one
    skill's repair fixes a changed/broken API, the fix should propagate to siblings
    instead of being rediscovered N times. skill-health already detects the *pattern*;
    this gives the *set* to patch.

Pure + unit-tested; the CLI assembles records from aeon.yml + cron-state + skill-health.
"""
import json
import sys

MIN_SCORED_FOR_QUALITY = 5
LOW_AVG = 2.5

# The load-bearing set (docs/CORE.md) — never retirement candidates.
CORE_SKILLS = {
    "autoresearch", "config-validator", "cost-report", "create-skill", "digest",
    "heartbeat", "onboard", "priority-brief", "reflect", "self-improve",
    "skill-evals", "skill-health", "skill-repair",
}


def retirement_candidates(records):
    """records: [{skill, enabled, total_runs, avg_score, runs_scored, chained, is_core}]."""
    out = []
    for r in records:
        if r.get("is_core"):
            continue
        skill = r.get("skill")
        enabled = bool(r.get("enabled"))
        runs = int(r.get("total_runs", 0) or 0)
        chained = bool(r.get("chained"))
        scored = int(r.get("runs_scored", 0) or 0)
        avg = r.get("avg_score")
        if enabled and runs == 0:
            out.append({"skill": skill, "reason": "enabled but never run", "confidence": "medium"})
        elif scored >= MIN_SCORED_FOR_QUALITY and isinstance(avg, (int, float)) and avg < LOW_AVG:
            out.append({"skill": skill, "reason": f"chronically low quality (avg {avg} over {scored})",
                        "confidence": "high"})
        elif not enabled and not chained and runs == 0:
            out.append({"skill": skill, "reason": "dormant: disabled, never chained, never run",
                        "confidence": "low"})
    # most actionable first
    rank = {"high": 3, "medium": 2, "low": 1}
    out.sort(key=lambda x: rank[x["confidence"]], reverse=True)
    return out


def find_siblings(target, records):
    """Skills (other than target) sharing at least one egress host with target."""
    by_name = {r["skill"]: set(h.lower() for h in (r.get("hosts") or [])) for r in records}
    th = by_name.get(target, set())
    if not th:
        return []
    return sorted(name for name, hosts in by_name.items()
                  if name != target and (hosts & th))


def main():
    # Best-effort assembly from the repo; advisory output only.
    import os
    import glob
    try:
        import yaml
    except ImportError:
        sys.stderr.write("prune_skills: needs PyYAML\n")
        sys.exit(2)

    cfg = yaml.safe_load(open("aeon.yml", encoding="utf-8")) if os.path.exists("aeon.yml") else {}
    skills_cfg = (cfg or {}).get("skills") or {}
    chains = (cfg or {}).get("chains") or {}
    chained = set()
    for cdef in chains.values():
        for step in (cdef.get("steps") or []) if isinstance(cdef, dict) else []:
            if isinstance(step, dict):
                chained.update(step.get("parallel") or [])
                if step.get("skill"):
                    chained.add(step["skill"])
    cron = {}
    if os.path.exists("memory/cron-state.json"):
        try:
            cron = json.load(open("memory/cron-state.json", encoding="utf-8"))
        except (OSError, ValueError):
            cron = {}
    records = []
    for name, scfg in skills_cfg.items():
        if not isinstance(scfg, dict):
            continue
        st = cron.get(name, {})
        avg = None
        hp = f"memory/skill-health/{name}.json"
        scored = 0
        if os.path.exists(hp):
            try:
                h = json.load(open(hp, encoding="utf-8"))
                avg = h.get("avg_score")
                scored = len(h.get("history") or [])
            except (OSError, ValueError):
                pass
        records.append({
            "skill": name, "enabled": bool(scfg.get("enabled")),
            "total_runs": st.get("total_runs", 0), "avg_score": avg, "runs_scored": scored,
            "chained": name in chained, "is_core": name in CORE_SKILLS,
        })
    json.dump({"retire": retirement_candidates(records), "count": len(records)},
              sys.stdout, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
