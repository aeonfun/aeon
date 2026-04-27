# Push Recap — 2026-04-27

## Verdict
> SHIPPING — two new fleet-ops skills (skill-analytics + contributor-reward) live in aeon.yml.

**Shape:** 2 user-visible commits · 0 internal · 0 infra · 0 bot-filtered
**Volume:** 5 files changed, +573/-1 lines across 2 commits by 1 author (aaronjmars)
**Merged PRs:** 2 (#142 skill-analytics; #144 contributor-reward)

---

## Top impact today
1. `98193f9` — feat: skill-analytics — fleet-level skill-run analytics widget (#142). New Wednesday 18:30 UTC meta-skill that ranks every skill that ran in the last 168h, surfacing six anomaly flags (SILENT, ALL_FAIL, CONSECUTIVE_FAILURES, LOW_SUCCESS, ALL_SKIP, DUPLICATE_RUNS); fleet operators get a ranked dashboard spec only when ≥1 flag fires. (3 files, +318/−1)
2. `46a7a24` — feat: contributor-reward — turn fork-contributor-leaderboard into a tier-priced rewards plan (#144). Reads last week's leaderboard article, applies a tier table (rank 1=25 USDC, 2=15, 3=10, 4–5=5, +5 first-PR bonus once per login), writes the plan to `memory/distributions.yml` under `contributors-YYYY-Wnn`, and pings the operator with a one-command `distribute-tokens` invocation. Plan generation only — no on-chain transfer. (2 files, +255/−0)

---

## aaronjmars/aeon

### Fleet-level operator tooling

**What this is:** Two new skills wired into `aeon.yml` that close longstanding gaps in fleet observability and contributor incentives. `skill-analytics` is the fleet-wide companion to per-skill `skill-health`/`heartbeat`; `contributor-reward` is the missing pipe between the weekly leaderboard and the existing `distribute-tokens` transfer skill.

**Shipped to users**
- `98193f9` — feat: skill-analytics — fleet-level skill-run analytics widget (#142)
  - `skills/skill-analytics/SKILL.md`: new 316-line skill spec. Pipeline: `./scripts/skill-runs --json --hours 168` + `aeon.yml` schedule cross-reference (catches scheduled skills that haven't fired at all = SILENT) + `memory/cron-state.json` consecutive-failures + `memory/logs/*.md` regex grep for SKIP_UNCHANGED / NEW_INFO / SKIP_QUIET exit taxonomy. Output: ranked article + json-render dashboard spec. Notification fires only when ≥1 anomaly flag is raised. (+316/−0)
  - `aeon.yml`: registers the skill on a Wednesday 18:30 UTC cron, right after the daily 18:00 `skill-health`. (+1/−0)
  - `.github/workflows/aeon.yml`: adds `skill-analytics` to the meta-skill case in `quality-analysis` so the post-run Haiku scorer skips it (output is structural, not content-scorable). (+1/−1)
- `46a7a24` — feat: contributor-reward — turn fork-contributor-leaderboard into a tier-priced rewards plan (#144)
  - `skills/contributor-reward/SKILL.md`: new 254-line skill spec. 10-step pipeline with tier pricing, idempotency keyed on `(week, login)` in `memory/state/contributor-reward-state.json`, first-PR bonus tracked once-ever per login, dry-run mode, and a full exit taxonomy (SKIP_ALREADY_PROCESSED / SKIP_NO_LEADERBOARD / SKIP_STALE_LEADERBOARD / SKIP_NO_ELIGIBLE). (+254/−0)
  - `aeon.yml`: scheduled Mondays 09:30 UTC (16h after Sunday's 17:30 `fork-contributor-leaderboard`), disabled by default — operators opt in deliberately. (+1/−0)

---

## Developer notes
- **New dependencies:** none.
- **Breaking changes:** none. Both new schedules are additive; `contributor-reward` ships disabled by default.
- **New public surface:**
  - Two new skills addressable via the `skills/` directory and `aeon.yml`: `skill-analytics`, `contributor-reward`.
  - New cron entries in `aeon.yml` (Wed 18:30 UTC; Mon 09:30 UTC, opt-in).
  - New persistent state file path: `memory/state/contributor-reward-state.json`.
  - New `memory/distributions.yml` list label convention: `contributors-YYYY-Wnn`.
- **Tech debt added:** none flagged in the diffs (no new TODOs/FIXMEs introduced).

## Open threads
- `contributor-reward` ships disabled — operator must explicitly enable in `aeon.yml` before Monday 09:30 UTC for it to fire.
- `skill-analytics` first run will be the next Wednesday 18:30 UTC (2026-04-29). Anomaly thresholds (LOW_SUCCESS / DUPLICATE_RUNS percentages) are codified in the SKILL.md but not externally configurable yet — likely first-run tuning needed.
- Both PRs closed older repo-actions ideas (Apr-22 #5 / Apr-24 #1 for skill-analytics; Apr-24 #2 for contributor-reward), suggesting the repo-actions backlog is being drained — worth checking whether new ideas are being filed at the same rate.

## Sources
- aaronjmars/aeon: ok
- gh api events: ok (2 PushEvents in window, both with `commits_count: 0` in the payload — fell back to `gh api repos/.../commits?since=...` for full SHA + message)
- gh api commits: ok (2 commits returned)
- gh pr list: ok (2 merged PRs returned)
- bot-filtered: 0
- diff-truncated: 0
