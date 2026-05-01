# Code Health Report — 2026-05-01

Repos audited: `aaronjmars/aeon` (HEAD `c95478c`, depth-1 → deepened by 10). Latest commit: `Remove agent status badge from README` (2026-05-01 10:02 -0400). One commit landed since last week's report at HEAD `f07d975`: PR #149 `feat: add smithery-manifest skill + initial Smithery / MCP Registry submission docs` (`50eec0e`, +905 lines, dashboard untouched). Today's badge-removal commit is README-only.

## aaronjmars/aeon

### TODOs (1 found)

| File:Line | Text |
|-----------|------|
| `skills/workflow-security-audit/SKILL.md:36` | `# TODO: bump ZIZMOR_VERSION to the latest stable on the next audit of this skill.` |

Same single TODO carrying since the 2026-04-29 report (now 3 days). All other `TODO`/`FIXME`/`XXX` matches across the tree are documentation tokens (skill files naming the concept as a grep target — `repo-actions/SKILL.md`, `code-health/SKILL.md`, `repo-scanner/SKILL.md`, `external-feature/SKILL.md`, `tool-builder/SKILL.md`, `push-recap/SKILL.md`, `create-skill/SKILL.md`, `deploy-prototype/SKILL.md`, `action-converter/SKILL.md`, `paper-digest/SKILL.md`), the `mktemp -t … XXXXXX` placeholders in `scripts/postprocess-admanage*.sh`, and the smoke-test regex at `skills/skill-health/tests/smoke.sh:205`. No new real TODO debt introduced by PR #149.

### Concerns

**1. Shell injection in `dashboard/app/api/secrets/route.ts:96` — STILL UNPATCHED, week 4.**

```ts
execSync(`gh secret set ${name} -b "${value.replace(/"/g, '\\"')}"`, {
  stdio: 'pipe',
  cwd: process.cwd(),
})
```

`name` is regex-validated (`/^[A-Z][A-Z0-9_]{1,}$/`, OK). `value` is only quote-escaped — backticks `` ` ``, `$(…)` command substitution, and `$VAR` expansion still reach the shell. POST `value = "x`whoami`"` runs the inner command on the dashboard host. Direct read of `secrets/route.ts:96` at HEAD `c95478c` confirms the line is byte-identical to the version called out in the 2026-04-27 push-recap, the 2026-04-28 dashboard digest, and the 2026-04-29 / 2026-04-30 code-health reports. Day 24+ unpatched.

**The fix template is in the same codebase, three files away.** `dashboard/app/api/auth/route.ts:46` does it correctly:

```ts
execSync(`gh secret set ${secretName}`, {
  input: key,                  // value via stdin, not template string
  stdio: ['pipe', 'pipe', 'pipe'],
})
```

`secretName` there is hardcoded; `gh secret set` reads the value from stdin via `input:`. Mirror that pattern at `secrets/route.ts:96`: drop the `-b "..."` flag, pipe `value` via `input: value`. Same diff at `secrets/route.ts:119` (DELETE handler) — `name` is regex-validated so the immediate exposure is lower, but moving to a `spawnSync('gh', argv)` shape closes the class. ~10-15 line diff total.

**Per `memory/topics/aeon-ops.md`, ISS-016 candidate filing is set for 2026-05-07** (skill-security-scan) if still unpatched. 6 days out.

**2. Zero unit/integration tests for the dashboard.**

`Glob **/*.{test,spec}.{ts,tsx,js,jsx}` returns nothing. Same as last week. Only test directory in the tree is `skills/skill-health/tests/` (`smoke.sh`, 321 lines — bash + ripgrep, not a real test runner). Highest-value first tests, ranked by exploitability on the same routes:
- `dashboard/app/api/secrets/route.ts` POST input validation (one real CVE waiting to be assigned).
- `dashboard/lib/memory.ts` `safeJoin` (path-traversal guard for the memory CRUD routes).
- `dashboard/lib/config.ts` `addSkillToConfig` (yaml mutation; called from import + skills routes).

**3. Large file: `a2a-server/src/index.ts` (578 lines).**

Identical line count to last week. Still the only file over 500 lines in the tree (next largest: `dashboard/lib/memory.ts` 308, `skill-health/tests/smoke.sh` 321, `onboard` 315, `skills/smithery-manifest/SKILL.md` 281 lines of skill-spec markdown). JSON-RPC parsing, RPC dispatch, body reading, and error handling all bundled in one module. Recommended split (`lib/rpc.ts`, `lib/io.ts`, thin `index.ts`) — defer until the next feature touches it.

**4. Sandbox-required scripts referenced by skills but not in tree.**

Confirmed by direct `ls scripts/`: only `prefetch-xai.sh` is present. Postprocess scripts in tree: `postprocess-admanage.sh`, `postprocess-admanage-create.sh`, `postprocess-devto.sh`, `postprocess-farcaster.sh`, `postprocess-replicate.sh`. Missing:

| Missing script | Skills affected | Issue |
|----------------|-----------------|-------|
| `scripts/postprocess-notify.sh` | `notify` `.pending-notify/` queue (third-fallback path; assumed by ≥12 skills) | tracked, no ID |
| `scripts/prefetch-vuln-scanner.sh` | `vuln-scanner` | ISS-001 |
| `scripts/prefetch-reddit.sh` | `reddit-digest`, `reddit-monitor`, `vibecoding-digest` | ISS-002, ISS-012 |
| `reply-maker)` case in `scripts/prefetch-xai.sh` | `reply-maker` | ISS-014 |

