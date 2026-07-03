# Aeon MCP Server

Expose every Aeon skill as a [Model Context Protocol](https://modelcontextprotocol.io) tool, so you can run any skill straight from **Claude Desktop** or **Claude Code** — no GitHub Actions, no cron, no separate UI. Each skill shows up as an `aeon-<slug>` tool; ask Claude to use it and it runs the exact same `SKILL.md` prompt the scheduled runner uses.

## What it is

The server reads `skills.json` at the repo root and advertises each skill as an MCP tool over stdio. When Claude calls a tool, it spawns `claude -p -` against the matching `skills/<slug>/SKILL.md`, waits for the run to finish (same ~10-minute budget as Actions), and hands the skill's output back as the tool result. It's the bridge that turns "Aeon runs on a schedule in CI" into "Aeon is a set of tools inside my Claude session."

It's the local, push-button way to run any skill from a Claude client. It spawns the same skill prompt the GitHub Actions runner uses, so behaviour is identical across entry points (cron and Claude).

## Quickstart

From the **repo root** (the server needs `skills.json` and the `skills/` directory beside it):

```bash
bin/add-mcp                    # build + register with Claude Code
bin/add-mcp --desktop          # also print the Claude Desktop config snippet
bin/add-mcp --build-only       # compile without registering (useful for CI / Claude Desktop)
bin/add-mcp --uninstall        # remove the 'aeon' server from Claude Code
```

`bin/add-mcp` checks Node, builds the TypeScript, and runs `claude mcp add aeon node <path>` so every skill is immediately available as an `aeon-*` tool in Claude Code. Restart your Claude session and ask: *"Use the aeon-hn-digest tool"* or *"Run aeon-token-movers with var=AEON"*.

Or build this app directly:

```bash
cd apps/mcp-server
npm install
npm run build                # → dist/index.js
node dist/index.js           # stdio server; normally launched by the MCP client, not by hand
```

### Requirements

- **Node.js >= 18** and npm (build + runtime).
- The **`claude` CLI** on `PATH` — skills execute via `claude -p -`. Install with `npm install -g @anthropic-ai/claude-code`.
- Whatever each skill needs at runtime — `ANTHROPIC_API_KEY` (or a configured gateway), `GITHUB_TOKEN` for repo skills, and any per-skill API keys. The spawned skill process inherits the MCP server's environment, so set these in your shell or a `.env` file at the repo root before launching the client.

## Tools

Every entry in `skills.json` becomes one tool:

| | |
|---|---|
| **Name** | `aeon-<slug>` — e.g. `aeon-deep-research`, `aeon-hn-digest`, `aeon-token-movers`. |
| **Description** | `[Aeon · <Category>] <skill description> (cron: <schedule>)` or `(on-demand)`, generated from the manifest so Claude can pick the right tool. |
| **Input** | A single optional `var` (string) — the skill's `${var}` input. Its description is the skill's own `var` contract, or a sensible category default. Leave it empty to use the skill's default behaviour. |

Examples of what `var` means per skill: a topic for research skills (`var="AI agent frameworks 2026"`), an `owner/repo` for dev skills, a token symbol for crypto skills. When in doubt, the skill's `SKILL.md` documents its `var` contract.

## Claude Desktop

`bin/add-mcp` registers with **Claude Code** automatically. For **Claude Desktop**, build once and add the server to your config:

```bash
bin/add-mcp --build-only       # produces apps/mcp-server/dist/index.js
bin/add-mcp --desktop          # prints the snippet + the config path for your OS
```

Then add this to your Claude Desktop config (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows: `%APPDATA%\Claude\claude_desktop_config.json`), replacing the path with your real repo path — see [`examples/mcp/claude_desktop_config.json`](../../examples/mcp/claude_desktop_config.json):

```json
{
  "mcpServers": {
    "aeon": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/aeon/apps/mcp-server/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop — Aeon skills appear in the tools list.

## Testing the round-trip

Before wiring it into a client, confirm the server lists and runs tools with the standalone Python client:

```bash
bin/add-mcp --build-only                          # produce dist/index.js
pip install mcp                                 # official Anthropic MCP client
python examples/mcp/test_connection.py          # lists every aeon-* tool, then calls aeon-cost-report
python examples/mcp/test_connection.py aeon-token-movers AEON   # call a specific tool with a var
```

You should see the full `aeon-*` tool list followed by a real skill output. If that works, your Claude Desktop / Claude Code wiring will too. `aeon-cost-report` is the default because it's fast and needs no external API.

## How it works

- **Transport:** stdio (`StdioServerTransport`) using the official `@modelcontextprotocol/sdk`. The MCP client launches `node dist/index.js` as a subprocess and speaks JSON-RPC over stdin/stdout — diagnostics go to stderr (`[aeon-mcp] …`) so they never corrupt the protocol stream.
- **Skill discovery:** `loadSkills()` parses `skills.json` from the repo root (resolved relative to the compiled file, three levels up from `dist/`). If the manifest is missing the server starts with zero tools rather than crashing.
- **Execution:** each call spawns `claude -p - --output-format json` with `cwd` set to the repo root and a 600 000 ms (10-minute) timeout — the same budget GitHub Actions gives a skill. The JSON envelope is unwrapped to return `result`; raw output is returned as a fallback.
- **Errors are returned, not thrown:** a missing skill, a missing `claude` CLI (`ENOENT` → install hint), or a non-zero exit all come back as readable tool text so Claude can react instead of the connection dropping.

## Sandbox / deployment note

This server shells out to the `claude` CLI per tool call, so it must run somewhere that CLI is installed and authenticated (your machine or a container with `ANTHROPIC_API_KEY`). It is **not** part of the GitHub Actions cron path — that path runs skills on their schedule. The MCP server is the on-demand, Claude-native complement: invoke a skill the moment you need it, from inside the assistant you're already using.
