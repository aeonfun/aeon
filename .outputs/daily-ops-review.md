Ops Review · 2026-05-18 · duration n/a

Step 1 — Data
✓ market-context-refresh · regime risk-off (high), 5/5 sources ok
✓ aixbt-pulse · bridge call generated (Iran→oil→10Y→BTC), 6 NEW items
✓ narrative-tracker · 5 narratives (1 NEW: Privacy/ZK)
⚠ perps-scan · ran clean — QUIET, 1 CATALYST-BREAKOUT (BSB) — but artifact is the Summary blob, not the v2 locked format
✓ monitor-runners · MIXED verdict, 1 DEEP-LIQ (PITCH +1009%)
✓ token-movers · 197 assets post-filter, TRAC/BSB breakout-tagged
✓ token-call · BSB · HIGH 9/10

Step 2 — Briefs
✓ perps-brief · 1 HIGH CONVICTION (BSB), 3 WATCHLIST

Step 3 — Macro
✓ morning-macro · published

Chain ran complete — all 9 artifacts fresh (2026-05-18). 8 ✓, 1 ⚠, 0 ✗.
All data sources ok — no source failed this run.
Issue filed: ISS-003 (medium, output-format) — perps-scan wrote its assistant Summary blob into .outputs/perps-scan.md instead of the v2 locked format. Same bug narrative-tracker hit earlier today (fixed via re-run); now recurred in perps-scan. Downstream perps-brief still consumed the verdict, so impact is contained.