Same root cause across all four: skill needs a network-fetch step that must run before Claude is sandboxed. Unchanged from last week.

**5. `child_process.execSync` usage across dashboard API routes — pattern hasn't moved.**

9 of 19 dashboard route files use `execSync`: `auth`, `secrets`, `sync`, `outputs`, `analytics`, `runs/[id]/logs`, `runs`, `skills/[name]/run`, `skills/route.ts`. Most either use only hardcoded literals (`sync`: `git status`/`git fetch origin main`/`git rev-list --count HEAD..origin/main`/`git push`/`git commit -m "..."`) or validate the interpolated value (`/^\d+$/` for run IDs, `/^[a-z][a-z0-9-]*$/` for skill names, then `JSON.stringify` for `var`/`model`).

`secrets/route.ts:96` is the only currently-exploitable instance. The pattern is one regex slip away from another vuln. An `execGh()` helper in `dashboard/lib/` that wraps `spawnSync('gh', argv, opts)` would close the whole class — same recommendation as last week.

**6. No `notify` script at the upstream root.**

The watched repo's `CLAUDE.md` and ≥5 skill files (`workflow-security-audit/SKILL.md`, `tool-builder/SKILL.md`, `onboard/SKILL.md`, `create-skill/SKILL.md`, `channel-recap/SKILL.md`) reference `./notify "msg"` as a runtime tool, but `aaronjmars/aeon` ships only `notify-jsonrender` at root. Forks running these skills out of the box won't have a fan-out script unless one is generated by `./aeon` setup or copied in by hand. Worth checking whether `onboard` writes `notify` to the working tree at install time, or whether this is a real documentation/ship gap.

**7. Dependency / version hygiene — unchanged.**

No `npm audit`/`pip-audit`/`cargo audit` step in any workflow. `dashboard/package.json` and `a2a-server/package.json` are not pinned to lockfile-snapshotted versions in CI (no `npm ci` step in `aeon.yml` or `chain-runner.yml`). Worth a `vuln-scanner` follow-up once ISS-001 lands.

**8. PR #149 (smithery-manifest) — clean from a code-health angle.**

+905 lines, all under `skills/smithery-manifest/`, `docs/`, plus 1-line changes to `aeon.yml` and 16-line update to `skills.json`. No new shell-out, no new TODOs, no >500-line file (skill-spec markdown is 281). Nothing new to flag.

### No hardcoded secrets detected

Pattern scans for `sk-ant-*`, `ghp_*`, `glpat-*`, `AKIA*`, `xoxb-*`, and the generic `(api[_-]?key|secret|password|token)\\s*[:=]\\s*['"][A-Za-z0-9_\-]{16,}` shape across `*.{ts,tsx,js,py,sh}` returned zero matches. Same as last week.

### Recommendations

1. **Patch `secrets/route.ts:96` this week.** Mirror `auth/route.ts:46` — pass `value` via `input:` stdin instead of template-string `-b`. Repeat at line 119 (DELETE) for the same shape. ~10-15 line diff. Now overdue by ~24 days; same fix recommended every report since 2026-04-27. After the patch, file the close on whatever ISS-016 ends up tracking.
2. **Add a test scaffold to `dashboard/`** — Vitest + a `secrets` POST input-validation test (asserting that `value` containing backticks or `$(…)` does not exec) and a `safeJoin` path-traversal test. The test for `secrets` would have caught the unpatched line on day 1.
3. **Land the three missing prefetch/postprocess scripts** (`postprocess-notify.sh`, `prefetch-vuln-scanner.sh`, `prefetch-reddit.sh`) and the `reply-maker)` case in `prefetch-xai.sh` to clear ISS-001/002/012/014 — pure unblock, no design decisions.
4. **Build an `execGh()` helper** in `dashboard/lib/` so route handlers stop building shell strings at all. Migrate `secrets/route.ts:96` and `secrets/route.ts:119` first; remaining 7 routes follow on next touch.
5. **Confirm or fix the missing `./notify` script at upstream root.** Either ship it, or remove the skill-side references that assume it.
6. **Split `a2a-server/src/index.ts`** when the next feature touches it — not urgent on its own.
7. **Wire `npm audit`** as a weekly workflow step (or a `vuln-scanner` skill case) once `prefetch-vuln-scanner.sh` lands.

## Summary

- Audited `aaronjmars/aeon` HEAD `c95478c`, 1 watched repo. 1 commit since last week (smithery-manifest, +905 lines, no dashboard touch); today's badge-removal is README-only.
- 1 real code TODO (`workflow-security-audit/SKILL.md:36`) — same as last 3 reports.
- 1 critical unpatched issue: shell-injection at `dashboard/app/api/secrets/route.ts:96`. Day 24+. Same code byte-identical to the 2026-04-30 report. ISS-016 candidate filing 2026-05-07 (6 days).
- Dashboard has zero unit tests; 9/19 API routes shell out via `execSync`. Only `secrets` POST is exploitable today.
- 4 sandbox-required scripts still missing (ISS-001/002/012/014 + `postprocess-notify.sh`).
- 1 file over 500 lines: `a2a-server/src/index.ts` (578, unchanged).
- New finding: `./notify` script absent at upstream root despite being referenced by ≥5 skills + CLAUDE.md.
- No hardcoded secrets detected.
- No new dependency-vulnerability scanning step in CI.
