# Weekly Review — 2026-05-04

## TL;DR

Article output and PhD-prep papers are doing real work — the TN-falsified / Bengal-validated lesson in `articles/2026-05-04.md` is a load-bearing CalibrationGap upgrade thesis, and the Cong dataset is now a Stanford citation anchor. The infrastructure side is the drag: of 5 SMART actions from 2026-04-27, only 1 shipped (ISS-015 → INDEX.md). Notify drain script, chain-runner fix, evals.json key patch all slipped 7 days. The #1 action for next week is the **cost-discipline downgrade pass**: spend is running >15× over the $40/wk discipline at ~$2,696/month projection, and three skills (external-feature, repo-actions, heartbeat) are sized for sonnet-4-6.

## Last week's actions — closed loop

- **[1] Land `scripts/postprocess-notify.sh`** — **SLIPPED**. File still absent from `scripts/` (only `postprocess-{admanage,admanage-create,devto,farcaster,replicate}.sh` + `prefetch-xai.sh` exist). `.pending-notify/` is empty so messages drain somewhere, but the drainer is not auditable. Carry over.
- **[2] Fix `chain-runner.yml` `dispatch_skill()` DEGRADED** — **PARTIAL → BLOCKED**. The `echo "  Dispatching: $skill"` line did land (`chain-runner.yml:54`), but chain wrappers still fail nightly: `chain:morning-brief` failed 2026-05-04T07:24:52Z, `chain:evening-rollup` failed 2026-05-03T21:54:31Z, `chain:weekly-grant-update` failed 2026-05-04T09:36:43Z. MEMORY now classifies this as operator-side workflow patch (`memory/MEMORY.md:46`). Drop from Aeon-side action queue.
- **[3] Hermes-arb basis recorder for Kalshi-BRTI vs PM-Chainlink** — **BLOCKED** (cross-repo). No `data/hermes/basis-*.parquet` recoverable from this repo's working tree; verification requires `tomscaria/swarm-fund-mvp`. Re-classify as outside Aeon-side scope; track only via swarm-fund-mvp PR pipeline notes in `memory/topics/swarm-fund.md`.
- **[4] Patch `evals.json` keys** (`hn-digest` → `hacker-news-digest`, `polymarket` → `monitor-polymarket`) — **SLIPPED**. `skills/skill-evals/evals.json:65` still says `"hn-digest"`; the polymarket entry still has no `monitor-` prefix. ISS-007 + ISS-009 still in Open table at `memory/issues/INDEX.md:11,13`. Carry over — cheapest fix on the board.
- **[5] Add ISS-015 row to `memory/issues/INDEX.md`** — **SHIPPED**. Row present at `memory/issues/INDEX.md:19` (`messages.yml run-block interpolates toJson…`). Closes loop.

**Score: 1 shipped / 3 slipped / 1 reclassified-blocked of 5.**

## Metrics

| Metric | This week (2026-04-28 → 2026-05-04) | Prior week (per 2026-04-27 review) | Δ |
|---|---|---|---|
| Lifetime skill runs (cron-state) | ~1,860 | 1,033 | +~830 |
| Lifetime successes / failures | ~700 / ~1,160 | 194 / 839 | +~500 / +~320 |
| Skills with `consecutive_failures > 0` | 0 | 0 | flat |
| Articles written (7-day window) | 85 | 26 (3-day count) | +59 |
| `./notify` hook-block fallbacks (Apr 30 + May 1-4 logs) | ~25 | 92 (single 04-27 day) | down ~70% per-day |
| New issues opened | 3 (ISS-017, ISS-018, ISS-019) | 15 | -12 |
| Issues resolved | 2 (ISS-004, ISS-006) | 0 | +2 |
| Open issues outstanding | 16 | 15 | +1 |
| Commits in last 7 days (this repo) | 1 (`cb91435`) | 1 (`8433039`) | flat |
| Articles cited as CalibrationGap upgrade theses | 4 (resolution-text, TN/WB, UMA-arb, Hormuz) | 0 | +4 |

