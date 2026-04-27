# Changelog — Week of 2026-04-27

*Window: 2026-04-20 → 2026-04-27 · Sources: aaronjmars/aeon=ok*

## aaronjmars/aeon

> **Highlights:** A new `SHOWCASE.md` puts the most-active forks alongside an Aeon-vs-AutoGen/CrewAI/n8n/LangGraph comparison so framework-shoppers landing from HN or MCP registries get a real answer. Earlier in the week, `contributor-reward` closed the loop from the weekly community leaderboard to a tier-priced payout plan, and `skill-analytics` started ranking every fleet skill run with consecutive-failure flags.

### Added
- `SHOWCASE.md` lists the six most-active forks plus a head-to-head comparison against AutoGen, CrewAI, n8n, and LangGraph. ([#145](https://github.com/aaronjmars/aeon/pull/145))
- `contributor-reward` skill turns the weekly fork-contributor leaderboard into a tier-priced payout plan in `memory/distributions.yml` (no auto-execute). ([#144](https://github.com/aaronjmars/aeon/pull/144))
- `skill-analytics` produces a Wednesday fleet-wide ranking of every skill run in the last 7 days, with silent-scheduled detection and consecutive-failure flags. ([#142](https://github.com/aaronjmars/aeon/pull/142))
- Public `/status/` health page so every Aeon fork ships a live skill-fleet dashboard. ([#141](https://github.com/aaronjmars/aeon/pull/141))
- `fork-skill-digest` produces a divergence report across configured forks. ([#140](https://github.com/aaronjmars/aeon/pull/140))
- `./onboard` CLI plus an onboarding validator skill for new instances. ([#139](https://github.com/aaronjmars/aeon/pull/139))
- Three new skills landed together: `aixbt-pulse`, `schedule-ads`, and `create-campaign`. ([#138](https://github.com/aaronjmars/aeon/pull/138))
- Worked examples for the A2A gateway and MCP server integrations. ([#137](https://github.com/aaronjmars/aeon/pull/137))

### Changed
- Sweeping autoresearch rewrite of ~35 existing skills on Apr 20 — sharper output formats, tighter prompts, and quality fixes across the fleet (PRs [#46](https://github.com/aaronjmars/aeon/pull/46)–[#127](https://github.com/aaronjmars/aeon/pull/127)).

*Internal: 2 README touch-ups hidden (social link, star-history section). Bots filtered: 0.*
