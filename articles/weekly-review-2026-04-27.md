# Weekly Review — 2026-04-27

## TL;DR

The week shipped 26 articles, indexed 5 PhD-relevant papers, and stood up the issue tracker (15 open). The bottleneck is unambiguous: `./notify` hook-block fired 90+ times in 2026-04-27's log alone and there is no `scripts/postprocess-notify.sh` in tree to drain the queue. Top action for next week: land that drain script by 2026-04-30 so daily skill output actually leaves the box.

## Last week's actions — closed loop

_No prior review to audit — this is the baseline._

## Metrics

| Metric | This week | Prior week | Δ |
|---|---|---|---|
| Skill runs (lifetime, cron-state) | 1,033 | — | — |
| Successes / failures (lifetime) | 194 / 839 | — | — |
| Lifetime success rate | 18.8% | — | — |
| Skills with `consecutive_failures > 0` | 0 / 83 | — | — |
| Articles written (last 3 active days) | 26 | — | — |
| `./notify` hook-block fallbacks (Apr 25 + 26 + 27 logs) | 135 | — | — |
| New issues opened | 15 (ISS-001..015) | — | — |
| Issues resolved | 0 | — | — |
| Commits in last 7 days | 1 (`8433039`) | — | — |
| PRs merged (this repo) | 0 | — | — |
| Pending PRs flagged in MEMORY | 4 (`tomscaria/aeon#1`, swarm-fund #18/#19/#20, this-repo PR #4) | — | — |

_Source note: `./scripts/skill-runs --hours 168 --json` is sandbox-blocked from this session; metrics fall back to `memory/cron-state.json` (lifetime totals, not 7-day) and direct file/log inspection. **Degraded source.**_

The 18.8% lifetime success rate looks alarming in isolation. The `consecutive_failures: 0` across all 83 skills says the inverse — recent runs are stable. Most failures are bootstrap-era noise from before the prefetch and queue patterns landed.

## Findings (KALM, prioritized)

### Keep

- **paper-pick PhD-prep is doing real work.** 5 papers indexed into MEMORY this week, all directly load-bearing for the Stanford application: LiveTradeBench (`arXiv:2511.03628`, Polymarket as a first-class eval), TruthTensor (`arXiv:2601.13545`, multi-axis live PM evaluation), Agentic World Modeling (`arXiv:2604.22748`, L1/L2/L3 maps onto Birth→Canary→Apex), LLaTiSA (`arXiv:2604.17295`), Le 2026 four-component decomposition (`arXiv:2602.19520`). Evidence: `memory/MEMORY.md` "Recent papers" block; `articles/explainer-2026-04-27.md` (Le decomposition explainer). Priority 4×4÷2 = 8.
- **Daily article skill is producing grant-grade narrative ammo.** This week: insider-trading prosecution piece (`articles/research-brief-us-prediction-market-insider-trading-enforcement-2026-04-27.md`), Kalshi/Polymarket conduct-rules piece (`articles/2026-04-27.md`), Kalshi/Polymarket crypto perps brief. All three are quotable in grant applications and LP narrative. Priority 5×4÷2 = 10.
- **Issue tracker mechanics work end-to-end.** 15 issues filed this week with proper YAML frontmatter, severity, category, detected_by. ISS-013 captured the 2026-04-26 23:53–58Z mass-failure storm with 53 affected skills enumerated. Priority 3×3÷2 = 4.5.

### Add

- **`scripts/postprocess-notify.sh` is missing from the tree.** MEMORY explicitly notes this. The notify hook-block fires repeatedly (135 log mentions across 3 days, 92 in 2026-04-27 alone), each falling back to `.pending-notify/{ts}.md`. The directory currently shows zero files — meaning either the postprocess does run somewhere or messages are being silently dropped. Either way: the script is not in tree and not auditable. Priority 5×5÷2 = 12.5.
- **Hermes-arb basis recorder for Kalshi-BRTI vs PM-Chainlink.** Kalshi crypto perps went live 2026-04-27 NYC. First-24h-of-trading tape is the load-bearing dataset for the convergence trade. No recorder exists yet. Evidence: `memory/MEMORY.md` "Next Priorities" + `articles/research-brief-kalshi-polymarket-crypto-perps-2026-04-27.md`. Priority 4×5÷3 = 6.7.
- **INDEX.md auto-update on new ISS-* file.** `memory/issues/ISS-015.md` exists with `status: open` and full frontmatter, but is not listed in `memory/issues/INDEX.md` Open table (which still shows ISS-001 through ISS-014). Health skills filing duplicates is the failure mode. Priority 3×3÷1 = 9.

### Less

- **`./notify` hook-block churn.** 92 `pending-notify`/`hook-block`/`fell back to` log mentions in 2026-04-27 alone. Every skill that calls `./notify "$(cat …)"` re-hits the same `Unhandled node type: string` bug, queues, moves on. The fact that `.pending-notify/` is currently empty means either workflow-side pickup works (untracked) or messages vanish. Both possibilities are bad. Evidence: every skill output section in `memory/logs/2026-04-27.md` referencing `.pending-notify/`. Priority 5×5÷2 = 12.5 (same root as Add #1; treat as one action).
- **chain-runner.yml `dispatch_skill()` DEGRADED.** Now confirmed across morning-brief, evening-rollup, AND weekly-grant-update. Evidence: `memory/MEMORY.md` OPS ALERTS line; `memory/topics/aeon-ops.md`. Same pattern (chain wrapper fails, individual steps still run if dispatched separately). Priority 4×5÷2 = 10.
- **Lifetime success rate 18.8% across 83 skills.** 33 skills sit below 20% lifetime success. Bootstrap noise weights the denominator, but 19 runs of `monitor-polymarket` for 2 successes is not just historical — it's the highest-leverage daily skill for the Apex push and it's not running clean. Evidence: `memory/cron-state.json`. Priority 4×4÷3 = 5.3.

### More

- **`monitor-polymarket` and `polymarket-comments`.** MEMORY explicitly tags these as "the highest-leverage daily skills" for the Apex push. Both have lifetime success rates of 11% and 17%. Both ran a handful of times this week. Evidence: `memory/cron-state.json` (`monitor-polymarket: 19 runs, 2 succ`; `polymarket-comments: 18 runs, 3 succ`). Priority 5×4÷3 = 6.7.
- **`weekly-shiplog` Mondays → grant committees.** MEMORY says "ran successfully under the chain consume step despite wrapper failure." Today is 2026-04-27 (Monday). One run isn't a forwarding pipeline. Priority 3×4÷3 = 4.

### Top 5 (sorted by priority)

1. Notify drain script (Add #1 / Less #1, same action) — 12.5
2. chain-runner.yml fix (Less #2) — 10
3. Daily article skill keep — 10
4. INDEX.md auto-update / ISS-015 row (Add #3) — 9
5. paper-pick PhD-prep keep — 8

## Next week — actions

- [ ] Land `scripts/postprocess-notify.sh` that drains `.pending-notify/*.md` to Telegram/Discord/Slack via the same fanout shape as `./notify`, wire it into the post-run workflow step, by 2026-04-30
  - Why: 92 hook-block fallbacks in 2026-04-27 alone; queue exists but no auditable drainer is in tree
  - Done when: a test message dropped into `.pending-notify/` arrives in Telegram within one workflow cycle, and the file is removed from the queue

- [ ] Fix `chain-runner.yml` `dispatch_skill()` DEGRADED across morning-brief, evening-rollup, weekly-grant-update — add an echo per dispatched skill before each `gh workflow run`, by 2026-04-29
  - Why: 3+ chains hit DEGRADED state per MEMORY; one fix unblocks Apex-pushing daily skills
  - Done when: next morning-brief chain run produces the full set of expected outputs (`monitor-polymarket`, `polymarket-comments`, et al) and posts a single combined message, not a wrapper-fail line

- [ ] Wire Kalshi-BRTI vs PM-Chainlink basis recorder for hermes-arb — daily basis CSV/Parquet snapshot committed to `tomscaria/swarm-fund-mvp`, by 2026-05-01
  - Why: Kalshi crypto perps live 2026-04-27 NYC; first 72h tape is unrecoverable later
  - Done when: a recorder script lands in swarm-fund-mvp, runs once on cron, produces a non-empty `data/hermes/basis-2026-04-XX.parquet`

- [ ] Patch `evals.json` keys (`hn-digest` → `hacker-news-digest`, `polymarket` → `monitor-polymarket`) and resolve ISS-007 + ISS-009 in `memory/issues/INDEX.md`, by 2026-04-28
  - Why: cheapest skill-evals NEW_FAIL clear available; spec-drift, no code change
  - Done when: ISS-007 and ISS-009 move to Resolved table in INDEX.md, next skill-evals run shows NEW_FAIL count drop ≥2

- [ ] Add ISS-015 row to `memory/issues/INDEX.md` Open table, by 2026-04-28
  - Why: file exists, frontmatter says `status: open`, but INDEX is missing it; health skills will file a duplicate
  - Done when: ISS-015 row present in INDEX.md with severity/category/detected/affected_skills columns matching the file's frontmatter

## Goals progress

- **Near-term income (grants + advisory).** Active. This week's articles (insider-trading enforcement, conduct-rules, Kalshi/PM crypto perps) are direct grant-narrative ammo. The cost-report (`articles/cost-report-2026-04-27.md`) keeps spend visible. No advisory income closed. Continue.
- **Stanford PhD prep (Dec 2026).** Progress. 5 PhD-grade papers indexed in MEMORY this week; explainer on Le 2026 four-component decomposition (`articles/explainer-2026-04-27.md`) shipped. paper-pick PhD-prep slot ran multiple times. Continue.
- **Live P&L proof — Apex gate (Revenant).** Stalled. Closed-trade count unchanged at 29 (per `memory/MEMORY.md` line 49 and `memory/topics/swarm-fund.md`). 71 trades to go. Blocker is `chain-runner.yml` DEGRADED, which throttles `monitor-polymarket` and `polymarket-comments`. Action #2 above unblocks.
- **Hermes-arb (Day-0 surfaced this week).** New scope. Kalshi crypto perps live 2026-04-27 NYC; basis recorder not built. Action #3 above. **Scope change since last consolidation** — reflect this in MEMORY.md if it isn't already (line 16 confirms it).
- **External-feature PR pipeline.** Active per MEMORY (PRs #18/#19/#20 to swarm-fund-mvp). Not auditable from this repo. Continue.

## Notes

- The 2026-04-28 11 UTC Polymarket V2 cutover wipes resting orders. Operator has a separate action item; not on this review's checklist because it's user-side, not Aeon-side.
- `consecutive_failures: 0` across all 83 cron-state.json entries: useful counter-signal to the 18.8% lifetime success rate. The system right now is stable, not broken; the failures are accumulated.
- `git log --since="7 days ago"` returned a single commit. Either history is shallow on this branch or article generation writes directly without committing. Worth verifying next week — if direct writes are the pattern, a weekly auto-commit would make `git log` an honest source again.
- This is the baseline weekly-review. Next week's run will close the loop on the five SMART actions above.

## Notification decision

Will notify. Conditions for skip per skill spec require zero failures, zero new issues, zero priority ≥10 actions. We have 15 new issues opened, 33 skills under 20% lifetime success, two priority-≥10 actions (notify drain at 12.5; chain-runner at 10). Notify proceeds.
