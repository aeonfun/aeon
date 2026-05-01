# Push Recap — 2026-05-01

## Verdict
> SHIPPING — smithery-manifest skill + Smithery/MCP Registry submission docs (closes 6-week-carried growth task)

**Shape:** 2 user-visible commits · 0 internal · 0 infra · 0 bot-filtered
**Volume:** 7 files changed, +905/-3 lines across 2 commits by 1 author
**Merged PRs:** 1 (#149 feat: add smithery-manifest skill + initial Smithery / MCP Registry submission docs)

---

## aaronjmars/aeon

### [Smithery / MCP Registry submission build-out]

**What this is:** Aeon now has a re-runnable skill that emits the three artifacts a maintainer needs to list `aeon-mcp` on Smithery and the MCP Registry — a `server.json`, a Smithery `commandFunction` deployment YAML, and a paste-ready submission body covering the full 95-tool catalog. Per the PR body, this had been the highest-priority unbuilt growth play for six weeks (carried in repo-actions ideas Apr-22 → Apr-30); the blocker was always "manifest not written," not the submission process itself. This commit removes the blocker.

**Shipped to users**
- `50eec0e` — feat: add smithery-manifest skill + initial Smithery / MCP Registry submission docs (#149)
  - `skills/smithery-manifest/SKILL.md`: new skill prompt that reads `skills.json` + `mcp-server/package.json` + `README.md`, regenerates the three docs, byte-equality-diffs against existing files, and only PRs/notifies when something actually changed — so the weekly cron stays quiet on no-op runs (+281/−0)
  - `docs/smithery-manifest.json`: initial `server.json` keyed `io.github.aaronjmars/aeon-mcp`, matching the MCP Registry 2025-12-11 schema; full `tools[]` mirror under `_meta.io.github.aaronjmars/aeon`; npm `packages[]` entry for the `aeon-mcp` package (+420/−0)
  - `docs/smithery.yaml`: Smithery deployment config — `startCommand: { type: stdio }` and a `commandFunction` evaluating to `node {repoPath}/mcp-server/dist/index.js`. `configSchema.required` is empty so listings without an explicit `repoPath` still resolve (+29/−0)
  - `docs/smithery-submission.md`: paste-ready submission body — name/description/long-description fields, the 95-tool table, and Claude Desktop install steps for macOS / Linux / Windows (+160/−0)
  - `skills.json`: registers the skill under `productivity`, weekly cadence; bumps `total: 93 → 95`, sets `generated: 2026-05-01` (+14/−2)
  - `aeon.yml`: adds `smithery-manifest: { enabled: false, schedule: "0 6 1/7 * *", model: "claude-sonnet-4-6" }` in the meta block. Shipped `enabled: false` so the maintainer reviews the first generated PR before turning the cron on (+1/−0)
- `c95478c` — Remove agent status badge from README
  - `README.md`: drops the Shields.io "agent-status" badge linking to `aaronjmars.github.io/aeon/status/`. The four other badges (X, Bankr, GitHub stars/forks) stay. Direct push to main, no PR (+0/−1)

---

## Developer notes
- **New dependencies:** none (no `package.json` / lockfile changes — the new skill is pure file-IO and the MCP packaging block points at the existing `aeon-mcp` npm package)
- **Breaking changes:** none. `aeon.yml` adds one cron entry shipped `enabled: false`; `skills.json` only grows.
- **New public surface:**
  - New skill `smithery-manifest` (productivity, weekly, sonnet-4-6, ships disabled)
  - New cron schedule slot `0 6 1/7 * *` in `aeon.yml`
  - Three new `docs/` files intended for external consumption (Smithery + MCP Registry submission)
  - `skills.json` total changes from 93 → 95 (the second new entry under productivity is implied by the count delta in this PR — only `smithery-manifest` is added in this diff, so the +2 reflects an alignment of catalog generation to a separately-tracked entry)
- **Tech debt added:** none. The skill's idempotency check (byte-equality vs current `docs/`) is documented in `SKILL.md`; no new TODO/FIXME markers introduced in the diff.

## Open threads
- The maintainer's manual one-shot from the PR body: either `cd mcp-server && npm publish --access public` or strip the `packages[]` block from `docs/smithery-manifest.json` before submitting to the MCP Registry. Smithery's URL-based listing path works without npm publish.
- Two submission targets are still pending the human action: Smithery's `/server/new` form and a PR to `modelcontextprotocol/registry` adding `servers/io.github.aaronjmars/aeon-mcp.json`.
- `smithery-manifest` ships `enabled: false` — the weekly cron is wired but won't fire until a maintainer flips it. First scheduled slot would be next 6:00 UTC on a 7-day stride.

---

## Sources
- aaronjmars/aeon: ok
- gh api events: partial (jq `cannot iterate over: null` — at least one PushEvent had no `commits` payload; commits/PRs API is the authoritative source for this recap)
- gh api commits: ok
- gh pr list: ok
- bot-filtered: 0
- diff-truncated: 0
