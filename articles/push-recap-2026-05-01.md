# Push Recap — 2026-05-01

## Verdict
> SHIPPING — Smithery / MCP Registry submission manifest lands after six weeks carried.

**Shape:** 2 user-visible commits · 0 internal · 0 infra · 0 bot-filtered
**Volume:** 7 files changed, +905/-3 lines across 2 commits by 1 author
**Merged PRs:** 1 (#149 feat: add smithery-manifest skill + initial Smithery / MCP Registry submission docs)

---

## Top impact today
1. `50eec0e` — feat: add smithery-manifest skill + initial Smithery / MCP Registry submission docs (#149). New skill auto-generates three submission artifacts from `skills.json` + `mcp-server/package.json` so the listing on Smithery and MCP Registry becomes a paste-into-form task — closes the highest-priority growth play unbuilt for six weeks. (6 files, +905/-2)
2. `c95478c` — Remove agent status badge from README. Strips the `agent-status` badge link to `aaronjmars.github.io/aeon/status/` from the README header — the badge gets removed from every fork's landing page going forward. (1 file, +0/-1)

---

## aaronjmars/aeon

### Smithery / MCP Registry submission

**What this is:** Aeon's first listing-side artifact for the MCP ecosystem. Adds a weekly skill that re-generates a `server.json` matching the MCP Registry schema, a Smithery deployment YAML, and a paste-ready submission body — all from `skills.json` so the 95-tool catalog stays in sync without hand-editing manifests. Shipped `enabled: false` so the maintainer reviews the first PR before the cron turns on.

**Shipped to users**
- `50eec0e` — feat: add smithery-manifest skill + initial Smithery / MCP Registry submission docs (#149)
  - `skills/smithery-manifest/SKILL.md`: new skill prompt — reads inputs, generates three files, diffs against existing, opens a PR + notifies only when the byte-equal check fails on stable input (idempotent re-runs stay quiet) (+281/-0)
  - `docs/smithery-manifest.json`: initial generation, full 95-tool `tools[]` mirror under `_meta.io.github.aaronjmars/aeon`, npm `packages[]` block pointing at `aeon-mcp` (+420/-0)
  - `docs/smithery-submission.md`: paste-ready body with field values, short + long descriptions, full tool table, and end-user install instructions for Claude Desktop on macOS / Linux / Windows (+160/-0)
  - `docs/smithery.yaml`: Smithery deployment config — `startCommand: { type: stdio }` plus `commandFunction` evaluating to `node {repoPath}/mcp-server/dist/index.js`; empty `configSchema.required` so listings without a `repoPath` still work (+29/-0)
  - `skills.json`: +1 entry under productivity (weekly cadence), `total: 93 → 95`, `generated: 2026-05-01` (+14/-2)
  - `aeon.yml`: +1 line in the meta block, `0 6 1/7 * *`, `claude-sonnet-4-6` (+1/-0)

### README cleanup

**What this is:** Strips one shields.io badge from the README header. Forks pulling `main` lose the `agent-status` link in their landing page; behavior change is purely cosmetic but it ships to every reader who lands on the repo.

**Shipped to users**
- `c95478c` — Remove agent status badge from README
  - `README.md`: removes the `<a href="https://aaronjmars.github.io/aeon/status/">` line and its shields.io `agent-status` badge from the header `<p align="center">` block (+0/-1)

---

## Developer notes
- **New dependencies:** none.
- **Breaking changes:** none. The new skill ships `enabled: false`, so the weekly cron won't dispatch until the maintainer flips it.
- **New public surface:** new skill `smithery-manifest`, three new files in `docs/` (`smithery-manifest.json`, `smithery-submission.md`, `smithery.yaml`) — these are the artifacts the maintainer pastes into Smithery and the MCP Registry submission form. `skills.json` total moves 93 → 95.
- **Tech debt added:** none visible. No new TODOs/FIXMEs in the diff.

## Open threads
- PR #151 — `feat: add show-hn-draft skill — pre-write the launch post under zero pressure` (aaronjmars, branch `feat/show-hn-draft`, opened 17:50 UTC today, not yet merged).
- PR #150 — `fix(dashboard/secrets): use execFileSync to close shell-injection on secret set/delete` (tomscaria, branch `ai/secrets-route-execfilesync`, opened 17:19 UTC today, not yet merged). This is the carrier for the four-week-unpatched shell-injection at `dashboard/app/api/secrets/route.ts:96`; landing it pre-empts ISS-016 filing on 2026-05-07.
- Manual follow-up on the Smithery PR: either publish `aeon-mcp` to npm or strip the `packages[]` block from `docs/smithery-manifest.json` before submitting to the MCP Registry.

## Sources
- aaronjmars/aeon: ok
- gh api events: ok (push payloads carried no inline commits, used commits API)
- gh api commits: ok
- gh pr list: ok
- bot-filtered: 0
- diff-truncated: 0
