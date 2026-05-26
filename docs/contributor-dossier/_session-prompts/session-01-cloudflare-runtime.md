# Session 01 — Cloudflare Runtime Port

> **Goal:** Stand up an alternative Aeon skill runtime on Cloudflare Workers + Durable Objects + Cron Triggers, running alongside (not replacing) GitHub Actions. Per-skill `runtime:` field in `aeon.yml` selects which one executes a given skill.
>
> **Effort:** 4–8 weeks across 4 phases.
> **Risk:** Medium — runtime divergence between Actions and Workers is the main hazard.
> **Author gate:** Yes — confirm alongside-vs-replacement posture before starting Phase 2.
> **Reference:** [`../09-EXPANSION-OPTIONS.md`](../09-EXPANSION-OPTIONS.md) § Option #1.

---

## The prompt to paste

```
You are implementing the Cloudflare Workers runtime port for the Aeon
framework. Read these dossier docs first, in order:
  - docs/contributor-dossier/01-ARCHITECTURE.md
  - docs/contributor-dossier/03-subsystems/runtime.md
  - docs/contributor-dossier/03-subsystems/skills.md
  - docs/contributor-dossier/03-subsystems/memory.md
  - docs/contributor-dossier/05-SECURITY.md
  - docs/contributor-dossier/09-EXPANSION-OPTIONS.md (Option #1 section)

Your task: build a Cloudflare Workers runtime that executes Aeon skills
identically to the GitHub Actions runtime in .github/workflows/aeon.yml,
including the same 21 steps (skill validate, secret check, prefetch,
Fleet preflight, Claude call via SDK, quality scoring via Workers AI,
json-render conversion, notify, postprocess, Fleet postflight, commit
results, update cron-state).

Constraints:
  - Per-skill `runtime: "workers" | "actions"` field in aeon.yml. Default
    via top-level `default_runtime:`. Backward-compatible — skills without
    the field stay on actions.
  - Each Aeon instance can run either or both runtimes. Operators choose
    per-skill.
  - Memory writes accumulate in a per-skill staging buffer; commit to git
    via Octokit in batches (every N runs or M minutes — make N and M
    configurable). The git repo remains the source of truth.
  - Per-skill DurableObject ensures the same skill cannot run twice in
    parallel (matches the Actions concurrency: aeon-${skill} pattern).
  - 30s CPU limit per Worker subrequest is real; skills > 30s should be
    refused with a clear "use actions runtime" error.
  - All secrets injected as Workers bindings, NEVER returned to the
    browser, NEVER logged.

Out of scope:
  - Replacing the Actions runtime. Both must work simultaneously.
  - Touching skill prose. Skills are unchanged.
  - Dashboard rewrite — only add a runtime toggle.
  - MCP server / A2A gateway. They stay shelling to local `claude -p -`.

Operate in feature branches: expansion/cloudflare-runtime-*. Open one PR
per phase. Run ./scripts/doctor before requesting review.
```

---

## Punchlist

### Phase 1 — Scaffold + heartbeat parity (week 1–2)

- [ ] New directory `workers-runtime/` with `wrangler.jsonc`, `package.json`, `src/`.
- [ ] DurableObject `SkillRunner` skeleton.
- [ ] HTTP entry (`fetch`) for `POST /run?skill=<name>&var=<val>&model=<m>`.
- [ ] Cron entry (`scheduled`) that reads `aeon.yml`, matches against current time, dispatches due skills.
- [ ] Anthropic SDK integration. Single Claude call per skill.
- [ ] Workers AI integration for the Haiku quality scorer (replaces inline Haiku).
- [ ] Memory read via Octokit (raw files from git) with KV cache.
- [ ] Memory write to staging KV; flush worker commits batches via Octokit.
- [ ] `heartbeat` runs end-to-end on Workers. Output written, cron-state updated, notify fires.
- [ ] Comparison harness: same skill runs on Actions + Workers, outputs diffed.
- **Acceptance:** `heartbeat` Workers run produces identical output to an Actions run within ±5% byte size + identical exit-taxonomy marker.

### Phase 2 — `aeon.yml` integration + dispatcher (week 3–4)

- [ ] Schema extension: per-skill `runtime:` field; top-level `default_runtime:`.
- [ ] Dispatcher in `messages.yml` reads the field and routes correctly. Skills marked `runtime: "workers"` skip the Actions dispatch and instead trigger the Workers cron entry.
- [ ] Port 5 high-volume read-only skills: `token-alert`, `token-movers`, `github-trending`, `morning-brief`, `digest`.
- [ ] Per-runtime cost tracking: extend `memory/token-usage.csv` with a `runtime` column.
- [ ] Operator doc: `docs/contributor-dossier/03-subsystems/runtime-cloudflare.md` (new subsystem doc).
- **Acceptance:** 5 ported skills run on Workers daily for 1 week without divergence; cost tracking shows the expected delta.

### Phase 3 — Sandbox patterns on Workers (week 5–6)

