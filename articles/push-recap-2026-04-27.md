# Push Recap — 2026-04-27

## Verdict
> SHIPPING — two new fleet-ops skills + a public Showcase page (#142, #144, #145).

**Shape:** 3 user-visible commits · 0 internal · 0 infra · 0 bot-filtered
**Volume:** 7 files changed, +647/-1 lines across 3 commits by 1 author (aaronjmars)
**Merged PRs:** 3 (#142 skill-analytics; #144 contributor-reward; #145 SHOWCASE.md)

---

## Top impact today
1. `98193f9` — feat: skill-analytics — fleet-level skill-run analytics widget (#142). New Wednesday 18:30 UTC meta-skill that ranks every skill that ran in the last 168h, surfacing six anomaly flags (SILENT, ALL_FAIL, CONSECUTIVE_FAILURES, LOW_SUCCESS, ALL_SKIP, DUPLICATE_RUNS); fleet operators get a ranked dashboard spec only when ≥1 flag fires. (3 files, +318/−1)
2. `46a7a24` — feat: contributor-reward — turn fork-contributor-leaderboard into a tier-priced rewards plan (#144). Reads last week's leaderboard article, applies a tier table (rank 1=25 USDC, 2=15, 3=10, 4–5=5, +5 first-PR bonus once per login), writes the plan to `memory/distributions.yml` under `contributors-YYYY-Wnn`, and pings the operator with a one-command `distribute-tokens` invocation. Plan generation only — no on-chain transfer. (2 files, +255/−0)
3. `2774f7f` — feat: add SHOWCASE.md with active forks + ecosystem comparison (#145). New top-level page listing the six most-active forks (with skill counts and focus notes sourced from the weekly leaderboard skills) and a side-by-side comparison vs AutoGen, CrewAI, n8n, LangGraph. README gains a one-line pointer; existing Aeon-vs-Claude-Code/Hermes/OpenClaw block stays. (2 files, +74/−0)

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

### Public discoverability

**What this is:** A new top-level Showcase page that turns the upstream-facing comparison into a two-axis story — "what other operators are running" alongside "how Aeon compares to the agent frameworks people already evaluate." Fork data is generated from the same weekly skills that drive internal fleet ranking, so the page stays current without manual editing.

**Shipped to users**
- `2774f7f` — feat: add SHOWCASE.md with active forks + ecosystem comparison (#145)
  - `SHOWCASE.md`: new 72-line top-level page. Active-forks table (tomscaria/aeon at 94 skills enabled, then maacx2022, DannyTsaii, davenamovich, 0xfreddy, pezetel) sourced from `fork-contributor-leaderboard` + `skill-leaderboard` outputs. Comparison table vs AutoGen / CrewAI / n8n / LangGraph across 8 axes (runtime, scheduling, skill format, persistent memory, self-healing, quality scoring, reactive triggers, setup floor). "Add yourself" note tells fork operators how to land in the table. (+72/−0)
  - `README.md`: one-line pointer added below the "Why most autonomous agent framework?" section, directing readers to `SHOWCASE.md` for the broader ecosystem comparison. (+2/−0)

---

## Developer notes
- **New dependencies:** none.
- **Breaking changes:** none. Both new skills ship disabled-by-default; the SHOWCASE page is additive.
- **New public surface:**
  - Two new skills addressable via the `skills/` directory and `aeon.yml`: `skill-analytics`, `contributor-reward`.
  - New cron entries in `aeon.yml` (Wed 18:30 UTC; Mon 09:30 UTC, both opt-in).
  - New persistent state file path: `memory/state/contributor-reward-state.json`.
  - New `memory/distributions.yml` list label convention: `contributors-YYYY-Wnn`.
  - New top-level doc: `SHOWCASE.md`, linked from `README.md`.
- **Tech debt added:** none flagged in the diffs (no new TODOs/FIXMEs introduced).

## Open threads
- `contributor-reward` ships disabled — operator must explicitly enable in `aeon.yml` before Monday 09:30 UTC for it to fire.
- `skill-analytics` first run will be the next Wednesday 18:30 UTC (2026-04-29). Anomaly thresholds (LOW_SUCCESS / DUPLICATE_RUNS percentages) are codified in the SKILL.md but not externally configurable yet — likely first-run tuning needed.
- All three PRs closed older repo-actions ideas (Apr-22 #5 / Apr-24 #1 for skill-analytics; Apr-24 #2 for contributor-reward; the meta-thesis from MEMORY is that PRs #142 and #144 closed ideas #1–#2 in rank order — #145's Showcase page extends the trend by drawing on the same fork/leaderboard data those skills emit). Worth checking whether new ideas are being filed at the same rate the backlog drains.
- `SHOWCASE.md` lists six forks today; the page is hand-edited but the source data (skill-leaderboard, fork-contributor-leaderboard) regenerates weekly — without an auto-update step, the table will drift from the underlying ranking unless the next Sunday run also rewrites this page.

## Sources
- aaronjmars/aeon: ok
- gh api events: ok (PushEvents had `commits_count: 0` in lite payload — fell back to `gh api repos/.../commits?since=...` for full SHA + message, same fallback pattern as the earlier 2026-04-27 run)
- gh api commits: ok (3 commits returned)
- gh pr list: ok (3 merged PRs returned)
- bot-filtered: 0
- diff-truncated: 0
