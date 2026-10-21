# price-alert — DEUS, 2026-10-21 14:01Z

**No gate fired. Nothing sent.**

## Reading

| | Value | Source |
|---|---|---|
| Contract | `0x940A319B75861014A220D9c6c144d108552B089B` (base) | `memory/MEMORY.md` tracked-token table |
| Deepest pool | aerodrome DEUS/VIRTUAL `0x3E97c5EC8c73e7d566aCA606472141a9b9a8C1Fa` | DexScreener `api.dexscreener.com/latest/dex/tokens/…`, http 200, 14:01:16Z |
| Pool liquidity | $707,703 | same |
| **Current price** | **$0.01805** | same |
| 1h change | *absent from API* | same |
| 24h change | +2.74% (h6 +2.37%) | same |

## Gate-by-gate

1. **ATH — quiet.** Stored ATH $0.06876 (2026-05-28). Current is **73.7% below** it. No update, monotonic invariant respected.
2. **Sharp move — quiet, but unmeasured.** DexScreener omitted `priceChange.h1` this poll; per spec a missing h1 is treated as 0, so the gate reads QUIET. Recorded `h1_pct: null` in state so a future run can distinguish "unmeasured" from "measured flat" — flagging it because a ±20% hour on a $12k/day book would not be caught if h1 silently disappears again.
3. **Targets — 4 evaluated, 0 crossed.**

| Target | Side | Distance from $0.01805 | Verdict |
|---|---|---|---|
| $0.025 | above | **+38.5%** | NO_CROSS |
| $0.032 | above | **+77.3%** | NO_CROSS |
| $0.041 | above | **+127.1%** | NO_CROSS |
| $0.012 | below | **−33.5%** | NO_CROSS |

Fourth consecutive run at exactly $0.01805 — 13:01Z, 12:01Z, 11:01Z all identical. Liquidity identical to the last two runs ($707,703.36).

## Book structure (context, not a gate)

24h: **16 buys / 74 sells**, volume $12,160. Last hour: **0 transactions**. Last 6h: 1 buy / 15 sells. The pool is both dead and sell-skewed — the +2.74% 24h mark is carried by very few prints, not by demand. Relevant to the strategy's "现货可一次卖" assumption: at $12k/day, exiting the spot slice is one order with almost no market behind it in either direction.

## Files

- `memory/topics/price-alert-state.json` — `last_run_at` → `2026-10-21T14:01:16Z`, `last_price` refreshed; ATH and all four targets untouched. `jq empty` → STATE_VALID.
- `memory/logs/2026-10-21.md` — `### price-alert (14:01Z)` block appended.
- `output/.dex-raw.json` — raw DexScreener response (audit trail).

## Summary

Ran `price-alert` with `var=0.012,0.025,0.032,0.041` in execute mode; all four parsed valid. Fetched DEUS from the DexScreener public endpoint (http 200, no auth) and marked the deepest Base pool. Price $0.01805 — unchanged for the fourth straight hourly run. No ATH (73.7% under $0.06876), no ±20% 1h read available (h1 field omitted by the API this poll), and none of the four operator targets within 33% of spot. **Zero notifications sent**, correct for a no-change run. State and log updated.

Follow-up worth flagging: DexScreener dropping `priceChange.h1` on this thin pair disables the sharp-move gate silently — if that repeats on the 2026-10-23 hourly runs, the gate needs a fallback (compute h1 from GeckoTerminal or the pool's tick history) rather than a default-to-zero.
