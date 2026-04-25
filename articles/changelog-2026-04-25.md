# Changelog — Week of 2026-04-25

*Window: 2026-04-18 → 2026-04-25 · Sources: aaronjmars/aeon=ok*

## aaronjmars/aeon

> **Highlights:** Every Aeon fork now ships a live `/status/` health dashboard, an `./onboard` validator CLI, and three new skills covering AIXBT pulse, scheduled ads, and campaign creation. A 63-skill autoresearch sweep on Apr 20 rewrote nearly every existing skill in one batch.

### Added
- Public `/status/` health page so every fork has a live skill-fleet dashboard. ([#141](https://github.com/aaronjmars/aeon/pull/141))
- `fork-skill-digest` skill produces a divergence report across configured forks. ([#140](https://github.com/aaronjmars/aeon/pull/140))
- `./onboard` CLI plus an onboarding validator skill for new instances. ([#139](https://github.com/aaronjmars/aeon/pull/139))
- Three new skills: `aixbt-pulse`, `schedule-ads`, and `create-campaign`. ([#138](https://github.com/aaronjmars/aeon/pull/138))
- Worked examples for the A2A gateway and MCP server integrations. ([#137](https://github.com/aaronjmars/aeon/pull/137))
- `fork-contributor-leaderboard` skill ranks community devs across the fork fleet weekly. ([#42](https://github.com/aaronjmars/aeon/pull/42))
- Memory Search API exposed in the dashboard. ([#41](https://github.com/aaronjmars/aeon/pull/41))
- Farcaster syndication added to `syndicate-article`. ([#40](https://github.com/aaronjmars/aeon/pull/40))
- `star-milestone` skill notifies on stargazer count thresholds. ([#39](https://github.com/aaronjmars/aeon/pull/39))

### Changed
- Sweeping autoresearch rewrite of 63 existing skills on Apr 20 — sharper output formats, tighter prompts, and quality fixes across the fleet (PRs [#46](https://github.com/aaronjmars/aeon/pull/46)–[#136](https://github.com/aaronjmars/aeon/pull/136)).

### Fixed
- Long Telegram notifications are now chunked instead of silently truncated. ([#45](https://github.com/aaronjmars/aeon/pull/45))
- Article URLs in skill output are clickable again — the skill now resolves `$GITHUB_REPOSITORY` correctly. ([#44](https://github.com/aaronjmars/aeon/pull/44))
- `fetch-tweets` no longer hangs on the prefetch step or loses workflow variables. ([#43](https://github.com/aaronjmars/aeon/pull/43))
- Notification stream deduplicates messages and suppresses test/trace probes. ([61160ef](https://github.com/aaronjmars/aeon/commit/61160ef81fc8973da818480fbf600daa6537cb0b))
- Scheduler no longer fires duplicate catch-up runs. ([83071f2](https://github.com/aaronjmars/aeon/commit/83071f25bbc57b2b21e1c70c027fc37a3b79d93a))

*Internal: 2 README touch-ups (social link, star-history section). Bots filtered: 0.*
