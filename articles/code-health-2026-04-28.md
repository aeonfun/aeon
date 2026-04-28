# Code Health Report — 2026-04-28

Window: weekly cadence. Prior runs: 2026-04-25 (`articles/code-health-2026-04-25.md`), 2026-04-27 (`articles/code-health-2026-04-27.md`). Watched repos audited: 1.

## aaronjmars/aeon

- HEAD: `4782c4a` "feat(heartbeat): add Token Pulse section to public status page (#146)" (2026-04-28)
- Delta vs prior run (`46a7a24`): **2 commits, 4 files, +105/-3 lines, all markdown.**
  - PR #145 (`2774f7f`, 2026-04-27): `README.md` +2/-0, `SHOWCASE.md` +72/-0.
  - PR #146 (`4782c4a`, 2026-04-28): `docs/status.md` +6/-2, `skills/heartbeat/SKILL.md` +25/-1.
- Runtime code touched: **zero**. No `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.py`, or `*.sh` changes since 2026-04-26.
- Source files scanned: 60 (`*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.py`, `*.sh`), excluding `node_modules/`, `.git/`, `.next/`, `dist/`. Unchanged.
- Skills directory: 103 entries. Unchanged.

### TODOs / FIXMEs / HACK / XXX (0 genuine markers)

`grep -rEn 'TODO|FIXME|HACK|XXX'` over `*.{ts,tsx,js,jsx,py,sh}` returns three matches, all false positives identical to 2026-04-25:

- `skills/skill-health/tests/smoke.sh:205` — regex pattern that *detects* placeholders inside SKILL.md files.
- `scripts/postprocess-admanage.sh:143` and `scripts/postprocess-admanage-create.sh:182` — `mktemp -t admanage-result.XXXXXX.md` template tokens (mktemp requires literal `XXXXXX`).

Result: **clean.**

### Secrets in code (0 findings)

Two pattern sets, both empty:

1. Provider tokens — `sk_live`, `sk_test`, `ghp_…`, `gho_…`, `ghs_…`, `xoxb-…`, `xoxp-…`, `AIza…`, `AKIA…`, `hf_…`. No matches.
2. Generic credential pattern — `(api[_-]?key|secret|password|token|bearer)\s*[:=]\s*['"][A-Za-z0-9_-]{20,}['"]`. No matches.

All `process.env.*` reads in `a2a-server/`, `dashboard/lib/github.ts`, `dashboard/app/api/skills/route.ts`, `dashboard/lib/config.ts` remain reads only. **Clean.**

### Test coverage (unchanged — still the dominant gap, four weeks running)

Test artifacts present:

- `skills/skill-health/tests/smoke.sh` (321 lines) — bash assertions over SKILL.md frontmatter and placeholder bans. Validates skill *contents*, not runtime code.
- `examples/mcp/test_connection.py` — sample MCP client smoke. Example, not coverage.

Test artifacts absent (verified directly against `package.json`):

| Bundle | Lines | `package.json` scripts | Tests |
|---|---:|---|---|
| `dashboard/` | 18 API routes + 14 components + 7 lib modules | `dev`, `build`, `start` | **none** |
| `a2a-server/` | 578-line JSON-RPC + SSE gateway | `build`, `start`, `dev` | **none** |
| `mcp-server/` | 224-line MCP entry point | `build`, `dev`, `start` | **none** |

Identical finding to 2026-04-25 and 2026-04-27. PRs #145 and #146 added zero coverage and were not expected to (both are markdown-only). The recommendation — Vitest scaffold on `dashboard/`, unit suite on `a2a-server/` — is now three weeks unaddressed and remains the single highest-leverage code-health action.

### Large files (1 over 500 lines, unchanged)

| File | Lines | Verdict |
|---|---:|---|
| `a2a-server/src/index.ts` | 578 | Unchanged. Borderline. Same caveat: split only after unit tests land. |
| `skills/skill-health/tests/smoke.sh` | 321 | Test code. Acceptable. |
| `skills/skill-security-scan/scan.sh` | 318 | Single-purpose. Acceptable. |
| `dashboard/lib/memory.ts` | 308 | At threshold. Acceptable. |
| `dashboard/components/ui/TargetCursor.tsx` | 287 | Acceptable. |
| `mcp-server/src/index.ts` | 224 | Acceptable. |
| `dashboard/lib/github.ts` | 217 | Acceptable. |

No file crossed the 500 threshold. None grew measurably (no PR touched them).

### Type escape hatches

`grep -rEn '\bas any\b'` returns **2** hits, not 3 as last week's report stated:

- `dashboard/lib/config.ts:163` — `(entry as any).flow = true`
- `dashboard/lib/config.ts:174` — `items.splice(fallbackIdx, 0, pair as any)`

