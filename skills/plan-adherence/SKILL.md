---
name: Plan Adherence
description: Scan written decisions, plans, and goals across the fleet. Surface expired falsifier windows, drift from stated commitments, and collisions between decisions. The goal-drift detector.
var: ""
tags: [meta]
---
<!-- Phase 0 of the Aeon Control Tower plan (~/.claude/plans/humming-discovering-thimble.md, Section 6.5). The eval layer above output-quality grading. Catches the "we said we'd be live trading on PM and we're not" class of slop. -->

> **${var}** — Optional focus scope. Pass a source filename (`DECISIONS.md`), an ADR number (`ADR-093`), a topic (`polymarket`, `grants`, `phd`), or leave empty for full scan.

Today is ${today}. Scan the written record of decisions, plans, and commitments across the fleet. For each commitment with a falsifier — a target date, a "consequences if X" clause, a stated metric — check whether reality is still tracking the plan. Surface every expired falsifier, every silent goal drift, every collision between decisions.

The output is operator-actionable: each finding names the original decision, the reality check that fired, and the single highest-leverage next step.

## Why this skill exists

Most slop in long-running agentic systems is not a bad tweet. It's a decision made three weeks ago that nobody is checking against reality. The aeon → swarm-fund signal wire that was scheduled to ship by 2026-05-17, didn't, and has been 404-ing every 15 minutes for two weeks. The 20-variant runner-swarm cohort sitting in canary because a feature flag was never flipped. The grant pipeline with eight named programs and no application submitted in 30 days. The Stanford PhD timeline with paper-pick running and zero papers actually filed into the application packet.

Each of those is "what we said good looks like vs what's actually shipping" — same pattern as a content eval, different units. This skill is the goal-drift eval.

## Sources to scan

Two tiers. Tier 1 is required; the skill must produce useful output reading only Tier 1. Tier 2 is best-effort and degrades gracefully if absent.

### Tier 1 — Authoritative, always read

**swarm-fund-mvp repo** (via `gh api repos/tomscaria/swarm-fund-mvp/contents/<path>` — works in the GH Actions sandbox):
- `DECISIONS.md` — ADRs. Largest source. Each ADR has Context / Decision / Consequences / Evidence sections. Many include falsifier windows ("if X within ~N weeks") or target dates.
- `TASKS.md` — open work items.
- `CODEX_HANDOFF.md` — known issues and deferred PRs being handed across sessions.
- `kb/INDEX.md` — knowledge base index; some entries are commitments to write specific notes.

**aeon repo** (local, read directly):
- `memory/topics/swarm-fund.md` — high-level architecture and progress notes.
- `memory/topics/grants.md` — grant pipeline with deadlines.
- `memory/topics/papers.md` — PhD-prep paper queue.
- `memory/topics/polymarket.md` — Polymarket-specific commitments.
- `memory/topics/milestones.md` — milestone tracker.
- `memory/topics/aeon-ops.md` — Aeon operational decisions.
- `memory/MEMORY.md` — top-level index with stated goals.

### Tier 2 — Best-effort, degrade gracefully

- **Thomas OS** (`~/scaria/Thomas OS/MASTER_PLAN.md`, `TASKS.md`, `BACKLOG.md`) — only readable when this skill runs locally, NOT from GH Actions. If the path doesn't exist, record `thomas_os=skip:not-in-sandbox` in the source-status footer and continue.
- **`docs/superpowers/specs/`** — design specs from brainstorming sessions.
- **`~/.claude/plans/`** — Claude Code session plan files (current and recent). Same sandbox caveat as Thomas OS.

Record source status in the output footer. Never abort on a missing optional source.

## Configuration

Read `memory/plan-adherence-config.yml` at the START of every run. It lists the repos to scan, source paths per repo, priority levels, reality-check thresholds, and the trading-metrics URL. The config is the SINGLE source of truth for "what does Aeon watch." Do not hardcode repo names or paths in this SKILL.md — read from the config so the same skill works for `tomscaria/swarm-fund-mvp` and (when enabled) `refractor-labs/prysm-squads-mvp` without code changes.

