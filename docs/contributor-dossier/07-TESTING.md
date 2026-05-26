# Testing

What's tested today, what isn't, and the scaffolding we ship in this dossier to close the highest-leverage gaps.

---

## What exists today

Aeon's test surface is **runtime-and-fleet-level**, not unit-level. The framework relies on these for quality assurance:

| Layer | Skill | What it tests | When |
|---|---|---|---|
| **Output quality** | [`skill-evals`](../../skills/skill-evals/SKILL.md) | Per-skill assertions in `skills/skill-evals/evals.json`: word count, required/forbidden patterns, numeric bounds, staleness. Diff vs prior run flags `NEW_FAIL` / `FIXED` / `STILL_FAIL`. | Cron |
| **Run health** | [`skill-health`](../../skills/skill-health/SKILL.md) | Classifies each skill: `CRITICAL`/`DEGRADED`/`FLAPPING`/`WARNING`/`HEALTHY`/`NO_DATA`. Files issues. | Cron |
| **Coverage** | [`./scripts/eval-audit`](../../scripts/eval-audit) | Audits what fraction of enabled skills have evals defined. | On-demand or via `skill-evals` |
| **Batch coherence** | [`batch-health`](../../skills/batch-health/SKILL.md) | Did all scheduled skills fire in the morning window? | Daily 08:00 UTC |
| **Quality scoring** | Haiku post-step in [`aeon.yml:601-701`](../../.github/workflows/aeon.yml#L601-L701) | 1–5 quality score per run, rolling 30-run history. | Every skill run |
| **Workflow security** | [`workflow-security-audit`](../../skills/workflow-security-audit/SKILL.md) | zizmor + actionlint on `.github/workflows/*.yml`. | Cron |
| **Skill security** | [`skill-security-scan`](../../skills/skill-security-scan/SKILL.md) | Threat-pattern scan of `SKILL.md` + scripts. | On `./add-skill` install + cron |
| **Vulnerability** | [`vuln-scanner`](../../skills/vuln-scanner/SKILL.md) | Semgrep + TruffleHog + osv-scanner across watched repos. | Cron |
| **Drift** | [`skill-update-check`](../../skills/skill-update-check/SKILL.md) | Imported-skill drift vs `skills.lock`. | Cron |
| **Freshness** | [`skill-freshness`](../../skills/skill-freshness/SKILL.md) | Upstream-output staleness for chained skills. | Cron |

This is **strong at the runtime level** — Aeon will tell you when skills break in production. It's **weak at the code level** — there are no unit tests for the dashboard, the MCP server, the A2A gateway, the supply-chain scripts, or the skill format.

## What we ship to close the gap

Five test artifacts, scaffolded under [`docs/contributor-dossier/_tests-scaffold/`](_tests-scaffold/). Each one's intended final location is noted below. They are *scaffolds* — review them, decide on adoption, then move to the final paths and commit.

### 1. SKILL.md lint — `skills/_lint/skill-lint.sh`

**What it checks:**
- Frontmatter present, valid YAML.
- Required fields: `name`, `description` (≤90 chars), `var`, `tags`.
- `tags` from the fixed taxonomy: `content, crypto, dev, meta, news, research, social`.
- Max 3 tags.
- Var-documentation blockquote (`> **${var}** —`) present.
- `Today is ${today}.` task statement present.
- Numbered steps (`1. **Title.**`) present.
- `## Sandbox note` section present.
- Penultimate step starts with `**Log.**`.
- Final step starts with `**Notify.**` and references `./notify`.

**Scaffold:** [`_tests-scaffold/skill-lint.sh`](_tests-scaffold/skill-lint.sh) — bash + awk + grep. Zero dependencies. Returns non-zero on any failure with file:line:reason output.

**CI wiring:** add a step to `.github/workflows/aeon.yml` (or a new dedicated `lint.yml`) that runs `bash skills/_lint/skill-lint.sh` on every push touching `skills/`.

**Final location:** `skills/_lint/skill-lint.sh` + invoking step in `.github/workflows/lint.yml`.

---

### 2. Dashboard API-gate tests — `dashboard/__tests__/api-gate.test.ts`

**What it tests:** the [`dashboard/lib/security/api-gate.ts`](../../dashboard/lib/security/api-gate.ts) gate. This is the most security-critical code in the repo.

- Loopback variants accepted: `127.0.0.1`, `localhost`, `::1`, `[::1]`, `0.0.0.0`, each with arbitrary ports.
- Non-loopback rejected: `attacker.example`, `10.0.0.1`, `evil.localhost.com`.
- `AEON_DASHBOARD_ALLOWED_HOSTS` honored: `box.tail-xxx.ts.net,aeon.local` adds names without disabling defaults.
- `AEON_DASHBOARD_ALLOW_ANY_HOST=1` bypasses gate.
- Env var changes are picked up live (no caching).
- State-changing methods (POST/PUT/PATCH/DELETE) require Origin or Referer on allowlist; both missing → 403.
- Safe methods (GET/HEAD/OPTIONS) skip the Origin check entirely.
- Origin with bad URL → 403.
- Rejection responses are JSON with `error` field and a hint about the env-var hatches.

**Scaffold:** [`_tests-scaffold/api-gate.test.ts`](_tests-scaffold/api-gate.test.ts) — Vitest spec. Run with `cd dashboard && npx vitest run`.

**CI wiring:** new step `cd dashboard && npm test` in the dashboard workflow (or a unified `tests.yml`).

**Final location:** `dashboard/__tests__/api-gate.test.ts` + `vitest` added to `dashboard/package.json` devDependencies + `test` script.

---

### 3. MCP server smoke — `mcp-server/__tests__/smoke.ts`

**What it tests:** the built [`mcp-server/dist/index.js`](../../mcp-server/) responds to:

- `initialize` request.
- `tools/list` — returns N≥1 tools, all matching `aeon-*` naming.
- `tools/call` for a no-op skill (we use [`heartbeat`](../../skills/heartbeat/SKILL.md) since it has no var requirement and is safe to invoke).
- Error path: invalid tool name returns a proper MCP error.

Re-uses the structure of [`examples/mcp/test_connection.py`](../../examples/mcp/test_connection.py) but in TypeScript so it sits alongside the server.

**Scaffold:** [`_tests-scaffold/mcp-smoke.ts`](_tests-scaffold/mcp-smoke.ts) — uses `@modelcontextprotocol/sdk` to spawn the server, run the handshake, assert.

**CI wiring:** new step `cd mcp-server && npm run build && npm test` after the MCP server is built.

**Final location:** `mcp-server/__tests__/smoke.ts` + `vitest` in `mcp-server/package.json` + `test` script.

---

### 4. A2A gateway smoke — `a2a-server/__tests__/smoke.ts`

**What it tests:** the built [`a2a-server/dist/index.js`](../../a2a-server/) responds to:

- `GET /.well-known/agent.json` returns valid agent card with skills array.
- `POST /` with valid JSON-RPC `tasks/send` creates a task.
- `POST /` with invalid skill id returns a proper error.
- `POST /tasks/sendSubscribe` returns SSE stream that emits state changes.
- Eviction: after 1000 tasks created, oldest completed tasks pruned.

**Scaffold:** [`_tests-scaffold/a2a-smoke.ts`](_tests-scaffold/a2a-smoke.ts) — Vitest spec. Spawns the server on a random port, runs HTTP assertions.

**CI wiring:** parallel to MCP smoke.

**Final location:** `a2a-server/__tests__/smoke.ts` + `vitest` in `a2a-server/package.json` + `test` script.

---

### 5. Contributor doctor — `scripts/doctor`

**What it does:** one-command sanity check before a contributor opens a PR. Validates the developer's local state against the conventions.

Checks (per category):

- **`gh` CLI** — installed and authenticated.
- **`memory/cron-state.json`** — valid JSON.
- **`memory/MEMORY.md`** — exists.
- **`aeon.yml`** — valid YAML; every entry references a real `skills/<name>/SKILL.md`.
- **`skills.json`** — in sync with `SKILL.md` files (otherwise prompt to run `./generate-skills-json`).
- **`skills.lock`** — every imported skill has provenance.
- **`skills/_lint/skill-lint.sh`** — runs and passes.
- **Workflow files** — runs `actionlint` if available.
- **Dashboard / MCP / A2A** — `npm test` in each if changed.
- **Notify dry-run** — exercises `./notify` with `--dry-run` if you've staged a notify change.
- **Replay last skill run** — reads last log entry, summarizes status.

Output: a colored checklist with PASS / WARN / FAIL per check. Exit code 0 if no FAIL.

**Scaffold:** [`_tests-scaffold/doctor.sh`](_tests-scaffold/doctor.sh) — bash. Designed to be source-and-extend.

**Final location:** `scripts/doctor` (alongside other helper scripts). Invoke as `./scripts/doctor` from repo root.

---

## CI integration plan

Three workflows when fully adopted:

| Workflow | Triggers | Runs |
|---|---|---|
| `.github/workflows/lint.yml` (new) | Push to `skills/`, `aeon.yml`, `skills.json` | `skill-lint.sh`, `actionlint` on workflows, `aeon.yml` validation |
| `.github/workflows/test-runtime.yml` (new) | Push to `.github/workflows/`, `mcp-server/`, `a2a-server/`, `dashboard/` | Vitest in each affected package |
| `.github/workflows/aeon.yml` (existing) | Cron + dispatch + label | Skill execution (unchanged) |

For the dossier ship, we recommend introducing them as **non-blocking** (status checks but not required for merge) so the team can validate the test signal before making them gates.

---

## What we deliberately don't ship

- **Per-skill unit tests.** Skills are LLM prompts. `skill-evals` is the right surface for them — assertion-based output testing, not unit testing.
- **End-to-end pipeline tests.** Mocking GitHub Actions, mocking the LLM, mocking the notify channels — the test would prove the harness, not the code.
- **Full integration tests for `add-skill` / `install-skill-pack`.** They mutate the filesystem and call `gh`. The smoke surface here is the security scan itself, which we don't re-test (it's the upstream skill).
- **A test that catches "skill prose ignores `CLAUDE.md`."** That's an LLM-quality regression; `skill-evals` is the right surface.

