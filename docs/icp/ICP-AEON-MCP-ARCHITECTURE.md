# ICP-AEON-MCP-ARCHITECTURE.md

**Scope:** Aeon's MCP implementation, traced from source — both the server surface (`apps/mcp-server`) and the client surface (`.mcp.json` → run-harness → claude) — and what it means for reaching an external MCP server like ICP's.
**All paths relative to `/Users/mac/aeon`. Date:** 2026-11-03.

---

## 0. Two surfaces, do not conflate them

| | **Aeon-as-SERVER** | **Aeon-as-CLIENT** |
|---|---|---|
| Code | `apps/mcp-server/` (+ hosted `aeon.fun/connect/mcp`) | `.mcp.json` + `.github/workflows/aeon.yml` + `harness-adapter/` |
| Role | Exposes **Aeon's own skills** as MCP tools to a client | Lets a skill **consume an external MCP server** |
| Could it reach ICP's MCP? | **No** — it is a server, it does not dial out | **This is the only candidate path** — and it still can't (see §3) |

---

## 1. Aeon-as-SERVER — `apps/mcp-server` (NOT a client) — `Confirmed`

**Files:** `apps/mcp-server/src/index.ts`, `src/skill-executor.ts`, `README.md`, `package.json`.

- `src/index.ts:103` — `new Server({name:"aeon-mcp"},{capabilities:{tools:{}}})` over **stdio** (`StdioServerTransport`, `index.ts:156`) using `@modelcontextprotocol/sdk`.
- `index.ts:44-59` `buildTools()` — every skill in `catalog/skills.json` becomes a tool **`aeon-<slug>`** with a single optional `var` arg.
- `index.ts:112-153` `CallToolRequestSchema` handler — on call, spawns `harness-adapter/run-harness` via `skill-executor.runSkill()` (`README.md:120`: `--mode <tier> --allowed-tools <list> --timeout 1800`), i.e. **it runs a skill locally**, identical to a scheduled run.
- `README.md:3-16` — two deployments: **local stdio** (`bin/add-mcp`) and **hosted** (`https://www.aeon.fun/connect/mcp`, "Streamable HTTP, OAuth 2.1 with GitHub sign-in", ~20 management tools).

**Conclusion:** `apps/mcp-server` is a **server** that publishes Aeon skills outward. It contains **no outbound MCP client code** and is **not reusable** to call the ICP endpoint. `Confidence: Confirmed` (full source read).

**Reusable from here:** the stdio `Server` wiring and the skill→tool mapping — useful only if we ever want to expose a *new ICP skill* as a tool, which is downstream of building the skill, not a prerequisite.

---

## 2. Aeon-as-CLIENT — the real external-MCP path, traced end to end — `Confirmed`

### Trace of one external MCP tool (robinhood-mcp), config → execution

**(a) Skill declares the server** — `skills/robinhood-mcp/SKILL.md` frontmatter:
```yaml
metadata:
  mode: read-only
  mcp:
    - robinhood-trading       # names the server in .mcp.json
```
Tools surface as `mcp__robinhood-trading__*`; the skill **discovers them from the server** ("tool descriptions are the source of truth, don't assume a fixed list"). Same shape in `skills/base-mcp/SKILL.md` (`mcp: [base]`, `mcp__base__*`).

**(b) Config file** — a single project-root **`.mcp.json`** `{ "mcpServers": { <name>: {type,url|command,headers|env,…} } }`. (The only committed one in-repo is `plugin/.mcp.json`; live ones are pushed by the dashboard.)

**(c) Dispatch/resolve** — `.github/workflows/aeon.yml`:
- `:755-763` builds `ALL_SECRETS = toJSON(secrets)` — the blob that `${VAR}`s and `requires:` resolve from.
- `:1015` MCP loads **only if** not shadow-mode **and** `.mcp.json` exists **and** `jq -e '.mcpServers'` succeeds.
- `:1020` **sources `scripts/mcp-oauth-refresh.sh`** (mint fresh access tokens from stored refresh tokens — see §3).
- `:1029-1035` for each `${VAR}` in `.mcp.json`, if any referenced secret is **unset → emit `::warning::` and SKIP all MCP this run** (fail-open-to-skip; a missing key never hard-fails the run).
- `:1038-1042` if all present: for each server append **`mcp__${srv}`** to the tool allowlist and set `MCP_FLAGS=(--mcp-config .mcp.json --strict-mcp-config)`.
- `:1131` passes `--mcp-config .mcp.json` into `RH_ARGS` only when the preflight enabled MCP.

**(d) Variable expansion** — `harness-adapter/lib/mcp-translate.sh:mcp_expand_vars()` (`:12-22`): `perl` substitutes `${VAR}` from the environment into a temp `mcp.json`; **unset vars are left literal** (names returned so the caller can warn). Per-harness translation also here (codex `-c` flags, vibe/pi TOML/JSON) — Claude needs none.