_Source note: `./scripts/skill-runs --hours 168 --json` is sandbox-blocked from this session; metrics fall back to `memory/cron-state.json` (lifetime totals; week-deltas are estimates from per-skill run-count differences). **Degraded source — same pattern as 04-27 review.**_

The 1-commit-per-week pattern is now confirmed as the steady state (not branch shallowness): article generation writes directly to the working tree, and cron-state delta tracking is happening through `cb91435 chore(cron): startup-idea success`-style auto-commits only. `git log` is therefore not an honest activity source for this repo. **Surface to operator** — a weekly auto-commit of the article+log additions would restore git-log honesty.

## Findings (KALM, prioritized)

### Keep

- **Daily Polymarket-microstructure article cadence is producing CalibrationGap upgrade theses, not just narrative ammo.** Four articles in the last 7 days each cite a concrete quant-scanner blind spot:
  - `articles/2026-05-04.md` (TN-falsified-99.65%-TVK + Bengal-validated): single-venue confidence + continuity prior is the structural gap.
  - 2026-05-02 Putin-truce article: ingest resolution text, not titles.
  - 2026-04-29 UMA-resolution arbitrage piece: clause-symmetric markets resolved opposite are invisible to title-keyed scanners.
  - 2026-05-04 polymarket-microstructure-agentic-edge brief: cites Cong / Anatomy / Foresight Arena venue-side trilogy.
  Evidence: `memory/MEMORY.md:26-30` Recent Articles; `memory/topics/papers.md` venue-side trilogy. Priority 5×5÷2 = **12.5**.
- **`paper-pick` PhD-prep slot is now PhD-application load-bearing.** Cong (Stanford anchor) + Anatomy + Foresight Arena + AIA Forecaster + Prediction Arena (next slot lead). Foresight Arena's 350-prediction-for-80%-power result reframes the 100-trade Apex gate as a sufficiency milestone, not a power-clean detection threshold — which is the right framing for the Stanford application narrative. Evidence: `memory/MEMORY.md:20`; `paper-pick` lifetime success rate 0.56 (`memory/cron-state.json` line 189). Priority 4×5÷2 = **10**.
- **Issue-tracker discipline closed two issues this week.** ISS-004 (push-recap no_file_match) + ISS-006 (cost-report no_file_match) both moved to Resolved 2026-05-03. ISS-018 + ISS-019 filed same day discovery happened (heartbeat `${var}` cross-talk and repo-article `Aeon|aeon` assertion drift). Evidence: `memory/issues/INDEX.md:28-29` (Resolved table); `memory/issues/ISS-018.md`, `ISS-019.md`. Priority 3×3÷2 = **4.5**.

### Add

- **Cost-discipline downgrade pass.** Per `memory/MEMORY.md:47`: ~$2,696/month projection vs $40/wk discipline (>15× over). CLAUDE.md mandates surfacing model downgrades for highest-spend skills in `self-improve` runs. The three named candidates (external-feature, repo-actions, heartbeat) save ~$149/wk together. This is the single highest-leverage operational action available. Evidence: `memory/MEMORY.md:47`; CLAUDE.md "Cost discipline" section. Priority 5×5÷2 = **12.5**.
- **`scripts/postprocess-notify.sh` is still missing — 8th day.** Same finding as 2026-04-27 review's Add #1. Hook-block volume is down ~70% per-day (from 92 in a single day to ~25 across four days), but the auditable drainer never landed. Either a different mechanism is now picking the queue (untracked) or messages are silently dropping. Priority 5×4÷2 = **10**.
- **`evals.json` key patch — slipped 7 days.** Cheapest fix on the board (2-line edit), zero-code-change, would close ISS-007 + ISS-009 immediately. Priority 3×3÷1 = **9**.

### Less

