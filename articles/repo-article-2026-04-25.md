# Aeon Stopped Shipping Single-Instance Features Four Days Ago

aaronjmars/aeon spent April 20 self-evolving 70+ existing skills in one squashed batch. Since April 22, every feature PR — without exception — has shipped a primitive that watches, scores, or onboards the fleet of forks. The single-instance autonomous-agent framework is becoming a fleet-operations layer, and the four-day window is sharp enough to call.

## The claim
> Every aaronjmars/aeon feature merge from Apr 22–25 (PRs #139, #140, #141, #142) targets the 36-fork fleet, not the single instance — that's a fleet-operations pivot.

## Evidence

The merged-feature timeline since the autoresearch batch finished tells one story. [PR #139](https://github.com/aaronjmars/aeon/pull/139) (Apr 22) shipped `./onboard` and a workflow_dispatch validator skill that the PR body justifies by counting the fleet: "32 forks exist, ~26 active, with no guided path from 'fork' to 'first skill running.'" The CLI is a read-only checklist (`aeon.yml` enabled skills, secrets configured, GH Actions has run, `memory/logs/` has entries) — its entire reason for existing is to drag silent forks across the activation line.

[PR #140](https://github.com/aaronjmars/aeon/pull/140) (Apr 23, +359 lines) added `fork-skill-digest`, a Sunday 18:30 UTC meta skill that detects "where the configured fork fleet systematically disagrees with upstream defaults" — `DEFAULT_FLIP_ENABLE`, `DEFAULT_FLIP_DISABLE`, `MODEL_CONSENSUS`, `VAR_HOTSPOT`, `EMERGING`. The skill mines configured-fork `aeon.yml` files and emits week-over-week deltas (`NEW_FLIP`, `STRENGTHENED`, `FADED`) backed by `memory/topics/fork-skill-digest-state.json`. There is no plausible single-instance use case — by construction it requires `N_CONFIGURED >= 2`.

[PR #141](https://github.com/aaronjmars/aeon/pull/141) (Apr 24, [commit `8242d84`](https://github.com/aaronjmars/aeon/commit/8242d84)) wired heartbeat to overwrite `docs/status.md` on every run with an Overall verdict, per-skill table, and open-issue list. The PR body is explicit: "Forks inherit the page automatically — since `docs/` is part of the repo, every fork that enables GitHub Pages gets `/status/` at their own Pages URL with zero extra config." Single-instance heartbeat already existed; what shipped was the trust signal that broadcasts it across all forks.

[PR #142](https://github.com/aaronjmars/aeon/pull/142) (Apr 25, +318 lines, still open) introduces `skill-analytics` — a Wednesday meta skill producing a fleet-wide ranked view from `./scripts/skill-runs --json --hours 168`, with anomaly flags (`SILENT`, `ALL_FAIL`, `CONSECUTIVE_FAILURES`, `LOW_SUCCESS`, `ALL_SKIP`, `DUPLICATE_RUNS`) and a significance gate that only notifies when at least one anomaly fires. The PR body explicitly frames the audience: "35 forks inherit the analytics widget for free." Both `heartbeat` and `skill-health` already existed; neither produces a fleet view.

## Counter-evidence / what would change my mind

Two earlier PRs in the same week argue the other way. [PR #137](https://github.com/aaronjmars/aeon/pull/137) on Apr 21 added A2A gateway and MCP server integration examples — a single-instance protocol-interop play. [PR #138](https://github.com/aaronjmars/aeon/pull/138) the same day shipped `aixbt-pulse + schedule-ads + create-campaign` — three monetization-flavored skills that run inside one instance. So the pivot is real but recent: it is the last four days, not the last seven. If the next feature PR after #142 reverts to a single-instance skill, the thesis weakens to "a four-day spike, not a direction." Worth re-checking on Apr 28.

## Why it matters

If the pivot holds, aeon's competitive position changes. The single-instance agent framework category is crowded — Obra's Superpowers collection [carries 40.9k stars and 3.1k forks](https://github.com/obra/superpowers) on the same `SKILL.md` substrate. Aeon at 237 stars and 36 forks is a second-tier framework on the single-instance axis. But "fleet operations layer for forks of an agent framework" is an unclaimed slot. The April 22–25 primitives — onboarding validator, divergence digest, public status page, fleet analytics widget — read as scaffolding for a peer-learning ecosystem where forks vote on defaults, broadcast health to anyone watching, and onboard new operators through a checklist instead of a tutorial. If the next two weeks of merges keep that shape, aaronjmars is building toward the fleet itself as the moat.

---
*Sources*
- [aaronjmars/aeon repo](https://github.com/aaronjmars/aeon) — 237 stars, 36 forks, 1 open issue at time of writing
- [PR #139 — onboard validator](https://github.com/aaronjmars/aeon/pull/139)
- [PR #140 — fork-skill-digest](https://github.com/aaronjmars/aeon/pull/140)
- [PR #141 — public status page](https://github.com/aaronjmars/aeon/pull/141)
- [PR #142 — skill-analytics (open)](https://github.com/aaronjmars/aeon/pull/142)
- [aaronjmars on X — aeon roadmap thread](https://x.com/aaronjmars/status/2036818584937095581)
- [Obra Superpowers — comparable Claude Code skill collection](https://github.com/obra/superpowers)
