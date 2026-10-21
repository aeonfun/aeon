Run complete. Both watches scanned clean — no alert sent, per the "only notify on signal" rule.

## On-Chain Monitor — 2026-10-21T10:12:35Z

**Result: `ON_CHAIN_OK` (n_watches=2, n_raw=0, n_dropped=0). No notification sent.**

### Scan window
Incremental only — 226 blocks (≈7.5 min), `52893845 → 52894071` on Base. The prior run at 10:25Z had already closed out the rolling 24h backfill, so this is a pure delta check.

| Watch | Source | Block range | Events |
|---|---|---|---|
| DEUS escrow `0xA85A…C373` | tenderly-rpc | 52,893,845 → 52,894,071 | 0 |
| xDEUS `0xe6d5…4431` | tenderly-rpc | 52,893,845 → 52,894,071 | 0 mints, 0 burns, 0 moves |

### Why the zero is trustworthy
A zero from a log query looks identical to a broken filter, so I checked both directions:

- **Pipeline live:** network-wide DEUS transfers in the last 200 blocks = **35**. `eth_getLogs` is returning data; the watches are genuinely idle.
- **Balance witness:** escrow DEUS `29,362,657.93714045` and xDEUS supply `1,711` / escrow `57` were **byte-identical before and after**. No balance-moving transaction could have been missed.

### Rolling 24h (`52850871 → 52894071`) — unchanged from the 08:25Z and 10:25Z runs
- In: **66,150.23 DEUS** · Out: **43,512.49 DEUS** · Net: **+22,637.74 DEUS** (+0.077% of escrow — net inflow)
- Research trigger (§ 情报, 5%/day): the gate sits at **1,468,133 DEUS**; actual outflow was **0.148%** of escrow. Not remotely close.
- 10 escrow transfers, 6 xDEUS mints, 4 burns. Median event **$179**, max **$447** at $0.01789/DEUS — nothing clears the $200/$250 thresholds.

### Counterparty pass (done anyway — cheap, and it's the "who" that matters)
- `0x7901…0185` — **contract**, staked 25,000 DEUS twice in one day, holds 25,000 DEUS + 5 xDEUS. Largest accumulator.
- `0x6e5f…cba5` — **contract**, round-tripper (13,385 in; 7,560 + 5,020 out). Resizing a position, not exiting.
- `0xd5ff…c724` — **EOA**, unstaked 12,419.81 DEUS, still holds **52,837 DEUS liquid**. That's the one address with both size and demonstrated willingness to sell.

### Price / trigger distance
DEUS **$0.01805** (Aerodrome VIRTUAL pair, liq $705.9k, 24h vol $11.5k, +3.03%/24h); $0.01793 on the USDC pair.

`$0.025` +38.5% · `$0.032` +77.3% · `$0.012` −33.5% · `$0.041` +127.1% — **none touched.**

### Source note
`ALCHEMY_API_KEY` and `ETHERSCAN_API_KEY` are unset again, so this ran on the keyless Tenderly gateway. Native ETH moves on these watches remain invisible — only ERC-20/ERC-721 logs are seen.

One RPC behaviour worth recording: a **203-block** range on the unfiltered xDEUS leg failed with `query exceeds max results 20000` — Base Transfer volume is now high enough that unfiltered `eth_getLogs` is unusable at any range. Fixed by adding the contract `address` filter instead of scanning all Transfers. That's in `base-rpc-access.md` now.

## Summary

**What I did:** Ran the `onchain-monitor` skill with no `var`. Fetched the current Base block, scanned the delta window on both watches, verified the empty result against a network-wide control query and an escrow-balance witness, recomputed rolling 24h flows, profiled all seven escrow counterparties (EOA vs contract + token holdings), and pulled current DEUS price to measure trigger distance.

**Files created/modified:**
- `memory/on-chain-state.json` — advanced `last_block` to 52,894,071, refreshed `last_run` and notes for both watches
- `memory/logs/2026-10-21.md` — appended the `### onchain-monitor (10:12Z)` entry with full detail
- `memory/topics/deus-escrow.md` — **new** living doc: the two watches, the 5% gate math, and the counterparty map
- `memory/topics/base-rpc-access.md` — added the 20,000-result cap section, bumped `timestamp`

**No alert sent** — zero surviving events and no strategy trigger, so nothing to report. Per the strategy, silence is the correct output here.

**Follow-up actions:**
1. `memory/on-chain-state.json.new` is a stale partial write from the 10:03Z run. The delete wasn't granted this run, so it's still on disk. It's inert (the skill reads `on-chain-state.json` only) but should be removed by a write-mode run.
2. `0xd5ff…c724` is worth adding to `on-chain-watches.yml` — it's the only holder with meaningful liquid DEUS and a track record of unstaking.
3. Setting `ALCHEMY_API_KEY` would restore decoded, categorized transfers plus native ETH visibility.
