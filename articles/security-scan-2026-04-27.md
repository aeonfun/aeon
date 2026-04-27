# Security Scan — 2026-04-27

**Verdict:** ATTENTION
**Scope:** full corpus (skills/*/SKILL.md, skills/*/*.sh, .github/workflows/*.yml, scripts/*.sh)
**Scanner:** inline Grep fallback (scan.sh blocked by sandbox approval; pattern library identical to `skills/skill-security-scan/scan.sh`)
**Counts:** ~110 files scanned · 2 HIGH · 2 MEDIUM (post-downgrade) · multiple LOW · 4 NEW · 0 RESOLVED · BOOTSTRAP run (no prior state)

This is the bootstrap run — `memory/state/security-scan.json` did not exist, so every finding is NEW. Baseline file `skills/security/scan-baseline.yml` was created with 41 self-documenting suppressions for the security-scan and security-digest skills (their bodies cite the patterns the scanner looks for).

---

## Needs attention (NEW high-severity this run)

Two real injections in `.github/workflows/messages.yml`. Both inside the `Extract message` step's `run: |` block. Repository_dispatch event payloads (action name + client_payload.message) are interpolated into the shell context unescaped. Anyone holding a token with `repo:write` can dispatch a hostile payload and gain command execution with full secret access (TELEGRAM_BOT_TOKEN, CLAUDE_CODE_OAUTH_TOKEN, ANTHROPIC_API_KEY, GH_TOKEN). Same incident class as the 2026-04-11 audit — the prior fix correctly rebound `inputs.message` / `inputs.source` to `_INPUT_MESSAGE` / `_INPUT_SOURCE`, but missed the `repository_dispatch` branch. Trigger is gated by token possession, not public input, so blast-radius is limited to anyone who can dispatch — but the bypass is direct.

| File:Line | Pattern | Issue | Remediation |
|-----------|---------|-------|-------------|
| .github/workflows/messages.yml:577 | `${{ toJson(github.event.client_payload.message) }}` inside single-quoted echo in `run:` | [ISS-015](../memory/issues/ISS-015.md) | Rebind to `env: _DISPATCH_PAYLOAD: ${{ toJson(...) }}`, then `echo "$_DISPATCH_PAYLOAD" \| jq -r '.'`. `toJson()` does not escape single quotes — JSON allows literal `'` inside strings, which closes the bash region. |
| .github/workflows/messages.yml:578 | `${{ github.event.action }}` interpolated into `TYPE=` assignment in `run:` | [ISS-014](../memory/issues/ISS-014.md) | Rebind to `env: _DISPATCH_ACTION: ${{ github.event.action }}`, then `TYPE="$_DISPATCH_ACTION"`. |

Both fixes share the same env-binding pattern documented in `articles/workflow-security-audit-2026-04-11.md`.

## Resolved since last scan

None — bootstrap run, no prior state to diff against.

## Persistent findings

None — bootstrap run.

## Per-file results (HIGH/MEDIUM only)

| File | Status | HIGH | MEDIUM | Notes |
|------|--------|------|--------|-------|
| .github/workflows/messages.yml | FAIL | 2 | 0 | ISS-014, ISS-015 — env-binding miss on `repository_dispatch` branch |
| skills/monitor-runners/SKILL.md | WARN | 0 | 2 | `eval "${N}_TREND_OK=1"` and `eval "${N}_VOL_OK=1"` lines 74, 77 — code-fence downgraded from HIGH; `${N}` derives from `$NETWORKS` which inherits from skill `$var`. Replace with associative array or jq lookup; `eval` is not needed for boolean state tracking. |
| skills (other) | PASS/WARN | 0 | various | `curl ... ${VAR}` matches across ~40 skills are URL/header construction inside fenced code blocks, code-fence downgraded from HIGH to MEDIUM. None expand secrets into outbound bodies; auth-header patterns are blocked by the sandbox per CLAUDE.md and routed through `scripts/prefetch-*.sh`. |

## Appendix — full finding categories

**HIGH (post-suppression, post-downgrade):** 2
- messages.yml:577 — `${{ toJson(github.event.client_payload.message) }}` in `run:` block (real `run:` step, no downgrade)
- messages.yml:578 — `${{ github.event.action }}` in `run:` block (real `run:` step, no downgrade)

**MEDIUM (post-downgrade):** 2
- monitor-runners/SKILL.md:74 — `eval "${N}_TREND_OK=1"` (HIGH → MEDIUM; inside fenced ` ```bash ` block)
- monitor-runners/SKILL.md:77 — `eval "${N}_VOL_OK=1"` (HIGH → MEDIUM; inside fenced ` ```bash ` block)

**Suppressed at baseline (41 total):**
- 16 self-documenting patterns inside `skills/skill-security-scan/SKILL.md` threat-model and remediation tables
- 23 pattern-library literals inside `skills/skill-security-scan/scan.sh` (these strings define what the scanner looks for)
- 2 example curl invocations inside `skills/security-digest/SKILL.md` fenced blocks

**Code-fence downgraded (raw HIGH → MEDIUM, then dropped from main report as routine):**
- ~40 `curl ... ${ENV_VAR}` matches across `distribute-tokens`, `paper-digest`, `vercel-projects`, `vibecoding-digest`, `paper-pick`, `polymarket-comments`, `on-chain-monitor`, `monitor-kalshi`, `hacker-news-digest`, `last30`, `monitor-polymarket`, `defi-monitor`, etc. All are inside fenced ` ```bash ` blocks documenting API call shape; per `CLAUDE.md` these are blocked by the sandbox at runtime and routed through `scripts/prefetch-*.sh` for auth paths.
- 4 `"ignore previous instructions" / "you are now…"` mentions in `skills/{repo-actions,deep-research,research-brief,last30}/SKILL.md` — these are explicit defensive guidance instructing the agent to discard sources containing such phrases. Documentation, not payload. Not added to baseline (they're already negated by surrounding prose); listed here for completeness.

**Trusted-source check:** repo's git remote is `tomscaria/aeon`. NOT in `skills/security/trusted-sources.txt` (only `aaronjmars`, `aaronjmars/aeon`, `aaronjmars/aeon-agent` are trusted). All scan results are full-content, no format-only downgrade applied.

## Bootstrap notes

- Created `skills/security/scan-baseline.yml` with 41 seed suppressions.
- `scan.sh --all --json` was blocked at the sandbox approval gate. Fell back to inline Grep using the same HIGH/MEDIUM/LOW pattern library, per the SKILL.md instruction "never silently skip."
- Persisted finding state to `memory/state/security-scan.json` for delta computation on the next run.
- Filed two issues: ISS-014 (github.event.action injection), ISS-015 (toJson client_payload.message injection). Single root cause, single PR can fix both.

## Suggested next action

One PR rebinding both lines to env keys closes ISS-014 and ISS-015. Pattern is in `articles/workflow-security-audit-2026-04-11.md`. Cost: 4 line edits, no semantic change. After merge, this skill will pick up RESOLVED on the next run and auto-close both issues.
