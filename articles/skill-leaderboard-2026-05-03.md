# Skill Leaderboard — 2026-05-03

**Verdict:** 7 configured forks; `github-trending` hit 43% — promote candidate

*Scanned 28 active forks of aaronjmars/aeon (pushed in last 30 days). 7 are configured (aeon.yml diverges from upstream defaults). Leaderboard scored against the configured 7.*

## Top Skills (configured fleet)

| Rank | Skill | Forks | % Configured | var | model | sched | Δ vs last week |
|------|-------|-------|--------------|-----|-------|-------|----------------|
| 1 | heartbeat | 7 | 100% | 0 | 0 | 2 | — |
| 2 | github-trending | 3 | 43% | 0 | 1 | 0 | — |
| 3 | defi-overview | 2 | 29% | 0 | 1 | 0 | — |
| 4 | digest | 2 | 29% | 2 | 0 | 0 | — |
| 5 | evening-recap | 2 | 29% | 1 | 0 | 0 | — |
| 6 | hacker-news-digest | 2 | 29% | 0 | 1 | 0 | — |
| 7 | idea-capture | 2 | 29% | 2 | 0 | 0 | — |
| 8 | paper-digest | 2 | 29% | 0 | 1 | 0 | — |
| 9 | skill-health | 2 | 29% | 0 | 1 | 0 | — |
| 10 | token-alert | 2 | 29% | 0 | 1 | 0 | — |
| 11 | token-movers | 2 | 29% | 0 | 1 | 0 | — |
| 12 | deep-research | 2 | 29% | 0 | 0 | 0 | — |
| 13 | github-monitor | 2 | 29% | 0 | 0 | 0 | — |
| 14 | market-context-refresh | 2 | 29% | 0 | 0 | 0 | ↑1 |
| 15 | morning-brief | 2 | 29% | 0 | 0 | 0 | ↑1 |

*(Top 15 shown. `var`, `model`, `sched` columns = count of CONFIGURED forks that override that field for this skill.)*

## What the fleet is telling us

### Promote

- **`github-trending`** — 3/7 (43%) configured forks have it on. Upstream default is `false`. The fleet finds it useful regardless of operator niche; worth flipping the default or at minimum featuring it as "first skill to enable."
- **`evening-recap`** — 29% adoption, both enabling forks set a custom `var`. Operators are personalizing the end-of-day summary. Strong signal that the skill delivers value when configured, weak when run stock.
- **`skill-health`** — 29% adoption. Both forks enabling it added `model: claude-sonnet-4-6` override. Suggests operators want the daily health check but don't want to burn opus on it. Candidate for a built-in model default in upstream.

### Match

None this week. Only `maacx2022` independently overrides model to `claude-sonnet-4-6` on several skills (`hacker-news-digest`, `paper-digest`, `github-trending`, `token-alert`, `token-movers`, `defi-overview`, `skill-health`). No second fork independently makes the same choice on the same skill. Watch next week — if a new configured fork runs a similar pattern, the match signal hardens.

### Sunset (review for removal or better docs)

- **`aixbt-pulse`** — 0 forks enabled in this run and last run (2nd consecutive 0-fork week). Not in any aeon.yml. Dead path.
- **`create-campaign`** — same pattern. 0 for 2 weeks. No adopters.
- **`schedule-ads`** — same. Paired with `create-campaign`; both appear to be relics of a dropped advertising feature.

### Fleet-only skills

- **`macos-apps`** (`0xfreddy/aeon`) — weekly macOS app discovery digest, Monday 9 AM UTC. Not in upstream. Enabled and running. Review for upstream inclusion.

## Week-over-week

- **Rising:** `token-report` (rank 19 → 15, ↑4) — maacx2022 fork ran it this week, confirmed stable.
- **Falling:** `article` (rank 12 → ~23, ↓11) — dropped from 2 forks to 1 (tomscaria only); one prior configured fork rotated out. `startup-idea` (rank 18 → ~23, ↓5) — same cause.
- **New entries:** none in top 15.
- **Dropouts:** none (no skill hit 0 forks_enabled this week among previously ranked skills).

## Fleet composition

| Tier | Count | % |
|------|-------|---|
| Configured | 7 | 25% |
| Template (untouched aeon.yml) | 21 | 75% |
| Unreadable (no tree / no yml / rate-limited) | 0 | 0% |
| **Total active forks** | **28** | 100% |

Fleet grew from 24 → 28 active forks week-over-week. Configured count: 6 → 7. Conversion rate held at 25%.

## Source status

- Trees fetched: 3 / 28 (lordchildrey, 0xfreddy, Xedphilia — checked for fork-only skill dirs)
- aeon.yml readable: 28 / 28
- Rate-limited: 0
- Fork-only skill dirs inspected: ~12 (across lordchildrey, Xedphilia, 0xfreddy trees)

---
*Source: GitHub API — forks of aaronjmars/aeon. Methodology: a fork counts as "configured" if its `aeon.yml` differs from upstream defaults on `enabled`, `model`, `var`, or `schedule` for any skill. Untouched templates are excluded from leaderboard math.*
