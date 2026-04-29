*Push Recap — 2026-04-29*
aaronjmars/aeon — SHIPPING — pr-triage skill goes live as first-touch layer for external PRs.

Shipped to users:
• `e26e7a2` PR #147 — new `skills/pr-triage/SKILL.md` (+248): four-check rubric (scope/format/originality/size), four-rung verdict ladder (ACCEPTED/NEEDS-CHANGES/DEFER/OUT-OF-SCOPE), `triage:*` label namespace, idempotent state in `memory/triaged-prs.json` keyed on (PR, headRefOid).
• `aeon.yml` — wired at `30 9 * * *` mid-morning, disabled-by-default, `var:` accepts owner/repo or owner/repo#N.
• `skills.json` — catalog total bumps 92 → 93; install via `./add-skill aaronjmars/aeon pr-triage`.

Trigger: external PR #143 (pezetel) sat 4 days untouched while fork count climbs toward 40.

Shape: 1 user-visible · 0 internal · 0 infra · 0 bot-filtered · 1 merged PR
Volume: 4 files, +263/-2 lines

Full recap: https://github.com/tomscaria/aeon/blob/main/articles/push-recap-2026-04-29.md
