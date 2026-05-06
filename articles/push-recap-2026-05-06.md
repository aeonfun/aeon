# Push Recap — 2026-05-06

## Verdict
> BUILDING — aeon registers dormant star-momentum-alert and hardens dashboard exec; swarm-fund silent under 95 metric-cron blips

**Shape:** 2 user-visible commits · 0 internal · 0 infra · 95 automation-only (timestamp-only metric refreshes)
**Volume:** 4 files changed, +300/-7 lines across 2 substantive commits by 1 author
**Merged PRs:** 2 (#159 star-momentum-alert; #158 dashboard execFileSync hardening) — both on aaronjmars/aeon

---

## Top impact today
1. `1e167cf` — feat(star-momentum-alert): project next milestone crossing date for show-hn-draft dispatch timing (#159). Adds a daily Sonnet skill that walks 14 days of `repo-pulse` log blocks, projects the next star-milestone crossing via 7-day linear extrapolation, and alerts only when the projection lands 7-14d out **and** on Tue/Wed/Thu — i.e. when `show-hn-draft` should be dispatched. Shipped registered but `enabled: false`. (3 files, +295/-2)
2. `89d566b` — fix(dashboard/skills/run): use execFileSync to harden against shell injection (#158). Mirrors the #150 pattern on the last `execSync` path that interpolated user input (`var`, `model`) on the dashboard's `workflow_dispatch` trigger. Whitelist already neuters metacharacters; this is defense-in-depth. (1 file, +5/-5)

The 95 swarm-fund-mvp commits in the window are all `data: refresh site metrics` cron pushes against `swarm-lab-site/public/metrics.json`. Sampled head and tail of the window: each commit is a `+1/-1` change to the `generated_at` timestamp line only — the underlying agent metrics did not change. Treated as automation noise, not bot-filtered (author is `tomscaria`, not `*-bot`).

---

## aaronjmars/aeon

### [Theme 1 — Launch-timing instrumentation]

**What this is:** aeon now has a dispatch-timing oracle for its own Show HN launch. It watches its own star-count series in `memory/logs/`, projects when the next round milestone (300, 500, 1000) crosses, and only fires when that crossing falls inside the Tue–Wed–Thu launch window 7-14 days out. Closes the lead-time gap between "show-hn-draft is ready" (PR #151, May 1) and "today is the day to dispatch it." aeon at 270⭐ on May 5; the 300 milestone is the active first target.

**Shipped to users**
- `1e167cf` — feat(star-momentum-alert) (#159)
  - `skills/star-momentum-alert/SKILL.md` (new): the full skill — walks `memory/logs/${date}.md` for 14 days, greps `**owner/repo**: stargazers_count=N` lines that `repo-pulse` writes, builds per-repo daily series, normalizes day-gaps, computes 3-day and 7-day rolling deltas, projects next-milestone crossing via 7-day mean, gates on weekday + days-remaining, dedupes per `(repo, milestone)` with a 7-day re-emit window. State in `memory/topics/star-momentum-state.json`. Pure local file I/O — no curl, no `gh api`, no env-var-in-headers. (+280/-0)
  - `aeon.yml`: schedule `10 10 * * *`, sonnet model, `enabled: false` slot inserted after `star-milestone`. (+1/-0)
  - `skills.json`: catalog total `109 → 110`, registers the entry alphabetically after `star-milestone` in the dev category. (+14/-2)

**Under the hood** *(none — this PR is all new skill + catalog registration; no test or refactor commits accompany it in the window)*

### [Theme 2 — Dashboard shell-out hardening]

**What this is:** The last `execSync` path on the dashboard that round-tripped user-supplied input through bash now uses `execFileSync` with an argv array, matching the pattern PR #150 set on `secrets/route.ts` and `auth/route.ts:46`. The `var` and `model` whitelists already strip shell metacharacters, so this isn't a live exploit — it removes the place where dashboard input still touched a shell at all.

**Shipped to users**
- `89d566b` — fix(dashboard/skills/run) (#158)
  - `dashboard/app/api/skills/[name]/run/route.ts`: replace `execSync` (string command) with `execFileSync` (file + args array); drop the `JSON.stringify` shell-quoting on `var`/`model` since `gh` receives `-f key=value` directly without bash. (+5/-5)

The PR description notes the author audited the other `execSync` call sites (`auth`, `analytics`, `runs`, `runs/[id]/logs`, `outputs`, `sync`, `skills` GET) and confirmed they all use hardcoded commands or pre-validated digit-only IDs — so this commit closes the dashboard's last user-input shell surface.

---

## tomscaria/swarm-fund-mvp

### Internal: Metrics-refresh cron only

**What this is:** Cron-driven heartbeat. Between 17:14 UTC May 5 and 16:55 UTC May 6 the metrics publisher pushed 95 commits, all titled `data: refresh site metrics`, all touching only `swarm-lab-site/public/metrics.json`, all `+1/-1` on the `generated_at` timestamp. No agent score change, no new agent enrolled, no `metrics.json` schema delta. The CalibrationGap (Revenant) live state at https://rswarm.ai/metrics.json is the source of truth — this article does not infer P&L from these refreshes.

No human commits, no merged PRs, no branch pushes outside `main` in the window. Per the swarm-fund-mvp memory note, the meaningful signal here is **absence**: zero strategy/runner code merges for a third consecutive day (last substantive change was 2026-05-03 ADR-093/094). The 95 timestamp commits are not bot-filtered (author `tomscaria`, message doesn't match `chore(deps):`) but they are flagged here as automation-only.

---

## tomscaria/lore-financial-teaser

Empty in the window. Last push event 2026-05-03 21:21 UTC. No commits, no merged PRs.

---

## Developer notes
- **New dependencies:** none.
- **Breaking changes:** none. The dashboard exec swap is API-shape-preserving; the new skill is `enabled: false`.
- **New public surface:**
  - aeon: new skill `star-momentum-alert` registered in `skills.json` and `aeon.yml`. New state file path expected: `memory/topics/star-momentum-state.json`. New article path expected: per the SKILL.md, articles for star-momentum projections (the SKILL.md says "article writes regardless of alert outcome").
  - aeon: no new dashboard route or CLI flag — `skills/[name]/run/route.ts` is an existing endpoint, internals only.
- **Tech debt added:** none visible in the diffs. PR #159 has a clean commit-message footer; PR #158 has none.

## Open threads
- aeon `star-momentum-alert` is registered with `enabled: false`. Operator must flip the flag in `aeon.yml` for the skill to actually run on its 10:10 UTC slot. The PR description says "Operator enables the skill in `aeon.yml` once the running instance has at least 4 days of `repo-pulse` data on disk (already true)." — so the gate is operator action, not data sufficiency.
- swarm-fund-mvp: zero substantive code in the window is itself an open thread. The ADR-093/094 wire-up falsifier (memory note: ~2026-05-17 deadline for `tomscaria/aeon` to ship the `outputs/{skill}/{date}.json` JSON contract) is 11 days out and the swarm-side made no moves toward it today.
- aeon: no progress on the `tomscaria/aeon` 9 stalled PRs (#1–#5, #8–#11) — those live on a different fork (`tomscaria/aeon`, not `aaronjmars/aeon`); not in the window's commit set but flagged in MEMORY.md as the pipeline that must close to deliver the swarm-fund tick-broker contract.

## Sources
- tomscaria/swarm-fund-mvp: ok (95 commits, 0 merged PRs, all automation noise)
- tomscaria/lore-financial-teaser: empty (0 commits, 0 merged PRs, last push 2026-05-03)
- aaronjmars/aeon: ok (2 commits, 2 merged PRs)
- gh api events: ok
- gh api commits: ok
- gh pr list: ok
- bot-filtered: 0 (none matched the `*-bot` / `chore(deps):` rule)
- diff-truncated: 0
- automation-only flagged separately: 95 (swarm-fund-mvp metrics-cron)
