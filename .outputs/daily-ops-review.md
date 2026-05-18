Ops Review · 2026-05-18 · duration n/a

Step 1 — Data
✗ market-context-refresh · no artifact in .outputs/
⚠ aixbt-pulse · artifact stale — dated 2026-05-17 19:00Z, not today's chain run
⚠ narrative-tracker · artifact stale — dated 2026-05-17 baseline run
✓ monitor-runners · MIXED verdict, 1 DEEP-LIQ (PITCH +1480%), fresh 2026-05-18
⚠ token-movers · artifact stale — dated 2026-05-17
✗ perps-scan · no artifact in .outputs/
✗ token-call · no artifact — only stale token-pick.md (2026-05-17, pre-rename slot)

Step 2 — Briefs
✗ perps-brief · no artifact in .outputs/

Step 3 — Macro
✗ morning-macro · no artifact in .outputs/

Chain did not execute as a unit today. Only monitor-runners produced a fresh (2026-05-18) artifact; 4 artifacts are stale 2026-05-17 standalone runs, 4 are missing entirely.
Missing sources: market-context-refresh, perps-scan, perps-brief, morning-macro.
Stale sources: aixbt-pulse, narrative-tracker, token-movers.
No issues filed in memory/issues/.
Note: token-call output slot is empty while a stale token-pick.md remains — the rename landed in aeon.yml but not in the skill's artifact naming. MEMORY.md still describes v1 config; it lags the v2 morning-review chain in aeon.yml.
