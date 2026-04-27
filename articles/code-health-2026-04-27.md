# Code Health Report — 2026-04-27

Window: weekly cadence. Prior run: 2026-04-25 (`articles/code-health-2026-04-25.md`). Watched repos audited: 1.

## aaronjmars/aeon

- HEAD: `46a7a24` "feat: contributor-reward — turn fork-contributor-leaderboard into a tier-priced rewards plan (#144)" (2026-04-26)
- Delta vs prior run: **1 commit, 2 files, +255/-0 lines.** PR #144 added `skills/contributor-reward/SKILL.md` (254 lines, new skill spec — markdown only) and added one schedule line to `aeon.yml`. Zero TypeScript / JavaScript / Python / Bash runtime code changed since 2026-04-25.
- Skills directory: 103 entries (+2 vs prior; `contributor-reward` from #144 plus one other directory entry not previously counted).
- Source files scanned: 60 (`*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.py`, `*.sh`), excluding `node_modules/`, `.git/`, `.next/`, `dist/`.

### TODOs / FIXMEs / HACK / XXX (0 genuine markers)

Re-ran `grep -rn 'TODO|FIXME|HACK|XXX'` over `*.{ts,tsx,js,jsx,py,sh}`. Single match in source code: `skills/skill-health/tests/smoke.sh:205` — the regex pattern that *detects* placeholders inside SKILL.md files. False positive, identical to last run.

All other matches sit in skill markdown files describing the markers (`skills/repo-actions/SKILL.md`, `skills/create-skill/SKILL.md`, `skills/deploy-prototype/SKILL.md`, `skills/code-health/SKILL.md`, `workflows/code-health.md`) — documentation, not code.

Result: **clean.**

### Secrets in code (0 findings)

- No matches for `sk_live`, `sk_test`, `ghp_`, `gho_`, `ghs_`, `xoxb-`, `xoxp-`, `AIza`, `AKIA`, `hf_` patterns.
- No `(api[_-]?key|secret|password|token|bearer)\s*[:=]\s*['"][a-zA-Z0-9_\-]{20,}['"]` matches.
- All env-var reads in `a2a-server/`, `dashboard/lib/github.ts`, `dashboard/app/api/skills/route.ts`, `dashboard/lib/config.ts` remain reads only.

Result: **clean.**

### Test coverage (unchanged, still the dominant gap)

Test artifacts:

- `skills/skill-health/tests/smoke.sh` — 321 lines of bash assertions over SKILL.md frontmatter and placeholder bans. Validates skill *contents*, not runtime code.
- `examples/mcp/test_connection.py` — sample MCP client smoke. Example, not coverage.

Test artifacts not present:

- `dashboard/` — Next.js app, 18 API routes + 14 React components + 7 lib modules. **No `test` script in `package.json`. Zero unit or integration tests.**
- `a2a-server/` — 578-line JSON-RPC + SSE gateway. **No `test` script. Zero tests.**
- `mcp-server/` — 224-line MCP entry point. **No `test` script. Zero tests.**

Same finding as 2026-04-25. PR #144 added zero coverage and was not expected to (it shipped a markdown skill spec). The recommendation from last week — Vitest setup on `dashboard/`, unit suite on `a2a-server/` JSON-RPC dispatcher — is unaddressed and remains the single highest-leverage health action.

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

No files crossed the 500 threshold this week. No files near the threshold grew measurably (PR #144 did not touch any of them).

### Type escape hatches

`dashboard/lib/config.ts` still contains the three `as any` casts on the `yaml` AST surface flagged 2026-04-25. Untouched this week. Tightening to `YAMLMap` / `Pair` types remains a 10-line cleanup.

No `@ts-ignore`, `@ts-nocheck`, or `eslint-disable` directives anywhere in the TypeScript tree.

### Dead code / commented-out blocks (0)

Grep for `^\s*//\s*(if|for|while|return|const|let|var|function|import|export|await)\s` over `dashboard/**/*.{ts,tsx}` returned zero matches. Block-comment hits in `dashboard/lib/{config,memory}.ts` are JSDoc, not commented-out code.

### Concerns

1. **Test coverage on `dashboard/`, `a2a-server/`, `mcp-server/` is still zero.** Identical to last week. The dashboard exposes a secrets API (`dashboard/app/api/secrets/route.ts`) and a memory CRUD layer over the filesystem (`dashboard/lib/memory.ts`, 308 lines) without a single regression test. This is the load-bearing risk and it has not moved.
2. **No new skill spec includes a smoke or eval hook.** `skills/contributor-reward/SKILL.md` (added in #144) writes to `memory/distributions.yml` and depends on idempotency state in `memory/state/contributor-reward-state.json` — exactly the kind of stateful, money-adjacent skill that benefits from at least a `skill-evals` entry. Worth flagging to the operator alongside the broader test-infra gap.
3. **`as any` casts in `dashboard/lib/config.ts:163,174,184`** unchanged. Cosmetic, deferrable.

### Recommendations

1. **Land the Vitest scaffold on `dashboard/`** with `lib/memory.ts` and `lib/config.ts` as the first two specs. These are pure filesystem and YAML transforms — easiest possible foothold and the one most directly tied to operator-visible behavior. This is the same recommendation as 2026-04-25; restating because it is the single highest-leverage code-health action and remains unstarted.
2. **Add a unit suite to `a2a-server/`** for `handleTasksSend`, `handleTasksGet`, `handleTasksCancel`, `rpcError`. Pure functions over `Record<string, unknown>`; trivial fixtures.
3. **Add a `skill-evals` line for `contributor-reward`** before the first scheduled Monday run (2026-04-27 09:30 UTC has already passed; first run will fire 2026-05-04 09:30 UTC). Catches state-key collisions, malformed leaderboard inputs, dry-run vs live divergence.
4. **Defer the three `as any` cleanup and the `a2a-server/index.ts` split** until tests exist. Both are safe-looking refactors that become silent breakage without a regression net.

### Sources

- Local clone of aaronjmars/aeon@`46a7a24` at `/home/runner/work/aeon/aeon/.audit-tmp/`.
- Greps over `*.{ts,tsx,js,jsx,py,sh}`, excluding `node_modules/`, `.git/`, `.next/`, `dist/`.
- Line counts via `wc -l`.
- PR delta via `gh api repos/aaronjmars/aeon/pulls/144/files`.

---

**CODE_HEALTH_OK** — 1 repo audited, 0 TODO markers, 0 secrets, 1 file >500 lines (unchanged), 3 `as any` casts (unchanged), test coverage gap on dashboard/a2a-server/mcp-server unchanged from 2026-04-25 and remains P1.
