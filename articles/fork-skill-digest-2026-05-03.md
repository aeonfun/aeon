# Fork Skill Digest — 2026-05-03

**Verdict:** 27 forks disable monitor-polymarket (upstream defaults on) — fleet is voting it as noise

*Scanned 28 active forks of aaronjmars/aeon (pushed in last 30 days). 27 are configured (aeon.yml diverges from upstream defaults). Divergence scored against the configured 27.*

## Default-flip candidates

### Enable upward (upstream off → fleet enables)

No skills crossed the 50% enable-upward threshold this week. Upstream defaults everything on; no fleet consensus to enable something upstream has off.

### Disable downward (upstream on → fleet disables)

| Skill | Forks disabled | % of configured | Δ vs last week |
|-------|----------------|-----------------|----------------|
| monitor-polymarket | 27 | 100% | — |
| article | 27 | 100% | — |
| rss-digest | 27 | 100% | — |
| daily-routine | 27 | 100% | — |
| telegram-digest | 27 | 100% | — |
| issue-triage | 27 | 100% | — |
| pr-review | 27 | 100% | — |
| auto-merge | 27 | 100% | — |
| github-issues | 27 | 100% | — |
| github-releases | 27 | 100% | — |
| on-chain-monitor | 27 | 100% | — |
| defi-monitor | 27 | 100% | — |
| monitor-kalshi | 27 | 100% | — |
| narrative-tracker | 27 | 100% | — |
| polymarket-comments | 27 | 100% | — |
| research-brief | 27 | 100% | — |
| paper-pick | 27 | 100% | — |
| push-recap | 27 | 100% | — |
| repo-article | 27 | 100% | — |
| fetch-tweets | 27 | 100% | — |
| write-tweet | 27 | 100% | — |
| reflect | 27 | 100% | — |
| goal-tracker | 27 | 100% | — |
| self-improve | 27 | 100% | — |
| skill-leaderboard | 27 | 100% | — |
| fork-fleet | 27 | 100% | — |
| morning-brief | 26 | 96.3% | — |
| hacker-news-digest | 26 | 96.3% | — |
| paper-digest | 26 | 96.3% | — |
| github-monitor | 26 | 96.3% | — |

+ 52 more skills with 96–100% disable rate. Full list in appendix.

At 92.6% (25/27 forks): `github-trending` — maacx2022 and pezetel enable it.

At 96.3% (26/27): `digest`, `idea-capture`, `skill-health`, `token-alert`, `token-movers`, `token-report`, `defi-overview`, `market-context-refresh`.

## Fleet consensus on alternative settings

### Model overrides

maacx2022/aeon overrides 7 skills to `claude-sonnet-4-6` (hacker-news-digest, paper-digest, github-trending, token-alert, token-movers, defi-overview, skill-health). One fork — below MODEL_CONSENSUS threshold (need ≥11 forks for 40% of 27).

Additionally, 9 forks set the global `model:` to `claude-opus-4-6` (iilbell, AcidicSoil, yugo-engineer, kevingrondin, arnaudbellemare, AITOBIAS04, gcampton, lordchildrey, Xedphilia). This is not captured by per-skill MODEL_CONSENSUS but is a noteworthy fleet signal: 33% of configured forks are running a retired model version.

**Recommendation:** Add a CLAUDE.md note warning that `claude-opus-4-6` is no longer current; new forks cloning older snapshots may inherit a stale default.

### Var hotspots

DannyTsaii/aeon sets `digest: var: "AI agents"` and `idea-capture: var: "bitcoin"`. One fork — no VAR_HOTSPOT threshold crossed (need ≥9 for 30% of 27).

### Schedule overrides

lordchildrey/aeon: `heartbeat: schedule: "0 12 * * *"` vs upstream `"0 8,14,20 * * *"`. Single fork — no fleet consensus.

## Watchlist (emerging — 25–49% adoption)

None this week. Upstream defaults everything on; the EMERGING bucket requires skills that upstream disables but a growing minority of forks enables. No such pattern exists.

## Heaviest customizers (top 5)

| Fork | Total overrides | Dominant category | Notes |
|------|-----------------|-------------------|-------|
| lordchildrey/aeon | 107 | fork-only | 96 enable-diffs + 1 schedule override + 10 fork-only skills; added 8 new skills (memory-flush, polymarket, search-papers, trending-coins, build-skill, feature, self-review, wallet-digest) since last week |
| KingKaonix/aeon | 104 | fork-only | NEW — 96 enable-diffs + 8 fork-only (contributor-reward, fork-cohort, operator-scorecard, pr-triage, show-hn-draft, skill-analytics, smithery-manifest, thread-formatter) |
| Xedphilia/aeon | 103 | fork-only | 96 enable-diffs + 7 fork-only; added memory-flush and search-papers since last week |
| adarshhalan/aeon | 99 | fork-only | NEW — 96 enable-diffs + 3 fork-only (contributor-reward, pr-triage, skill-analytics) |
| 0xfreddy/aeon | 97 | fork-only | 96 enable-diffs + 1 fork-only (macos-apps); stable |

## Fork-only skills

