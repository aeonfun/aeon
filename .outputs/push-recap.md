*Push Recap — 2026-04-29*
aaronjmars/aeon — SHIPPING — pr-triage skill goes live as first-touch layer for external PRs.

Shipped to users:
• PR #147 / e26e7a2 — new `pr-triage` skill (skills/pr-triage/SKILL.md, +248): four-check rubric (scope/format/originality/size) emits ACCEPTED / NEEDS-CHANGES / DEFER / OUT-OF-SCOPE; templated welcome comment + triage:* label within minutes of open. Closes only on protected-path violations (.github/workflows/, root aeon binary).
• aeon.yml +1: pr-triage wired in at `30 9 * * *` (mid-morning band, disabled-by-default), supports `var: owner/repo` or `owner/repo#N` for one-shot dispatch.
• skills.json +13: catalog total 92 → 93; new install `./add-skill aaronjmars/aeon pr-triage`.

Shape: 1 user-visible · 0 internal · 0 infra · 0 bot-filtered · 1 merged PR
Volume: 4 files, +263/-2

Operator action: pr-triage ships disabled — flip `enabled: true` (or workflow_dispatch with var) to start triaging external PRs. PR #143 (pezetel) is the trigger case still untouched.

Full recap: https://github.com/tomscaria/aeon/blob/main/articles/push-recap-2026-04-29.md
