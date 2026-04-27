# Fork Skill Digest — 2026-04-27

**Verdict:** 23 forks disable rss-digest (upstream defaults on) — fleet is voting it as noise

*Scanned 24 active forks of aaronjmars/aeon (pushed in last 30 days). 23 are configured (aeon.yml diverges from upstream defaults). Divergence scored against the configured 23.*

---

## Default-flip candidates

### Enable upward (upstream off → fleet enables)

No skills crossed the 50% enable-upward threshold this week.

### Disable downward (upstream on → fleet disables)

The dominant fleet pattern: operators fork, leave heartbeat running, disable everything else. 87 skills qualify for DEFAULT_FLIP_DISABLE this week (91–100% of configured forks disable each). Below are representative samples by disable tier; the full divergence table is in the appendix.

**100% disabled (23/23 forks) — selected skills:**

| Skill | Forks disabled | % of configured | Δ vs last week |
|-------|----------------|-----------------|----------------|
| rss-digest | 23 | 100% | NEW |
| daily-routine | 23 | 100% | NEW |
| telegram-digest | 23 | 100% | NEW |
| issue-triage | 23 | 100% | NEW |
| pr-review | 23 | 100% | NEW |
| auto-merge | 23 | 100% | NEW |
| github-issues | 23 | 100% | NEW |
| monitor-polymarket | 23 | 100% | NEW |
| monitor-kalshi | 23 | 100% | NEW |
| narrative-tracker | 23 | 100% | NEW |
| paper-pick | 23 | 100% | NEW |
| fetch-tweets | 23 | 100% | NEW |
| write-tweet | 23 | 100% | NEW |
| code-health | 23 | 100% | NEW |
| reflect | 23 | 100% | NEW |
| skill-leaderboard | 23 | 100% | NEW |
| fork-skill-digest | 23 | 100% | NEW |

*+ 55 more skills at 100%. See appendix for the full list.*

**95.7% disabled (22/23 forks):**

| Skill | Forks disabled | % of configured | Δ vs last week |
|-------|----------------|-----------------|----------------|
| morning-brief | 22 | 95.7% | NEW |
| hacker-news-digest | 22 | 95.7% | NEW |
| paper-digest | 22 | 95.7% | NEW |
| github-monitor | 22 | 95.7% | NEW |
| token-alert | 22 | 95.7% | NEW |
| token-movers | 22 | 95.7% | NEW |
| token-report | 22 | 95.7% | NEW |
| defi-overview | 22 | 95.7% | NEW |
| market-context-refresh | 22 | 95.7% | NEW |
| skill-health | 22 | 95.7% | NEW |
| skill-repair | 22 | 95.7% | NEW |
| evening-recap | 22 | 95.7% | NEW |
| article | 22 | 95.7% | NEW |
| startup-idea | 22 | 95.7% | NEW |
| idea-capture | 22 | 95.7% | NEW |

**91.3% disabled (21/23 forks):**

| Skill | Forks disabled | % of configured | Δ vs last week |
|-------|----------------|-----------------|----------------|
| github-trending | 21 | 91.3% | NEW |

**Fleet interpretation:** The 87-skill breadth of this signal is not "these skills are noise." It is an onboarding pattern: operators fork, verify the agent runs (heartbeat), and have not yet configured their skill slate. The default of `enabled: true` for 96 skills causes every fresh fork to register as a massive DISABLE_DOWNWARD voter the moment it disables anything. Recommended response: ship upstream with a much smaller default-enabled set. Skills where even configured operators don't enable them (100% disable rate) are stronger noise candidates. Skills with selective uptake (github-trending: 2 forks, article/startup-idea/idea-capture: 1 fork each) are genuinely optional.

---

## Fleet consensus on alternative settings

### Model overrides

None this week. Only one fork (maacx2022/aeon) has per-skill model overrides (7 skills → claude-sonnet-4-6). Below the MODEL_CONSENSUS threshold of 10 forks (≥40% of 23 configured).

### Var hotspots

None this week. Only one fork (DannyTsaii/aeon) has non-empty var overrides: idea-capture → "bitcoin". Below the VAR_HOTSPOT threshold of 7 forks (≥30% of 23 configured).

### Schedule overrides

One fork (lordchildrey/aeon) changes heartbeat schedule from `0 8,14,20 * * *` to `0 12 * * *`. Below fleet-consensus threshold.

---

## Watchlist (emerging — 25–49% adoption)

None this week. The highest skill adoption across the configured fleet is github-trending at 2/23 = 8.7%.

---

## Heaviest customizers (top 5)

| Fork | Total overrides | Dominant category | Notes |
|------|-----------------|-------------------|-------|
| lordchildrey/aeon | 99 | fork-only | 96 disabled + heartbeat schedule changed to noon + 2 fork-only skills (hn-digest, tweet-digest) |
| 0xfreddy/aeon | 97 | fork-only | 96 disabled + 1 fork-only skill (macos-apps — weekly macOS app discovery) |
| DannyTsaii/aeon | 96 | content | 94 disabled + var overrides on idea-capture ("bitcoin") + global model override to claude-sonnet-4-6 |
| pezetel/aeon | 95 | dev | 95 disabled, github-trending selectively kept |
| davenamovich/aeon | 94 | content | 94 disabled, article + startup-idea selectively kept |