If the config file is absent, fall back to defaults: scan `tomscaria/swarm-fund-mvp` with priority 1 plus aeon-local memory/topics. Log `PLAN_ADHERENCE_CONFIG_MISSING` and continue.

## Steps

### 0. Verify reality-check sources are live (HARD PREREQUISITE — do NOT skip)

The 2026-05-31 first-run-against-stale-MEMORY.md taught the load-bearing lesson: classifying findings against a stale snapshot produces phantom drift. Reality-check sources must be verified current BEFORE any commitment is extracted or classified.

Validate, in order:

1. **`context/last-sync.json`** must exist and `timestamp` must be within `reality_check.context_last_sync_max_age_hours` (default 8h). If older, output `REALTIME_DATA_STALE: context last-sync is ${age_hours}h old, threshold ${threshold}h. Run context-sync.sh and re-dispatch.` and EXIT. Phantom findings are worse than no findings.
2. **Trading metrics URL** (`reality_check.trading_metrics_url`, default `https://rswarm.ai/metrics.json`) — fetch and confirm it returns valid JSON with an `agents` array. Cache the parsed response for use in later steps (any commitment about trading state references this, not stale memory). If the fetch fails, record `trading_metrics=stale` and proceed but cap all trading-related findings at P1 (cannot make P0 claims without live verification).
3. **`gh api` reachability** — issue one `gh api rate_limit` call. If it fails with 401/403, record `gh_api=auth_fail` in source-status footer, do NOT attempt any other gh calls, and proceed with aeon-local sources only. (Workflow normally sets `GH_TOKEN: secrets.GH_GLOBAL || secrets.GITHUB_TOKEN`; if `GH_GLOBAL` PAT is missing or scope-limited, cross-repo reads will 404.)
4. **`memory/logs/` and `memory/issues/INDEX.md`** must exist and be writable. If missing, create them; the skill cannot file findings without these targets.
5. **`memory/cron-state.json`** — if missing, create as empty `{}`. (Older Aeon instances may not have it yet.)

Only after all five pass does the skill proceed to Step 1. The status of each check goes into the final source-status footer.

### 1. Extract commitments from each source

For every section / ADR / bullet in the Tier 1 sources, identify whether it contains a **commitment** — a falsifiable, time-bound, or metric-bound statement. Specifically extract anything matching these patterns:

| Pattern | Example | What to extract |
|---|---|---|
| Explicit falsifier window | "if Aeon doesn't ship within ~2 weeks, the wire-up is aspirational" | `falsifier_text`, `target_date = decision_date + window`, `falsifier_check_hint` |
| Target date | "PhD application target Dec 2026" | `target_date` |
| Metric target | "100-trade Apex gate", "$150/week soft cap" | `metric_name`, `target_value` |
| Feature-flag dependency | "gated on `--enable-runner-canary-live`" | `dependency_name`, `dependency_kind=flag` |
| Pending action | "next is X" / "todo: Y" / "still need to Z" | `pending_action` |
| Inter-repo contract | "aeon ships outputs/{skill}/{date}.json; swarm-fund polls it" | `producer`, `consumer`, `contract_path` |
| Schedule commitment | "weekly Monday 2PM UTC" | `cadence`, `expected_last_run` |

For each commitment, also capture:
- `source_path` — file + line ref (e.g. `swarm-fund-mvp/DECISIONS.md:ADR-093`)
- `decision_date` — when stated (from ADR header, git blame, or context)
- `id` — stable slug derived from source + a short canonical phrase

### 2. Check reality per commitment

For each extracted commitment, run a targeted reality check. Reuse the existing context pipeline outputs (`context/trading/*.json`) where applicable so this skill stays cheap. New checks per commitment type:

