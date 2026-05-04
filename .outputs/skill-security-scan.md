`SECURITY_SCAN_NOCHANGE`

## Summary

Ran skill-security-scan in fallback mode (canonical `scan.sh --all --json` shell-out blocked by sandbox; fell back to inline Grep with the same HIGH/MEDIUM/LOW pattern library, per the skill's preflight rule).

**Verdict: ATTENTION (no new findings; 2 PERSISTENT HIGH still open under ISS-015). Exit `SECURITY_SCAN_NOCHANGE`.**

- **Scope:** full corpus (`var` empty) — 113 SKILL.md + 3 workflows + 11 scripts + 1 companion script.
- **Counts:** 2 HIGH · 2 MEDIUM · 0 LOW · 0 NEW · 0 RESOLVED · 4 PERSISTENT (identical fingerprints to 2026-04-27).
- **HIGH (persistent):** `.github/workflows/messages.yml:577` (`toJson(github.event.client_payload.message)` into single-quoted echo) and `:578` (`${{ github.event.action }}` direct in `run:`) — both tracked under ISS-015. Carrier PR #4 still stalled awaiting workflow-scoped PAT.
- **MEDIUM (persistent, code-fence-downgrade):** `skills/monitor-runners/SKILL.md:74,77` — `eval` inside fenced bash block.
- **No new ISSes filed** — both current HIGH are already covered by ISS-015.
- **Notify skipped** per spec (no NEW HIGH, no RESOLVED HIGH).

**Continuity note:** the raw scanner library would also fire HIGH on ~18 `curl -H "Authorization: … $TOKEN"` lines in `messages.yml`, `aeon.yml`, and `scripts/postprocess-*.sh` / `prefetch-*.sh` — these are auth-to-the-API-that-owns-the-secret, not exfil. Preserved the 2026-04-27 fallback's known-design classification for continuity, and surfaced them in the report appendix as candidates for a single batch baseline-suppression PR (operator review) so the canonical `scan.sh` path agrees once the sandbox unblocks.

**Files written/modified:**
- `articles/security-scan-2026-05-04.md` (new — report)
- `memory/state/security-scan.json` (updated — same findings, new timestamp, NOCHANGE exit)
- `memory/issues/INDEX.md` (housekeeping — added missing ISS-015 row to Open table; prior run recorded `issues_filed: ["ISS-015"]` but never landed the index entry per MEMORY.md note)
- `memory/logs/2026-05-04.md` (appended `### skill-security-scan` section)

**Follow-up actions:**
- Operator: land PR #4 (workflow-scoped PAT) to close ISS-015's two messages.yml interpolation findings.
- Operator: review the appendix's auth-curl candidate list and merge a single baseline-suppression PR with documented `reason` / `reviewed_by` so future scans drop them deterministically.
- Optional cleanup: rewrite `monitor-runners/SKILL.md:74,77` eval pair as `if/else` arms or `declare -g` to fully clear the eval pattern in the documentation snippet.