*maacx2022/aeon notable: 82 disabled + 7 model overrides (crypto-focused stack: github-trending, token-alert, token-movers, defi-overview + monitoring cluster all moved to claude-sonnet-4-6 for cost). Total overrides: 89. Ranks 6th but has the richest configuration profile in the fleet.*

---

## Fork-only skills

| Fork | Skill | Notes |
|------|-------|-------|
| 0xfreddy/aeon | macos-apps | Monday macOS app discovery digest — not in upstream |
| lordchildrey/aeon | hn-digest | Shorter-form HN digest (distinct from hacker-news-digest) |
| lordchildrey/aeon | tweet-digest | Tweet aggregation skill — appears in 2 forks |
| Xedphilia/aeon | tweet-digest | Same skill concept — independent implementation |
| Xedphilia/aeon | wallet-digest | On-chain wallet monitoring digest |
| Xedphilia/aeon | feature | Single-skill enhancement command (cf. external-feature) |
| Xedphilia/aeon | build-skill | Skill construction tool (cf. create-skill) |
| Xedphilia/aeon | self-review | Self-assessment skill (cf. reflect/self-improve) |

**Upstreaming candidates:** `tweet-digest` (2 independent implementations = organic demand) and `macos-apps` (scoped niche skill with a clean weekly schedule) are the strongest upstream candidates. `wallet-digest` fills a gap between treasury-info and on-chain-monitor. Xedphilia appears to be running a significantly older/different fork generation; its full skillset warrants a closer look for upstreaming ideas.

---

## Week-over-week

First divergence snapshot — no comparison available.

---

## Fleet composition

| Tier | Count | % |
|------|-------|---|
| Configured | 23 | 95.8% |
| Template (untouched aeon.yml) | 1 | 4.2% |
| Unreadable | 0 | 0% |
| **Total active** | **24** | **100%** |

*Template fork: tomscaria/aeon — this running instance. Its aeon.yml is the upstream baseline.*

---

## Source status

- Trees fetched: 24 / 24
- aeon.yml readable: 24 / 24
- YAML parse failures: 0 (DannyTsaii has duplicate `digest:` key — last-wins parsing applied)
- Rate-limited: 0
- Fork-only skills inspected: 8 instances (6 unique names)

---

## Appendix — full divergence table

Sorted by forks_disabled_count desc. All 87 eligible skills (non-heartbeat, non-workflow_dispatch) qualify for DEFAULT_FLIP_DISABLE. Top 30 shown:

| Skill | enable_diff | var_overrides | model_overrides | schedule_overrides |
|-------|-------------|---------------|-----------------|--------------------|
| rss-digest | 23 | 0 | 0 | 0 |
| daily-routine | 23 | 0 | 0 | 0 |
| telegram-digest | 23 | 0 | 0 | 0 |
| issue-triage | 23 | 0 | 0 | 0 |
| pr-review | 23 | 0 | 0 | 0 |
| auto-merge | 23 | 0 | 0 | 0 |
| github-issues | 23 | 0 | 0 | 0 |
| github-releases | 23 | 0 | 0 | 0 |
| on-chain-monitor | 23 | 0 | 0 | 0 |
| defi-monitor | 23 | 0 | 0 | 0 |
| treasury-info | 23 | 0 | 0 | 0 |
| monitor-polymarket | 23 | 0 | 0 | 0 |
| monitor-kalshi | 23 | 0 | 0 | 0 |
| monitor-runners | 23 | 0 | 0 | 0 |
| token-pick | 23 | 0 | 0 | 0 |
| narrative-tracker | 23 | 0 | 0 | 0 |
| polymarket-comments | 23 | 0 | 0 | 0 |
| unlock-monitor | 23 | 0 | 0 | 0 |
| technical-explainer | 23 | 0 | 0 | 0 |
| research-brief | 23 | 0 | 0 | 0 |
| paper-pick | 23 | 0 | 0 | 0 |
| search-skill | 23 | 0 | 0 | 0 |
| security-digest | 23 | 0 | 0 | 0 |
| deal-flow | 23 | 0 | 0 | 0 |
| reg-monitor | 23 | 0 | 0 | 0 |
| push-recap | 23 | 0 | 0 | 0 |
| repo-article | 23 | 0 | 0 | 0 |
| repo-actions | 23 | 0 | 0 | 0 |
| repo-pulse | 23 | 0 | 0 | 0 |
| star-milestone | 23 | 0 | 0 | 0 |

*+ 57 more skills with enable_diff between 21 and 23, all 0 on other signals.*

Skills with non-zero non-enable signals: github-trending (model_overrides: 1 by maacx2022, 21 enable_diff), hacker-news-digest (model: 1, 22 enable_diff), paper-digest (model: 1, 22 enable_diff), token-alert (model: 1, 22 enable_diff), token-movers (model: 1, 22 enable_diff), defi-overview (model: 1, 22 enable_diff), skill-health (model: 1, 22 enable_diff), idea-capture (var: 1 [bitcoin], 22 enable_diff).

heartbeat (schedule_overrides: 1 by lordchildrey) is excluded from flip math per spec. It appears here for completeness: enable_diff 0, var 0, model 0, schedule 1.

---

*Source: GitHub API — forks of aaronjmars/aeon. Methodology: a fork is "configured" if its aeon.yml diverges from upstream defaults on enabled, model, var, or schedule for any skill. Untouched templates are excluded from divergence math. Companion to skill-leaderboard (popularity) and fork-fleet (per-fork work).*