- [ ] Pre-fetch pattern: ported as Worker-side TypeScript modules in `workers-runtime/prefetch/`. Each module exports `async function fetch(skill, var, env)`. Replaces `scripts/prefetch-*.sh` for skills running on Workers.
- [ ] Post-process pattern: same shape in `workers-runtime/postprocess/`.
- [ ] Port the `xai` prefetch and the `devto`, `replicate`, `farcaster`, `admanage` postprocesses.
- [ ] Each ported script has a smoke test in `workers-runtime/__tests__/`.
- **Acceptance:** All skills that previously required `scripts/prefetch-xai.sh` or postprocess scripts can run on either runtime; tests pass.

### Phase 4 — Dashboard + docs + cutover (week 7+)

- [ ] Dashboard "Run skill" button accepts `?runtime=workers|actions` query param. Surface which runtime each run used in the feed.
- [ ] Each skill's row in the dashboard shows preferred runtime.
- [ ] Operator migration doc: how to move a skill from Actions to Workers (and back).
- [ ] Decision log: which skills genuinely benefit from Workers (sub-second latency or chained-call patterns) vs which are happy on Actions (heavy / long / one-shot).
- [ ] Fleet Watcher preflight / postflight integration on Workers.
- [ ] Document the 30s CPU limit and how to detect skill incompatibility at registration time.
- **Acceptance:** A new operator can pick the runtime per skill via the dashboard without reading source. Documentation matches behavior.

---

## Files touched

| Path | Action |
|---|---|
| `workers-runtime/` | New directory |
| `workers-runtime/wrangler.jsonc` | New — D1, KV, R2, DO bindings |
| `workers-runtime/package.json` | New |
| `workers-runtime/src/{index,skill-runner,memory,notify,fleet-watcher,gateway}.ts` | New |
| `workers-runtime/prefetch/*.ts` | Ported from `scripts/prefetch-*.sh` |
| `workers-runtime/postprocess/*.ts` | Ported from `scripts/postprocess-*.sh` |
| `workers-runtime/__tests__/*.test.ts` | New |
| `aeon.yml` | Add `default_runtime:` + per-skill `runtime:` field (off by default) |
| `.github/workflows/messages.yml` | Skip Actions dispatch for `runtime: workers` skills |
| `dashboard/app/api/skills/[name]/run/route.ts` | Accept and forward `runtime` param |
| `dashboard/components/SkillCard.tsx` | Show preferred runtime |
| `docs/contributor-dossier/03-subsystems/runtime-cloudflare.md` | New subsystem doc |
| `docs/contributor-dossier/03-subsystems/runtime.md` | Cross-link to the new doc |

---

## Dependencies

- **Cloudflare account** with Workers Paid plan ($5/mo) — needed for Cron Triggers + DO + Workers AI quotas.
- **D1 database** for memory index hot paths.
- **KV namespace** for cron-state (hot reads/writes).
- **R2 bucket** for article gallery (optional; can defer).
- **Anthropic SDK** for `@anthropic-ai/sdk` package (replaces `claude -p -`).
- **Octokit** for GitHub API access.
- **Operator must add** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` as repo secrets.

---

## Out of scope

- Migrating MCP / A2A surfaces (they stay shelling to local `claude -p -`).
- Migrating the dashboard to Cloudflare Pages (separate session — could be a future Session 10).
- Replacing the Actions runtime. Backward-compatible always.
- Adding skills that don't already exist. Port-only, no greenfield.

---

## Risks

| Risk | Mitigation |
|---|---|
| Workers JS behaves differently from the Actions Node runner (timezone, locale, Node APIs) | Phase 1 comparison harness catches this. Document exceptions. |
| Skill prose embeds bash tools (`curl`, `jq`) the Workers runtime can't shell to | Translate to fetch/JSON.parse equivalents inside the runtime. Document the boundary. |
| Git rate limits hit when committing memory every run | Batch commits — N runs OR M minutes, whichever first. Default N=10, M=15. |
| 30s CPU limit catches heavy skills | Hard fail at registration time, not at run time. Error message tells operator to use `runtime: actions`. |
| Operator confusion ("which runtime ran this?") | Dashboard surfaces it on every run row. Log entry includes `runtime: workers \| actions`. |
| Cost surprise from Workers AI Haiku scoring | Document expected cost; expose `quality_scorer: workers-ai \| haiku-api` setting per instance. |

---

## Doctor check

After the session, the contributor should be able to run:

```bash
./scripts/doctor
```

And see:

- ✓ `workers-runtime/__tests__` smoke green
- ✓ `aeon.yml` has at least one skill with `runtime: workers`
- ✓ That skill has run successfully in the last 24h (cron-state shows it)
- ✓ Diff harness shows no divergence vs Actions for the same skill on the same day

---

## Related dossier docs

- [`../03-subsystems/runtime.md`](../03-subsystems/runtime.md) — what's being mirrored
- [`../03-subsystems/skills.md`](../03-subsystems/skills.md) — the contract that doesn't change
- [`../03-subsystems/memory.md`](../03-subsystems/memory.md) — how memory writes work today
- [`../05-SECURITY.md`](../05-SECURITY.md) — Workers binding model, secret handling
- [`../09-EXPANSION-OPTIONS.md`](../09-EXPANSION-OPTIONS.md) § Option #1 — full PoC sketch
