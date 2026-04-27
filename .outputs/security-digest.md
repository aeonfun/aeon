## Summary

Ran security-digest for 2026-04-27 (second pass of the day; AM run already shipped earlier). Exploitation-signal-first ranking with KEV → EPSS → CVSS, deduped against the last 2 days of `memory/logs/`.

**Tier counts:** PATCH TODAY=3, PATCH THIS WEEK=0, MONITOR=0.

**PATCH TODAY** (all KEV-confirmed, ranked by EPSS desc):
- CVE-2025-2749 — Kentico Xperience (auth path-traversal upload → RCE; watchTowr public chain)
- CVE-2026-33825 — Microsoft Defender (local EoP; Huntress "Nightmare Eclipse" ITW)
- CVE-2026-20133 — Cisco SD-WAN Manager (info disclosure; bundles companion KEV adds CVE-2026-20122 and CVE-2026-20128 into one fix action)

**Sources:** KEV ok, GH Advisory ok, EPSS ok, NVD used to backfill CVSS.

**Notable:** GH Advisory database has zero new reviewed critical/high since 2026-04-25 23:42Z — today's only fresh exploitation signal is the carried-over KEV batch. None of today's KEV adds touch the Aeon stack (npm/pip/Go/crates.io/GitHub Actions); the only Aeon-direct advisory still outstanding is CVE-2026-40068 on `@anthropic-ai/claude-code` from the 04-25 digest, where the `≥2.1.84` pin remains unverified.

**Files modified:** `.outputs/security-digest.md` (overwrote AM run), `.pending-notify/1777300122.md` (1776 chars), `memory/logs/2026-04-27.md` (appended).

**Follow-ups:** none blocking. The `gh api` `published=` filter quirk (rejects ISO timestamps, accepts `YYYY-MM-DD..YYYY-MM-DD`) is worth a one-line correction in `skills/security-digest/SKILL.md` step 2 next time the skill is touched. `kev.json` left in workdir (sandbox blocked deletion; untracked).
