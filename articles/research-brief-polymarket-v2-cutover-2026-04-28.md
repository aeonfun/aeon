---
topic: Polymarket V2 cutover (CTF Exchange V2, pUSD, on-chain builder codes, orderbook reset)
date: 2026-04-28
source_count: 7w / 2a
confidence: medium
thesis: "The pUSD migration plus on-chain builder-code revenue share will durably tighten Polymarket top-20 binary spreads relative to the 7-day pre-cutover baseline within 14 days, because V2 removes V1's balance-check race conditions and nonce collisions that drove maker cancel-and-replace toxicity, and because builder-code economics newly align integrators with depth provision."
---

## BLUF

Polymarket executed its CLOB V2 cutover at ~11:00 UTC on 2026-04-28, replacing the V1 exchange stack with new CTF Exchange contracts, EIP-1271 smart-contract-wallet signatures, on-chain builder-code attribution, and a 1:1 USDC-backed pUSD stablecoin, wiping every resting V1 order in the process ([help.polymarket.com](https://help.polymarket.com/en/articles/14762452-polymarket-exchange-upgrade-april-28-2026)). The cutover came pre-loaded with a $1M maker-rebate program — $500k front-loaded in the first two hours, $500k spread across the rest of day one — built to refill the book before competitors re-quote ([crypto.news](https://crypto.news/polymarket-rolls-out-clob-v2-with-1m-liquidity-rewards-to-harden-prediction-markets/)). For automated agents, V1 SDKs are now formally bricked: `@polymarket/clob-client` and `py-clob-client` "no longer work against production CLOB V2" ([docs.polymarket.com](https://docs.polymarket.com/v2-migration)).

## Thesis

V2 will durably tighten top-20 binary spreads versus the 7-day pre-cutover baseline within 14 days because the new contracts retire two V1 toxicity sources at once: the balance-check race conditions / nonce-invalidation failures that produced silent fail-on-match cancellations ([news.bitcoin.com](https://news.bitcoin.com/polymarkets-april-2026-upgrade-new-stablecoin-faster-order-matching-smart-contract-wallet-support/)), and the absent revenue-share path for integrators — now solved via on-chain builder codes that pay USDC rebates to attribution-bearing flow ([crypto.news](https://crypto.news/polymarket-rolls-out-clob-v2-with-1m-liquidity-rewards-to-harden-prediction-markets/)). With $9.55B in 30-day volume and ~$25M/month in fee revenue underwriting the rebate pool, the maker-economics step-up is large enough to register at the touch ([crypto.news](https://crypto.news/polymarket-rolls-out-clob-v2-with-1m-liquidity-rewards-to-harden-prediction-markets/)).

## Context

The cutover is the largest single change to Polymarket's exchange stack since launch, and it lands during a four-way structural reordering of US prediction markets. Kalshi launched onshore crypto perpetuals on 2026-04-27 NYC ([theblock.co](https://www.theblock.co/post/396450/polymarket-unveils-plans-trading-engine-overhaul-native-stablecoin)). Polymarket itself shipped 10x perps on 2026-04-21. FanDuel and DraftKings are bidding for the same retail. The V2 stack is, in effect, the back-office prerequisite for Polymarket to compete on professional execution rather than just brand and political-event handle.

Three changes carry the load. First, **pUSD** — a Polygon ERC-20 backed 1:1 by USDC, with the smart contract enforcing the peg ([help.polymarket.com](https://help.polymarket.com/en/articles/14762452-polymarket-exchange-upgrade-april-28-2026)) — moves Polymarket off the USDC.e stack and into a unit it controls. Second, **builder codes** put attribution and rebate accrual on-chain, ending the off-chain, hand-managed integrator economics of V1 ([news.bitcoin.com](https://news.bitcoin.com/polymarkets-april-2026-upgrade-new-stablecoin-faster-order-matching-smart-contract-wallet-support/)). Third, **EIP-1271 support** opens the venue to smart-contract wallets and account abstraction, which is the relevant integration surface for institutional desks that don't sign with raw EOAs.

The cost is concentrated and known: ~1 hour of downtime, every resting V1 order wiped, V1 SDKs bricked, and a one-time user-prompt to convert USDC to pUSD ([help.polymarket.com](https://help.polymarket.com/en/articles/14762452-polymarket-exchange-upgrade-april-28-2026)).

## Evidence

- All open V1 orders cleared during the maintenance window; users and market makers must re-place orders post-cutover, confirmed by Polymarket itself ([help.polymarket.com](https://help.polymarket.com/en/articles/14762452-polymarket-exchange-upgrade-april-28-2026)).
- Polymarket pre-funded $1M in maker rebates for cutover day, with $500k allocated to the first two hours to compress the depth-refill window ([binance.com](https://www.binance.com/en/square/post/317390137282162)).
- V2 EIP-712 signing adds three required fields (`timestamp`, `metadata`, `builder`) and removes three (`feeRateBps`, `nonce`, `taker`) — the `builder` field is the on-chain handle that drives integrator rebates ([docs.polymarket.com](https://docs.polymarket.com/v2-migration)).
- Polymarket's CTFv2 contracts were audited by Cantina and Quantstamp prior to deployment ([help.polymarket.com](https://help.polymarket.com/en/articles/14762452-polymarket-exchange-upgrade-april-28-2026)).
- Volume context: Polymarket's 30-day volume going into the cutover was ~$9.55B, with monthly fee revenue ~$25M and an annualized run-rate near $300M ([crypto.news](https://crypto.news/polymarket-rolls-out-clob-v2-with-1m-liquidity-rewards-to-harden-prediction-markets/)) — the platform is upgrading into rising volume, not falling.

## Key papers

- **Yang, Cheng, & Zou (2026), "Arbitrage Analysis in Polymarket NBA Markets,"** SSRN preprint 6624718 ([ssrn.com](https://doi.org/10.2139/ssrn.6624718)) — surfaced via OpenAlex; the SSRN abstract page is currently 403'd from this environment, so only metadata is verified. As the most recent listed academic study of executable arbitrage on Polymarket binary books, it is the primary place to expect post-cutover follow-up: V2 nonce/race-condition removal should mechanically raise hit-rate on resting two-sided quotes, and builder-code rebates should lower the maker break-even — both are testable against the paper's pre-V2 baseline once the dataset is updated.
- **Gebele & Matthes (Jan 2026), "LOOP Violations in Cross-Platform Prediction Markets,"** arXiv:2601.01706. Documents persistent 2–4% cross-platform price gaps across ~100k semantically-aligned events on 10 venues (2018–2025), framed as structural friction (capital cost, fragmented liquidity, identity ambiguity), not information disagreement. V2 reduces *one* of those frictions — Polymarket-side execution cost — but does not touch fragmented liquidity across venues. The structural-friction frame survives the cutover.

## What would change my mind

- **Falsified if** median top-20-binary touch spread through 2026-05-12 stays equal-or-wider than the 7-day pre-cutover (2026-04-21 to 2026-04-27) baseline measured on Polymarket's own data feed, despite the $1M rebate program clearing.
- **Falsified if** the $1M maker-rebate program is exhausted on day one without depth recovery at the inside (defined: top-of-book quoted size on top-20 markets back to ≥80% of pre-cutover 7-day average within 48 hours).
- **Falsified if** a post-cutover contract bug or oracle-handling regression triggers a paused-trading event longer than 4 hours in the first 14 days — which would signal the audit dual-cover (Cantina + Quantstamp) missed something material.
- **Falsified if** Polymarket announces a chain migration off Polygon within 14 days, since pUSD lives on Polygon and any imminent move would re-fragment the very liquidity V2 is trying to consolidate.

## Open questions

- Will builder-code rebates concentrate flow with one or two front-end aggregators (winner-take-most) or stay diffused — and which regime is better for Revenant-class resting-quote agents?
- Does EIP-1271 + account-abstraction support measurably move institutional flow on-net, or is regulatory clarity (CFTC duopoly framing) the binding constraint?
- Does V2's removal of `feeRateBps` from order signing (fees now set at match time) materially affect the hermes-arb min-gap calibration (currently 7pp, with deep-research recommending 7.5–8pp)?

## Connections

- **CalibrationGap / Revenant** (`memory/MEMORY.md`): Revenant's resting-quote book was wiped at 11 UTC; the `py-clob-client` install block listed as a Polymarket-side blocker in `memory/topics/polymarket.md` is now moot — `py-clob-client-v2` is the only path. V2's race-condition fix should mechanically lift Revenant's match-rate.
- **hermes-arb settlement basis** (`memory/topics/polymarket.md`): V2 does not change Polymarket's Chainlink Data Streams settlement; the dual-clock structural gap vs Kalshi's BRTI-mean settlement persists. V2 is execution-layer; settlement-layer asymmetry is unchanged.
- **Comments-side ops feed** (`memory/topics/polymarket.md`): V2 cutover was reported in real time by tracked handles @taerv534 (advance flag), @Crooked-Setting and @Boring-Comportment (orderbook-wipe confirmation at 12:41–12:45 UTC) — the comments-side telemetry beat official Polymarket status messaging on go-live confirmation.

## Sources

**Academic**
- Yang, Cheng, & Zou (2026), "Arbitrage Analysis in Polymarket NBA Markets," SSRN 6624718 — https://doi.org/10.2139/ssrn.6624718
- Gebele & Matthes (Jan 2026), arXiv:2601.01706, LOOP-violations paper — https://arxiv.org/abs/2601.01706

**Web (primary first)**
- Polymarket Help Center, "Polymarket Exchange Upgrade: April 28, 2026" (2026-04, primary) — https://help.polymarket.com/en/articles/14762452-polymarket-exchange-upgrade-april-28-2026
- Polymarket Documentation, "Migrating to CLOB V2" (2026-04, primary developer) — https://docs.polymarket.com/v2-migration
- Polymarket clob-client-v2 GitHub repo — https://github.com/Polymarket/clob-client-v2
- crypto.news, "Polymarket rolls out CLOB v2 with $1M liquidity rewards" (2026-04) — https://crypto.news/polymarket-rolls-out-clob-v2-with-1m-liquidity-rewards-to-harden-prediction-markets/
- Bitcoin.com News, "Polymarket's April 2026 Upgrade" (2026-04) — https://news.bitcoin.com/polymarkets-april-2026-upgrade-new-stablecoin-faster-order-matching-smart-contract-wallet-support/
- Binance Square, "Polymarket Launches Upgraded CLOB v2 Trading Platform" (2026-04-28, post-cutover) — https://www.binance.com/en/square/post/317390137282162
- The Block, "Polymarket unveils plans for trading engine overhaul, native stablecoin" (2026-04) — https://www.theblock.co/post/396450/polymarket-unveils-plans-trading-engine-overhaul-native-stablecoin
