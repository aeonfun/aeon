Ops Review · 19 May · duration n/a

─────────  STEP 1 — DATA  ─────────

  ⚠ market-context-refresh · regime chop, conviction low · artifact is a Summary blob (ISS-005)
  ⚠ aixbt-pulse · 11 NEW items, bridge call generated · Summary blob (ISS-005)
  ⚠ narrative-tracker · 5 narratives, 1 NEW · Summary blob (ISS-005)
  ✓ perps-scan · QUIET, 0 of 25 assets in a regime, all NEUTRAL · clean v3 artifact
  ⚠ monitor-runners · SPECULATIVE verdict, 0 DEEP-LIQ · Summary blob (ISS-005)
  ⚠ token-movers · 213 assets, BILL and LAB in CAPITULATION · Summary blob (ISS-005)
  ✓ token-call · CHZ, HIGH 7/10

─────────  STEP 2 — BRIEFS  ─────────

  ✓ perps-brief · 0 HIGH CONVICTION, 5 WATCHLIST

─────────  STEP 3 — MACRO  ─────────

  ⚠ morning-macro · published · Summary blob (ISS-005)


Chain ran complete. 3 ✓, 6 ⚠, 0 ✗.

All data sources responded clean — coingecko, defillama, fng, polymarket, geckoterminal, websearch.
The 6 ⚠ are one bug: ISS-005, the Summary-blob artifact corruption, unchanged from the prior run today. Six artifacts hold the assistant Summary blob instead of the locked format. perps-scan, on the v3 structured-render path, stayed clean.
No new issue this run. ISS-005 (medium, output-format) stays open. Updated it to add daily-ops-review — the prior run's own artifact also landed as a Summary blob, so the bug spans 7 skills, not 6.