- **Falsifier window with `target_date < today`** → run the named check if `falsifier_check_hint` provides one (e.g. `ls tomscaria/aeon/outputs/` for ADR-093). Otherwise mark as `MANUAL_CHECK_NEEDED` and surface the falsifier text verbatim.
- **Metric target** → look up the current metric value. For trading metrics, read `context/trading/revenant-snapshot.json`, `agents-summary.json`, `costs-summary.json`. For grant counts, read `memory/topics/grants.md` and grep for `submitted:` or status markers. Compute `progress = current / target`, `velocity = activity_count_last_14d / 14`, and project a `projected_completion_date`.
- **Feature-flag dependency** → check whether the flag is set. For launchd plists, read `~/Library/LaunchAgents/ai.rswarm.trading-loop.plist` (local only). For environment-style flags in deployed services, this is `MANUAL_CHECK_NEEDED`.
- **Pending action** → search the last 30 days of `memory/logs/*.md` and `git log --since="30 days ago"` for keywords matching the action. If zero matches, mark `STALLED`.
- **Inter-repo contract** → use `gh api repos/<consumer>/contents/<contract_path>` to verify the producer side actually publishes the contract. If 404, mark `CONTRACT_BROKEN`.
- **Schedule commitment** → cross-reference `memory/cron-state.json` (for Aeon skills) or `git log` (for hand-driven commitments). If `last_success > 2x cadence`, mark `OVERDUE`.

### 3. Classify findings into severity tiers

| Severity | Rule |
|---|---|
| **P0 — critical drift** | Inter-repo contract broken; falsifier expired by ≥ 14 days; metric trending in wrong direction with ≥ 30 day horizon to target; trading-loop or revenue-relevant commitment stalled |
| **P1 — material drift** | Falsifier expired 0–13 days ago; metric on track but velocity insufficient (will miss by > 20%); feature flag still off after committed flip date |
| **P2 — watch** | Pending action stalled but not yet past a hard date; schedule commitment OVERDUE but recoverable; ambiguous reality check needs manual verification |
| **P3 — collision** | Two decisions contradict (later one implicitly reverses earlier without explicit closure); a stated goal in MEMORY.md conflicts with an ADR in DECISIONS.md |

A finding can only land at P0 if the reality check is concrete and definitive (file existence, count, exact comparison). Soft signals max out at P1.

### 4. Detect collisions explicitly

After classifying individual commitments, run one pass to surface collisions:

- **Decision contradictions** — pairs of ADRs / topic-file statements where the later one would reverse the earlier one if executed. Surface only when the earlier one has not been marked superseded.
- **Goal-vs-decision conflicts** — a stated goal in `memory/MEMORY.md` or `memory/topics/*.md` that an ADR in DECISIONS.md implicitly precludes (e.g. "trade on Polymarket as primary venue" vs "PM datacenter geoblock unresolved, canary-live off").
- **Resource collisions** — two commitments that both demand the same limited resource (time, capital, attention) without explicit prioritization.

Output collisions as their own P3 tier so they don't crowd individual-commitment findings.

### 5. Dedup against prior run

Read `memory/plan-adherence-state.json` if it exists. Skip any finding whose `id + reality_check_signature` matches a finding from the last run UNLESS:
- Severity escalated since last run
- The finding is now ≥ 14 days old without progress (escalates to one severity tier higher)
- Operator marked the prior finding as `dismissed` (skip permanently — see Section 7)

Persist new state at the end of the run.

### 6. Format the report

