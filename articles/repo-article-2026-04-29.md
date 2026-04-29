# Aeon's Forks Are Now Writing Its Roadmap. PR #147 Was Built So #143 Doesn't Happen Again.

In the last eight days, `aaronjmars/aeon` has merged seven feature PRs at one-per-day cadence ([#140](https://github.com/aaronjmars/aeon/pull/140) through [#147](https://github.com/aaronjmars/aeon/pull/147)). Every single one ships infrastructure for outside contributors. The newest, `pr-triage` (#147, 2026-04-29), is the first whose merge note explicitly names the friction that triggered it: a four-day-stale external PR from a listed fork operator.

## The claim

> aaronjmars/aeon's roadmap is now driven by fork friction: all 7 merged PRs this week ship contributor infrastructure, and #147 cites a 4-day-stale external PR from a listed fork operator.

## Evidence

**The PR slate is monothematic.** Of the seven feature PRs merged from 2026-04-22 onward — `onboard` ([#139](https://github.com/aaronjmars/aeon/pull/139), 2026-04-22), `fork-skill-digest` ([#140](https://github.com/aaronjmars/aeon/pull/140), 2026-04-23), `public status page` ([#141](https://github.com/aaronjmars/aeon/pull/141), 2026-04-24), `skill-analytics` ([#142](https://github.com/aaronjmars/aeon/pull/142), 2026-04-26), `contributor-reward` ([#144](https://github.com/aaronjmars/aeon/pull/144), 2026-04-26), `SHOWCASE.md` ([#145](https://github.com/aaronjmars/aeon/pull/145), 2026-04-27), and `pr-triage` (#147, 2026-04-29) — none touch the agent loop, skill executor, or runtime. They are all about *who else* is running Aeon. `SHOWCASE.md` enumerates six active forks by handle; `fork-skill-digest` aggregates skill divergence across them; `contributor-reward` turns the fork-contributor leaderboard into a tier-priced rewards plan. The framework is being instrumented for an audience.

**PR #147's stated trigger is real and verifiable.** The merge note for `pr-triage` reads: "`pezetel`'s PR #143 sat untouched for four days — no label, no comment, no review request — at the moment when external traction is the project's growth lever." [PR #143](https://github.com/aaronjmars/aeon/pull/143) is on the public timeline, opened by `pezetel` and closed unmerged on 2026-04-26. `pezetel/aeon` is also row six on the `SHOWCASE.md` active-forks table ("`heartbeat` + `github-trending` — a focused dev-pulse instance. The first fork to break `github-trending` out of the long tail."). The same fork the project promoted as a flagship is the fork whose friction generated the next merge.

**The new skill ships an explicit ladder, not a vibe.** `skills/pr-triage/SKILL.md` defines four verdicts — `OUT-OF-SCOPE`, `NEEDS-CHANGES`, `DEFER`, `ACCEPTED` — keyed on file-path scope, frontmatter validity, and diff size, with idempotent state in `memory/triaged-prs.json` keyed on `(PR number, headRefOid)` so pushes re-triage automatically. The skill is wired into `aeon.yml` at `30 9 * * *`, alongside `issue-triage` and `pr-review`. The maintainer is automating his own first-touch behavior on every external PR.

**Star and fork counts back the urgency.** `aaronjmars/aeon` shows 252 stars and 35 forks today, up from roughly 200 stars four days ago — a 13.9% fork-to-star ratio that is unusually high for a project created 2026-03-04. PR #147's body closes with: "highest-priority unbuilt as fork count climbs toward 40." External-contributor latency is a problem the project could not have had at 200 stars. It has it now.

## Counter-evidence / what would change my mind

[#142 `skill-analytics`](https://github.com/aaronjmars/aeon/pull/142) is the weakest fit for the thesis — a fleet-level run-analytics widget reads as much like operator dashboarding as contributor infrastructure. Reasonable to call it "tooling for the maintainer," not "tooling for the fork." The thesis still holds at 6 of 7 even with #142 carved out. A stronger refutation would be next week's PR slate: if #148-#150 ship a runtime change — a new model orchestration layer, a skill-execution rewrite, anything in the agent loop — the fork-pivot has reverted and the maintainer has rotated back to the engine. Watch for it.

## Why it matters

For an open-source agent framework competing against AutoGen, CrewAI, n8n, and LangGraph — the four projects compared head-to-head in `SHOWCASE.md` — the thing that scales is *operators running their own copy*, not stars on a README. AutoGen wants you to write Python agents. CrewAI wants you to write Python crews. Aeon wants you to fork once and walk away. That positioning only pays off if the fork experience is good enough that the second, fifth, and twentieth forker keeps shipping. PR #147 is the first piece of evidence that the project's roadmap is now *responsive to* its own ecosystem — a single fork operator's friction generated the next merge. If the pattern holds, Aeon will be one of very few agent frameworks whose 2026 roadmap is set by its users instead of its maintainer's prior-quarter intent.

---
*Sources*
- [aaronjmars/aeon repo](https://github.com/aaronjmars/aeon)
- [PR #147 — pr-triage](https://github.com/aaronjmars/aeon/pull/147)
- [PR #143 — `pezetel`, closed unmerged](https://github.com/aaronjmars/aeon/pull/143)
- [PR #145 — SHOWCASE.md](https://github.com/aaronjmars/aeon/pull/145)
- [SHOWCASE.md — active forks + ecosystem comparison](https://github.com/aaronjmars/aeon/blob/main/SHOWCASE.md)
- [aaronjmars on X — "just build on aeon"](https://x.com/aaronjmars/status/2046252721557139500)
- [DEV.to — Aeon: The Background AI Agent That Runs on GitHub Actions](https://dev.to/aaronjmars/aeon-the-background-ai-agent-that-runs-on-github-actions-16am)
