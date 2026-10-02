# harness-adapter

**One Claude Code-shaped contract, nine coding-agent harnesses.**

This directory is exactly what the workflow runs: the `run-harness` dispatcher and
the nine adapters aeon can dispatch to - **claude, grok, codex, pi, vibe, kimi, fx, cursor, hermes**.
It is self-contained, so fixes land here directly. Three further harnesses
(`opencode`, `copilot`, `agy`) were evaluated and deliberately left out; the
per-harness reasons are recorded in the allowlist comment in
`.github/workflows/aeon.yml`.

`run-harness` wraps each CLI behind one headless interface — Claude Code's: prompt
on stdin, flags mirroring `claude -p`, one JSON envelope on stdout. Swap the first
argument, keep everything else. `.github/workflows/aeon.yml` runs **every** skill
through it, whichever harness is configured (claude is wrapped in the multi-provider
gateway cascade; `scripts/run-grok.sh` is now setup-only), so everything downstream
(scoring, token accounting, memory, notifications) is unchanged. The pattern
generalizes [aeonfun/aeon](https://github.com/aeonfun/aeon)'s original `run-grok.sh`,
which proved it for one harness.

```sh
echo "Summarize the TODOs in this repo" | ./run-harness codex --mode read-only
echo "Draft release notes"              | ./run-harness grok  --max-turns 20
echo "Reply with OK"                    | ./run-harness kimi  --mode read-only
```

## The contract

```
stdin   the prompt
stdout  { "result": "<text>",
          "usage": { "input_tokens": N, "output_tokens": N,
                     "cache_read_input_tokens": N, "cache_creation_input_tokens": N },
          "session_id": "<optional>", "total_cost_usd": <optional>,
          "model": "<optional: the model the harness says it ran (codex today)>" }
stderr  diagnostics only
exit    0 ok · 3 abnormal model stop with no output · 124 timeout · other = error
```

An abnormal stop (grok `stopReason=Cancelled`, codex `turn.failed`, …) with no
output **fails the run** — partial or empty results are never emitted as success.

## The nine harnesses

| | claude | grok | codex | pi | vibe | kimi |
|---|---|---|---|---|---|---|
| Round-trip envelope | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Token usage | ✅ + cost | ✅ + cost¹ | ✅ | ✅ + cost | 0² | 0² |
| Read-only enforcement | ✅ sandbox | ✅ sandbox³ | ✅ native | ✅ sandbox | ✅ sandbox⁴ | ✅ sandbox⁴ |
| Structured output | native | native | native | shim⁵ | shim⁵ | shim⁵ |
| MCP tool call (live) | ✅ | ✅ needs `--trust`⁷ | ✅⁶ | ✅ CI (fake model)⁹ | ✅ | ✅ needs overlay⁸ |
| Native provider auth | Claude Pro/Max OAuth | X account · `XAI_API_KEY` | ChatGPT OAuth · `OPENAI_API_KEY` | provider env key | Mistral key | Moonshot OAuth · key |

The six in this table round-trip the contract on real CLIs (claude ≥2.1, grok 0.2.101,
codex-cli 0.144.6, pi 0.80.9, vibe 2.20.0, kimi 0.28.0; live runs on real models). The
current pins (claude 2.1.287, grok 1.0.46, codex-cli 0.159.3, pi 0.99.2, vibe 2.25.8,
kimi 2.1.1) are checked on every change by `.github/workflows/ci-harness-cli.yml`:
each CLI is installed at its pin, its `--help` must still list every flag its
adapter passes, and a prompt goes through `run-harness` against a local fake model
server (no real model call). aeon runs all nine through
this adapter; claude's call is additionally wrapped in the AI-gateway failover
cascade.

**fx** is the seventh adapter (`adapters/fx.sh`) - verified mechanically
end-to-end (envelope, MCP-config translation, model/step env, and the
success/failure paths against a real fx 0.0.5 binary), but not yet
live-dispatched on GitHub Actions, so it is absent from the tested matrix above.

The two newer adapters are:

| harness | headless entry point | auth | usage |
|---|---|---|---|
| cursor | `agent -p --trust --output-format json` | `CURSOR_API_KEY` | provider output only; zero when Cursor omits usage |
| hermes | `hermes -z --usage-file <path>` | `HERMES_AUTH` (Nous Portal OAuth archive) or OpenRouter | usage/session from the usage file |

¹ grok reports usage **only** on `--output-format streaming-json`, whose terminal
`{"type":"end"}` event carries usage, `total_cost_usd` and `sessionId`; the adapter
builds `.result` from `type=="text"` chunks only — never the interleaved
`type=="thought"` chain-of-thought.
² vibe and kimi expose no token counts in their `-p`/json modes → usage normalizes
to 0 (vibe meters cost server-side; kimi's stream carries none).
³ grok's own `--sandbox read-only` is a silent no-op on 0.2.101 (writes still land),
so grok is write-locked by the dispatcher's wrapper sandbox instead.
⁴ vibe and kimi `-p` modes have no permission-layer gate of their own; read-only
holds entirely via the dispatcher's OS sandbox (`sandbox-exec` on macOS, `bwrap` on
Linux) mounting the workspace read-only.
⁵ prompt-shim (`lib/schema-retry.sh`): the schema is appended to the prompt, the
result validated, and one corrective retry runs. No native `--json-schema` flag
exists on these.
⁶ codex calls MCP tools fine headlessly. This previously read "wired but
approval-denied"; re-measured 2026-07-27 on codex-cli 0.144.6, the real blocker was
a translation bug in `lib/mcp-translate.sh` — `env`/`headers` were emitted as JSON
objects, which codex (parsing `-c` values as TOML) rejects outright, killing the
run before the model started. With inline tables emitted instead, a live aeon run
invoked `glim_twitter_get` and returned data only the MCP server could supply.
⁷ grok gates repo-local (project-scoped) MCP servers behind its folder-trust store
(`~/.grok/trusted_folders.toml`); a CI checkout is never trusted, so the adapter
passes `--trust` whenever an MCP config is in play. Without it the server is
silently never started and no `mcp__<srv>__*` tool exists.
⁸ kimi auto-discovers `<cwd>/.mcp.json` and that WINS over the config staged in
`$KIMI_CODE_HOME`, so it sends `${VAR}` placeholders verbatim instead of the
expanded secret. `lib/sandbox.sh` overlays the expanded copy onto the workspace
file inside the bwrap sandbox. Linux-only: on macOS (`sandbox-exec`, no
bind-mounts) kimi still reads the literal `${VAR}`s.
⁹ pi 0.99 ships built-in MCP (stdio + streamable HTTP) read from `mcp.json` in its
agent dir. The adapter writes the translated config into a temp
`PI_CODING_AGENT_DIR` whose other entries link to the real `~/.pi/agent`, and
declares every server's tools directly (`"exposure": "direct"`): pi's default
`codemode` exposure hides MCP tools behind a script tool, and the first model
request waits only for servers with direct tools. That wait is capped at a
hard-coded 10s in pi (`dist/extensions/mcp/index.js`, `DEFAULT_STARTUP_WAIT_MS`),
so a direct server that needs longer misses turn 1 and joins later turns. `sse`
entries, other types and names outside `[A-Za-z0-9_-]` are warned about and
skipped. `env`/`headers` values are escaped so pi does not expand `$VAR` or run a
leading `!` a second time. Tool names turn `-` into `_` (`mcp__my_srv__tool`).
`--approve` trusts a workspace `.pi/mcp.json`, whose entries win over the staged
ones by name. Proven in CI against a fake model and a fake stdio server (fast,
2s-slow, plus a skipped `sse` entry); not yet on a live model.

## Flags

| Flag | Notes |
|---|---|
| `--model <id>` | per-harness mapping; a wrong-family id (e.g. `claude-*` on codex) falls back to that harness's default |
| `--allowed-tools "<list>"` | Claude's grammar (`Read,Bash(git:*),...`), translated per harness |
| `--mode read-only\|write` | capability tier; derived from `--allowed-tools` if omitted (default `write`) |
| `--mcp-config <.mcp.json>` | Claude-style config; `${VAR}`s expanded from env, translated per harness |
| `--max-turns <n>` | native on claude/grok; codex/pi/vibe/kimi rely on `--timeout` |
| `--json-schema '<schema>'` | native on claude/grok/codex; prompt+validate+one-retry on pi/vibe/kimi |
| `--append-system-prompt <t>` | extra standing instructions |
| `--timeout <s>` | wall-clock guard (default 600) |
| `--no-sandbox` | skip the wrapper OS sandbox on read-only runs |
| `--no-compat-rules` | skip the Claude-idiom preamble on non-claude harnesses |

## How each layer is translated

| Layer | claude | grok | codex | pi | vibe | kimi |
|---|---|---|---|---|---|---|
| Invoke | `claude -p -` | `grok -p --output-format streaming-json` | `codex exec --json -` | `pi -p --mode json` | `vibe -p --trust --output json` | `kimi -p --output-format stream-json` |
| Result | envelope passthrough | `type=="text"` chunks (never `thought`) | last `agent_message` | last assistant `message_end` | last assistant `content` (never `reasoning_content`) | last assistant `content` |
| Usage | native + cost | streaming `end` event → cost | sum of `turn.completed.usage` | per-message usage + cost | none → 0 | none → 0 |
| Read-only | `--allowedTools` + wrapper sandbox | `bypassPermissions` + wrapper sandbox | `--sandbox read-only` (native) | `--tools` subset + wrapper sandbox | wrapper sandbox only | wrapper sandbox only |
| MCP | `--mcp-config` | native `.mcp.json` + `MCPTool(...)` allows + `--trust`⁷ | `-c mcp_servers.*` (TOML inline tables⁶) | `{mcpServers}` + `exposure: direct` in temp `PI_CODING_AGENT_DIR`⁹ | `config.toml [[mcp_servers]]` in temp `VIBE_HOME` | `{mcpServers}` in temp `KIMI_CODE_HOME` + sandbox overlay⁸ |
| CLAUDE.md | native + `@imports` | native (no imports) | via `project_doc_fallback_filenames` | native | native | native |

### Design notes

**Read-only enforcement is hoisted into the dispatcher.** Only codex has a native
kernel sandbox that actually holds; every other harness — claude, grok, pi, vibe,
kimi, fx — runs read-only under `sandbox-exec` (macOS) or `bwrap` (Linux) with the
workspace mounted read-only, so `--mode read-only` means the same thing on all nine:
*the repo physically cannot be mutated*, regardless of the model or its permission
config. (vibe and kimi lean on this entirely — their `-p` modes have no
permission-layer gate of their own.)

**Denied-tool semantics** are normalized to *deny-and-continue*: claude and codex
already behave that way headlessly; grok would abort the whole turn on a denied
tool, so its adapter runs `bypassPermissions` + OS sandbox; pi never denies.

**`@imports` are Claude-only.** The dispatcher detects them in `CLAUDE.md` and
pre-expands a merged copy (`lib/imports.sh`); the leaner long-term pattern is
carrying just the delta in `AGENTS.md`, which every other harness reads.

## Field notes from live testing

- **Codex strict-mode schemas** — OpenAI's response_format 400s on any object
  schema missing `additionalProperties: false`. Claude-style schemas don't carry
  it; the codex adapter patches schemas recursively, so one `--json-schema` string
  works identically everywhere.
- **grok's `--sandbox read-only` is a silent no-op** (0.2.101): a read-only run
  ordered to write a file created it anyway. grok is now write-locked by the wrapper
  sandbox like the others, and a `read-only holds` live test guards it.
- **Read-only really holds**: codex answered *"this workspace is read-only"*; pi
  lost write/edit/bash to `--tools` subsetting; vibe/kimi are held by the wrapper
  sandbox — no stray files, on any harness.
- **Every harness then in the sweep but pi called live MCP tools** (2026-07-27
  sweep, glim.sh over streamable HTTP; pi gained built-in MCP in 0.99, see ⁹). Three of them needed a dispatcher fix first, and each failed
  *silently* — the agent just reported the server "not connected" and quietly fell
  back to raw HTTP, which reads as a working run: codex crashed on config load
  (footnote ⁶), grok never started the server in an untrusted checkout (⁷), and
  kimi sent unexpanded `${VAR}` placeholders (⁸). vibe worked untouched; pi
  had no MCP at the time. **Verify MCP by what the tool returned, not by whether
  the run went green.**
- **Pi's minimalism is measurable**: the same one-line prompt consumed ~2.4k input
  tokens on pi vs ~12k on codex — its sub-1k system prompt holds up.

## Installing the harnesses

Only the harnesses you actually dispatch need to be installed.

| Harness | Install | Auth |
|---|---|---|
| Claude Code | `npm i -g @anthropic-ai/claude-code@2.1.287` | `claude login` (Pro/Max or API key) |
| Grok Build | `npm i -g @xai-official/grok@1.0.46` | `grok login` (SuperGrok / X Premium+) or `XAI_API_KEY` |
| Codex CLI | `brew install codex` or `npm i -g @openai/codex@0.159.3` | `codex login` (any ChatGPT plan) or `OPENAI_API_KEY` |
| Pi | `npm i -g --ignore-scripts @earendil-works/pi-coding-agent@0.99.2` | provider env keys or `/login` OAuth in the TUI |
| Mistral Vibe | `pipx install mistral-vibe==2.25.8` (or the Vibe installer → `~/.local/bin/vibe`) | `vibe --setup` (Mistral API key) |
| Kimi Code | `npm i -g --ignore-scripts @moonshot-ai/kimi-code@2.1.1` (or `brew install kimi-code`) | `kimi login` (Moonshot) or a provider in `~/.kimi-code/config.toml` |
| Cursor CLI | `curl -fsSL https://cursor.com/install | bash` | `CURSOR_API_KEY` for headless runs |
| Hermes Agent | `curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash` | `hermes setup --portal`; archive as `HERMES_AUTH` for CI |

For aeon, these installs + auth are automated by `aeon.yml`'s *Install harness CLI*
step and the native-auth secrets (`CODEX_AUTH`, `KIMI_AUTH`, `MISTRAL_API_KEY`,
`OPENROUTER_API_KEY`, …). See [docs/aeon-integration.md](docs/aeon-integration.md).

## Capability manifest

[`harnesses.json`](harnesses.json) is the machine-readable capability manifest for
the ten adapters - the local analog of a UHP [`GET /v1/harnesses`](https://unifiedharnessprotocol.org)
discovery response. One queryable file answers *does this harness report token
cost? enforce read-only natively or via the wrapper sandbox? support MCP, and
how? what auth does it take?* - instead of that knowledge living only in the
tables above and in `scripts/resolve-harness.sh`.

It is generated, never hand-edited. Each `adapters/<h>.sh` carries an
`rh-meta-start … rh-meta-end` block (one JSON object) as the source of truth;
`bin/generate-harnesses-json` aggregates them, sorted and validated:

```sh
bin/generate-harnesses-json            # writes harnesses.json (pretty)
jq '.harnesses[] | select(.mcp != "unsupported") | .id' harnesses.json
```

`.github/workflows/ci-harnesses-json.yml` fails any PR whose committed manifest
does not match a fresh regen, so it cannot drift from the adapters it describes.

Each harness also lists its **credentials**: every secret that can authenticate
it, most preferred first, in exactly the order `scripts/resolve-harness.sh`
picks them. Per entry:

| key | meaning |
|-----|---------|
| `secret` | repo secret name |
| `kind` | `oauth_capture` (a CLI login whose files are tar+base64'd into the secret), `oauth_token` (a token a CLI mints, e.g. `claude setup-token`), `api_key`, `oidc` |
| `auth_mode` | the `AUTH_MODE` resolve-harness.sh reports when this credential is the one in use (`native-oauth` / `native-key` / `openrouter`) |
| `label` | human name |
| `prefix` | key prefix, when the provider has one (optional) |
| `get_url` | where to get it |
| `login_cmd` | the provider CLI's own login command (optional) |
| `aeon_cmd` | the local command that obtains and stores it (optional) |
| `cred_paths` | `$HOME`-relative files captured, for `oauth_capture` |
| `expires` / `refresh` | lifetime and how to renew (optional notes) |
| `aux_secrets` | extra secrets the credential needs to stay alive (grok: `GH_SECRETS_PAT` or `GH_GLOBAL` to persist the rotated refresh token) |

The older `auth` summary (`native_oauth` / `native_key` / `openrouter`) is
derived from that list by the generator. `default_model` mirrors resolve-harness.sh's
`DEFAULT_HM` (`default` = the harness's own configured model). The claude harness
points at [`gateways.json`](gateways.json), generated from the `gw-meta` block in
`adapters/claude.sh`: every provider `scripts/llm-gateway.sh` can route Claude Code
through, in its default `GATEWAY_ORDER`, with secret(s), key prefixes, base URL,
transport (`native` / `anthropic-compatible` / `sidecar`) and where to get a key.

resolve-harness.sh and llm-gateway.sh stay the runtime source; the manifests are a
read-only mirror for `aeon init`, `bin/onboard` and the dashboard.
`scripts/tests/test_credential_manifest.sh` (ci-tests) fails the moment they
drift from those scripts, the install pins, the aeon.yml `env:` blocks, or the
dashboard's `harness-auth.ts` / `gateway-registry.ts`.

## Layout

```
run-harness            dispatcher: args → RH_* env → sandbox/timeout → adapter → validate
adapters/<h>.sh        one per harness: invoke, translate, normalize (claude grok codex pi vibe kimi fx)
harnesses.json         generated capability manifest (UHP GET /v1/harnesses analog)
bin/generate-harnesses-json  aggregate adapters' rh-meta blocks → harnesses.json
gateways.json          generated claude gateway cascade (gw-meta block in adapters/claude.sh)
lib/envelope.sh        emit/validate the contract envelope
lib/tools-grammar.sh   --allowedTools → per-harness permissions
lib/mcp-translate.sh   .mcp.json → codex -c flags / vibe TOML / kimi home; ${VAR} expansion
lib/imports.sh         CLAUDE.md @import pre-expansion
lib/schema-retry.sh    structured output for harnesses without --json-schema (pi/vibe/kimi)
lib/sandbox.sh         wrapper OS sandbox (workspace read-only)
lib/compat-rules.md    Claude-idiom translation preamble
docs/aeon-integration.md  deployment runbook: wiring the swap into a live aeon
```

## Credits

The normalize-to-Claude's-envelope pattern, the grok permission stance, and the
thought-firewall come from [aeonfun/aeon](https://github.com/aeonfun/aeon)'s
`run-grok.sh`.

MIT — see [LICENSE](LICENSE).