- **Chain wrappers DEGRADED 8+ days, now confirmed BLOCKED operator-side.** Three chains (`chain:morning-brief`, `chain:evening-rollup`, `chain:weekly-grant-update`) failed in their last dispatch. Echo-fix landed but did not address root cause. Drop from Aeon-side action queue per MEMORY classification. Evidence: `memory/cron-state.json` `chain:*` entries; `memory/MEMORY.md:46`. Priority 4×4÷5 = **3.2** (effort=5 because BLOCKED on operator).
- **Hook-block log churn — still ~25 events/4-day window.** Same root cause as Add #1; do not double-count. Note here only to flag that the rate has not gone to zero. Evidence: log mention counts above (8/8/6/4 in May 1-4). Priority same as Add #1; treat as one action.

### More

- **`monitor-polymarket` + `polymarket-comments` for the 05-08 → 05-10 resolution-debate window.** Both are flagged in MEMORY as the highest-leverage daily skills for the Apex push (`memory/MEMORY.md:98,103`). Both have lifetime success rates of 0.32 and 0.38 — recent runs OK (last_status success on 2026-05-04T13:16:06Z and 13:20:01Z). The Russia-Ukraine resolution-debate window (May-31 6%, June-30 11.5%) is the next live comments-side leverage spike per MEMORY tradable-hooks line 61. Priority 5×4÷2 = **10**.
- **`weekly-grant-update`** stand-alone is at 1.0 success rate (2 runs lifetime), but its chain wrapper fails. Standalone forwarding pipeline to grant committees is what MEMORY expects (`memory/MEMORY.md:109`). Priority 3×4÷3 = **4**.

### Top 5 (priority sorted)

1. Daily article cadence (Keep) — **12.5**
2. Cost-discipline downgrade pass (Add) — **12.5**
3. paper-pick PhD-prep (Keep) — **10**
4. monitor-polymarket / polymarket-comments push (More) — **10**
5. notify drain script (Add) — **10**