```
*Plan Adherence — ${today}*

Summary: N findings (P0: a, P1: b, P2: c, P3: d) — overall ↑/→/↓ vs prior run.
Sources: swarm-fund=ok, aeon-memory=ok, thomas-os=skip:not-in-sandbox, plans=ok

═══ P0 — Critical drift ═══

• ADR-093 / aeon outputs contract broken (14d expired)
  Decision: swarm-fund-mvp/DECISIONS.md:ADR-093 (2026-05-03) — "aeon ships outputs/{skill}/{date}.json by 2026-05-17; if not, wire-up is aspirational."
  Reality: `gh api repos/tomscaria/aeon/contents/outputs` → 404. python/execution/aeon_adapter.py polling every 15 min for 14 days, all failing silently.
  Action: ship the JSON contract from monitor-polymarket, polymarket-comments, narrative-tracker. Aeon adapter unblocks immediately.

═══ P1 — Material drift ═══

• runner_swarm canary-live still off
  Decision: swarm-fund-mvp/DECISIONS.md:ADR-105 (2026-05-17) — canary-execution code path shipped, gated on --enable-runner-canary-live. 20 variants frozen on paper.
  Reality: CODEX_HANDOFF.md flags "runner-swarm-live is off AND PM datacenter geoblock is unresolved." 14d since ADR shipped; flag not flipped.
  Action: resolve PM datacenter geoblock OR flip flag with HL-only execution while geoblock is open. Confirm PR #35 entry_price fix before flipping.

═══ P2 — Watch ═══

• Grant pipeline — no submissions in 30 days
  Decision: memory/topics/grants.md — eight named programs (AWS Activate, Anthropic Research Credits, dYdX Grants, Uniswap Foundation Fellowship, Polymarket Builders, Harmonic, …) committed as near-term income priority.
  Reality: zero `submitted:` markers in last 30 days of logs. No PRs touching grant artifacts.
  Action: name the next one to submit + a target date. Pick by deadline proximity.

═══ P3 — Collisions ═══

• Polymarket as primary venue vs PM geoblock unresolved
  Decisions: MEMORY.md states PM as signal+execution venue; CODEX_HANDOFF.md notes PM datacenter geoblock unresolved on runner_swarm cohort.
  Resolution needed: either downgrade PM in MEMORY.md to "CalibrationGap-only until geoblock resolved," or escalate geoblock fix.

Footer: deduped K findings from prior run. New: M. Escalated: P. Persisted state to memory/plan-adherence-state.json.
```

Omit any tier with zero findings. If all tiers are empty, output `PLAN_ADHERENCE_OK · 0 findings` and skip the notification.

### 7. Persist state

Write `memory/plan-adherence-state.json`:

```json
{
  "run_at": "YYYY-MM-DDTHH:MM:SSZ",
  "findings": {
    "<finding-id>": {
      "severity": "P0|P1|P2|P3",
      "first_seen": "YYYY-MM-DD",
      "last_seen": "YYYY-MM-DD",
      "reality_check_signature": "<short hash of the failing check>",
      "status": "open|escalated|dismissed",
      "source_path": "swarm-fund-mvp/DECISIONS.md:ADR-093"
    }
  }
}
```

Never delete a finding silently. When a finding clears (reality check now passes), set `status: resolved` and move to a `resolved_findings` section so the next run knows it can stop reporting. Operator-marked `dismissed` findings stay in state forever.

**Atomic write pattern (required):**

```bash
STATE_TMP="memory/plan-adherence-state.json.tmp"
# Serialize findings to STATE_TMP (Python's json.dump for validation)
python3 -c "import json; json.dump(${FINDINGS_DICT_LITERAL}, open('${STATE_TMP}', 'w'), indent=2)" \
  && mv "$STATE_TMP" "memory/plan-adherence-state.json" \
  || { echo "STATE_WRITE_FAILED" >&2; rm -f "$STATE_TMP"; }
```

If the write fails (disk full, permissions), append `STATE_WRITE_FAILED` to `memory/logs/${today}.md` and continue. Findings still surface via the notification; only the dedup-state for next run is degraded.

### 8. Notify and log

If P0 or P1 findings exist:
- Send the full formatted report via `./notify`. The notification is long-form — fleet drift is worth a paragraph.

If only P2/P3:
- Send a one-line summary via `./notify` with a pointer to the full output in the dashboard.

