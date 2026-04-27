# Changelog — Week of 2026-04-27

*Window: 2026-04-20 → 2026-04-27 · Sources: aaronjmars/aeon=ok*

## aaronjmars/aeon

> **Highlights:** A new `contributor-reward` skill turns the weekly community-dev leaderboard into a tier-priced payout plan and hands it to the existing `distribute-tokens` pipeline. A fleet-wide `skill-analytics` widget now ranks every skill run in the last seven days, surfacing silent-scheduled skills and consecutive failures.

### Added
- `contributor-reward` skill closes the loop from the Sunday leaderboard to the on-chain transfer pipeline, generating a tier-priced payout plan in `memory/distributions.yml` (no auto-execute). ([#144](https://github.com/aaronjmars/aeon/pull/144))
- `skill-analytics` produces a Wednesday fleet-wide ranking of every skill run in the last 7 days, with silent-scheduled detection and consecutive-failure flags. ([#142](https://github.com/aaronjmars/aeon/pull/142))
- Public `/status/` health page so every Aeon fork ships a live skill-fleet dashboard. ([#141](https://github.com/aaronjmars/aeon/pull/141))
- `fork-skill-digest` produces a divergence report across configured forks. ([#140](https://github.com/aaronjmars/aeon/pull/140))
- `./onboard` CLI plus an onboarding validator skill for new instances. ([#139](https://github.com/aaronjmars/aeon/pull/139))
- Three new skills landed together: `aixbt-pulse`, `schedule-ads`, and `create-campaign`. ([#138](https://github.com/aaronjmars/aeon/pull/138))
- Worked examples for the A2A gateway and MCP server integrations. ([#137](https://github.com/aaronjmars/aeon/pull/137))
- `fork-contributor-leaderboard` ranks community devs across the fork fleet weekly. ([#42](https://github.com/aaronjmars/aeon/pull/42))
- Memory Search API exposed in the dashboard. ([#41](https://github.com/aaronjmars/aeon/pull/41))

### Changed
- Sweeping autoresearch rewrite of ~80 existing skills on Apr 20 — sharper output formats, tighter prompts, and quality fixes across the fleet (PRs [#46](https://github.com/aaronjmars/aeon/pull/46)–[#136](https://github.com/aaronjmars/aeon/pull/136)).

### Fixed
- Long Telegram notifications are now chunked instead of silently truncated. ([#45](https://github.com/aaronjmars/aeon/pull/45))
- Article URLs in skill output are clickable again — skills now resolve `$GITHUB_REPOSITORY` correctly. ([#44](https://github.com/aaronjmars/aeon/pull/44))
- `fetch-tweets` no longer hangs on the prefetch step or loses workflow variables. ([#43](https://github.com/aaronjmars/aeon/pull/43))

*Internal: 2 README touch-ups hidden (social link, star-history section). Bots filtered: 0.*
