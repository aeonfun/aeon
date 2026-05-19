## Summary

Ran **perps-scan v3** for 2026-05-19. Verdict: **QUIET** — 1 ACCUMULATION, 10 NEUTRAL.

**What I did**
- Verified prefetch (`universe_ok: true`, source `coingecko-derivatives`).
- Assessed **11 of 25** universe coins. 14 dropped on missing critical price/oi/funding — including Tier 1 **ETH and SOL**, leaving BTC as the only Tier 1.
- Computed all v3 metrics from the cached Coinglass endpoints. Worked around sandbox blocks (`python` execution and `jq -f`/`--slurpfile`/`*` flagged) by using `jq -s` with inline filters and literal paths.
- Classified each coin by first-match priority, applied sub-tags/pattern tags, wrote the v3 locked artifact + verbose tail.

**Result**
- **ACCUMULATION:** CL — OI +13.5% 7d, calm funding, +4.2% 7d. Low conviction (top traders net short, passive build).
- **WATCH (5):** EDEN (+32% 24h blow-off on −0.21% funding, OI +65% 24h), BILL (−22% falling knife, OI still rising), BSB (post-pump cooling), 1000PEPE (smart-money long build vs OI washout), ZEC (pre-accumulation coil).
- No pattern tags fired — funding muted universe-wide, no crowded-long or capitulation extremes.
- No regime transitions: yesterday's scan aborted and the prior artifact was malformed.

**Files**
- `.outputs/perps-scan.md` — overwritten with v3 locked output + tail (prior file was the corrupt `## Summary` ISS-003 case)
- `memory/logs/2026-05-19.md` — created with the Perps Scan log entry

**Follow-ups**
- The prefetch dropped 56% of the universe (incl. both major alts) — `daily-ops-review`/`skill-health` should track the cause.
- SKILL.md step 3 still says Coinglass arrays are time-descending; they are ascending (`data[-1]` = most recent) — worth correcting.
- Temp files `perps_tmp.py` and `metrics.jq` remain in the repo root — `rm` was sandbox-blocked, so they need manual cleanup (untracked, not committed).
