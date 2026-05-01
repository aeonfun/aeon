# Repo Actions — aaronjmars/aeon — 2026-05-01

**Top pick for tomorrow:** #1 — Patch shell-injection at `dashboard/app/api/secrets/route.ts:96` by switching `execSync` to `execFileSync` (Security, Small)
**Verdict:** PR #149 (`smithery-manifest`, merged today) just made `aeon-mcp` referenceable as an npm package and a Smithery / MCP Registry listing — but the package itself is missing a README, has no first-publish hygiene (no `prepublishOnly`, no metadata, no `.npmignore` / `files` field), and ships zero tests. Four of today's five anchor there. Ahead of all of it sits a 3-week-old shell-injection in the dashboard secrets API that operator memory has flagged as the next ISS-016 candidate if unpatched 2026-05-07 — that's the top pick.

## Actions

### 1. Patch `dashboard/app/api/secrets/route.ts:96` shell-injection by switching `execSync(string)` to `execFileSync(cmd, args[])`
**Priority:** HIGH (leverage 5)
**Type:** Security
**Effort:** Small (hours)
**Anchor:** FILE:dashboard/app/api/secrets/route.ts:L96 — the POST handler interpolates user-controlled `value` directly into a shell string: `execSync(\`gh secret set ${name} -b "${value.replace(/"/g, '\\\\"')}"\`)`. The only escape is a quote-replace, so a `value` containing `$(...)`, backticks, `;`, `&&`, `|`, or `\` still injects. The DELETE handler at the same file has the same shape with `${name}`. Operator memory flags this file:line as a 3-week-old open issue and a planned ISS-016 filing on 2026-05-07.
**Score:** L=5 C=5 N=5 (total 15/15)
**Impact:** Eliminates a remote-code-execution path on every Aeon dashboard that has the route enabled (every fork that ran `./aeon` locally and uses the secrets UI). Closes the open security item that `skill-security-scan` will otherwise file as ISS-016 next week.
**How:**
1. Change `execSync(\`gh secret set ${name} -b "${escaped}"\`, …)` to `execFileSync('gh', ['secret', 'set', name, '-b', value], { stdio: 'pipe', cwd: process.cwd() })`. `execFileSync` does not invoke a shell, so `name` and `value` are passed as argv and cannot inject.
2. Apply the same swap to the DELETE handler: `execFileSync('gh', ['secret', 'delete', name], …)`.
3. The existing `VALID_SECRET_NAME` regex (`^[A-Z][A-Z0-9_]+$`) on `name` stays — it's defense in depth, not the only barrier.
4. Drop the now-unnecessary `value.replace(/"/g, '\\\\"')` escape — unescaped `value` is fine through argv.
5. Add a one-line test fixture: `value = "$(touch /tmp/PWN)"`; assert `/tmp/PWN` does not exist after the call (run locally; no test framework is wired in dashboard yet, so this can be a manual repro in the PR description rather than CI-asserted).
**Definition of done:** PR diff shows both handlers using `execFileSync` with array args, the regex check on `name` is preserved, and the PR description includes the `$(touch /tmp/PWN)` repro showing it no longer fires. `skill-security-scan` flagging this line stops on the next scheduled run.

### 2. Add `mcp-server/README.md` — npm + Smithery listing landing page for `aeon-mcp`
**Priority:** HIGH (leverage 4)
**Type:** Content
**Effort:** Small (hours)
**Anchor:** MISSING:mcp-server/README.md — `mcp-server/` ships `package.json` (name: `aeon-mcp`, bin: `aeon-mcp`), `src/index.ts`, `tsconfig.json`, `.gitignore` — but no per-package README. PR #149 (`smithery-manifest`, merged today) added `docs/smithery-manifest.json` whose `packages[]` block points at npm `aeon-mcp` — so the package is now externally referenced. npm and Smithery both render the package's own `README.md` as the listing front page; without one, the listing ships blank.
**Score:** L=4 C=5 N=5 (total 14/15)
**Impact:** Anyone landing on the Smithery page for `aeon` or running `npm view aeon-mcp` sees install steps, the 95-tool list, and how the server actually runs — instead of a blank section. First-impression-of-the-listing gate.
**How:**
1. Create `mcp-server/README.md` with sections: Overview, Install (`npm install -g aeon-mcp` once published, plus the from-source path that PR #149's `commandFunction` already generates: `node {repoPath}/mcp-server/dist/index.js`), Claude Desktop config snippet matching `examples/mcp/claude_desktop_config.json`, Tool reference (link to `docs/smithery-submission.md` 95-tool table rather than duplicating).
2. Include a one-paragraph note that `aeon-mcp` *executes* skills by spawning `claude -p -` against the cloned Aeon repo — this is a fork-aware MCP server, not a static tool list. Cite `mcp-server/src/index.ts` lines that show the spawn.
3. Add a "Sandbox / requirements" section: requires `claude` CLI on `$PATH`, requires the cloned `aeon` repo at `${REPO_ROOT}` (two levels up from `dist/index.js`), requires `skills.json` to exist.
4. Cross-link from root `README.md` MCP section and from `docs/smithery-submission.md` install instructions.
**Definition of done:** `mcp-server/README.md` exists, `npm pack` (or visual inspection of the npm registry preview after publish) shows the README rendered as the package landing, and `examples/mcp/test_connection.py` references it for setup pointers.

### 3. Bundle npm-publish hygiene into `mcp-server/`: `prepublishOnly: tsc`, package metadata, `LICENSE` copy, `files` field, `mcp-server/.npmignore`
**Priority:** MED (leverage 3)
**Type:** DX
**Effort:** Small (hours)
**Anchor:** FILE:mcp-server/package.json (full file) — currently has no `prepublishOnly` lifecycle hook, no `repository` / `bugs` / `homepage` / `keywords` fields, no `license` field (root LICENSE exists but isn't auto-included in the npm tarball), and no `files` field — meaning `npm publish` would ship the entire directory tree (`src/`, `tsconfig.json`, plus whatever sat in `dist/`) and would publish stale `dist/` if the user hadn't manually run `tsc` first. Compounding issue: `mcp-server/.npmignore` does not exist (only `mcp-server/.gitignore` ships in the tree).
**Score:** L=4 C=5 N=4 (total 13/15)
**Impact:** First `npm publish` of `aeon-mcp` ships a clean tarball (only `dist/`, `README.md`, `LICENSE`), with correct npm metadata (repository link, bug tracker URL, MIT license badge), and cannot ship a stale build. Removes the "manually `tsc` before publish" footgun. Pairs with idea #2 (the README is what npm renders); this is the metadata around it.
**How:**
1. Patch `mcp-server/package.json`:
   - Add `"scripts": { ..., "prepublishOnly": "tsc" }` so `npm publish` always builds first.
   - Add `"license": "MIT"`.
   - Add `"repository": { "type": "git", "url": "https://github.com/aaronjmars/aeon.git", "directory": "mcp-server" }`.
   - Add `"bugs": { "url": "https://github.com/aaronjmars/aeon/issues" }`.
   - Add `"homepage": "https://github.com/aaronjmars/aeon/tree/main/mcp-server#readme"`.
   - Add `"keywords": ["mcp", "model-context-protocol", "claude", "claude-desktop", "aeon", "autonomous-agent", "ai-agent", "github-actions"]`.
   - Refine `"description"` from "MCP server that exposes all Aeon skills as Claude tools" → "Aeon MCP server — exposes 95 autonomous-agent skills as Claude Desktop / Claude Code tools".
   - Add `"files": ["dist", "README.md", "LICENSE"]`.
2. Copy `LICENSE` from repo root to `mcp-server/LICENSE` (MIT, identical) so the npm tarball ships its own LICENSE — npm does not auto-resolve a sibling-directory LICENSE.
3. Create `mcp-server/.npmignore` (belt-and-braces with `files` field): `src/`, `tsconfig.json`, `*.tsbuildinfo`, `node_modules/`.
4. Add `mcp-server/dist/` to root `.gitignore` so a contributor running `npm run build` doesn't commit the build output.
**Definition of done:** `cd mcp-server && npm pack --dry-run` lists exactly `package/dist/index.js`, `package/README.md`, `package/LICENSE`, `package/package.json` (no `src/`, no `tsconfig.json`, no `.tsbuildinfo`); the rendered npm metadata page (preview via `npm view aeon-mcp` post-publish, or `npm publish --dry-run` JSON locally) shows repository / homepage / bugs links and the keyword set.

### 4. Add `mcp-server/test/smoke.test.ts` + `.github/workflows/mcp-smoke.yml` — list-tools smoke test on every PR touching `mcp-server/**`
**Priority:** MED (leverage 3)
**Type:** DX
**Effort:** Medium (1–2 days)
**Anchor:** FILE:mcp-server/src/index.ts (full file, no test sibling) + MISSING:.github/workflows/mcp-smoke.yml. Server has zero test coverage — `package.json` only declares `build`/`dev`/`start` scripts, no `test` — and the only existing CI files are `aeon.yml`, `chain-runner.yml`, `messages.yml`. With the Smithery + MCP Registry listing now externally referenceable (PR #149 today), a regression in `loadSkills()` or the `tools/list` handler would silently break the published package.
**Score:** L=3 C=4 N=5 (total 12/15)
**Impact:** Catches the "tools/list returns empty" or "skill manifest parse threw" classes of bug *before* a published `aeon-mcp` ships them to Smithery users. Concrete acceptance: PR adding `mcp-server/src/index.ts:LXX` regression in `loadSkills()` fails CI.
**How:**
1. Add `vitest` to `mcp-server/package.json` devDeps (chosen because Aeon's existing JS subprojects do not pin a runner — vitest is the lightest-weight TS-native option compatible with the existing `tsc` toolchain). Add `"test": "vitest run"` and `"test:watch": "vitest"` to scripts.
2. Create `mcp-server/test/smoke.test.ts`:
   - Spawn `node dist/index.js` via `child_process.spawn`.
   - Send a JSON-RPC `tools/list` request over stdio (the MCP `StdioServerTransport` shape).
   - Read the response, parse, assert `result.tools.length >= 90` (current `skills.json` has 95 entries; tolerate small fluctuations).
   - Assert each tool name matches `/^aeon-[a-z][a-z0-9-]+$/` (the slug pattern from `skillToToolName`).
   - Kill the child on test teardown.
3. Create `.github/workflows/mcp-smoke.yml` triggered on `pull_request` with paths `mcp-server/**` or `skills.json`. Steps: checkout → `cd mcp-server && npm ci && npm run build && npm test`.
4. Document the smoke test in `mcp-server/README.md` (idea #2) "Contributing" / "Local checks" section.
**Definition of done:** A PR that introduces a typo in `loadSkills()` or that returns an empty `tools[]` from `ListToolsRequestSchema` fails the new workflow with a clear "expected ≥90 tools, got N" message; a clean PR passes.

### 5. Add `.github/CODEOWNERS` to auto-assign PR reviewers per top-level area
**Priority:** MED (leverage 3)
**Type:** DX
**Effort:** Small (hours)
**Anchor:** MISSING:.github/CODEOWNERS — repo has 38 forks and the `pr-triage` skill (PR #147, merged 04-29) for first-touch external-PR triage, but no CODEOWNERS file means GitHub can't auto-suggest reviewers and `pr-triage` has no canonical owner-map to consult when routing. Recent merged PRs span six distinct areas (`skills/**`, `dashboard/**`, `mcp-server/**`, `docs/**`, `.github/workflows/**`, `scripts/**`) with no codified ownership.
**Score:** L=3 C=5 N=4 (total 12/15)
**Impact:** PR review requests auto-fan-out by path, `pr-triage` has a deterministic owner-map to consult instead of guessing from `git blame`, and external contributors see who actually owns the area before opening a PR.
**How:**
1. Create `.github/CODEOWNERS` with path-based rules:
   - `*` → `@aaronjmars` (default)
   - `/skills/` → `@aaronjmars`
   - `/dashboard/` → `@aaronjmars`
   - `/mcp-server/` → `@aaronjmars`
   - `/docs/` → `@aaronjmars`
   - `/.github/workflows/` → `@aaronjmars`
   - `/scripts/` → `@aaronjmars`
2. (Optional, follow-up) When fork-side maintainers exist who own specific skills they authored, append per-skill rules. Out of scope for this initial drop — single-owner everywhere is fine and lints clean.
3. GitHub validates CODEOWNERS automatically; verify the "Code owners" tab on the repo Settings → Branch protection page shows rules parsed without errors.
4. Update `skills/pr-triage/SKILL.md` to read CODEOWNERS as the source-of-truth owner-map (cross-link, no logic change required if the skill already routes by path).
**Definition of done:** `.github/CODEOWNERS` exists, the repo Settings → Code owners view shows zero parse errors, opening a test PR touching `mcp-server/**` auto-requests review from `@aaronjmars`, and `pr-triage` references CODEOWNERS in its source-status footer on the next run.

## Monitor

### A. Add `.github/workflows/mcp-server-publish.yml` — tag-triggered `npm publish` of `aeon-mcp`
**Why not yet:** Requires an `NPM_TOKEN` repo secret (operator decision: which npm account / org owns `aeon-mcp`?), and confirmation that the `aeon-mcp` name is not already squatted on npm. Gates external account/secret setup that `external-feature` cannot take autonomously.
**Anchor:** MISSING:.github/workflows/mcp-server-publish.yml + ref to `aeon-mcp` in `docs/smithery-manifest.json` packages[].

### B. Submit `aeon-mcp` to Smithery + MCP Registry (the actual listing, not the doc)
**Why not yet:** `docs/smithery-submission.md` is the paste-ready submission body (PR #149 today), but the actual submission is a one-off operator action requiring a Smithery account and the MCP Registry maintainer reviewer flow. No autonomous path.
**Anchor:** FILE:docs/smithery-submission.md (paste-ready) + state: not yet submitted (no public listing for `io.github.aaronjmars/aeon-mcp` as of today).

### C. Pick a test runner for `dashboard/**` so the secrets-API regression test from idea #1 can be CI-asserted
**Why not yet:** No existing test framework in `dashboard/`. Choosing between `vitest` / `jest` / Next.js' built-in `next/jest` is an architectural call the maintainer should make, not external-feature. (Once chosen, the secrets-route shell-injection repro from idea #1 belongs in that suite.)
**Anchor:** FILE:dashboard/package.json — no `test` script, no `vitest`/`jest`/`@playwright/test` in devDeps.

---

**Source status:** gh=ok code_search=ok memory_topics=missing articles_dir=ok watched_repos=1 parsed
**Mode:** REPO_ACTIONS_OK
**Carried over from prior runs:** 04-30 top pick (`scripts/prefetch-reddit.sh`) — still missing in upstream `aaronjmars/aeon` `scripts/` tree (only `eval-audit, generate-feed.sh, postprocess-{admanage-create,admanage,devto,farcaster,replicate}.sh, prefetch-xai.sh, skill-runs, sync-site-data.sh, sync-upstream.sh` ship), still applicable. Operator-side `reddit-digest` continues failing daily (7th consecutive 05-01 run).
