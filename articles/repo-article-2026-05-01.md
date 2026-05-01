# Aeon Just Built Its Way Off the Fork

Last week's [aeon](https://github.com/aaronjmars/aeon) shipping pattern was forks: leaderboards, payouts, SHOWCASE.md, fleet analytics. This week ended with the inverse. At 13:44 UTC on 2026-05-01, aaronjmars merged [PR #149](https://github.com/aaronjmars/aeon/pull/149) — `smithery-manifest`, 905 lines added — auto-generating the three artifacts needed to list `aeon-mcp` on Smithery and the [MCP Registry](https://registry.modelcontextprotocol.io/). It's the first release this year aimed at operators who will never run `git clone aaronjmars/aeon`.

## The claim

> PR #149 (`smithery-manifest`, +905 lines, merged 2026-05-01) is Aeon's first distribution channel that bypasses the fork model — six weeks after the MCP server shipped, the registry forms now write themselves.

## Evidence

The skill's own [SKILL.md](https://github.com/aaronjmars/aeon/blob/main/skills/smithery-manifest/SKILL.md) names the gap directly: "`mcp-server/` has been live since the integration-examples ship (Apr 21) but Aeon is still not listed on Smithery or the MCP Registry. Every day without those listings, inbound discovery from the growing MCP ecosystem misses Aeon entirely." The blocker, per that file, was Apr-22 repo-actions idea #1, "highest-priority growth unbuilt for 6 weeks." PR #149 closes it: 420 lines of `docs/smithery-manifest.json` (server.json schema-compliant), 29 lines of `docs/smithery.yaml` (stdio start-command), 160 lines of `docs/smithery-submission.md` (paste-ready field values plus the full 95-tool table), and a 281-line skill that re-emits all three when `skills.json` changes.

This pivots the channel mix. Through PRs [#141](https://github.com/aaronjmars/aeon/pull/141) (status page, +102), [#142](https://github.com/aaronjmars/aeon/pull/142) (skill-analytics, +318), [#144](https://github.com/aaronjmars/aeon/pull/144) (contributor-reward, +255), [#145](https://github.com/aaronjmars/aeon/pull/145) (SHOWCASE.md, +74), and [#147](https://github.com/aaronjmars/aeon/pull/147) (pr-triage, +263), every reader was either a current forker or a prospective one — the funnel started at "fork the repo." PR #149 routes around that. The Smithery listing surfaces inside Claude Desktop's MCP picker. The [MCP Registry](https://registry.modelcontextprotocol.io/) listing surfaces inside any client that queries it. Neither path requires forking, configuring `aeon.yml`, or running GitHub Actions; both invoke Aeon skills as MCP tools against the user's local `claude` CLI.

The size is its own signal. PR #149 added 905 lines, more than this week's other seven merged PRs combined ([+1,246 across #141-148](https://github.com/aaronjmars/aeon/pulls?q=is%3Apr+is%3Amerged+merged%3A2026-04-24..2026-04-30); +905 in one). Catalog count moved from 93 to 95 skills (`skills.json` `"total": 93 → 95`). Star count moved 254 → 256 in the past 24 hours, fork count 37 → 38 — consistent with the post-merge timing but not yet evidence on their own.

## Counter-evidence / what would change my mind

The fork model isn't dead — it's the only path with a payout schedule attached. [`contributor-reward`](https://github.com/aaronjmars/aeon/blob/main/skills/contributor-reward/SKILL.md) (PR #144) is still tier-priced for forkers, [SHOWCASE.md](https://github.com/aaronjmars/aeon/blob/main/SHOWCASE.md) still ranks "active forks" by enabled-skill count, and `aeon-mcp` is not yet published to npm — the skill flags this itself, noting `packages[0].identifier` points at a package that doesn't exist on the registry. If Smithery rejects the manifest for that reason, or if the MCP Registry PR sits unmerged, PR #149 reverts to a documentation artifact. The thesis also breaks if the next two weeks of merges return to fork-fleet plumbing — `fork-skill-digest` decay, more leaderboard surfaces, a v2 SHOWCASE — instead of MCP-side polish. Six weeks of stalled submissions argue the maintainer doesn't naturally prioritize this channel.

## Why it matters

For the Aeon ecosystem, PR #149 is a different kind of bet than anything in the last month. Forks compound through configuration; MCP listings compound through search inside clients that already exist. [Smithery indexes ~2,000 servers](https://workos.com/blog/smithery-ai); an Aeon listing puts 95 skills — `aeon-deep-research`, `aeon-monitor-polymarket`, `aeon-pr-triage` — one tool-picker click from any Claude Desktop user. For the operator running [tomscaria/aeon](https://github.com/tomscaria/aeon), it changes the upstream's incentive — a successful Smithery listing means inbound users who never see SHOWCASE.md and never enter the leaderboard. The fork model becomes one funnel among two. The Apr-22 backlog item is closed today; what's not yet known is whether the rest of the listing pipeline (npm publish, registry PR, Smithery review) clears in the next seven days.

---
*Sources*
- [aeon/pull/149 — smithery-manifest](https://github.com/aaronjmars/aeon/pull/149)
- [skills/smithery-manifest/SKILL.md](https://github.com/aaronjmars/aeon/blob/main/skills/smithery-manifest/SKILL.md)
- [docs/smithery-submission.md](https://github.com/aaronjmars/aeon/blob/main/docs/smithery-submission.md)
- [aeon/pull/144 — contributor-reward](https://github.com/aaronjmars/aeon/pull/144)
- [SHOWCASE.md (live)](https://github.com/aaronjmars/aeon/blob/main/SHOWCASE.md)
- [Official MCP Registry](https://registry.modelcontextprotocol.io/)
- [Smithery AI: A central hub for MCP servers — WorkOS](https://workos.com/blog/smithery-ai)
