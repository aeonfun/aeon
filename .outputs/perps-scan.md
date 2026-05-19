The perps-scan re-run is complete. The artifact was rewritten in the v3 locked format, overwriting the malformed `## Summary` blob from the chain run (ISS-004).

## Summary

Ran **perps-scan v3** for 2026-05-19 as a corrective re-run — the chain run had written its assistant `## Summary` blob into `.outputs/perps-scan.md` instead of the locked format (ISS-004).

**What I did**
- Verified the prefetch (`universe_ok: true`, source `coingecko-derivatives`).
- Assessed **10 of 25** universe coins. 15 dropped on missing price/oi/funding — including Tier 1 ETH and SOL, leaving BTC the only Tier 1.
- Computed all v3 metrics from the cached Coinglass endpoints with `jq -s` inline filters. Confirmed arrays are time-ascending (`data[-1]` = newest) and cast the mixed string/number OI `close` field before arithmetic.
- Classified by first-match priority, applied sub-tags and pattern tags, wrote the v3 locked artifact plus the verbose per-asset tail.

**Result**
- **Verdict: QUIET** — 1 ACCUMULATION, 9 NEUTRAL (90% NEUTRAL).
- **ACCUMULATION:** CL — OI +13.55% 7d, calm funding, +4.35% 7d. Low conviction, top traders net short, passive build.
- **WATCH (4):** EDEN (+37.8% 24h leverage blow-off / squeeze on -0.109% funding, OI +77% 24h, short liqs $322k vs $27k long), BILL (-21.5% falling knife, OI rising into the drop, no flush), BSB (post-pump cooling), 1000PEPE (smart-money long build vs OI washout).
- **No pattern tags** fired — funding muted universe-wide, no crowded-long or capitulation extreme.
- **No transitions** — re-run case, prior artifact malformed/dated-today.

**Files**
- `.outputs/perps-scan.md` — overwritten with the v3 locked output + tail (prior file was the ISS-004 `## Summary` blob).
- `memory/logs/2026-05-19.md` — appended a `## Perps Scan (re-run)` entry.

**Follow-ups**
- The prefetch dropped 15 of 25 coins incl. both major alts — `daily-ops-review` / `skill-health` should keep tracking the cause.
- SKILL.md step 4 formulas still assume time-descending Coinglass arrays; they are ascending — worth correcting in the spec.
- Today's candle is a partial bar (prefetch 09:52Z), so vol_ratio and liquidation totals understate — flagged in the artifact tail.
- Temp files `_metrics.jq` / `_nobasis.json` remain in `.coinglass-cache/`; `rm` is sandbox-blocked, but that directory is gitignored so they won't be committed.
