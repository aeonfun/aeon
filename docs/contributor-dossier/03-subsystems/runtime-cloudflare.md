# Subsystem: Cloudflare Workers Runtime (alternative)

Alternative runtime for Aeon skills, running alongside GitHub Actions. Per-skill `runtime:` field in `aeon.yml` selects which one executes a given skill.

> **Status:** Scaffold inside the Sealed Sprint (Session 01, 2026-05-26). Worker structure + Durable Object skeleton + wrangler config in place. The 21-step pipeline is PLACEHOLDER — its shape is documented; implementation is multi-week post-seal work.

---

## At a glance

| Property | Value |
|---|---|
| Implemented | Session 01 scaffold (Sealed Sprint, 2026-05-26) |
| Source | [`workers-runtime/`](../../../workers-runtime/) (new directory) |
| Configuration | [`workers-runtime/wrangler.jsonc`](../../../workers-runtime/wrangler.jsonc) |
| Entry points | `fetch` (HTTP — dashboard "Run skill"), `scheduled` (5-min cron tick) |
| Concurrency primitive | `SkillRunner` Durable Object (per-skill singleton) |
| Memory | KV (CRON_STATE, MEMORY_CACHE) + D1 (MEMORY_DB) + R2 (ARTICLE_BUCKET) + GitHub via Octokit (canonical) |
| Gateway | Anthropic SDK direct OR Bankr router (config-gated) |
| Quality scorer | Workers AI (Haiku-equivalent) — eliminates the inline Haiku tax |
| Selection | `runtime: "workers" | "actions"` per skill in aeon.yml (default `actions`) |

## Selection model

```yaml
# aeon.yml — backward-compatible. Skills without runtime: default to actions.
default_runtime: actions   # global default

skills:
  morning-brief: { enabled: true, schedule: "0 7 * * *", runtime: "workers" }
  deep-research: { enabled: true, schedule: "workflow_dispatch", runtime: "actions" }  # heavy, stays on Actions
  token-alert:   { enabled: true, schedule: "0 12 * * *", runtime: "workers" }
```

The messages.yml scheduler checks the `runtime:` field. Skills marked `workers` skip GitHub Actions dispatch; the Workers cron entry picks them up instead.

## Why alongside, not replacement

- **GitHub Actions has features Workers doesn't:** unlimited CPU time per run (Workers caps at 30s subrequest, hours with `waitUntil`), built-in OAuth, fork-friendly defaults, free unlimited minutes on public repos.
- **Workers has features Actions doesn't:** sub-second cold start, reliable cron, native WebSocket, Workers AI binding, persistent state via Durable Objects.
- **Operators choose.** Skills that benefit from sub-second latency (chat replies, alert routing) → Workers. Skills that need long execution (`deep-research`, `feature` implementation) → Actions.
- **Skill prose is unchanged.** The same SKILL.md works on both runtimes. No fork.

## The 21-step pipeline (documented; PLACEHOLDER for Session 01)

The Workers pipeline mirrors [`.github/workflows/aeon.yml`](../../../.github/workflows/aeon.yml) step-for-step. Each step becomes a TypeScript module in `workers-runtime/src/pipeline/`:

| # | Step | Module (future) |
|---|---|---|
| 1 | Validate skill name | `pipeline/validate.ts` |
| 2 | Validate secrets present | `pipeline/secrets.ts` |
| 3 | Run prefetch modules | `prefetch/*.ts` (ported from `scripts/prefetch-*.sh`) |
| 4 | Fleet preflight (fail closed) | `pipeline/fleet-watcher.ts` |
| 5 | Resolve model + gateway | `pipeline/gateway.ts` |
| 6 | Build prompt (skill + var + today + chain context) | `pipeline/prompt.ts` |
| 7 | Call Anthropic SDK (or Bankr) | `pipeline/claude.ts` |
| 8 | Capture token usage | `pipeline/tokens.ts` |
| 9 | Write output to staging | `pipeline/output.ts` |
| 10 | Quality scoring (Workers AI) | `pipeline/quality.ts` |
| 11 | json-render conversion | `pipeline/jsonrender.ts` |
| 12 | Notify fan-out | `pipeline/notify.ts` |
| 13 | Retry pending notifications | `pipeline/notify.ts` |
| 14 | Run postprocess modules | `postprocess/*.ts` |
| 15 | Fleet postflight (always-run) | `pipeline/fleet-watcher.ts` |
| 16 | Log to token-usage.csv | `pipeline/tokens.ts` |
| 17 | Write to .outputs/ | `pipeline/output.ts` |
| 18 | Batch-commit memory to GitHub | `pipeline/commit.ts` (Octokit; every N runs) |
| 19 | Update CRON_STATE entry | `pipeline/cron-state.ts` |
| 20 | Emit observability event | `pipeline/observability.ts` |
| 21 | Return result | (top-level `SkillRunner.fetch`) |

