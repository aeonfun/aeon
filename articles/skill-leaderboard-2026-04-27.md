# Skill Leaderboard — 2026-04-27

**Verdict:** 6 configured forks; github-trending hit 50% — promote candidate

*Scanned 24 active forks of aaronjmars/aeon (pushed in last 30 days). 6 are configured (aeon.yml diverges from upstream defaults). Leaderboard scored against the configured 6.*

---

**Baseline note:** This instance (tomscaria/aeon) runs with all 100 skills enabled — a heavier divergence from the canonical template than any other fork in the fleet. Upstream defaults are drawn from the canonical aaronjmars/aeon aeon.yml (all skills `enabled: false` except heartbeat, global model `claude-opus-4-7`). The running instance's local aeon.yml is not used as the baseline because it would collapse all other forks into a single "less configured" tier and invert the leaderboard.

---

## Top Skills (configured fleet)

| Rank | Skill | Forks | % Configured | var | model | sched | Δ vs last week |
|------|-------|-------|--------------|-----|-------|-------|----------------|
| 1 | heartbeat | 6 | 100% | 0 | 0 | 0 | NEW |
| 2 | github-trending | 3 | 50% | 0 | 1 | 0 | NEW |
| 3 | defi-overview | 2 | 33% | 0 | 1 | 0 | NEW |
| 4 | digest | 2 | 33% | 1 | 0 | 0 | NEW |
| 5 | evening-recap | 2 | 33% | 1 | 0 | 0 | NEW |
| 6 | hacker-news-digest | 2 | 33% | 0 | 1 | 0 | NEW |
| 7 | idea-capture | 2 | 33% | 1 | 0 | 0 | NEW |
| 8 | paper-digest | 2 | 33% | 0 | 1 | 0 | NEW |
| 9 | skill-health | 2 | 33% | 0 | 1 | 0 | NEW |
| 10 | token-alert | 2 | 33% | 0 | 1 | 0 | NEW |
| 11 | token-movers | 2 | 33% | 0 | 1 | 0 | NEW |
| 12 | article | 2 | 33% | 0 | 0 | 0 | NEW |
| 13 | deep-research | 2 | 33% | 0 | 0 | 0 | NEW |
| 14 | github-monitor | 2 | 33% | 0 | 0 | 0 | NEW |
| 15 | market-context-refresh | 2 | 33% | 0 | 0 | 0 | NEW |

Ranks 16–24 (1 fork, 17%): morning-brief, skill-repair, startup-idea, token-report, and every remaining skill enabled exclusively by tomscaria/aeon.

*var = count of configured forks that override `var:` from empty. model = count with explicit per-skill `model:` override differing from canonical. sched = count with schedule override.*

## What the fleet is telling us

### Promote

github-trending reached 50% adoption across the configured fleet (tomscaria, maacx2022, pezetel) with upstream default `enabled: false`. It is the only non-heartbeat skill that three independent operators enabled. Upstream should flip it to `enabled: true` or at minimum surface it more prominently in the README quickstart.

Secondary promote candidates at 33% adoption (2/6 forks):

- **evening-recap** — 2 forks enabled; 1 (tomscaria) also set a custom `var:` for an end-of-day Telegram digest. Signals strong operator demand for a daily ops summary. Consider enabling with a default var prompt.
- **skill-health** — 2 forks enabled (maacx2022 with `model: claude-sonnet-4-6` override). Self-monitoring is the second thing operators turn on after a stable skill suite.
- **hacker-news-digest / paper-digest** — both at 33%, both on maacx2022 with model override. Morning content aggregation is a reliable first use case.
- **idea-capture / digest** — both at 33%, both on DannyTsaii with topic-specific `var:` values ("bitcoin", "AI agents"). Configurable content harvesting is the pattern.
- **defi-overview / token-alert / token-movers** — DeFi/token intelligence cluster at 33%. Crypto-context operators enable all three together.

Heuristic, operator overrides take precedence.

### Match

No formal per-skill match this week (no two configured forks independently overriding the same skill's `model:` to the same value, distinct from the canonical per-skill model).

Fleet signal worth noting: DannyTsaii/aeon and maacx2022/aeon independently changed the global `model:` to `claude-sonnet-4-6` (canonical: `claude-opus-4-7`). Two of six configured operators downgraded to Sonnet unprompted. Upstream should consider whether the canonical global default should shift, or whether the README should call this out as the recommended cost-optimization step.

### Sunset (review for removal or better docs)

Skills present in upstream `skills/` directory with 0 enabled instances across all configured forks and 0 var overrides:

1. **aixbt-pulse** — crypto market pulse via AIXBT endpoint. Not included in any fork's aeon.yml. May need better documentation or removal if the AIXBT API is no longer viable.
2. **create-campaign** — AdManage.ai ad provisioning. Specialized niche; no fork has adopted it. Better suited as a standalone repository than an always-bundled upstream skill.
3. **schedule-ads** — paired with create-campaign; same finding. Zero adoption, niche API dependency.

### Fleet-only skills

**0xfreddy/aeon** built `macos-apps` — weekly macOS app discovery digest, scheduled Monday 9 AM UTC. Not in upstream `skills/`. One fork adopted it; worth reviewing for upstream inclusion if the use case generalizes.

## Week-over-week

First ranked snapshot — no comparison available. State persisted to `memory/topics/skill-leaderboard-state.json` for next week's deltas.

## Fleet composition

| Tier | Count | % |
|------|-------|---|
| Configured | 6 | 25% |
| Template (untouched aeon.yml) | 18 | 75% |
| Unreadable (no tree / no yml / rate-limited) | 0 | 0% |
| **Total active forks** | **24** | **100%** |

Configured forks this week: tomscaria/aeon (all skills enabled), maacx2022/aeon (14 skills, Sonnet everywhere), DannyTsaii/aeon (digest + idea-capture with topic vars, Sonnet global), davenamovich/aeon (article + startup-idea), pezetel/aeon (github-trending only), 0xfreddy/aeon (macos-apps fork-only).

Conversion rate: 25% (6/24). Three-quarters of the active fleet have not moved beyond the heartbeat default.

## Source status

- Trees fetched: 24 / 24
- aeon.yml readable: 24 / 24
- Rate-limited: 0
- Fork-only skill files inspected: 1 (macos-apps in 0xfreddy/aeon)

---
*Source: GitHub API — forks of aaronjmars/aeon. Methodology: a fork counts as "configured" if its `aeon.yml` differs from canonical upstream defaults (aaronjmars/aeon) on `enabled`, `model`, `var`, or `schedule` for any skill. Untouched templates are excluded from leaderboard math.*