**(e) Launch** — `harness-adapter/run-harness:78-84` runs `mcp_expand_vars` into `$RH_TMPDIR/mcp.json`; `harness-adapter/adapters/claude.sh:71-73` appends **`--mcp-config <expanded> --strict-mcp-config`** to the `claude` CLI, which connects natively, discovers tools, and exposes them as `mcp__<server>__<tool>`.

**(f) Execute & handle errors** — the skill calls `mcp__<server>__*`. Denials are surfaced by `claude.sh:130-143` (`permission_denials` → `::warning::`). Skills self-limit retries (robinhood/base: "don't retry the same call more than twice"); on `401/invalid-token` they log `*_AUTH_STALE` and tell the operator to reconnect.

### Auth / token model — `Confirmed`

`scripts/mcp-oauth-refresh.sh` is the whole headless-OAuth story:
- `:111` finds secrets named `MCP_*_OAUTH` (each holds an OAuthSecret JSON **string**: `{token_endpoint, client_id, client_secret?, refresh_token}`).
- `:34-37` **if `token_endpoint` or `refresh_token` is empty → skip** (cannot refresh).
- `:43-52` POSTs **`grant_type=refresh_token`** (confidential client → HTTP Basic; public/PKCE client → `client_id` in body).
- `:72-74` exports a fresh `MCP_<SLUG>_TOKEN` (masked) so `.mcp.json`'s `Authorization: Bearer ${MCP_<SLUG>_TOKEN}` resolves live.
- `:83-97` if the provider rotates the refresh token, persists the new one with `GH_SECRETS_PAT`/`GH_GLOBAL` (loud `::warning::` if it can't).

**Secret injection generally:** declared `requires:` keys are injected into the run env; `${VAR}` in `.mcp.json` resolves from `ALL_SECRETS`. Irreversible/auth'd calls use `./secretcurl` (keeps `$SECRET` off the command line). (See `CLAUDE.md` → Network & Secrets.)

**Timeouts/retries:** `run-harness --timeout` (600 default; **1800** for a skill run). No framework-level per-MCP-tool retry; MCP preflight is fail-open-to-skip.

**Tests:** the adapter/translation layer is covered under `scripts/tests/` (e.g. `test_credential_manifest.sh`, pinned to `adapters/claude.sh`'s manifest at `claude.sh:30-31`). *(I verified the reference this session, not the entire suite — `Confidence: High`.)*

---

## 3. Can the client path reach ICP's MCP? — **No** — `Confirmed`

| Requirement of `mcp.internetcomputer.org/mcp` | What Aeon's client path provides | Match |
|---|---|---|
| Grant: `authorization_code` + PKCE (S256) only | `mcp-oauth-refresh.sh` does **`refresh_token`** only | ✗ |
| Refresh: **none issued** | Depends on a stored `refresh_token` | ✗ |
| Token acquisition: interactive **Internet Identity** browser login | Headless GitHub Actions, no browser, no human | ✗ |
| Client auth: public (no secret) | Supports static header/env or OAuth-refresh | n/a |

The mismatch is **structural at both ends**: ICP issues no refresh token and offers no machine grant; Aeon's headless OAuth is built on exactly the refresh-token grant ICP lacks. Even Dynamic Client Registration (which ICP supports) only registers a client — it still demands the interactive `authorize` round-trip.

**Reusable code for an ICP integration (what actually helps):**
- The **`.mcp.json` → allowlist → `--strict-mcp-config`** client wiring and `mcp_expand_vars` — reusable *only* for an MCP server that accepts static headers or a `refresh_token` grant (ICP is neither).
- **`./secretcurl`** and the `requires:`/`ALL_SECRETS` injection — directly reusable for a **direct-to-IC** path (store a PEM/seed as a secret; call the IC HTTP gateway / use `icp-cli` in-run).

**Recommendation:** For any runtime IC access, go **direct-to-IC** (agent-js or `icp-cli` + PEM identity secret), not via the MCP connector. For the security-audit project, **no runtime IC access is required** — the audit operates on source.

---

## Confidence summary
| Claim | Confidence |
|---|---|
| `apps/mcp-server` is server-only, not a client | Confirmed (full read of `index.ts`/README) |
| Client path trace (config→exec) | Confirmed (aeon.yml, mcp-translate.sh, claude.sh, 2 skills) |
| Headless OAuth = refresh-token grant only | Confirmed (`mcp-oauth-refresh.sh`) |
| Client path cannot reach ICP MCP | Confirmed (metadata ∩ source) |
| Full test-suite coverage | High (one test verified, not all) |
