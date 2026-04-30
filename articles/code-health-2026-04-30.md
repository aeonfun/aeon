# Code Health Report — 2026-04-30

Repos audited: `aaronjmars/aeon` (HEAD `f07d975`, depth-1 clone). Latest commit: `feat: thread-formatter skill — auto-format top daily event as 5-tweet thread (#148)` (2026-04-30 09:12 -0400).

## aaronjmars/aeon

### TODOs (1 found)

| File:Line | Text |
|-----------|------|
| `skills/workflow-security-audit/SKILL.md:36` | `# TODO: bump ZIZMOR_VERSION to the latest stable on the next audit of this skill.` |

Same single TODO carrying since the 2026-04-29 report. The other ~30 `TODO`/`FIXME` matches across the tree are documentation tokens (skills naming the concept as a grep target — `repo-actions/SKILL.md`, `code-health/SKILL.md`, `repo-scanner/SKILL.md`, `external-feature/SKILL.md`, `evals.json` `forbidden_patterns`, `skill-health/tests/smoke.sh:205` regex). No real carry-debt in code.

### Concerns

**1. Shell injection in `dashboard/app/api/secrets/route.ts:96` — STILL UNPATCHED, week 4.**

```ts
execSync(`gh secret set ${name} -b "${value.replace(/"/g, '\\"')}"`, { ... })
```

`name` is regex-validated (`/^[A-Z][A-Z0-9_]{1,}$/`, OK). `value` is only quote-escaped — backticks `` ` ``, `$(…)` command substitution, and `$VAR` expansion still reach the shell. POST `value = "x`whoami`"` runs the inner command on the dashboard host. First flagged 2026-04-27 in push-recap, again in 2026-04-28 dashboard digest, and in 2026-04-29 code-health. **Still unpatched as of HEAD `f07d975`.**

**The fix template is already in the same codebase** — `dashboard/app/api/auth/route.ts:46` does it correctly:

```ts
execSync(`gh secret set ${secretName}`, {
  input: key,                  // value via stdin, not template string
  stdio: ['pipe', 'pipe', 'pipe'],
})
```

`secretName` there is a hardcoded literal (`'CLAUDE_CODE_OAUTH_TOKEN'` or `'ANTHROPIC_API_KEY'`), and `gh secret set` reads the value from stdin. Mirror that pattern: drop the `-b "..."` flag, pipe `value` to stdin via `input: value`. ~10-line diff.

**2. Zero unit/integration tests for the dashboard.**

`Glob **/*.{test,spec}.{ts,tsx,js}` returns nothing. Only test directory in the tree is `skills/skill-health/tests/` (smoke.sh, 321 lines — bash + ripgrep, not a real test runner). Same as last week. Highest-value first tests: `dashboard/lib/memory.ts` `safeJoin` (path-traversal guard), `dashboard/lib/config.ts` `addSkillToConfig` (yaml mutation), `dashboard/app/api/secrets/route.ts` POST validation.

**3. Large file: `a2a-server/src/index.ts` (578 lines).**

One line trimmed since last week (was 579). Still the only file over 500 lines in the tree. JSON-RPC parsing, RPC dispatch, body reading, and error handling all bundled in one module. Recommended split (`lib/rpc.ts`, `lib/io.ts`, thin `index.ts`) is the same as last week — defer until the next feature touches it.

**4. Sandbox-required scripts referenced by skills but not in tree.**

| Missing script | Skills affected | Issue |
|----------------|-----------------|-------|
| `scripts/postprocess-notify.sh` | `notify` `.pending-notify/` queue (third-fallback path) | tracked, no ID |
| `scripts/prefetch-vuln-scanner.sh` | `vuln-scanner` | ISS-001 |
| `scripts/prefetch-reddit.sh` | `reddit-digest`, `reddit-monitor` | ISS-002, ISS-012 |
| `reply-maker)` case in `scripts/prefetch-xai.sh` | `reply-maker` | ISS-014 |

Same root cause across all four: skill needs a network fetch step that must run before Claude is sandboxed. Unchanged from 2026-04-29.

**5. `child_process.execSync` is used in 8 of 14 dashboard API routes.**

Routes using `execSync`: `auth`, `secrets`, `sync`, `outputs`, `analytics`, `runs/[id]/logs`, `runs`, `skills/[name]/run`. Most either use only hardcoded literals (`sync`, hardcoded `git status`/`git fetch origin main`/`git rev-list --count HEAD..origin/main`/`git push`/`git commit -m "..."`), or validate the interpolated value (`/^\d+$/` for run IDs, `/^[a-z][a-z0-9-]*$/` for skill names, then `JSON.stringify` for `var`/`model`).

Only `secrets/route.ts:96` is exploitable today. The pattern is one regex slip away from another vuln. An `execGh()` helper in `dashboard/lib/` that wraps `spawnSync('gh', argv, opts)` would close the whole class.

**6. Dependency / version hygiene — not blocked, but unscanned.**

No `npm audit`/`pip-audit`/`cargo audit` step in any workflow. `dashboard/package.json` and `a2a-server/package.json` are not pinned to lockfile-snapshotted versions in CI (no `npm ci` step in `aeon.yml` or `chain-runner.yml`). Worth a `vuln-scanner` follow-up once ISS-001 lands.

### Recommendations

1. **Patch `secrets/route.ts:96` this week.** Mirror `auth/route.ts:46` — pass `value` via `input:` stdin instead of template-string `-b`. ~10-line diff. Now overdue by ~3 days; same fix recommended in last week's report.
2. **Add a test scaffold to `dashboard/`** — Vitest + one `safeJoin` test and one `secrets` POST-validation test. Establishes the baseline so subsequent PRs can extend it.
3. **Land the three missing prefetch/postprocess scripts** to clear ISS-001/002/012/014 + `postprocess-notify.sh` — pure unblock, no design decisions.
4. **Build an `execGh()` helper** in `dashboard/lib/` so route handlers stop building shell strings at all. Migrate `secrets/route.ts:96` and `secrets/route.ts:119` first; remaining 6 routes follow.
5. **Split `a2a-server/src/index.ts`** when the next feature touches it — not urgent on its own.
6. **Wire `npm audit`** as a weekly workflow step (or a `vuln-scanner` skill case) once `prefetch-vuln-scanner.sh` lands.

## Summary

- Audited `aaronjmars/aeon` HEAD `f07d975`, 1 watched repo.
- 1 real code TODO (`workflow-security-audit/SKILL.md:36`) — same as last week.
- 1 critical unpatched issue: shell-injection at `dashboard/app/api/secrets/route.ts:96` (week 4 unpatched). The same codebase has the fix template at `auth/route.ts:46`.
- Dashboard has zero unit tests; 8/14 API routes shell out via `execSync`. Only `secrets` POST is exploitable today.
- 3 sandbox-required scripts still missing (ISS-001/002/012 + `postprocess-notify.sh` + `reply-maker)` case in `prefetch-xai.sh`).
- 1 file over 500 lines: `a2a-server/src/index.ts` (578, down from 579).
- No hardcoded secrets detected.
- No new dependency-vulnerability scanning step in CI.
