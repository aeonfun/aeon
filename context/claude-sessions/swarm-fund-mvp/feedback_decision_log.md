---
name: Decision log rule
description: Every architecturally significant decision in swarm-fund-mvp must be appended to DECISIONS.md at the repo root
type: feedback
originSessionId: 1094a08b-2262-481b-b450-cb2a7d52c4aa
---
Any decision meeting (a) irreversible without material cost, (b) locks architecture / creates a dependency, or (c) rejects a reasonable alternative MUST be logged in `/Users/scaria/swarm-fund-mvp/DECISIONS.md` before or at the same commit as the implementation.

**Why:** Before 2026-04-18, decisions were scattered across MEMORY.md, STRATEGY_TRUTH.md, aristotle_response_plan.md, commit messages, and session transcripts — evolution was not reconstructable. Thomas established the ADR log as the authoritative ledger to make the project legible to grants, LPs, and future teammates.

**How to apply:**
- Use `scripts/decision-log-helper.sh "<title>"` — auto-fills next sequence number + today's date, opens editor with the ADR template, appends on save.
- Skip for: bug fixes, dependency bumps, cosmetic changes, renames.
- When superseding an earlier decision: add a new entry AND update the old entry's `**Status:** Superseded by NNN`.
- Entries live chronologically (oldest → newest, 001 at top).
- Format is fixed: NNN + YYYY-MM-DD + title, then Status / Context / Decision / Rationale / Consequences / Evidence.
