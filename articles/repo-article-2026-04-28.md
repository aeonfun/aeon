# Aeon's Last Seven PRs Are All About the Forks. Zero Touched the Skill Executor.

From April 21 to April 28, 2026, Aeon merged seven PRs. Every one ships ecosystem instrumentation — public status page, fork-divergence digest, contributor rewards plan, fleet skill analytics, onboarding validator, ecosystem comparison doc, public token dashboard. None touched the core skill executor or the cron loop. The framework's headline product this week was watching itself.

## The claim

> Aeon shipped 7 merged PRs from 2026-04-21 to 2026-04-28; all 7 add meta or ecosystem features (public status page, fork analytics, contributor rewards, onboarding, SHOWCASE) — zero modify the core executor, the chain runner, or the scheduling primitive.

## Evidence

Walk the PR list directly. [#139](https://github.com/aaronjmars/aeon/pull/139) is the `onboard` validator — a bash CLI plus skill that runs eight checks on a fresh fork (workflows present, Claude auth secret set, at least one notification channel wired). [#140](https://github.com/aaronjmars/aeon/pull/140) adds `fork-skill-digest`, a Sunday 18:30 UTC meta skill that surfaces where configured forks diverge from upstream defaults on `enabled`, `var`, `model`, or `schedule`. [#141](https://github.com/aaronjmars/aeon/pull/141) wires a public `/status/` page on the GitHub Pages gallery that the existing `heartbeat` skill regenerates three times a day. [#142](https://github.com/aaronjmars/aeon/pull/142) is `skill-analytics`, a Wednesday widget that pulls `./scripts/skill-runs --json --hours 168` to produce a fleet-wide ranking of every skill's pass/fail rate over the prior 7 days.

The rest of the week extends the same surface. [#144](https://github.com/aaronjmars/aeon/pull/144) is `contributor-reward`, which reads the latest `fork-contributor-leaderboard` article and writes a tier-priced `memory/distributions.yml` plan for the existing on-chain `distribute-tokens` pipeline — closing the loop from "we ranked your work" to "here is a proposed payout." [#145](https://github.com/aaronjmars/aeon/pull/145) ships `SHOWCASE.md`, a public table of the six most-active forks plus a head-to-head against AutoGen, CrewAI, n8n, and LangGraph. [#146](https://github.com/aaronjmars/aeon/pull/146) extends the public status page with a Token Pulse row showing AEON price, 24h change, liquidity, volume, and FDV.

Now look at what each diff actually changed. Every PR adds either a new `skills/<name>/SKILL.md` (139, 140, 142, 144), extends `skills/heartbeat/SKILL.md` (141, 146), or edits docs (145). The most invasive non-skill edit in the whole week is a one-line touch to `.github/workflows/aeon.yml` in [#142](https://github.com/aaronjmars/aeon/pull/142) — wiring to register the new meta skill, not a runtime change. `chain-runner.yml`, the workflow at the heart of the documented `dispatch_skill()` bug that has degraded `morning-brief`, `evening-rollup`, and `weekly-grant-update` for over four days running, was not touched once. The `./aeon` runner, the `chain-runner.yml` workflow, and the cron primitive all sit at byte-for-byte parity with where they sat on April 21.

Activity outside the merge log tells the same story. The repo has issues disabled (zero open). There are zero open PRs as of [the tip of `main`](https://github.com/aaronjmars/aeon). There is no release in the seven-day window. Star count crossed 250 (251 at time of writing, up from 244 a week ago) — distribution growth, not runtime work.

## Counter-evidence / what would change my mind

The strongest counter-read is that `heartbeat` *is* core. Both [#141](https://github.com/aaronjmars/aeon/pull/141) and [#146](https://github.com/aaronjmars/aeon/pull/146) extend `skills/heartbeat/SKILL.md`, and heartbeat is the skill that decides whether the agent itself is healthy. Editing it changes how the system reasons about its own liveness, which is closer to the executor than to the meta-layer. A weaker counter: `aeon.yml` was touched in four of seven PRs, and `aeon.yml` is the schedule manifest. But every one of those edits is a single line — `enabled: true` plus a cron string for the new meta skill. That is registration, not redesign.

The honest gap in the thesis is the *negative* claim — that no core work is happening. It might just be queued elsewhere and not yet visible in `main`. The repo's documented `chain-runner.yml dispatch_skill()` bug is exactly the kind of fix you would expect to land in a normal week, and its absence is consistent with the thesis but does not prove a deliberate strategy. It could just be an unstaffed week on the runtime.

## Why it matters

If you fork Aeon today, you inherit a fleet-aware framework: a public status page that tells your community whether your agent is up, an analytics view that shows which skills are earning their cron cost, a leaderboard that ranks contributors by impact, and a rewards plan that prices their work. That is a different framework from the one that existed on April 21, even though the executor is byte-for-byte identical. Aeon is treating the forks themselves as the product surface, not the orchestration primitive. Compare against the [AutoGen / CrewAI](https://dev.to/aaronjmars/aeon-the-background-ai-agent-that-runs-on-github-actions-16am) cohort, where every release note is about orchestration primitives. Aeon's release note this week is about distribution instrumentation. That is a competitive choice, not a roadmap accident — and if you are evaluating frameworks for a fork-friendly deployment, it is the choice that should move your prior.

---

*Sources*
- [PR #139 — onboard validator skill + ./onboard CLI](https://github.com/aaronjmars/aeon/pull/139)
- [PR #140 — fork-skill-digest divergence digest](https://github.com/aaronjmars/aeon/pull/140)
- [PR #141 — public /status/ page](https://github.com/aaronjmars/aeon/pull/141)
- [PR #142 — skill-analytics fleet-level widget](https://github.com/aaronjmars/aeon/pull/142)
- [PR #144 — contributor-reward tier-priced rewards plan](https://github.com/aaronjmars/aeon/pull/144)
- [PR #145 — SHOWCASE.md active forks + ecosystem comparison](https://github.com/aaronjmars/aeon/pull/145)
- [PR #146 — Token Pulse section on public status page](https://github.com/aaronjmars/aeon/pull/146)
- [aaronjmars/aeon (repo root)](https://github.com/aaronjmars/aeon)
- [Public status page (live)](https://aaronjmars.github.io/aeon/status/)
- [Aeon: The Background AI Agent That Runs on GitHub Actions — dev.to](https://dev.to/aaronjmars/aeon-the-background-ai-agent-that-runs-on-github-actions-16am)