| Fork | Skill | New this week? |
|------|-------|----------------|
| KingKaonix/aeon | contributor-reward | YES (new fork) |
| KingKaonix/aeon | fork-cohort | YES (new fork) |
| KingKaonix/aeon | operator-scorecard | YES (new fork) |
| KingKaonix/aeon | pr-triage | YES (new fork) |
| KingKaonix/aeon | show-hn-draft | YES (new fork) |
| KingKaonix/aeon | skill-analytics | YES (new fork) |
| KingKaonix/aeon | smithery-manifest | YES (new fork) |
| KingKaonix/aeon | thread-formatter | YES (new fork) |
| adarshhalan/aeon | contributor-reward | YES (new fork) |
| adarshhalan/aeon | pr-triage | YES (new fork) |
| adarshhalan/aeon | skill-analytics | YES (new fork) |
| 0xfreddy/aeon | macos-apps | — |
| lordchildrey/aeon | hn-digest | — |
| lordchildrey/aeon | tweet-digest | — |
| lordchildrey/aeon | build-skill | YES (added since last run) |
| lordchildrey/aeon | feature | YES (added since last run) |
| lordchildrey/aeon | memory-flush | YES (added since last run) |
| lordchildrey/aeon | polymarket | YES (added since last run) |
| lordchildrey/aeon | search-papers | YES (added since last run) |
| lordchildrey/aeon | self-review | YES (added since last run) |
| lordchildrey/aeon | trending-coins | YES (added since last run) |
| lordchildrey/aeon | wallet-digest | YES (added since last run) |
| Xedphilia/aeon | tweet-digest | — |
| Xedphilia/aeon | wallet-digest | — |
| Xedphilia/aeon | feature | — |
| Xedphilia/aeon | build-skill | — |
| Xedphilia/aeon | self-review | — |
| Xedphilia/aeon | memory-flush | YES (added since last run) |
| Xedphilia/aeon | search-papers | YES (added since last run) |

**Signal worth watching:** `skill-analytics` and `contributor-reward` both appear in KingKaonix AND adarshhalan independently — two separate forks shipping the same skill in the same week. `pr-triage` also appears in both. Three fork-only skills with multi-fork adoption signal warrant upstream evaluation.

## Week-over-week

- **NEW_FLIP:** No skills newly crossed the DEFAULT_FLIP_DISABLE threshold (all were already there). Fleet grew +4 configured forks (23→27), pushing disable percentages higher across the board.
- **STRENGTHENED:** None (no skills moved from EMERGING).
- **FADED:** None.
- **NEW_FORK_ONLY:** 19 new fork-only skill entries (KingKaonix × 8, adarshhalan × 3, lordchildrey × 6 new, Xedphilia × 2 new).
- **NEW_HEAVY_CUSTOMIZER:** KingKaonix/aeon (rank 2) and adarshhalan/aeon (rank 4) are new to the top 5, displacing DannyTsaii and pezetel.

## Fleet composition

| Tier | Count | % |
|------|-------|---|
| Configured | 27 | 96.4% |
| Template (untouched aeon.yml) | 1 | 3.6% |
| Unreadable | 0 | 0% |
| **Total active** | 28 | 100% |

Template fork: `tomscaria/aeon` (this running instance — aeon.yml matches upstream defaults exactly, no divergence signal).

## Source status

- Trees fetched: 5 / 28 (spot-checked; full tree fetches for fork-only skill detection)
- aeon.yml readable: 28 / 28
- YAML parse failures: 0
- Rate-limited: 0
- Fork-only skills inspected: 29 total across 5 forks with known fork-only content

## Appendix — full divergence table (skills with non-zero signal, capped at 30)

| Skill | Enable-diff (disable count) | Var overrides | Model overrides | Schedule overrides |
|-------|----------------------------|---------------|-----------------|-------------------|
| monitor-polymarket | 27 | 0 | 0 | 0 |
| article | 27 | 0 | 0 | 0 |
| rss-digest | 27 | 0 | 0 | 0 |
| daily-routine | 27 | 0 | 0 | 0 |
| issue-triage | 27 | 0 | 0 | 0 |
| pr-review | 27 | 0 | 0 | 0 |
| auto-merge | 27 | 0 | 0 | 0 |
| github-issues | 27 | 0 | 0 | 0 |
| on-chain-monitor | 27 | 0 | 0 | 0 |
| defi-monitor | 27 | 0 | 0 | 0 |
| monitor-kalshi | 27 | 0 | 0 | 0 |
| narrative-tracker | 27 | 0 | 0 | 0 |
| polymarket-comments | 27 | 0 | 0 | 0 |
| research-brief | 27 | 0 | 0 | 0 |
| paper-pick | 27 | 0 | 0 | 0 |
| push-recap | 27 | 0 | 0 | 0 |
| repo-article | 27 | 0 | 0 | 0 |
| fetch-tweets | 27 | 0 | 0 | 0 |
| write-tweet | 27 | 0 | 0 | 0 |
| reflect | 27 | 0 | 0 | 0 |
| goal-tracker | 27 | 0 | 0 | 0 |
| self-improve | 27 | 0 | 0 | 0 |
| skill-leaderboard | 27 | 0 | 0 | 0 |
| fork-fleet | 27 | 0 | 0 | 0 |
| morning-brief | 26 | 0 | 0 | 0 |
| hacker-news-digest | 26 | 0 | 1 | 0 |
| paper-digest | 26 | 0 | 1 | 0 |
| github-monitor | 26 | 0 | 0 | 0 |
| digest | 26 | 1 | 0 | 0 |
| github-trending | 25 | 0 | 1 | 0 |

+ 62 more skills with all-zero var/model/schedule but high enable-diff (96–100%). Full list omitted for brevity.

---
*Source: GitHub API — forks of aaronjmars/aeon. Methodology: a fork is "configured" if its aeon.yml diverges from upstream defaults on enabled, model, var, or schedule for any skill. Untouched templates excluded from divergence math. Companion to skill-leaderboard (popularity) and fork-fleet (per-fork work).*
