Done. The `monitor-runners` skill ran for 2026-05-19 (~15:25 UTC, 4th run of the day on fresher data).

## Summary

Scanned 5 chains via GeckoTerminal — all 11 endpoints fetched cleanly (two single 429s recovered on spaced curl retries, no WebFetch fallback needed). 164 pools deduped, 80 cleared the quality gate.

**Verdict: SPECULATIVE** — top 5 all tagged BREAKOUT, no DEEP-LIQ anywhere.

| # | Token | Chain | 24h | Score | Vol / Liq | Churn |
|---|-------|-------|-----|-------|-----------|-------|
| 1 | TYGR | sol | +1485% | 89 | $1.7m / $64k | 26x |
| 2 | OSOR | sol | +2918% | 89 | $48m / $280k | 171x |
| 3 | COAR | sol | +571% | 89 | $50m / $317k | 157x |
| 4 | ★ GDOR | sol | +712% | 89 | $47m / $251k | 189x |
| 5 | 14 | bsc | +7986% | 89 | $51m / $156k | 329x |

Tape read: wash-inflated casino — four of five picks run 150-330x volume-to-liquidity churn, OSOR and GDOR flat on both h1 and h6 (move spent). TYGR is the lone exception, still climbing 21h in with a 26x ratio — the cleanest pick on a dirty board. GDOR is a ★ name repeat from 2026-05-18 but a fresh contract (serial-clone name, not a continuing run); not 3 days consecutive, so no MEMORY.md flag.

Notable: the ~12:00 run had PITCH at #5 (+1892%); its launch spike has since rolled out of the 24h window (now +47%), so it dropped from the ranking and TYGR entered — legitimate fresh-data drift.

**Files:**
- `.outputs/monitor-runners.md` — overwrote a stale `## Summary` blob (the ISS-005 output-format bug) with the correct v2 locked signal format
- `.pending-notify/1779204741.signal.md` — notification queued for post-run Discord delivery to #runners
- `memory/logs/2026-05-19.md` — appended Monitor Runners log + summary

**Sandbox notes:** `./notify` not directly invocable (`$(cat ...)` substitution blocked); wrote the pending `.signal.md` directly, which is the notify script's own fallback path. Scoring done via inline `jq` pipelines since file redirects and `python3` pipelines were blocked. Scratch dir `.gtdata/` already gitignored (rm blocked).