---

## How to write tests for a new skill

When you ship a new skill, ship an eval alongside it:

1. **Add an entry to [`skills/skill-evals/evals.json`](../../skills/skill-evals/evals.json):**
   ```json
   "your-skill": {
     "output_pattern": "articles/your-skill-*.md",
     "max_age_hours": 28,
     "required_patterns": ["<thing it should always say>"],
     "forbidden_patterns": ["<failure indicator>"],
     "min_word_count": 200,
     "max_word_count": 2000,
     "quality_cross_check": "true"
   }
   ```

2. **Run it once** to produce a baseline output.

3. **Read your own assertion against the baseline.** Adjust until it's stable.

4. **Run `./scripts/eval-audit`** to confirm coverage_pct increased.

That's the entire eval contract for a new skill. No mocks, no fixtures, no fakers — your skill's actual output, judged against your own assertions, on a real cadence.

---

## What "the tests pass" means

| Signal | Means |
|---|---|
| `skill-lint.sh` exits 0 | Every `SKILL.md` follows the conventions. |
| `dashboard/__tests__` green | The security gate behaves correctly. (Most critical signal.) |
| `mcp-server/__tests__` green | MCP server handshake works; skills are discoverable. |
| `a2a-server/__tests__` green | A2A protocol shape is correct; task lifecycle works. |
| `./scripts/doctor` green | Your local state matches the project's expectations. |
| `skill-evals` reports `SKILL_EVALS_OK` | No output regressions vs last week. |
| `heartbeat` logs `HEARTBEAT_OK` | No failed / stuck / chronic skills. |
| `workflow-security-audit` quiet | No new workflow-security findings. |

These are seven distinct signals — none of them is a CI green-check on its own. Aeon's quality posture is the *intersection*.

---

## Related docs

- [`05-SECURITY.md`](05-SECURITY.md) — why the dashboard api-gate tests matter so much.
- [`06-IMPLEMENTATION-PATTERNS.md`](06-IMPLEMENTATION-PATTERNS.md) — what skill-lint enforces.
- [`03-subsystems/self-healing.md`](03-subsystems/self-healing.md) — the runtime-level test surface that already exists.