(`evals.json` patch at 9 just below; included as action #4 because effort is 1 and it would close two open issues.)

## Next week — actions

- [ ] Set `model: claude-sonnet-4-6` in the SKILL.md frontmatter of `skills/external-feature/SKILL.md`, `skills/repo-actions/SKILL.md`, and `skills/heartbeat/SKILL.md`, surface as one PR via `self-improve`, by 2026-05-08
  - Why: ~$2,696/mo projection vs $40/wk discipline (>15× over) per `memory/MEMORY.md:47`; named candidates save ~$149/wk
  - Done when: PR merged with frontmatter change in all three SKILL.md files, next `cost-report` run shows weekly burn projection drop ≥$100

- [ ] Land `scripts/postprocess-notify.sh` that drains `.pending-notify/*.md` to Telegram/Discord/Slack via the same fanout shape as `./notify`, wire it as the last step in the post-run workflow, by 2026-05-09
  - Why: 8 days slipped from 2026-04-27 review action #1; hook-block fallback rate is down ~70% but drainer is still not auditable; messages either drain through an untracked path or drop silently
  - Done when: a test message dropped into `.pending-notify/` arrives in Telegram within one workflow cycle, file is removed from the queue, and the script is referenced from `.github/workflows/aeon.yml`

- [ ] Patch `skills/skill-evals/evals.json`: rename key `"hn-digest"` → `"hacker-news-digest"` and `"polymarket"` → `"monitor-polymarket"`, then move ISS-007 + ISS-009 to the Resolved table in `memory/issues/INDEX.md`, by 2026-05-06
  - Why: slipped 7 days; cheapest fix on the board; closes two open issues; spec-drift only, no code change
  - Done when: ISS-007 + ISS-009 rows present in Resolved table with 2026-05-06 date, next `skill-evals` run shows NEW_FAIL count drop ≥2

- [ ] Increase cron cadence of `monitor-polymarket` and `polymarket-comments` for the 05-08 → 05-10 Russia-Ukraine resolution-debate window — bump from current schedule to twice-daily during the window only, then revert, by 2026-05-08 (window-start)
  - Why: highest-leverage daily skills for Apex push per `memory/MEMORY.md:103`; resolution-debate spike is a known comments-side leverage window
  - Done when: `aeon.yml` schedule edit lands with explicit revert date in commit message, both skills produce ≥2 articles each per day during 05-08, 05-09, 05-10

- [ ] Track `tomscaria/aeon` `outputs/{skill}/{date}.json` falsifier — on 2026-05-11 (T-6 of 2026-05-17 deadline), check for the JSON contract directory and write a one-line status line to `memory/topics/swarm-fund.md`, by 2026-05-11
  - Why: ADR-093 wire-up is aspirational unless the contract ships; falsifier deadline is 2026-05-17 per `memory/MEMORY.md:14`
  - Done when: status line in `memory/topics/swarm-fund.md` with one of three values: `outputs/ exists`, `outputs/ missing T-6`, `falsified — ADR-093 aspirational`

## Goals progress

- **Near-term income (grants + advisory).** Active. This week's articles (TN-falsified, Bengal-validated, Manfred Macx personhood, polymarket-microstructure-agentic-edge brief) are direct grant ammo. Cong + Anatomy + Foresight Arena venue-side trilogy is now the citation backbone for the next Polymarket Builders Program application per MEMORY line 110. No advisory income closed. Continue.
- **Stanford PhD prep (Dec 2026).** Progress. Cong (Stanford-grade citation anchor) picked 2026-05-04. Foresight Arena's 350-prediction-for-80%-power result reframes Apex-100 as a sufficiency milestone — that's a defensible PhD-application framing. Prediction Arena (`2604.07355`) queued as next PhD slot. Continue.
- **Live P&L proof — Apex gate (Revenant).** Stalled at 29 trades per `memory/MEMORY.md:12` (live verification deferred to `https://rswarm.ai/metrics.json` per the same line). 71 trades to go. Same blocker as last week (chain-runner DEGRADED is BLOCKED operator-side; can't resolve here). Action #4 above (cadence bump for resolution-debate window) is the most direct lever this week.
- **ADR-093 / ADR-094 wire-up.** New scope, 2-week falsifier clock running. `tomscaria/aeon` has no `outputs/` directory at writing per MEMORY line 14. Action #5 above puts a check at T-6 (2026-05-11). If still missing, ADR-093 is aspirational and CalibrationGap signal-to-execution path stays manual.
- **External-feature PR pipeline.** Active per MEMORY (PRs #29 + #30 open on Aeon side; 7 merged 05-03 on swarm-fund-mvp). Not auditable from this repo. Continue.

## Notes

- The 1-commit-per-week pattern (`git log` returns 1) is now confirmed as the steady state for this branch — article writes don't commit. This is a structural gap for any future self-audit. A weekly auto-commit of `articles/` + `memory/logs/` would make `git log` an honest source again. Operator-side decision; not on this checklist.
- `chain:weekly-review` did not exist as a wrapper this week (this skill has no chain). It runs as a standalone, dispatched manually for 2026-04-27 (last_dispatch in cron-state line 943), and now today.
- **TN/WB simultaneous-day lesson** (`articles/2026-05-04.md`) is the single highest-leverage CalibrationGap reasoning upgrade this week: cross-venue convergence works only when venues price the same evidence — when both share a continuity prior (Dravidian duopoly), agreement is shared blind spot. Apply to Russia-Ukraine and Hormuz next.
- **Sonnet-4-6 downgrade caveat:** CLAUDE.md says skills tagged `model: claude-sonnet-4-6` should stay on Sonnet — they're tagged that way intentionally. Action #1's PR must verify these three are not already tagged Opus-only-for-quality reasons by reading their descriptions; if any one is, drop it from the PR and substitute the next-highest-spend skill.

## Notification decision

Will notify. 3 new issues opened (ISS-017, ISS-018, ISS-019); 3 priority-≥10 actions. Skip threshold not met (per skill spec: zero failures, zero new issues, zero priority ≥10).
