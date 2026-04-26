# Skill Evals — 2026-04-26

**Verdict:** SKILL_EVALS_REGRESSED
**Coverage:** 14/97 (14.4%) — first run (BOOTSTRAP)
**Diff:** 9 new fail · 0 fixed · 0 still failing · 5 stable (all NEW_* — bootstrap baseline)

## Action Queue
1. Patch evals.json:polymarket — rename key to `monitor-polymarket`, fix output_pattern to `articles/monitor-polymarket-*.md` (ISS-009, mission-critical)
2. Patch evals.json:hn-digest — rename key to `hacker-news-digest`, fix output_pattern to `articles/hacker-news-digest-*.md` (ISS-007)
3. Investigate token-alert — no_file_match despite cron-state success; inspect SKILL.md for actual output path (ISS-010)
4. Investigate skill-health — may not produce articles/ output; check if evals.json should point to `memory/skill-health/last-report.json` (ISS-011)
5. Dispatch repo-pulse — no output in 1 day (ISS-003)
6. Dispatch push-recap — no output in 1 day (ISS-004)
7. Dispatch rss-digest — no output in 1 day (ISS-008)
8. Add evals.json specs for uncovered enabled skills — 83 uncovered; top candidates: monitor-polymarket, narrative-tracker, paper-pick, security-digest, code-health

## Regressions (NEW_FAIL)

| Skill | Status | Root cause | Issue |
|-------|--------|------------|-------|
| repo-pulse | NEW_FAIL | no_file_match | ISS-003 |
| push-recap | NEW_FAIL | no_file_match | ISS-004 |
| fork-fleet | NEW_FAIL | no_file_match | ISS-005 |
| cost-report | NEW_FAIL | no_file_match | ISS-006 |
| hn-digest | NEW_FAIL | no_file_match (spec mismatch: key should be hacker-news-digest) | ISS-007 |
| rss-digest | NEW_FAIL | no_file_match | ISS-008 |
| polymarket | NEW_FAIL | no_file_match (spec mismatch: key should be monitor-polymarket) | ISS-009 |
| token-alert | NEW_FAIL | no_file_match despite cron-state success | ISS-010 |
| skill-health | NEW_FAIL | no_file_match despite cron-state success | ISS-011 |

## Full Results

| Skill | Status | Diff | Root cause | Quality | Words | Last output |
|-------|--------|------|------------|---------|-------|-------------|
| heartbeat | PASS | NEW_PASS | — | unknown | 13,110 | memory/logs/2026-04-25.md |
| changelog | PASS | NEW_PASS | — | avg=4.0 | 257 | articles/changelog-2026-04-25.md |
| repo-article | PASS | NEW_PASS | — | unknown | 668 | articles/repo-article-2026-04-25.md |
| repo-actions | PASS | NEW_PASS | — | unknown | 1,367 | articles/repo-actions-2026-04-25.md |
| deep-research | PASS | NEW_PASS | — | unknown | 4,299 | articles/deep-research-2026-04-25.md |
| repo-pulse | NO_OUTPUT | NEW_FAIL | no_file_match | unknown | — | — |
| push-recap | NO_OUTPUT | NEW_FAIL | no_file_match | unknown | — | — |
| fork-fleet | NO_OUTPUT | NEW_FAIL | no_file_match | unknown | — | — |
| cost-report | NO_OUTPUT | NEW_FAIL | no_file_match | unknown | — | — |
| hn-digest | NO_OUTPUT | NEW_FAIL | no_file_match | unknown | — | — |
| rss-digest | NO_OUTPUT | NEW_FAIL | no_file_match | unknown | — | — |
| polymarket | NO_OUTPUT | NEW_FAIL | no_file_match | unknown | — | — |
| token-alert | NO_OUTPUT | NEW_FAIL | no_file_match | unknown | — | — |
| skill-health | NO_OUTPUT | NEW_FAIL | no_file_match | unknown | — | — |

## Coverage Gaps (enabled in aeon.yml, missing from evals.json)

Top 10 by operational relevance:
- monitor-polymarket — inferred pattern: `articles/monitor-polymarket-*.md` (also fixes ISS-009 spec mismatch)
- narrative-tracker — inferred pattern: `articles/narrative-tracker-*.md`
- paper-pick — inferred pattern: `articles/paper-pick-*.md`
- security-digest — inferred pattern: `articles/security-digest-*.md`
- code-health — inferred pattern: `articles/code-health-*.md`
- hacker-news-digest — inferred pattern: `articles/hacker-news-digest-*.md` (also fixes ISS-007 spec mismatch)
- evening-recap — inferred pattern: `articles/evening-recap-*.md`
- polymarket-comments — inferred pattern: `articles/polymarket-comments-*.md`
- deep-research — already covered
- vuln-scanner — inferred pattern: `articles/vuln-scan-*.md`

+73 more — see aeon.yml for full list.

## Notes

This is the first skill-evals run (BOOTSTRAP). All results are NEW_*; no prior baseline exists. Two structural issues dominate:

1. **Spec key mismatches** (ISS-007, ISS-009): `hn-digest` and `polymarket` in evals.json do not match the skill names in aeon.yml (`hacker-news-digest`, `monitor-polymarket`). These two patches are the lowest-effort highest-signal fixes — polymarket especially since it's the primary CalibrationGap monitoring signal.

2. **Output location drift** (ISS-010, ISS-011): `token-alert` and `skill-health` both show cron-state success but no articles/ output. Either the skills write to a non-articles path or their filenames diverge from the spec.

fork-fleet and cost-report are weekly Monday skills; today is Sunday. Resolve on Monday 2026-04-28 when the cron fires.

## Sources

- evals.json=ok · cron-state=ok · skill-health=partial (changelog.json only) · eval-audit=fail (sandbox blocked) · prior-article=none (BOOTSTRAP)