The "third cast" cited at line 184 in the 2026-04-27 report is `function getMapValue(map: any, key: string)` — a parameter type annotation, not a cast. Last week's count was off by one. The two real `as any` casts on the `yaml` AST surface remain. ~10-line cleanup; deferrable.

`@ts-ignore`, `@ts-nocheck`, `eslint-disable`: **0 hits anywhere in the TypeScript tree.**

### Dead code / commented-out blocks (0)

Grep for `^\s*//\s*(if|for|while|return|const|let|var|function|import|export|await)\s` over `*.{ts,tsx,js}`: zero matches. Block-comment hits are JSDoc only.

`console.log` / `debugger` leftovers in `*.{ts,tsx,js}`: zero matches.

### Open security finding from 2026-04-27 — STILL UNPATCHED

`dashboard/app/api/secrets/route.ts:96` continues to read:

```ts
execSync(`gh secret set ${name} -b "${value.replace(/"/g, '\\"')}"`, { ... })
```

`name` is regex-validated by `VALID_SECRET_NAME` (safe). The secret `value` is interpolated into the shell command with only `"` escaped — backticks, `$(…)`, and `\` survive. A value containing `` `whoami` `` or `$(curl evil)` would execute on the host running the dashboard. The dashboard is operator-local so exposure is bounded; this is defense-in-depth, not an exploitable production hole.

The fix pattern already exists in this codebase: `dashboard/app/api/auth/route.ts:46` uses `execSync(\`gh secret set ${secretName}\`, { input: ... })` (stdin) and avoids the shell escape entirely. Two-line rewrite, no new dependencies.

This finding was first reported in the 2026-04-27 addendum and has not been filed under `memory/issues/`. The `code-health` skill is not on the issue-filer allowlist (per `CLAUDE.md`: only `skill-health`, `skill-evals`, `heartbeat`, `self-review` file issues), so the recommendation is for `skill-security-scan` to pick this up under a fresh `ISS-016` on its next run, with `severity: medium`, `category: quality-regression`, `affected_skills: [dashboard/app/api/secrets/route.ts]`.

### Concerns

1. **Test coverage on `dashboard/`, `a2a-server/`, `mcp-server/` remains zero.** Three consecutive weekly reports have flagged this. The dashboard exposes a secrets API and a memory CRUD layer over the filesystem (`dashboard/lib/memory.ts`, 308 lines) without a single regression test. Load-bearing risk; has not moved.
2. **`secrets/route.ts:96` shell-injection vector still unpatched** ~24 hours after first report. Not exploitable in practice but the fix is trivial and the right pattern is already in the same file tree.
3. **2026-04-27 report miscounted `as any` casts** — small but worth flagging for the running tally; actual count is 2, not 3.
4. **Two heartbeat-adjacent SKILL.md changes (#146)** added markdown-only logic. No skill-evals coverage was added for the new Token Pulse section. Same pattern as #144 (`contributor-reward`) flagged last week — new skills shipping without an evals hook.

### Recommendations

1. **Land the Vitest scaffold on `dashboard/`** with `lib/memory.ts` and `lib/config.ts` as the first two specs. Same recommendation as 2026-04-25 and 2026-04-27. Restating because it remains the single highest-leverage health action and is now three weeks unstarted.
2. **Patch `dashboard/app/api/secrets/route.ts:96`** to mirror `auth/route.ts:46` — pass `value` via `input:` rather than shell-quoting. Two-line change. File `ISS-016` from `skill-security-scan` to track.
3. **Add a `skill-evals` line for `heartbeat`** (specifically for the Token Pulse section added in PR #146) and for `contributor-reward` (still missing from last week). Both touch state files (`memory/distributions.yml`, `metrics.json`) and benefit from regression coverage.
4. **Tighten `dashboard/lib/config.ts:163,174`** to `YAMLMap` / `Pair` types from `yaml`. Cosmetic. Defer until tests exist.
5. **Defer the `a2a-server/index.ts` split** until a unit suite is in place.

### Sources

- Local clone of aaronjmars/aeon@`4782c4a` at `/home/runner/work/aeon/aeon/.audit-tmp/aeon/`.
- Greps over `*.{ts,tsx,js,jsx,py,sh}`, excluding `node_modules/`, `.git/`, `.next/`, `dist/`.
- Line counts via `wc -l`. PR deltas via `gh api repos/aaronjmars/aeon/pulls/{145,146}/files`.
- `package.json` script blocks read directly from `dashboard/`, `a2a-server/`, `mcp-server/`.

---

**CODE_HEALTH_OK** — 1 repo audited, 0 TODO markers, 0 secrets, 1 file >500 lines (unchanged), 2 `as any` casts (corrected from 3), test coverage gap unchanged from 2026-04-25/27 and remains P1, `secrets/route.ts:96` shell-injection vector still unpatched and recommended for `ISS-016`.
