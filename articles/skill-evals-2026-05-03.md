# Skill Evals — 2026-05-03

**Verdict:** SKILL_EVALS_REGRESSED
**Coverage:** 14/100 (14.0%) ↓ vs prior 14/97 (14.4%)
**Diff:** 2 new fail · 2 fixed · 7 still failing · 3 stable

## Action Queue

1. Investigate repo-article — missing_pattern:Aeon|aeon; 2026-05-02 article covers swarm-fund-mvp, not aeon (ISS-019)
2. Patch evals.json:heartbeat — output_pattern `memory/logs/*.md` is shared log; other skills' entries trigger ${var} forbidden match (ISS-018)
3. Patch evals.json:polymarket → rename key to `monitor-polymarket`, fix output_pattern to `articles/monitor-polymarket-*.md` (ISS-009)
4. Patch evals.json:hn-digest → rename key to `hacker-news-digest`, fix output_pattern to `articles/hacker-news-digest-*.md` (ISS-007)
5. Dispatch repo-pulse — no output in 7+ days (ISS-003)
6. Investigate token-alert — no articles/ output despite cron-state success 2026-05-02T13:42Z (ISS-010)
7. Investigate skill-health — no articles/ output despite cron-state success (ISS-011)
8. Add evals.json entries for narrative-tracker, paper-pick, monitor-polymarket (+83 more uncovered enabled skills)

## Regressions (NEW_FAIL)

| Skill | Status | Root cause | Issue |
|-------|--------|------------|-------|
| heartbeat | NEW_FAIL | forbidden_pattern:${var} — 3 hits in memory/logs/2026-05-02.md (other skills' log entries) | ISS-018 |
| repo-article | NEW_FAIL | missing_pattern:Aeon\|aeon — 2026-05-02 article is about swarm-fund-mvp | ISS-019 |

## Recovered (FIXED)

| Skill | Was | Now |
|-------|-----|-----|
| push-recap | NO_OUTPUT (ISS-004) | PASS — articles/push-recap-2026-05-02.md (2,766 words) |
| cost-report | NO_OUTPUT (ISS-006) | PASS — articles/cost-report-2026-04-27.md (538 words) |

## Still Failing

| Skill | Status | Root cause | Issue | Failing since |
|-------|--------|------------|-------|---------------|
| repo-pulse | NO_OUTPUT | no_file_match: articles/repo-pulse-*.md | ISS-003 | 2026-04-26 |
| fork-fleet | NO_OUTPUT | no_file_match: articles/fork-fleet-*.md | ISS-005 | 2026-04-26 |
| hn-digest | NO_OUTPUT | no_file_match: spec key mismatch (hacker-news-digest) | ISS-007 | 2026-04-26 |
| rss-digest | NO_OUTPUT | no_file_match: articles/rss-digest-*.md | ISS-008 | 2026-04-26 |
| polymarket | NO_OUTPUT | no_file_match: spec key mismatch (monitor-polymarket) | ISS-009 | 2026-04-26 |
| token-alert | NO_OUTPUT | no_file_match despite cron-state success 05-02 | ISS-010 | 2026-04-26 |
| skill-health | NO_OUTPUT | no_file_match despite cron-state success | ISS-011 | 2026-04-26 |

## Full Results

| Skill | Status | Diff | Root cause | Quality | Words | Last output |
|-------|--------|------|------------|---------|-------|-------------|
| heartbeat | FAIL | NEW_FAIL | forbidden_pattern:${var} | unknown | ~13k+ | memory/logs/2026-05-02.md |
| changelog | PASS | STABLE | — | avg=4.0 | 525 | articles/changelog-2026-05-02.md |
| push-recap | PASS | FIXED | — | unknown | 2,766 | articles/push-recap-2026-05-02.md |
| repo-article | FAIL | NEW_FAIL | missing_pattern:Aeon\|aeon | unknown | 703 | articles/repo-article-2026-05-02.md |
| repo-actions | PASS | STABLE | — | unknown | 2,433 | articles/repo-actions-2026-05-02.md |
| deep-research | PASS | STABLE | — | unknown | 4,299 | articles/deep-research-2026-04-25.md |
| cost-report | PASS | FIXED | — | unknown | 538 | articles/cost-report-2026-04-27.md |
| repo-pulse | NO_OUTPUT | STILL_FAIL | no_file_match | unknown | — | — |
| fork-fleet | NO_OUTPUT | STILL_FAIL | no_file_match | unknown | — | — |
| hn-digest | NO_OUTPUT | STILL_FAIL | no_file_match (key mismatch) | unknown | — | — |
| rss-digest | NO_OUTPUT | STILL_FAIL | no_file_match | unknown | — | — |
| polymarket | NO_OUTPUT | STILL_FAIL | no_file_match (key mismatch) | unknown | — | — |
| token-alert | NO_OUTPUT | STILL_FAIL | no_file_match | unknown | — | — |
| skill-health | NO_OUTPUT | STILL_FAIL | no_file_match | unknown | — | — |

## Coverage Gaps (enabled in aeon.yml, missing from evals.json)

Top 10 by operational relevance:
- monitor-polymarket — inferred pattern: `articles/monitor-polymarket-*.md` (also fixes ISS-009)
- hacker-news-digest — inferred pattern: `articles/hacker-news-digest-*.md` (also fixes ISS-007)
- narrative-tracker — inferred pattern: `articles/narrative-tracker-*.md`
- paper-pick — inferred pattern: `articles/paper-pick-*.md`
- polymarket-comments — inferred pattern: `articles/polymarket-comments-*.md`
- monitor-kalshi — inferred pattern: `articles/monitor-kalshi-*.md`
- code-health — inferred pattern: `articles/code-health-*.md`
- evening-recap — inferred pattern: `articles/evening-recap-*.md`
- security-digest — inferred pattern: `articles/security-digest-*.md`
- deep-research — already covered

+76 more — see aeon.yml for full list.

## Notes

Two structural regressions this run. The repo-article regression is mission-grade: the skill is producing content about swarm-fund-mvp instead of the aeon repo. This may be intentional (operator uses repo-article for cross-repo coverage) but the assertion assumes aeon-focus. Resolve by either fixing the assertion or fixing the skill's default scope.

The heartbeat regression is a false positive: the shared `memory/logs/*.md` output_pattern picks up `${var}` from other skills' log entries. The assertion was not meaningful to begin with on a shared log file; narrowing the pattern or disabling the forbidden check for this output is the right fix.

Two real wins: push-recap and cost-report graduated from NO_OUTPUT to PASS. Both had been absent since the first eval (2026-04-26); their addition shows the cron infrastructure is recovering from the ISS-013 mass-failure tail.

Still-failing count: 7. All carry issues (ISS-003 through ISS-011 subset). The key spec-mismatch issues (ISS-007, ISS-009) remain the lowest-friction fixes — two evals.json key renames unlock two skill families.

## Sources

- evals.json=ok · cron-state=ok · skill-health=partial (changelog.json only) · eval-audit=fail (script approval blocked) · prior-article=ok (articles/skill-evals-2026-04-26.md)
