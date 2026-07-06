---
type: Reference
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
- **Out of band.** Telemetry export is decoupled from the model call — if Langfuse
  is slow or down, the skill run is unaffected. The shim never `exit`s or fails
  the run.
- **Span export is a Claude Code beta** (`CLAUDE_CODE_ENHANCED_TELEMETRY_BETA`).
  It ships with the pinned Claude Code version; if you pin an older CLI that
  predates span tracing, no traces are produced (still a clean no-op).

Coverage: the main skill run (all gateway fallback attempts), the post-run quality
scorer, the json-render feed convert, and the conversational-reply poller
(`messages.yml`). Each is tagged with an `aeon.component` resource attribute
(`skill-run` / `scorer` / `feed` / `message`). The **Grok Build harness**
(`harness: grok`) is not traced — the grok CLI has no equivalent OTEL export.

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

That's it — the next run appears in Langfuse. One `claude -p` run maps to one
Langfuse **session** (Claude Code stamps `session.id` per run).

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

## Sandbox note

No sandbox workaround is needed. The OTEL exporter runs **inside** the `claude`
process (the same process that already reaches the model API / gateways), not
through Claude Code's Bash tool, so its egress to Langfuse is not subject to the
bash network restrictions described in the README. No prefetch/postprocess hook is
involved; export is inline and out of band.

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
