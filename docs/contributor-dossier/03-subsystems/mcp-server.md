# Subsystem: MCP Server

The MCP server turns every Aeon skill into a tool that Claude Desktop, Claude Code, or any MCP-aware client can invoke.

---

## At a glance

| Property | Value |
|---|---|
| Source | [`mcp-server/src/index.ts`](../../../mcp-server/src/index.ts) (~225 lines) |
| Transport | stdio (`StdioServerTransport` at line 16) |
| Tool naming | `aeon-<skill-slug>` |
| Skill catalog source | `skills.json` (read at startup) |
| Execution model | Shells out to `claude -p -` — **identical to Actions runs** |
| Auth | Inherits operator's `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` from env |
| Build / install | `./add-mcp` |

## How it works

1. **Boot ([`mcp-server/src/index.ts:176-224`](../../../mcp-server/src/index.ts#L176-L224))** — creates a stdio server, loads skills, logs counts to stderr (Claude Desktop captures stderr to its log), registers `ListToolsRequest` and `CallToolRequest` handlers.

2. **Skill loading ([`mcp-server/src/index.ts:47-59`](../../../mcp-server/src/index.ts#L47-L59))** — reads `skills.json` from the repo root. `REPO_ROOT` is resolved from the running module path (`mcp-server/dist/index.js` → walk up). If `skills.json` is missing, logs to stderr and returns empty; the server starts but exposes zero tools.

3. **Tool registration ([`mcp-server/src/index.ts:69-83`](../../../mcp-server/src/index.ts#L69-L83))** — each skill becomes one MCP tool. The tool exposes a single optional `var` parameter (lines 75–82) — `model` is set at the MCP-server level, not per-call.

4. **Description builder ([`mcp-server/src/index.ts:86-93`](../../../mcp-server/src/index.ts#L86-L93))** — dynamic strings like `[Aeon · Research] Daily research brief (cron: 0 14 * * *)` or `[Aeon · Crypto] Token price/volume alert (on-demand)`. Lets clients discover skills by reading tool descriptions.

5. **Tool invocation ([`mcp-server/src/index.ts:121-172`](../../../mcp-server/src/index.ts#L121-L172))** — when a client calls a tool:
   - Construct a prompt with today's date, the `skills/<slug>/SKILL.md` path, and the resolved `var`.
   - Spawn `claude -p - --output-format json` as a child process (line 140), timeout 10 minutes.
   - Read the JSON response, extract `result`, return it as the tool output.
   - Handle ENOENT (missing `claude` CLI) and non-zero exit codes with user-friendly errors (lines 148–158).

The crucial property: **the MCP server runs skills the same way GitHub Actions does.** Same allowlist, same `claude -p -`, same skill file. There is no parallel execution path; you can debug a skill locally via MCP and trust the behavior will match Actions.

## What it does *not* do

- Does **not** expose `./notify` or any side-effect channels — MCP runs do not fan out to Telegram/Discord/Slack. The skill writes its output, the MCP client receives it. If you want notifications, run via Actions.
- Does **not** persist quality scores — the Haiku scorer only runs in the Actions post-step.
- Does **not** check Fleet Watcher — the auth gate is only in `aeon.yml`. MCP bypasses it.
- Does **not** support `var` validation — if a skill expects `var: "owner/repo#N"` and the MCP client passes garbage, the skill prose handles (or fails on) it.

## `./add-mcp`

The shell script ([`add-mcp`](../../../add-mcp), ~250 lines) handles build + registration:

- **`./add-mcp`** — runs `npm install` and `npm run build` in `mcp-server/`, produces `mcp-server/dist/index.js`.
- **`./add-mcp --desktop`** — prints a snippet to paste into `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS), pointing the `aeon` MCP server entry at the built `index.js`.
- **`./add-mcp --uninstall`** — removes the entry from Claude Desktop config.

The same built `dist/index.js` can be referenced by Claude Code's MCP config or any other MCP host. The reference config lives at [`examples/mcp/claude_desktop_config.json`](../../../examples/mcp/claude_desktop_config.json).

## Tested client integration

[`examples/mcp/test_connection.py`](../../../examples/mcp/test_connection.py) is an end-to-end smoke test using the official Python `mcp` SDK:

1. Spawn the server as a subprocess.
2. Initialize an MCP session.
3. List tools (asserts count > 0).
4. Call one tool (asserts the call returns).

This is the right baseline to verify a build before pointing Claude Desktop at it. We extend it in [`../07-TESTING.md`](../07-TESTING.md) with the protocol-shape assertions we ship in the dossier.

## Operational gotchas

- **The MCP server must be able to find `skills.json`.** If you've installed it standalone (no repo on disk), it logs the empty-skill warning and exits gracefully. The current code does not support remote skill catalogs.
- **`claude` CLI must be on PATH** for the MCP host's environment. Claude Desktop launches subprocesses with a minimal env; you may need to point `command:` at an absolute path to `claude` if `which claude` returns nothing in Desktop's spawn env.
- **stderr is your friend.** Claude Desktop swallows MCP server stderr to its log. When debugging, tail that log — the server logs skill counts, ENOENT diagnostics, and call traces.
- **Cancellation is not implemented.** If a skill takes 8 minutes and the user cancels in Claude Desktop, the child `claude -p -` process keeps running to completion. This is a known limitation worth fixing.

## Related docs

- [`a2a-server.md`](a2a-server.md) — same skills exposed over HTTP for non-MCP agents.
- [`runtime.md`](runtime.md) — the GitHub Actions execution path that this mirrors.
- [`skills.md`](skills.md) — the `SKILL.md` contract that MCP invokes.
- [`integrations.md`](integrations.md) — Smithery publication of the MCP server.
