# workers-runtime — Aeon on Cloudflare Workers (Session 01 scaffold)

Cloudflare Workers + Durable Objects + Cron Triggers as an **alternative** runtime for Aeon skills. Runs alongside (not replacing) the GitHub Actions runtime. Operators choose per-skill via `runtime:` field in `aeon.yml`.

> **Status:** Scaffold inside the Sealed Sprint (Session 01, 2026-05-26). Structure + bindings + Durable Object skeleton in place. The 21-step pipeline is a PLACEHOLDER — its shape is documented; implementation is multi-week post-seal work.

---

## Why

Per [`../docs/contributor-dossier/09-EXPANSION-OPTIONS.md`](../docs/contributor-dossier/09-EXPANSION-OPTIONS.md) § Option #1:

| Pain point on GitHub Actions | Workers solution |
|---|---|
| 30–90s cold start per skill run | ~5–50ms cold start |
| 5–15min cron drift | Cron Triggers reliable to the second |
| Empirical sandbox quirks (env var expansion, curl behavior) | JS runtime fully under our control |
| No persistent connections | Durable Objects + native WebSocket |
| Inline Haiku scoring tax | Workers AI free at low volume |
| Polling-based Telegram | Webhook + Cron native |

Cost shift: at 1000 runs/day on private repos, Actions ≈ $24/day; Workers ≈ $0.05/day compute (Anthropic token cost is identical in both).

## Layout

```
workers-runtime/
├── wrangler.jsonc          ← bindings: KV, D1, R2, DO, Workers AI
├── package.json            ← Anthropic SDK + Octokit + wrangler
├── src/
│   ├── index.ts            ← HTTP entry + scheduled entry + SkillRunner DO (SCAFFOLD)
│   ├── pipeline/           ← the 21 steps (FUTURE)
│   ├── memory.ts           ← KV/D1/R2 reads + Octokit batch commits (FUTURE)
│   ├── notify.ts           ← Telegram/Discord/Slack/Email (FUTURE)
│   ├── fleet-watcher.ts    ← preflight/postflight client (FUTURE)
│   └── gateway.ts          ← Anthropic SDK + Bankr router (FUTURE)
├── prefetch/               ← TypeScript port of scripts/prefetch-*.sh (FUTURE)
├── postprocess/            ← TypeScript port of scripts/postprocess-*.sh (FUTURE)
├── __tests__/              ← Vitest specs + comparison harness (FUTURE)
└── README.md               ← this file
```

## Activation (post-seal, multi-week work)

The seal blocks deployment. Once broken, the high-level plan from [`../docs/contributor-dossier/_session-prompts/session-01-cloudflare-runtime.md`](../docs/contributor-dossier/_session-prompts/session-01-cloudflare-runtime.md):

### Phase 1 — Heartbeat parity (weeks 1–2)
- Operator creates Cloudflare account; runs `wrangler kv:namespace create CRON_STATE`, etc., replaces PLACEHOLDERs in wrangler.jsonc.
- Implement `pipeline/run.ts` minimum to execute `heartbeat`.
- Comparison harness: same skill, both runtimes, diff outputs.

### Phase 2 — aeon.yml integration + 5 ported skills (weeks 3–4)
- Add `runtime:` field to aeon.yml schema.
- Dispatcher in messages.yml respects the field.
- Port `token-alert`, `token-movers`, `github-trending`, `morning-brief`, `digest`.

### Phase 3 — Sandbox patterns ported (weeks 5–6)
- TypeScript modules in `prefetch/` and `postprocess/`.
- Port `prefetch-xai`, `postprocess-devto`, `postprocess-replicate`, etc.

### Phase 4 — Dashboard + docs + cutover (weeks 7+)
- Dashboard "Run skill" gains `?runtime=workers|actions`.
- Decision log: which skills genuinely benefit from Workers.

## What's intentionally NOT in this scaffold

- The pipeline implementation (just stubs + comments).
- The MCP / A2A surfaces (they stay shelling to local `claude -p -`; they're an operator's-machine concern).
- The dashboard port to Cloudflare Pages (separate session).
- Skill prose translation (no skill modifications; skills are runtime-agnostic).

## Related docs

- [`../docs/contributor-dossier/03-subsystems/runtime-cloudflare.md`](../docs/contributor-dossier/03-subsystems/runtime-cloudflare.md) — full subsystem doc (this Session 01 ships it).
- [`../docs/contributor-dossier/03-subsystems/runtime.md`](../docs/contributor-dossier/03-subsystems/runtime.md) — what this mirrors (GitHub Actions runtime).
- [`../docs/contributor-dossier/09-EXPANSION-OPTIONS.md`](../docs/contributor-dossier/09-EXPANSION-OPTIONS.md) § Option #1 — original PoC sketch.
- [`../docs/contributor-dossier/_session-prompts/session-01-cloudflare-runtime.md`](../docs/contributor-dossier/_session-prompts/session-01-cloudflare-runtime.md) — full session prompt.
