# Aeon's Last Week Wasn't About the Agent. It Was About the Forks.

In the seven days from 2026-04-23 to 2026-04-30, aaronjmars merged eight pull requests into the [aeon](https://github.com/aaronjmars/aeon) repo. Six of them — [#140](https://github.com/aaronjmars/aeon/pull/140), [#141](https://github.com/aaronjmars/aeon/pull/141), [#142](https://github.com/aaronjmars/aeon/pull/142), [#144](https://github.com/aaronjmars/aeon/pull/144), [#145](https://github.com/aaronjmars/aeon/pull/145), and [#147](https://github.com/aaronjmars/aeon/pull/147) — operate across forks rather than inside any single instance. The headline feature isn't a new agent capability. It's a USDC payout schedule for the people forking the repo.

## The claim

> In the week of 2026-04-23 to 2026-04-30, aeon stopped shipping agent features and started shipping fork-fleet infrastructure — 6 of 8 merged PRs are cross-fork visibility, ranking, payout, or triage.

## Evidence

The cross-fork PRs cluster on four functions. **Visibility**: PR [#140](https://github.com/aaronjmars/aeon/pull/140) added [`fork-skill-digest`](https://github.com/aaronjmars/aeon/blob/main/skills/fork-skill-digest/SKILL.md) (357 lines), which scans every active fork's `aeon.yml` and reports where operators "systematically disagree with upstream defaults" — categorized as DEFAULT_FLIP_ENABLE, DEFAULT_FLIP_DISABLE, MODEL_CONSENSUS, or EMERGING. PR [#141](https://github.com/aaronjmars/aeon/pull/141) bolted on a public `/status/` page (31 new lines in `docs/status.md` plus 69 added to `skills/heartbeat/SKILL.md`) that "every fork gets". PR [#142](https://github.com/aaronjmars/aeon/pull/142) shipped [`skill-analytics`](https://github.com/aaronjmars/aeon/blob/main/skills/skill-analytics/SKILL.md) (316 lines) — a 7-day fleet-level run analyzer with a six-anomaly classifier (SILENT, ALL_FAIL, CONSECUTIVE_FAILURES, LOW_SUCCESS, ALL_SKIP, DUPLICATE_RUNS).

**Ranking and payout** are PRs [#144](https://github.com/aaronjmars/aeon/pull/144) and [#145](https://github.com/aaronjmars/aeon/pull/145). The first added [`contributor-reward`](https://github.com/aaronjmars/aeon/blob/main/skills/contributor-reward/SKILL.md) (254 lines), which reads the fork-contributor leaderboard and writes a tier-priced USDC distribution plan — $25/$15/$10/$5/$5 for ranks one through five, plus a $5 first-PR bonus per login. The skill stops short of executing payouts, but the schedule is now versioned in the repo. The second added [SHOWCASE.md](https://github.com/aaronjmars/aeon/blob/main/SHOWCASE.md) (72 lines), an ecosystem comparison page that names six "active" forks by enabled-skill count and positions aeon against AutoGen, CrewAI, n8n, and LangGraph.

**Triage** is PR [#147](https://github.com/aaronjmars/aeon/pull/147), `pr-triage` (248 lines). The skill applies a four-check rubric — scope, format, originality, ≤500-line size — to external PRs and emits OUT-OF-SCOPE / NEEDS-CHANGES / DEFER / ACCEPTED verdicts within minutes. The stated motive is operator load: "External PRs that sit unanswered look unwelcoming."

The two PRs that aren't fork-fleet plumbing are [#146](https://github.com/aaronjmars/aeon/pull/146) (Token Pulse appended to the status page, which is fork-shared infrastructure anyway) and [#148](https://github.com/aaronjmars/aeon/pull/148) (`thread-formatter`, 190 lines). That's the closest the week comes to a single-instance feature.

## Counter-evidence / what would change my mind

The fork-fleet thesis depends on the forks being a real audience. They aren't yet. The repo has 37 forks total per `gh api repos/aaronjmars/aeon`, but [SHOWCASE.md](https://github.com/aaronjmars/aeon/blob/main/SHOWCASE.md) names only six as "active", and 18 of 24 examined run nothing but `heartbeat`. A single fork — `tomscaria/aeon` — accounts for "the majority of all enabled skill slots across all active forks" (94 skills). Star count moved from 252 a week ago to 254 today: two stars in seven days. If the next two weeks bring more forks running more than five skills, the thesis strengthens; if not, contributor-reward becomes a payout schedule with no payees, and `fork-skill-digest` becomes an analyzer of a dataset of one.

A second weakness: the fork features aren't independently composable. `contributor-reward` reads the output of an upstream `fork-contributor-leaderboard` skill. `skill-analytics` reads the output of `./scripts/skill-runs --json`. Each addition extends the same internal contract rather than opening a public surface — so the "ecosystem" is functionally still single-author-coordinated, by sole-maintainer aaronjmars who merged all eight PRs himself.

## Why it matters

If you fork aeon and configure it heavily, you're now in a paid leaderboard. The mechanism is unilateral — aaronjmars owns the upstream, the leaderboard, and the payout key — but the schedule sits in the repo, and the `contributor-reward` spec explicitly preserves diffs between plan generation and execution as an audit trail. For operators running large fork instances (the [tomscaria/aeon](https://github.com/tomscaria/aeon) profile in SHOWCASE.md fits the description), this is the first week aeon's economic model became visible: forks contribute upward through the leaderboard, and the upstream returns dollars and SHOWCASE.md placement. Whether that scales depends on how many of the next ten forks ship a real `aeon.yml` instead of leaving heartbeat as the only entry. The infrastructure is now waiting for the population it assumes exists.

---
*Sources*
- [aeon/pull/140 — fork-skill-digest](https://github.com/aaronjmars/aeon/pull/140)
- [aeon/pull/142 — skill-analytics](https://github.com/aaronjmars/aeon/pull/142)
- [aeon/pull/144 — contributor-reward](https://github.com/aaronjmars/aeon/pull/144)
- [aeon/pull/145 — SHOWCASE.md](https://github.com/aaronjmars/aeon/pull/145)
- [aeon/pull/147 — pr-triage](https://github.com/aaronjmars/aeon/pull/147)
- [SHOWCASE.md (live)](https://github.com/aaronjmars/aeon/blob/main/SHOWCASE.md)
- [Aeon: The Background AI Agent That Runs on GitHub Actions — DEV Community](https://dev.to/aaronjmars/aeon-the-background-ai-agent-that-runs-on-github-actions-16am)
