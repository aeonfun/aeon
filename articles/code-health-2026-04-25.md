# Code Health Report — 2026-04-25

Window: weekly. First run for this repo. Watched repos audited: 1.

## aaronjmars/aeon

- HEAD: `8242d84` "feat(heartbeat): public status page at /status/ (#141)" (2026-04-24)
- Source files scanned: 261 (`*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.py`, `*.sh`, `*.go`, `*.rs`, `*.sol`), excluding `node_modules/` and `.git/`.
- Skills directory: 101 entries.

### TODOs / FIXMEs / HACK / XXX (0 genuine markers found)

Zero TODO/FIXME/HACK markers in actual code paths. All raw matches are false positives:

- `skills/skill-health/tests/smoke.sh:205`, `skills/skill-evals/evals.json` (15 lines), `scripts/eval-audit:207` — lint patterns *detecting* these markers in skill files; not the markers themselves.
- `skills/schedule-ads/config.example.yaml:22-25,43,71-73`, `skills/create-campaign/config.example.yaml:14-19` — `XXXXXXXXXXXXXXX` placeholders for operator-supplied IDs (Meta ad-account, page, Instagram, audience). Documented placeholders, not stale code.
- `scripts/postprocess-admanage.sh:143`, `scripts/postprocess-admanage-create.sh:182` — `mktemp -t admanage-result.XXXXXX.md` template placeholders (mandatory `XXXXXX` for mktemp).
- `skills.json:113` — the code-health skill's own description string.

Result: **clean.**

### Secrets in code (0 findings)

- No matches for `sk-…`, `ghp_…`, `xox[bp]-…`, or `AKIA…` patterns.
- No `(api_key|secret|token|password)\s*[:=]\s*['"]<long-string>['"]` patterns.
- All `process.env.*` usages (a2a-server, dashboard `lib/github.ts`, dashboard `app/api/skills/route.ts`) are reads only.
- No "DEMO_MODE", "TEMPORARY", "REMOVE ME", or "do not commit" markers.

Result: **clean.**

### Test coverage (single biggest gap)

Test artifacts in the repo:

- `skills/skill-health/tests/smoke.sh` — 321 lines of bash smoke checks across SKILL.md fields (frontmatter, sentinels, placeholder bans). Covers skill *contents*, not runtime code.
- `examples/mcp/test_connection.py` — 86-line smoke for the MCP example client.

Test artifacts not in the repo:

- `dashboard/` — Next.js app with 12 API routes + 13 React components + 8 lib modules. **Zero tests, no `test` script in `package.json`.**
- `a2a-server/` — 578-line JSON-RPC server. **No tests, no `test` script.**
- `mcp-server/` — 224-line MCP entry point. **No tests, no `test` script.**

The three TypeScript bundles that ship Aeon's external surface (HTTP, JSON-RPC, MCP) have no automated unit or integration coverage. Smoke tests on SKILL.md content are not a substitute.

### Large files (1 over 500 lines)

| File | Lines | Verdict |
|---|---:|---|
| `a2a-server/src/index.ts` | 578 | Borderline. Single coherent JSON-RPC + SSE server with clear sections. Pre-split it would benefit from unit tests around `handleTasksSend`/`handleTasksGet`/`rpcError`. |
| `skills/skill-health/tests/smoke.sh` | 321 | Test code, not application. Acceptable. |
| `skills/skill-security-scan/scan.sh` | 318 | Single-purpose security scanner. Acceptable. |
| `dashboard/lib/memory.ts` | 308 | Memory-file CRUD over the filesystem. At threshold. |
| `mcp-server/src/index.ts` | 224 | Acceptable. |
| `dashboard/lib/github.ts` | 217 | Acceptable. |

### Type escape hatches (low-priority)

`dashboard/lib/config.ts:163,174,184` — three `as any` casts when manipulating the `yaml` AST (`(entry as any).flow = true`, `pair as any`, `map: any`). The `yaml` library exposes the right types (`Document`, `YAMLMap`, `Pair`); these can be tightened.

Beyond this, no `@ts-ignore`, no `@ts-nocheck`, no `eslint-disable` directives anywhere in the TypeScript tree. Code is clean.

### Dead code / commented-out blocks (0)

Grep for commented-out statements (`^\s*//\s*(const|let|var|function|if|for|while|return|import|export|class)`) returned zero matches across all TS/JS/JSX/TSX. Repo has no obvious dead code.

### Concerns

1. **Test coverage on the three runtime bundles is zero.** This is the single load-bearing gap. The dashboard ships a credentials/secrets API (`dashboard/app/api/secrets/route.ts`, 125 lines) and a memory CRUD layer (`dashboard/lib/memory.ts`, 308 lines) without a single regression test.
2. **`a2a-server/src/index.ts` at 578 lines.** Not urgent to split, but unit tests around the JSON-RPC dispatcher should land before any further growth.
3. **`as any` casts in `dashboard/lib/config.ts`.** Cosmetic, but the YAML AST surface is well-typed and three casts can become zero in a 10-line patch.

### Recommendations

1. **Add a Vitest setup to `dashboard/`** with a `"test"` script and start with the pure utilities — `lib/memory.ts`, `lib/config.ts` (YAML add-skill round-trip), `lib/github.ts`. These are filesystem and string transforms; test coverage here is cheap and high-value.
2. **Add a unit test suite to `a2a-server/`** for `handleTasksSend`, `handleTasksGet`, `handleTasksCancel`, and `rpcError`. The handlers are pure functions over `Record<string, unknown>` — trivial to fixture.
3. **Tighten `dashboard/lib/config.ts:163,174,184`** to the `yaml` library's exported types (`YAMLMap`, `Pair`). Drop all three `as any`.
4. **Defer `a2a-server` split** until after (2). Splitting before tests risks behavior drift.

Out of scope here, already filed elsewhere: `.github/dependabot.yml` is the top recommendation in today's `repo-actions` run (`articles/repo-actions-2026-04-25.md`). Not re-surfacing.

### Sources

- Local clone of aaronjmars/aeon@8242d84 at `/home/runner/work/aeon/aeon/.repo-audit/`.
- Greps over `*.{ts,tsx,js,jsx,py,sh,go,rs,sol}`, excluding `node_modules/` and `.git/`.
- Line counts via `wc -l`.

---

**CODE_HEALTH_OK** — 1 repo audited, 0 TODO markers, 0 secrets, 1 file >500 lines, 3 `as any` casts, test coverage gap on dashboard/a2a-server/mcp-server flagged as P1.
