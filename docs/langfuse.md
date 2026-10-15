---
layout: default
title: Langfuse Observability
---

# Langfuse Observability (optional)

Aeon can stream every Claude Code run to a [Langfuse](https://langfuse.com) project
as a **trace** — the LLM requests (model, tokens, cost, latency), the tool calls,
and, when content logging is on, the prompts and responses themselves. It is
**opt-in and no-op**: set two secrets and traces start appearing; leave them unset
and nothing changes.

## How it works

`claude -p` (the default harness) has native OpenTelemetry support. When the
`LANGFUSE_*` credentials are present, `scripts/llm-gateway.sh` is followed by
`scripts/langfuse-otel.sh`, which exports the OTEL env vars that point Claude
Code's span exporter at Langfuse's OTLP endpoint (`<host>/api/public/otel`).

- **Traces only.** Langfuse's OTLP endpoint ingests spans, not OTEL metrics/logs.
  Claude Code's span tree — `claude_code.interaction → claude_code.llm_request →
  claude_code.tool` — carries `gen_ai.*` attributes that map directly onto
  Langfuse's LLM data model. The shim leaves the metrics/logs signals disabled so
  nothing is sent to an endpoint that would reject it.
- **HTTP, not gRPC.** Langfuse only accepts OTLP over HTTP, so the shim pins
  `OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf`.
- **Langfuse v4 ready.** The OTLP ingestion contract (endpoint, Basic auth, and
  the `gen_ai.*` attributes) is unchanged from v3, so nothing here is
  version-specific. The shim also sends `x-langfuse-ingestion-version=4`, which
  makes directly-ingested spans show up in real time; without that header, direct
  OTLP data can lag roughly 10-15 minutes in the Langfuse UI. (Langfuse Cloud is
  v4-only after its Nov 2026 cutover; existing `pk-lf-…`/`sk-lf-…` keys keep
  working across it.)
- **Out of band.** Telemetry export is decoupled from the model call — if Langfuse
  is slow or down, the skill run is unaffected. The shim never `exit`s or fails
  the run.
- **Span export is a Claude Code beta** (`CLAUDE_CODE_ENHANCED_TELEMETRY_BETA`).
  It ships with the pinned Claude Code version; if you pin an older CLI that
  predates span tracing, no traces are produced (still a clean no-op).

Coverage: the main skill run (all gateway fallback attempts), the post-run quality
scorer, the json-render feed convert, and the conversational-reply poller
(`messages.yml`). Each is tagged with an `aeon.component` resource attribute
(`skill-run` / `scorer` / `feed` / `message`).

### Run root, token usage and the quality score (claude)

For a claude run, run-harness also sends one **root span** per call itself
(`harness-adapter/lib/otel-span.sh`, OTLP/JSON over curl, after the run, also
when the run fails). It carries the trace name (`aeon:<component>:<skill>`), tags
`skill:<name>` and `component:<name>`, and one `usage <model>` GENERATION per
model with the run's real token counts from the envelope's `modelUsage`.
Langfuse prices those from its own model table, so traces, sessions and the cost
dashboards show real tokens and dollars. Claude Code's own `total_cost_usd` is
kept only as `aeon.cost_usd_reported` (it misprices model ids it does not know).

`TRACEPARENT` puts Claude Code's interaction span under that root. With a
subscription OAuth token, Claude Code starts its span exporter only after a
remote managed settings fetch while its first turn does not wait, so the
interaction span used to start on a no-op tracer and every span became its own
one-span trace (seen on every aeon-agent run from Claude Code 2.1.287 on; an
instance with an MCP server was spared because connecting it delays the first
turn). The claude adapter therefore holds the first turn about 1s with a
`SessionStart` hook while tracing is on. Set `AEON_OTEL_STARTUP_DELAY=0` to drop it.

The trace id comes from the run (`AEON_LF_TRACE_ID`, set by `langfuse-otel.sh`),
so the scorer step can post its 1-5 grade to the skill run's trace with
`scripts/langfuse-score.sh`: a NUMERIC `quality` score (comment = the judge's
assessment) plus one CATEGORICAL `quality_flag` per flag. Non-claude runs get the
score on the run's session instead.

### The non-claude harnesses (grok / codex / pi / vibe / kimi / fx / cursor / hermes)

Those CLIs have no native OTEL export, so their *internal* spans (per-tool, per
LLM-request) can't be captured. Instead run-harness emits **one coarse `gen_ai`
span per run** from the harness envelope — `gen_ai.system`, `gen_ai.request.model`,
token counts, and cost (`aeon.component=harness`). Only numeric usage is recorded;
the prompt and result text are never put on the span. This is opt-in on the same
Langfuse keys, plus a small `otel-cli` binary staged in CI
(`scripts/install-otel-cli.sh`); with no telemetry configured it is a clean no-op.
See `harness-adapter/lib/otel-span.sh`.

### The Node entry points (dashboard / mcp-server / webhook)

These surfaces (the operator control plane, the MCP server, and the Telegram
webhook Worker) can export their own OTLP traces — the request/routing layer, not
the inference, which already flows through the harness traces above. They are
opt-in on the standard `OTEL_EXPORTER_OTLP_ENDPOINT` env (point it at Langfuse's
`/api/public/otel` or any OTLP collector) and no-op when it is unset. The webhook
additionally requires the `nodejs_compat` flag, already set in its `wrangler.toml`.

## Setup

1. Create a Langfuse project and copy its API keys (Langfuse → **Settings → API
   Keys**).
2. Add two **repo secrets** — in the dashboard (Secrets → *Observability*) or with
   the `gh` CLI:

   ```bash
   gh secret set LANGFUSE_PUBLIC_KEY   # pk-lf-...
   gh secret set LANGFUSE_SECRET_KEY   # sk-lf-...
   ```

3. Pick your region. In the dashboard, the **Observability** group has an
   **EU / US** dropdown (🌍 Langfuse region) that writes the `LANGFUSE_HOST`
   variable for you — **default is EU**. Or set it by hand:

   ```bash
   # US cloud:
   gh variable set LANGFUSE_HOST --body 'https://us.cloud.langfuse.com'
   # or a self-hosted instance (shows as "Custom" in the dropdown, left untouched):
   gh variable set LANGFUSE_HOST --body 'https://langfuse.internal.example.com'
   ```

That's it — the next run appears in Langfuse. Every `claude -p` in one Aeon run
(the skill-run, the post-run scorer, the feed convert) is grouped into a single
Langfuse **session** keyed by the GitHub run id (`langfuse.session.id`), so you
see the whole run in one place rather than one session per process.

## Configuration reference

| Name | Kind | Default | Purpose |
|---|---|---|---|
| `LANGFUSE_PUBLIC_KEY` | secret | — | Langfuse public key (`pk-lf-…`). **Required** to activate. |
| `LANGFUSE_SECRET_KEY` | secret | — | Langfuse secret key (`sk-lf-…`). **Required** to activate. |
| `LANGFUSE_HOST` | variable | `https://cloud.langfuse.com` | Langfuse base URL / region. `LANGFUSE_BASE_URL` is accepted as an alias. |
| `LANGFUSE_TRACING` | variable | `1` | Set to `0`/`false`/`off` to force-disable even with keys set. |
| `LANGFUSE_LOG_CONTENT` | variable | `1` | `1` = capture prompts + responses + tool params; `0` = metadata only (redact all content); `all` = also capture tool input/output bodies. |

## Privacy

By default (`LANGFUSE_LOG_CONTENT=1`) prompts, responses, and tool **parameters**
are sent to your Langfuse project — that's the point of tracing the inference.
Tool input/output **bodies** (which can include command output) stay off unless
you set `LANGFUSE_LOG_CONTENT=all`. Set `LANGFUSE_LOG_CONTENT=0` for
metadata-only traces (tokens, cost, latency, structure — no text). All data goes
only to the Langfuse instance you configure; nothing is sent to Anthropic beyond
the normal model call.

## Known gaps (and what we deliberately don't do)

Confirmed against a live run (Claude Code `2.1.168`): traces, span tree, latency,
tool commands, prompts, and the `aeon.*` tags all flow correctly. Two gaps remain,
both upstream — **neither is fixable from this shim's env vars**:

- **Per-call token counts stay unaggregated.** Langfuse reads usage from
  `gen_ai.usage.*`, but Claude Code emits **bare** `input_tokens` on each
  `claude_code.llm_request`, so those land in `metadata.attributes.*`. Per-run
  totals and cost are covered by the root span's `usage <model>` generations
  (above); per-call cost would still need a collector.
- **Assistant response text never appears.** Claude Code puts it on the
  `claude_code.assistant_response` **event** (the OTEL *logs* signal), which
  Langfuse's OTLP endpoint doesn't ingest (traces only).

**We deliberately do NOT run an OTEL-collector / rewrite-proxy sidecar to fix
cost mapping.** Rationale: it adds a networked process to the critical path of
every run (a reliability risk for a reporting nicety), it's hand-rolled OTLP
parsing, and it shims *beta* Claude Code attribute names that will most likely
align with `gen_ai.usage.*` upstream (or Langfuse will add native Claude-Code
mapping), at which point the proxy is dead code. Per-run tokens and cost already
reach Langfuse through the run root span (and `memory/token-usage.csv`), so only
per-call cost is missing. Revisit only if upstream stays unaligned **and**
per-call cost in Langfuse becomes worth a sidecar.

## Network note

No workaround is needed. The OTEL exporter runs **inside** the `claude`
process (the same process that already reaches the model API / gateways), not
through Claude Code's Bash tool, so its egress to Langfuse never touches a command
line and is unaffected by the Bash permission layer's secret-expansion block
described in the README (there is no network sandbox). Export is inline and out of
band — no `.pending-*/` postprocess hook involved.

## Verifying

`scripts/tests/test_langfuse_otel.sh` covers the gating and env-export behavior
(no-op without keys, endpoint/auth/protocol construction, content toggles,
force-disable, `bash -e` safety). Run it with:

```bash
bash scripts/tests/test_langfuse_otel.sh
```

# Citations

- Langfuse OpenTelemetry ingestion: <https://langfuse.com/integrations/native/opentelemetry>
- Claude Code monitoring & telemetry: <https://code.claude.com/docs/en/monitoring-usage>
