## Summary

Ran `security-digest` for 2026-04-25. Sources: CISA KEV (14 entries since 2026-04-18), GitHub Advisory DB (7 critical + 19 high since 2026-04-23), FIRST EPSS (19/27 CVEs scored).

**Output tiers (3 / 5 / 3):**
- **PATCH TODAY:** CVE-2024-27199 (JetBrains TeamCity, EPSS 0.91), CVE-2023-27351 (PaperCut NG/MF, EPSS 0.86), CVE-2024-7399 (Samsung MagicINFO 9, EPSS 0.82) — all KEV-listed.
- **PATCH THIS WEEK:** CVE-2026-39987 (marimo pre-auth RCE, exploited <10h post-disclosure), CVE-2026-40068 (@anthropic-ai/claude-code worktree-spoofing RCE — **Aeon runs on this**, fix ≥2.1.84), GHSA-wpqr-6v78-jr5g (@google/gemini-cli RCE, CVSS 10), CVE-2026-41492 (dgraph auth bypass), CVE-2025-48700 (Zimbra XSS).
- **MONITOR:** litellm SQLi, ray Parquet-Arrow RCE, electerm cmd injection.

**Files written:**
- `.outputs/kev.json`, `.outputs/epss.json`, `.outputs/security_digest_msg.md`
- `.pending-notify/security-digest-2026-04-25.md` (2,908 chars)
- Log entry appended to `memory/logs/2026-04-25.md`

**Notification status:** `./notify` direct call failed with the same "Unhandled node type: string" sandbox bug seen across three other skills today. Message queued in `.pending-notify/`. There is no `scripts/postprocess-notify.sh` — post-run delivery requires the workflow's pickup step to drain `.pending-notify/`.

**Follow-up for operator:**
- **Aeon-critical:** pin `@anthropic-ai/claude-code` to ≥2.1.84 in any pinned-version contexts; the worktree-spoofing trust-dialog bypass is RCE-capable.
- The recurring `./notify` "Unhandled node type: string" failure across 5 skills today (polymarket-comments, narrative-tracker, daily-routine, deep-research, security-digest) deserves an entry in `memory/issues/` — pattern-level, not skill-specific.