## Memory model

Different from the Actions runtime in one important way: **memory writes batch**.

| Read pattern | Backing store | Notes |
|---|---|---|
| Hot — `cron-state.json`, `MEMORY.md` index | KV (`CRON_STATE`, `MEMORY_CACHE`) | TTL 5 min; refreshed from GitHub on miss |
| Index — entities/edges/chunks (for KG memory, Session 02) | D1 | Queryable via SQL |
| Cold — specific topic files, log files | On-demand fetch via Octokit | Cached in KV with TTL |
| Artifacts — articles/, generated images | R2 | Static-friendly URL space |

| Write pattern | Strategy |
|---|---|
| Per-run memory updates (logs, cron-state, skill-health) | Accumulate in per-skill staging KV |
| Every N runs OR M minutes (whichever first) | Flush worker commits the batch via Octokit to GitHub |
| Chain context (.outputs/{skill}.md) | Immediate write to KV; downstream skills read from KV (not GitHub) within the chain |

The git repo remains the source of truth. The Workers runtime caches and batches.

## What this scaffold ships

| Path | What it contains |
|---|---|
| [`workers-runtime/wrangler.jsonc`](../../../workers-runtime/wrangler.jsonc) | Full binding declarations (KV, D1, R2, DO, AI, secrets) with PLACEHOLDER ids the operator replaces during activation. |
| [`workers-runtime/package.json`](../../../workers-runtime/package.json) | Dependencies (Anthropic SDK, Octokit, wrangler, Workers types). |
| [`workers-runtime/src/index.ts`](../../../workers-runtime/src/index.ts) | Worker skeleton: HTTP entry, scheduled entry, `SkillRunner` Durable Object with the 21-step pipeline stubbed as a single method that returns 501. |
| [`workers-runtime/README.md`](../../../workers-runtime/README.md) | Activation runbook + phase plan. |
| This subsystem doc | What you're reading. |

## What's PLACEHOLDER (post-seal multi-week work)

- The 21-step pipeline implementation.
- The `pipeline/`, `prefetch/`, `postprocess/`, `__tests__/` subdirectories.
- The dispatcher change in `messages.yml` (skip Actions dispatch for `runtime: workers` skills).
- The dashboard's runtime toggle.
- The comparison harness (heartbeat-on-both-runtimes diff).
- Real wrangler deploy (requires Cloudflare account).

All these are well-described in [`session-01-cloudflare-runtime.md`](../_session-prompts/session-01-cloudflare-runtime.md) and the workers-runtime README.

## Activation flow (operator)

1. Create Cloudflare account (Workers Paid plan, $5/mo) + KV namespaces + D1 database + R2 bucket.
2. Update `wrangler.jsonc` — replace every `PLACEHOLDER_*` with the real IDs.
3. Set secrets via `wrangler secret put ANTHROPIC_API_KEY` (or `CLAUDE_CODE_OAUTH_TOKEN`), plus `GITHUB_TOKEN`, optional `FLEET_ENDPOINT`/`FLEET_TOKEN`/`BANKR_LLM_KEY`.
4. Implement Phase 1 of the session prompt (heartbeat parity). Comparison harness validates.
5. `wrangler deploy`.
6. Add one skill with `runtime: workers` to `aeon.yml`. Watch it run on Workers cron.
7. Iterate through phases.

## Trade-offs vs Actions

| | Workers | Actions |
|---|---|---|
| Cold start | 5–50ms | 30–90s |
| Cron precision | second-accurate | 5–15min drift |
| CPU per request | 30s (subrequest), longer with waitUntil | 6h |
| Cost on public repo | $5/mo + per-request | $0 |
| Cost on private repo | ~$5–20/mo for typical fleet | $0.008/min over plan budget |
| Sandbox quirks | None — JS runtime | curl env-var + outbound network gotchas |
| `claude -p -` available | No (use Anthropic SDK) | Yes |
| Fork-friendly | Operator needs Cloudflare account | Just git fork |

For most operators: hybrid (most skills on Actions, latency-sensitive skills on Workers) is the right answer.

## Related docs

- [`runtime.md`](runtime.md) — what this mirrors.
- [`skills.md`](skills.md) — skill prose is the same on both runtimes.
- [`memory.md`](memory.md) — what the batched commit pattern preserves.
- [`../05-SECURITY.md`](../05-SECURITY.md) — Workers binding model + secret handling.
- [`../09-EXPANSION-OPTIONS.md`](../09-EXPANSION-OPTIONS.md) § Option #1 — full PoC sketch.
- [`../_session-prompts/session-01-cloudflare-runtime.md`](../_session-prompts/session-01-cloudflare-runtime.md) — full session prompt.
- [`../../../workers-runtime/README.md`](../../../workers-runtime/README.md) — activation runbook.
