# Aeon A2A Gateway

Expose every Aeon skill as a callable task over [Google's Agent-to-Agent (A2A) protocol](https://google.github.io/A2A/). Any A2A-compliant framework - LangChain, AutoGen, CrewAI, OpenAI Agents SDK, Vertex AI - can discover Aeon's skills and run them over plain HTTP + JSON-RPC. No MCP client, no Claude interface, no SDK required: A2A is just HTTP.

## What it is

The gateway reads `skills.json` at the repo root and advertises each skill as an A2A skill on its agent card. When a task arrives, it spawns `claude -p -` against the matching `skills/<slug>/SKILL.md`, streams progress, and returns the skill's output as a task artifact. It's the bridge that turns "Aeon runs on GitHub Actions cron" into "any agent in your stack can call an Aeon skill on demand."

## Quickstart

From the **repo root** (the gateway needs `skills.json` and the `skills/` directory beside it):

```bash
./add-a2a                    # build + start on port 41241
./add-a2a --port 8080        # custom port
./add-a2a --build-only       # compile without starting
./add-a2a --print-config     # print the agent card URL + ready-to-paste client code
```

Or build and run this app directly:

```bash
cd apps/a2a-server
npm install
npm run build
node dist/index.js           # honours A2A_PORT / A2A_URL
```

The gateway runs in the foreground. For production, put it behind a process manager (pm2, systemd, Docker) or expose it with a tunnel (ngrok) and set `A2A_URL` so the agent card advertises the public URL.

### Requirements

- **Node.js >= 18** and npm (build + runtime).
- The **`claude` CLI** on `PATH` - skills execute via `claude -p -`. Install with `npm install -g @anthropic-ai/claude-code`.
- Whatever each skill needs at runtime (`ANTHROPIC_API_KEY` or a configured gateway, `GITHUB_TOKEN` for repo skills, etc.) - the spawned skill process inherits the gateway's environment.

### Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `A2A_PORT` | `41241` | Port the HTTP server listens on. |
| `A2A_URL` | `http://localhost:<port>` | Public base URL advertised on the agent card - set this when running behind a tunnel or reverse proxy. |

## Endpoints

| Method & path | Purpose |
|---------------|---------|
| `GET /.well-known/agent.json` | Agent card - the discovery document A2A clients fetch first. Lists every skill with its id, description, tags, and an example invocation. |
| `POST /` (or `POST /rpc`) | JSON-RPC 2.0 - `tasks/send`, `tasks/get`, `tasks/cancel`. |
| `POST /tasks/sendSubscribe` | Submit a task and receive Server-Sent Events (`status`, `artifact`, `close`) for long-running skills. |

CORS is open (`*`) and OPTIONS preflight is handled, so browser-based agents can call the gateway directly.

## Calling a skill

A2A is plain HTTP + JSON-RPC - any language works. Submit a task, then poll `tasks/get` (or subscribe via SSE) until the state is `completed`:

```python
import requests, time, uuid

GATEWAY = "http://localhost:41241"
task_id = str(uuid.uuid4())

# 1. Submit
requests.post(GATEWAY, json={
    "jsonrpc": "2.0", "id": 1, "method": "tasks/send",
    "params": {
        "id": task_id,
        "skillId": "aeon-deep-research",        # or mention "aeon-<slug>" in the message
        "var": "AI agent frameworks 2026",      # optional skill input
        "message": {"role": "user", "parts": [
            {"type": "text", "text": "Run aeon-deep-research"}]},
    },
}).raise_for_status()

# 2. Poll until done (skills run on a ~10 min Actions-style budget)
for _ in range(120):
    time.sleep(5)
    result = requests.post(GATEWAY, json={
        "jsonrpc": "2.0", "id": 2, "method": "tasks/get",
        "params": {"id": task_id},
    }).json()["result"]
    state = result["status"]["state"]
    if state == "completed":
        print(result["artifacts"][0]["parts"][0]["text"])
        break
    if state in ("failed", "canceled"):
        raise RuntimeError(result["status"])
```

**Choosing the skill.** Pass `skillId` (e.g. `"aeon-deep-research"`, with or without the `aeon-` prefix) for an explicit call. If you omit it, the gateway parses the message text for an `aeon-<slug>` mention, a `skill: <slug>`, or a bare slug. **Passing input.** Use the `var` param, or embed `var=<value>` / `var: <value>` in the message text - it maps to the skill's `${var}`.

Task state flows `submitted` → `working` → `completed` | `failed` | `canceled`. Completed and canceled tasks are kept for 30 minutes (capped at 1000) so callers can fetch results before they're evicted.

## Framework examples

Each client below is < 100 lines and calls a real skill end-to-end. Set `A2A_GATEWAY_URL` first (defaults to `http://localhost:41241`):

| Framework | Example | What it calls |
|-----------|---------|---------------|
| LangChain | [`examples/a2a/langchain_client.py`](../../examples/a2a/langchain_client.py) | `aeon-fetch-tweets` wrapped as a LangChain `Tool` |
| AutoGen | [`examples/a2a/autogen_workflow.py`](../../examples/a2a/autogen_workflow.py) | `aeon-deep-research` as an `AssistantAgent` function tool |
| CrewAI | [`examples/a2a/crewai_task.py`](../../examples/a2a/crewai_task.py) | `aeon-pr-review` as a CrewAI `BaseTool` |
| OpenAI Agents SDK | [`examples/a2a/openai_agents_client.py`](../../examples/a2a/openai_agents_client.py) | `aeon-token-report` as a `@function_tool` |

See [`examples/README.md`](../../examples/README.md) for the full catalog (MCP stdio and Claude Desktop clients live there too).

## Protocol notes

- **Agent card** advertises `capabilities.streaming: true`, `stateTransitionHistory: true`, and an empty `authentication.schemes` array - the gateway itself is unauthenticated, so run it on a trusted network or front it with your own auth/proxy.
- **No external dependencies** - the server is pure Node.js stdlib (`http`, `child_process`), so the build is fast and the runtime surface is small.
- Request bodies are capped at 1 MB; the gateway returns standard JSON-RPC error objects (`-32600`/`-32601`/`-32602`/`-32700`) for malformed calls.

## Sandbox / deployment note

This gateway shells out to the `claude` CLI per task, so it must run somewhere that CLI is installed and authenticated (your machine, a VM, or a container with `ANTHROPIC_API_KEY`). It is **not** part of the GitHub Actions cron path - that path runs skills on their schedule. The A2A gateway is the on-demand, pull-based complement: other agents call skills when they need them.
