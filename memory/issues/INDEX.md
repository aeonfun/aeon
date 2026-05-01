# Issues

## Open

| ID | Title | Severity | Category | Detected | Affected Skills |
|----|-------|----------|----------|----------|-----------------|
| [ISS-001](ISS-001.md) | vuln-scanner cannot run — all scanners blocked by sandbox, no prefetch script | high | sandbox-limitation | 2026-04-25 | vuln-scanner |
| [ISS-002](ISS-002.md) | vibecoding-digest cannot run — Reddit blocks GHA IPs, WebFetch also refused | high | sandbox-limitation | 2026-04-25 | vibecoding-digest |
| [ISS-003](ISS-003.md) | repo-pulse: no_file_match — articles/repo-pulse-*.md absent | high | missing-secret-or-cron | 2026-04-26 | repo-pulse |
| [ISS-004](ISS-004.md) | push-recap: no_file_match — articles/push-recap-*.md absent | high | missing-secret-or-cron | 2026-04-26 | push-recap |
| [ISS-005](ISS-005.md) | fork-fleet: no_file_match — articles/fork-fleet-*.md absent | high | missing-secret-or-cron | 2026-04-26 | fork-fleet |
| [ISS-006](ISS-006.md) | cost-report: no_file_match — articles/cost-report-*.md absent | high | missing-secret-or-cron | 2026-04-26 | cost-report |
| [ISS-007](ISS-007.md) | hn-digest: no_file_match — evals.json key likely mismatches hacker-news-digest | high | output-format | 2026-04-26 | hn-digest |
| [ISS-008](ISS-008.md) | rss-digest: no_file_match — articles/rss-digest-*.md absent | high | missing-secret-or-cron | 2026-04-26 | rss-digest |
| [ISS-009](ISS-009.md) | polymarket: no_file_match — evals.json key likely mismatches monitor-polymarket | high | output-format | 2026-04-26 | polymarket |
| [ISS-010](ISS-010.md) | token-alert: no_file_match — absent despite cron-state success | high | output-format | 2026-04-26 | token-alert |
| [ISS-011](ISS-011.md) | skill-health: no_file_match — absent despite cron-state success | high | output-format | 2026-04-26 | skill-health |
| [ISS-012](ISS-012.md) | reddit-digest cannot run on JSON API — Reddit blocks GHA IPs (same root as ISS-002) | high | sandbox-limitation | 2026-04-26 | reddit-digest |
| [ISS-013](ISS-013.md) | Mass skill failure 2026-04-26 23:53-58Z — 50+ skills exit with 0 tokens consumed | critical | unknown | 2026-04-27 | 53 skills (see file) |
| [ISS-014](ISS-014.md) | reply-maker cannot source fresh tweets — XAI prefetch case missing, WebFetch x.com paywall | high | sandbox-limitation | 2026-04-27 | reply-maker |
| [ISS-017](ISS-017.md) | GHA cron-tick gap — 07:00/07:30/08:00 UTC silently skipped two days running | high | unknown | 2026-05-01 | chain:morning-brief, daily-routine, rss-digest, hacker-news-digest, paper-digest, reddit-digest, telegram-digest, heartbeat |

## Resolved

| ID | Title | Severity | Fix PR | Resolved |
|----|-------|----------|--------|----------|
