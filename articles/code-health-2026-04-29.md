# Code Health Report — 2026-04-29

Repos audited: `aaronjmars/aeon` (HEAD `e26e7a2`, depth-1 clone).

## aaronjmars/aeon

### TODOs (1 found)

| File:Line | Text |
|-----------|------|
| `skills/workflow-security-audit/SKILL.md:36` | `# TODO: bump ZIZMOR_VERSION to the latest stable on the next audit of this skill.` |

The other 50+ literal `TODO`/`FIXME` matches across the tree are documentation strings (skills referencing the concept of TODOs as a grep target, regex tokens in `evals.json` forbidden_patterns lists, audit prompts in `repo-actions`/`repo-scanner`/`external-feature`). Not actual carry-debt in code.

### Concerns

**1. Shell injection in `dashboard/app/api/secrets/route.ts:96` — STILL UNPATCHED.**

```ts
execSync(`gh secret set ${name} -b "${value.replace(/"/g, '\\"')}"`, { ... })
```

`name` is regex-validated (`/^[A-Z][A-Z0-9_]{1,}$/`, OK). `value` is only quote-escaped — backticks `` ` ``, `$(…)` command substitution, and unescaped backslashes still reach the shell. A POST with `value = "x`whoami`"` runs the inner command on the dashboard host. First flagged 2026-04-27 in the push-recap; logged again in the 2026-04-28 dashboard digest; **still unpatched as of HEAD `e26e7a2`**. Fix: drop the template string, pass the value via stdin (`{ input: value }`) or argv (`spawnSync('gh', ['secret', 'set', name], { input: value })`). The same file's `DELETE` path (line 119) is safe because `name` is regex-validated.

**2. Zero unit/integration tests for the dashboard.**

Glob `**/*.{test,spec}.{ts,tsx,js}` returns nothing. The Next.js dashboard ships 14 API routes (`dashboard/app/api/**/route.ts`) and 12 components (`dashboard/components/*.tsx`) with no Jest/Vitest/Playwright coverage. The only "test" scaffolding in the repo is `skills/skill-health/tests/smoke.sh` (322 lines, validates skill markdown frontmatter) and `skills/skill-security-scan/scan.sh` (319 lines). Both are bash + ripgrep, not real test runners. Highest-value tests to write first: `dashboard/lib/memory.ts` `safeJoin` (path-traversal guard), `dashboard/lib/config.ts` `addSkillToConfig` (yaml mutation), and the `secrets` POST handler's input validation.

**3. Large file: `a2a-server/src/index.ts` (579 lines).**

Only file in the tree over 500 lines. A2A server bundles JSON-RPC parsing, RPC dispatch, body reading, and error handling in one module. Splitting `readBody`, `rpcError`/`rpcResult`, and the dispatcher into `lib/rpc.ts`, `lib/io.ts`, and a thin `index.ts` would cut review surface in half.

**4. Sandbox-required scripts referenced by skills but not in tree.**

| Missing script | Skills affected | Issue |
|----------------|-----------------|-------|
| `scripts/postprocess-notify.sh` | `notify` `.pending-notify/` queue (third-fallback path) | tracked, no ID |
| `scripts/prefetch-vuln-scanner.sh` | `vuln-scanner` | ISS-001 |
| `scripts/prefetch-reddit.sh` | `reddit-digest`, `reddit-monitor` | ISS-002, ISS-012 |
| `reply-maker)` case in `scripts/prefetch-xai.sh` | `reply-maker` | ISS-014 |

Same root cause across all four: skill needs a network fetch step that must run before Claude is sandboxed.

**5. `child_process.execSync` is used in 8 of 14 dashboard API routes.**

`auth`, `secrets`, `sync`, `outputs`, `analytics`, `runs/[id]/logs`, `runs`, `skills/[name]/run` — all shell out via template strings. Most validate the interpolated value (`/^\d+$/` for run IDs, `/^[a-z][a-z0-9-]*$/` for skill names, `JSON.stringify` for `var`/`model`). Only `secrets/route.ts:96` is exploitable today, but the pattern is one regex slip away from another vuln. Worth a refactor pass to use argv-form `spawnSync` everywhere — it's a 10-line helper that closes the whole class.

### Recommendations

1. **Patch `secrets/route.ts:96` this week.** One file, ~10-line diff. Already overdue by 2+ days.
2. **Add a test scaffold to `dashboard/`** — Vitest + one `safeJoin` and one `secrets` validation test. Establishes the baseline so subsequent PRs can extend it.
3. **Land the three missing prefetch/postprocess scripts** to clear ISS-001/002/012/014 — pure unblock, no design decisions.
4. **Consider an `execGh()` helper** in `dashboard/lib/` that wraps `spawnSync('gh', argv, opts)` so route handlers stop building shell strings.
5. **Split `a2a-server/src/index.ts`** when the next feature touches it — not urgent on its own.

## Summary

- Audited `aaronjmars/aeon` HEAD `e26e7a2`, 1 watched repo.
- 1 real code TODO (`workflow-security-audit/SKILL.md:36`).
- 1 critical unpatched issue: shell-injection at `dashboard/app/api/secrets/route.ts:96` (third week running).
- Dashboard has zero unit tests; 8/14 API routes shell out via template strings (only `secrets` POST is exploitable today).
- 3 sandbox-required scripts still missing (ISS-001/002/012 + `postprocess-notify.sh`).
- 1 file over 500 lines: `a2a-server/src/index.ts` (579).
- No hardcoded secrets detected.