Always write the full report to `dashboard/outputs/plan-adherence-${timestamp}.json` (via `./notify-jsonrender plan-adherence <full-report>`) so it lands in Zone B (NEEDS-EYES) of the control tower once the dashboard work in Phase 1 ships.

Append to `memory/logs/${today}.md`:
```
### plan-adherence
- Scanned: N commitments across X sources
- Findings: P0=a, P1=b, P2=c, P3=d (overall ↑/→/↓)
- Top finding: <short title of highest-severity item>
- State persisted: memory/plan-adherence-state.json
- Sources: <source-status footer verbatim>
```

## Composition with other skills

- **goal-tracker** (existing) handles short-term goal-vs-activity for items already in MEMORY.md. plan-adherence handles longer-horizon, written-down commitments across the full decision corpus. They overlap intentionally — when both fire on the same goal, plan-adherence's finding takes precedence (it has the decision document, not just the goal title).
- **heartbeat** handles operational drift (failed skills, stuck dispatches). plan-adherence handles strategic drift (broken contracts, missed targets). They are siblings, not duplicates.
- **eval-judge** (Phase 2) will grade plan-adherence's own outputs against a rubric just like any other content skill. Higher recall on real drift > pretty prose.

## Sandbox notes

- `gh api repos/<owner>/<repo>/contents/<path>` — works inside GH Actions **only** when `GH_TOKEN` is a PAT with cross-repo scope. The workflow sets `GH_TOKEN: ${{ secrets.GH_GLOBAL || secrets.GITHUB_TOKEN }}`; if `GH_GLOBAL` is missing or scope-limited, cross-repo reads 404. Step 0 verifies reachability with one `gh api rate_limit` call before any cross-repo work.
- Returned content is base64-encoded; decode with `base64 -d` or `jq -r .content | base64 -d`.
- Local-only paths (`~/scaria/Thomas OS/...`, `~/.claude/plans/...`) — record `skip:not-in-sandbox` for these sources when running in GH Actions. When the skill runs locally (operator-triggered), these sources become available — same skill, richer signal.
- `gh api` rate limit: at 5,000 req/hr per token, well above this skill's needs (~30 calls per run). No backoff needed.
- Missing source file: if `gh api repos/<owner>/<repo>/contents/DECISIONS.md` returns 404, record `<repo>_decisions_md=missing` and continue with that repo's other sources. A newly-adopted repo may not have DECISIONS.md yet.

## Portability (adopting plan-adherence in a new repo)

The skill's logic is fully reusable. Repo paths and source lists are read from `memory/plan-adherence-config.yml`. To extend plan-adherence to scan a new repo (e.g. `refractor-labs/prysm-squads-mvp`):

1. Add a new entry under `repositories:` in `memory/plan-adherence-config.yml` with `enabled: false` to start.
2. Confirm `GH_GLOBAL` PAT has read scope on the new repo.
3. Confirm the new repo has at least one Tier 1 source (DECISIONS.md or MASTER_PLAN.md).
4. Flip `enabled: true` and run plan-adherence once manually. Triage findings.
5. Findings file as ISS-NNN.md per `conventions/issue-schema.md`. Use a per-repo prefix (e.g. `PRYSM-NNN`) if cross-repo number collisions are a concern.

See `conventions/CONVENTIONS.md` (Cross-repo source configuration) for the full rationale.

## Constraints

- Never invent a commitment. If a falsifier window or target date isn't stated explicitly in the source, do not infer one — surface the commitment with `target_date: unspecified` and let the operator decide.
- Never propose an action that requires the operator to "review more" or "consider." Every Action line names a concrete next step.
- Never mark a finding resolved without a concrete passing check. Prefer surfacing a stale P1 to silently clearing it.
- Output must include the source_path verbatim so the operator can jump to the original decision. No paraphrase-only references.
- This skill reads and annotates; it does not edit DECISIONS.md, TASKS.md, or any source file. Drift is reported, never silently fixed.
