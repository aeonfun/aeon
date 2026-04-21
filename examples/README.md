# Aeon integration examples

Aeon ships an [A2A gateway](../a2a-server/) and an [MCP server](../mcp-server/) so any agent stack can call its 90+ skills. The scripts here are the shortest possible "first call works" demos — point them at a running gateway, run `python <file>`, get a real Aeon output back.

| File | Stack | Skill called | What it shows |
|------|-------|--------------|---------------|
| [`a2a/langchain_client.py`](a2a/langchain_client.py) | LangChain | `aeon-fetch-tweets` | Wrap a skill as a `langchain.tools.Tool` |
| [`a2a/autogen_workflow.py`](a2a/autogen_workflow.py) | AutoGen | `aeon-deep-research` | Function tool inside a multi-agent chat |
| [`a2a/crewai_task.py`](a2a/crewai_task.py) | CrewAI | `aeon-pr-review` | Subclass `BaseTool`, hand to a Crew agent |
| [`a2a/openai_agents_client.py`](a2a/openai_agents_client.py) | OpenAI Agents SDK | `aeon-token-report` | `@function_tool` decorator pattern |
| [`mcp/test_connection.py`](mcp/test_connection.py) | MCP (stdio) | `aeon-cost-report` (default) | List + invoke any `aeon-*` tool |
| [`mcp/claude_desktop_config.json`](mcp/claude_desktop_config.json) | Claude Desktop | — | Drop-in config snippet |

Every A2A script is &lt;100 lines, depends only on `requests` plus the framework SDK, and reads its endpoint from `A2A_GATEWAY_URL` (defaults to `http://localhost:41241`).

## A2A — start the gateway, then run any client

```bash
# Terminal 1 — start the gateway from your aeon repo
./add-a2a                      # listens on http://localhost:41241

# Terminal 2 — point a client at it
export A2A_GATEWAY_URL=http://localhost:41241
pip install langchain requests
python examples/a2a/langchain_client.py "AI agents"
```

Swap the script for `autogen_workflow.py`, `crewai_task.py`, or `openai_agents_client.py` to drive the gateway from a different framework. The four files share the same submit/poll pattern so you can crib whichever one matches your stack.

To call a different skill, change the `skillId` (and the `var` if the skill needs one). The agent card at `http://localhost:41241/.well-known/agent.json` lists every tool, its description, and an example invocation.

## MCP — verify the round-trip

```bash
./add-mcp --build-only          # produce mcp-server/dist/index.js
pip install mcp                 # official Anthropic MCP client
python examples/mcp/test_connection.py
```

You should see the full list of `aeon-*` tools followed by a real `aeon-cost-report` output. Once that works, hand `mcp-server/dist/index.js` to Claude Code with `./add-mcp` (already done if you ran `./add-mcp` without `--build-only`) or to Claude Desktop using [`mcp/claude_desktop_config.json`](mcp/claude_desktop_config.json) — replace `/ABSOLUTE/PATH/TO/aeon` with your actual repo path.

## Picking a different skill

`skills.json` at the repo root is the source of truth — every entry is callable as `aeon-<slug>` from MCP and as `skillId: "aeon-<slug>"` from A2A. Some good first calls:

- `aeon-cost-report` — fast, no external API needed, safe to run anywhere
- `aeon-token-report` (`var=AEON`) — public DexScreener data, no secrets required
- `aeon-deep-research` (`var="your topic"`) — long-running; expect 5–10 min
- `aeon-fetch-tweets` (`var="your topic"`) — needs `XAI_API_KEY` in the Aeon repo's environment

Skills that hit external APIs need the same secrets the Aeon GitHub Actions runner uses. Drop them into a `.env` file at the Aeon repo root before you start the gateway or MCP server.

## What the gateway is doing under the hood

Every Aeon skill is a markdown prompt at `skills/<slug>/SKILL.md`. The A2A and MCP servers both spawn `claude -p -` with the same prompt the GitHub Actions runner uses — so a skill behaves identically whether it fires on a cron, from your terminal, or from a remote agent on the other side of the protocol. No re-implementation, no drift.
