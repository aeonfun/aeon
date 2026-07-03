## What

<!-- One or two sentences: what does this PR change? -->

## Why

<!-- What triggered it — an issue (#123), a gap you hit, a community pack you're listing. Link the issue if there is one. -->

## Type of change

<!-- Check one, then fill in the matching checklist below and delete the rest. -->

- [ ] New skill
- [ ] New LLM gateway
- [ ] Community skill pack listing
- [ ] Core fix (dashboard / scripts / workflows / docs)

---

### New skill

- [ ] `skills/<name>/SKILL.md` frontmatter has `name:`, `category:`, `description:`, `tags:` (plus `requires:` / `mcp:` if it needs keys or MCP servers)
- [ ] Body is self-contained and includes a **Sandbox note** with the right fallback (WebFetch / `scripts/prefetch-*.sh` / `gh api`)
- [ ] Notifies through `./notify`, never a channel API directly
- [ ] Ran `bin/generate-skills-json && bin/generate-packs-json` and committed both regenerated manifests

### New LLM gateway

- [ ] Wired through all five files (`types.ts`, `auth-provider.mjs`, `secrets/route.ts`, `scripts/llm-gateway.sh`, `.github/workflows/*.yml`) — see [Adding a gateway](../README.md#adding-a-gateway)
- [ ] Added a row to the gateway table in the README
- [ ] Verified end to end — a run logs `gateway=auto resolved to <slug>`

### Community skill pack listing

- [ ] Pack repo is public with a clear license (MIT / Apache-2.0)
- [ ] Pack has a `skills-pack.json` manifest at its root and a `SKILL.md` per skill
- [ ] Write / onchain / bet skills are `default_enabled: false`
- [ ] This PR adds **both** a README table row and a matching `skill-packs.json` entry
- [ ] No monkey-patching of Aeon internals; no private or auth-walled endpoints required to run

### Core fix (dashboard / scripts / workflows / docs)

- [ ] Change is focused — one concern, no unrelated refactor
- [ ] Touched code follows the existing pattern in the file
- [ ] Relevant CI gates pass locally (e.g. `bash scripts/check-skill-categories.sh`, `bash scripts/check-capabilities-parity.sh`)

---

<!-- PRs are squash-merged: the title above becomes the commit subject on main. Branch from main; one change per PR. -->
