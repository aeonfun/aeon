---
name: codex-handoff-queue
description: "For autonomous/overnight sessions, drive work from CODEX_HANDOFF.md's priority queue — founder-confirmed default"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2cefedce-36fc-4527-a2d7-b7efd33de3c4
---

For autonomous or overnight sessions where the founder says "just build" without naming a specific task, drive the work from `CODEX_HANDOFF.md`'s priority queue (P0 → P1 → P2).

**Why:** On 2026-05-22 the founder opened an autonomous session with "just build, I won't help plan." Claude proposed working the `CODEX_HANDOFF.md` P1 queue; the founder picked it and then affirmed "the codex handoff is a good one to work off of." `CODEX_HANDOFF.md` is a deliberately-maintained cold-start brief / next-agent priority queue at the repo root.

**How to apply:** When an autonomous session starts without a specified target, read `CODEX_HANDOFF.md` first and propose its top-priority unfinished items. Treat it as the authoritative work queue, but verify item freshness against `git log` — the handoff can lag a few days behind reality (e.g. the 2026-05-17 handoff said "8 of 17 stuck canaries"; by 2026-05-22 it was 12 of 20).
