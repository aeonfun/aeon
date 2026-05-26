# Subsystem: A2A Gateway

The A2A (Agent-to-Agent) gateway lets any HTTP-speaking agent framework — LangChain, AutoGen, CrewAI, OpenAI Agents SDK, Vertex AI — invoke Aeon skills as remote agents.

---

## At a glance

| Property | Value |
|---|---|
| Source | [`a2a-server/src/index.ts`](../../../a2a-server/src/index.ts) (~550 lines) |
| Protocol | [Google A2A](https://google.github.io/A2A/) over HTTP + JSON-RPC 2.0 |
| Port | 41241 (configurable via `A2A_PORT`) |
| Transport | HTTP + Server-Sent Events for streaming |
| Auth | None by default — local-trust model |
| CORS | Permissive (allows browsers) |
| Build / start | `./add-a2a` |

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/.well-known/agent.json` | Agent card — discovery surface listing every skill |
| `POST` | `/` or `/rpc` | JSON-RPC 2.0 — methods: `tasks/send`, `tasks/get`, `tasks/cancel` |
| `POST` | `/tasks/sendSubscribe` | SSE endpoint — streams task state changes and artifacts in real time |

Source: [`a2a-server/src/index.ts:441-547`](../../../a2a-server/src/index.ts#L441-L547).

## Task lifecycle

Tasks move through five states ([`a2a-server/src/index.ts:53,220-250`](../../../a2a-server/src/index.ts#L220-L250)): `submitted → working → completed | failed | canceled`. Each task is an in-memory record (lines 77–88) with id, status, artifacts, history, metadata, child process handle (if running), and SSE subscriber list.

### Skill execution path ([`a2a-server/src/index.ts:163-218`](../../../a2a-server/src/index.ts#L163-L218))

1. Client sends `tasks/send` with a skill id and optional `var` in the message.
2. Server creates a task in `submitted` state.
3. Server spawns `claude -p -` asynchronously (line 183) with the skill prompt — same execution model as the MCP server and the Actions runner.
4. Server streams stdout into chunks (line 192), parses JSON output (lines 201–206).
5. On completion, stores artifacts (line 233).
6. Broadcasts state changes to all SSE subscribers for that task (lines 222, 240).

### Skill resolution ([`a2a-server/src/index.ts:145-159`](../../../a2a-server/src/index.ts#L145-L159))

Accepts skill ids two ways:

- **Explicit `skillId` parameter** (line 322) — preferred for programmatic clients.
- **Parsed from message text** — patterns like `aeon-deep-research`, `skill: deep-research`, or just the bare slug.

`var` is extracted from the message text via flexible patterns (`var=`, `var:`, quoted forms — line 157). The result of this parsing is what gets passed to the skill prompt.

### Eviction ([`a2a-server/src/index.ts:102-122`](../../../a2a-server/src/index.ts#L102-L122))

- Completed tasks are retained for 30 minutes.
- Hard cap at 1000 tasks; older completed tasks evicted first.

This is a per-process limit; restart the server and you lose history. For durable task records, log via the standard Aeon mechanism (write to `memory/logs/` in the skill itself).

## Agent card

The `/.well-known/agent.json` endpoint ([`a2a-server/src/index.ts:266-305`](../../../a2a-server/src/index.ts#L266-L305)) returns one A2A "skill" object per Aeon skill: name `aeon-<slug>`, description, tags, input/output modes (`text/plain`), and example invocations. Clients use this card to bind tools at startup.

## Working client integrations

Five reference clients ship in [`examples/`](../../../examples/):

| Stack | File | Lines | Pattern |
|---|---|---|---|
| **LangChain** | [`examples/a2a/langchain_client.py`](../../../examples/a2a/langchain_client.py) | 27–79 | Wraps Aeon as a LangChain `Tool`. JSON-RPC `tasks/send` → poll `tasks/get` every 5s up to 10 min → extract artifact. |
| **AutoGen** | [`examples/a2a/autogen_workflow.py`](../../../examples/a2a/autogen_workflow.py) | 28–96 | Registers `aeon_deep_research()` as a function tool on an `AssistantAgent`. Multi-turn user↔assistant conversation calls Aeon and returns a report. Requires OpenAI key for the driving agent. |
| **CrewAI** | [`examples/a2a/crewai_task.py`](../../../examples/a2a/crewai_task.py) | 28–90 | Defines `AeonPRReviewTool` as a `BaseTool` subclass; crew agent uses it to review repos. |
| **OpenAI Agents SDK** | [`examples/a2a/openai_agents_client.py`](../../../examples/a2a/openai_agents_client.py) | 27–79 | `@function_tool` decorator pattern. Requires `OPENAI_API_KEY` for the driving agent. |
| **MCP smoke** | [`examples/mcp/test_connection.py`](../../../examples/mcp/test_connection.py) | 44–81 | Stdio MCP smoke test (out-of-scope for A2A but ships in the same examples tree). |

All four A2A clients share the same polling pattern. A2A is **not WebSocket**; SSE is available via `/tasks/sendSubscribe` if you want push, but the example clients poll. We should consider shipping an SSE example — captured in [`../08-OPEN-QUESTIONS.md`](../08-OPEN-QUESTIONS.md).

## `./add-a2a`

The shell script ([`add-a2a`](../../../add-a2a)) handles build + start:

- **`./add-a2a`** — builds `a2a-server/`, starts on port 41241.
- **`./add-a2a --print-config`** — prints LangChain / Python client example snippets pointing at the running endpoint.
- **`./add-a2a --port <N>`** — alternate port via `A2A_PORT`.

## Operational gotchas

- **No auth.** Anyone who can reach the port can run any skill. This is fine for local trust; **do not** expose port 41241 publicly. If you need to expose it, put it behind a reverse proxy with auth — and recognize that any caller who reaches it can spend your Anthropic budget by triggering long skill runs.
- **CORS is permissive.** [`a2a-server/src/index.ts:414-418`](../../../a2a-server/src/index.ts#L414-L418) allows cross-origin requests. Useful for browser-based agents; means a malicious page in the browser of someone running the gateway locally can submit tasks. Mitigation: bind to `127.0.0.1` only at the network layer.
- **Long-running tasks block the worker pool.** A skill that takes 8 minutes occupies an executor for 8 minutes. The current implementation does not have a concurrency cap — concurrent task floods are an unguarded surface.
- **Task IDs leak in URLs / logs.** They're random but not unguessable in a focused brute-force. Don't treat them as security primitives.

## How A2A and MCP differ

| | MCP | A2A |
|---|---|---|
| Transport | stdio | HTTP + JSON-RPC + SSE |
| Discovery | `ListToolsRequest` | `GET /.well-known/agent.json` |
| Streaming | No | Yes (`/tasks/sendSubscribe`) |
| Typical clients | Claude Desktop, Claude Code | LangChain, AutoGen, CrewAI, OpenAI Agents |
| Concurrency | One server per host process | Multiple concurrent tasks per server |
| Auth model | Inherits MCP host's trust | None — local-trust only |
| Side-effects | `claude -p -` execution only | `claude -p -` execution only |

Same skills, two surfaces. The choice between them is driven by which framework your client uses.

## Related docs

- [`mcp-server.md`](mcp-server.md) — the stdio counterpart.
- [`runtime.md`](runtime.md) — the GitHub Actions execution path that both gateways mirror.
- [`integrations.md`](integrations.md) — Smithery publication, Bankr gateway, ecosystem integrations.
- [`../05-SECURITY.md`](../05-SECURITY.md) — auth posture for both gateways.
