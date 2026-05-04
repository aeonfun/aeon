# Fork Fleet Report — 2026-05-04

**Verdict:** NEW UPSTREAM CANDIDATE: 0xfreddy/aeon ships a `macos-apps` weekly digest skill that doesn't exist upstream.

Fleet: 41 total forks · 29 active (last 30d) · 1 managed instance (tomscaria/aeon) · 28 community.

Prior state was bootstrap-empty (`n_total=0` from 2026-04-27 quiet run), so this is the first real fleet snapshot — every active fork is technically `NEW_FORK` against the state file. The week-over-week section reads accordingly; future runs will have a real baseline.

---

## What changed this week
- **New forks (vs empty prior state)**: all 29 active forks counted as new entries; meaningful divergence in 6 (tomscaria, gcampton, pezetel, yugo-engineer, DannyTsaii, 0xfreddy).
- **Went active**: n/a (no prior baseline)
- **New skills landed**: 0xfreddy/aeon → `skills/macos-apps/SKILL.md`
- **Went stale**: n/a
- **Archived/deleted**: none

---

## PROMOTE — upstream contribution candidates

### 0xfreddy/aeon — score 20 [COMMUNITY]
**Activity:** last pushed 2026-04-21 · stars 0 · +5/-106 commits vs upstream
**Unique skills:**
- `skills/macos-apps/SKILL.md` — Weekly digest of best new macOS apps. Pulls from r/macapps, r/MacOS, r/productivity (OAuth + WebFetch fallback) and Twitter/X recent search; dedup index at `memory/macos-apps-index.json`; 60/40 reddit/twitter scoring; emits structured markdown of top N. Config-driven via `memory/macos-apps-config.yml` with sane defaults if file absent.

**Why promote:** Clean new vertical that doesn't overlap any existing aeon skill. Pattern matches upstream conventions (frontmatter, var, tags, sandbox-aware fallback). Adjacent to `vibecoding-digest` / `farcaster-digest` / `hacker-news-digest` family — same shape, new corner of the discovery surface. Low-risk merge: pure additive, two new memory files (`macos-apps-config.yml`, `macos-apps-index.json`), no changes to existing skills or wiring.

**Suggested action:** Open a PR cherry-picking `skills/macos-apps/`, `memory/macos-apps-config.yml`, `memory/macos-apps-index.json` from `0xfreddy:main` (5 commits, ~280 added lines). Or @-mention 0xfreddy in an issue inviting them to upstream. No `aeon.yml` cron addition in the cherry-pick — leave that to the operator who decides whether to schedule it.

---

## REVIEW — worth a look

| Fork | Score | Ahead | New/Modified | Notable |
|------|-------|-------|--------------|---------|
| yugo-engineer/aeon | ~34 | +194/-119 | 0/0 skills, +2 scripts | `scripts/fetch-tweets-query.py` (47 lines) + `fetch-tweets-run.sh` — Python xAI `x_search` prefetch implementation. Parallel solution to ISS-014's PR #156 reply-maker xAI prefetch (currently bash, day-9 in flight). Worth comparing the Python approach vs the shell approach if PR #156 stalls further. |
| DannyTsaii/aeon | inflated | +15/-14 | ~110/0 SKILL.md "added" | All 110+ "new" SKILL.md files live under `skills/write-tweet/skills/<name>/SKILL.md` — appears to be a nested duplication of upstream's skills tree, not real new skills. Underlying intent (a `write-tweet` harness wrapping all skills?) is unclear. Skip the cherry-pick; ask DannyTsaii what they're modeling before treating as real divergence. |
| gcampton/aeon | ~30 | +781/-162 | 0/0 skills, +1 misc | 781 commits ahead but compare-API hits the 250-commit cap so the diff is partial. Visible files are pure cron output (`.outputs/heartbeat.md`, daily logs, dashboard heartbeat JSON, `gcampton-post.md` artifact). Active runner, no surfaced upstream candidate. |
| pezetel/aeon | ~26 | +425/-14 | 0/0 skills | Active operator running daily — visible diff is github-trending output, heartbeat, cron-state, status.md. No new skills surfaced. |

---

## NOTE — low divergence

- `jordanfxlab/aeon` (+2/-18, `package.json` + `dashboard/next-env.d.ts`)
- `maacx2022/aeon` (+3/-110, aeon.yml schedule edits + skill-health output)
- `Xedphilia/aeon` (+20/-237, log-only adds 2026-03-23 → 2026-04-17)

18 additional active forks at +0/-N (just-cloned mirrors): KingKaonix, infrareactive, artlu99, eugene-gourevitch, CNZSMJ, adarshhalan, MYJOR, jdwyer76, moseslua/talon, brandong1987, morashad1010, JayNgDigitalCaptain, roadtogideon222-byte, jcksnykm/993, iilbell, AcidicSoil, AITOBIAS04, arnaudbellemare, kevingrondin, lordchildrey.

---

## Managed instances

### tomscaria/aeon (this repo) — +2047/-14
Operator's Aeon, swarm-fund-mvp focus. Compare API truncates at 250 commits / 300 files. Not evaluated for upstream-promotion since it IS the originating instance. Logged as MANAGED only.

---

## Fleet vs community

| Category | Count |
|----------|-------|
| Managed instances | 1 |
| Community forks | 40 |
| Active (≤30d) | 29 |
| Stale (30–365d) | 12 |
| Dormant (>365d) | 0 |

## Source status
`forks_list=ok · compare_ok=29/29 · deep_read=2/2 · rate_limit_retries=0 · unreadable=0 · files_truncated=tomscaria(1)`
