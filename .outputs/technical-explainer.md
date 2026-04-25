## Summary

Ran the `technical-explainer` skill end-to-end.

**Topic picked:** Settlement-basis risk between Polymarket's Chainlink Data Streams (single sub-second timestamped read) and Kalshi's CFB BRTI (60-print arithmetic mean over the final minute) — sourced from `articles/deep-research-2026-04-25.md` (Finding 3, called out as "the dominant residual edge — and the dominant noise term").

**Research:** 3 WebSearch queries (mechanism / Chainlink+Polymarket architecture / criticism); deep WebFetch on Kalshi help center, Polymarket RTDS docs, CFB BRTI page, and BlockEden Chainlink deep-dive. Four primary sources cited (Kalshi help, CFB BRTI page, Polymarket-Chainlink press release, NautilusTrader integration docs) plus two arXiv papers.

**Source-of-truth correction:** earlier deep-research log called Kalshi settlement a "60s trimmed mean." Kalshi help center confirms it's an arithmetic mean of 60 already-volume-weighted BRTI prints — any trimming lives in BRTI's order-book aggregation upstream. Flagged in the log for when `memory/topics/polymarket.md` gets created.

**Files created/modified:**
- `articles/explainer-2026-04-25.md` (969 words, all required sections)
- `.pending-replicate/explainer-2026-04-25.json` (dual-clock schematic prompt; `postprocess-replicate.sh` will pick it up post-run)
- `.pending-notify/explainer-2026-04-25.md` (notification payload; direct `./notify` hit the same `Unhandled node type: string` hook bug seen across at least four skills today)
- `memory/logs/2026-04-25.md` (Technical Explainer entry appended)

**Follow-ups:**
- Hero image generation contingent on `REPLICATE_API_TOKEN` and post-run script success — article ships either way (markdown image will simply not render if the file doesn't land).
- The `./notify` hook bug is now confirmed across polymarket-comments, narrative-tracker, daily-routine, and technical-explainer today. Worth filing under `memory/issues/` as a system-level pattern; postprocess-notify keeps delivery working but every skill currently logs a misleading "failure" on the direct call.
