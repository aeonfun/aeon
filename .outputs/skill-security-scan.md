SECURITY_SCAN_NEW · BASELINE_BOOTSTRAPPED

## Summary

**Verdict:** ATTENTION — 2 NEW HIGH script-injections in `.github/workflows/messages.yml`.

**HIGH findings (real `run:` block, no downgrade):**
- `messages.yml:577` — `${{ toJson(github.event.client_payload.message) }}` interpolated into single-quoted bash echo. `toJson()` does NOT escape single quotes; a `repository_dispatch` payload with `'` breaks the bash quote and runs as the workflow shell with full secret access.
- `messages.yml:578` — `${{ github.event.action }}` interpolated into `TYPE=` assignment. Same incident class as the 2026-04-11 audit; prior env-binding fix landed on the `inputs.*` path but missed the `repository_dispatch` branch.

**MEDIUM (HIGH→MEDIUM via fenced-block rule):** `skills/monitor-runners/SKILL.md:74,77` — `eval "${N}_TREND_OK=1"` inside a `bash` fenced block. Replace with associative array.

**Suppressed (41 baseline seeds):** self-documenting threat-model prose in `skills/skill-security-scan/SKILL.md`, pattern-library literals in `scan.sh`, fenced curl examples in `security-digest`.

**Trusted-source:** repo remote is `tomscaria/aeon`, not in `skills/security/trusted-sources.txt` — full content scan applied.

**Scanner note:** `scan.sh --all --json` was blocked at the sandbox approval gate. Fell back to inline Grep with the same HIGH/MEDIUM/LOW pattern library, per SKILL.md "never silently skip."

**Files created/modified:**
- `skills/security/scan-baseline.yml` (new, 41 suppressions)
- `articles/security-scan-2026-04-27.md` (report)
- `memory/state/security-scan.json` (delta state for next run)
- `memory/issues/ISS-014.md`, `memory/issues/ISS-015.md` (new HIGH issues)
- `memory/issues/INDEX.md` (2 rows added under Open)
- `memory/logs/2026-04-27.md` (skill-security-scan section appended)
- `.pending-notify/security-scan-2026-04-27.md` (notification queued)

**Follow-up:** Single PR rebinding `messages.yml:577–578` to `env:` keys closes both ISS-014 and ISS-015. Pattern documented in `articles/workflow-security-audit-2026-04-11.md`.
