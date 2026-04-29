<!-- hero image skipped: no-token (REPLICATE_API_TOKEN unset in this run) -->
<!-- intended hero-image prompt: "Technical schematic illustration of an EIP-712 order struct, dark navy background, thin cyan and amber lines, labeled boxes reading 'salt', 'maker', 'tokenId', 'timestamp', 'metadata', 'builder', a single bytes32 slot highlighted in amber as 'builder', arrows showing data flow from signed order into a CLOB matching engine and out to a USDC rebate distributor, blueprint aesthetic, monospace labels, 16:9" -->

# Polymarket's Builder Codes Are Just One `bytes32`. That's the Point.

**Key idea in one sentence:** Polymarket's V2 order struct adds a single `bytes32 builder` field inside the EIP-712 signed payload, and that one field — not a backend system, not a partner contract, not an off-chain attribution table — is the entire mechanism that routes ~16% of Polymarket's monthly volume and ~$2.5M in grants to third-party apps.

## The Setup

V1 Polymarket had no native way to credit a third-party app for the volume it sent. Integrator economics ran off-chain: spreadsheets, monthly check-ins, hand-paid USDC. Wrappers, copy-trade UIs, and dashboard frontends all routed orders into the same CLOB and got nothing programmatic back. That gap is exactly where most exchanges' integration ecosystems die — the builder ships an MVP, can't see their cut, and quits. The 2026-04-28 V2 cutover ([help.polymarket.com](https://help.polymarket.com/en/articles/14762452-polymarket-exchange-upgrade-april-28-2026)) closed the gap by signing the attribution into every order.

## The Intuition Pump

Builder codes look like an affiliate referral link. The integrator drops a code into a URL, the user clicks through, the platform pays a kickback. Same shape — except the URL is a cryptographically signed message and the click is an order fill that the matching engine has already settled.

Where the analogy breaks: a referral link can be stripped, replayed, or forged at the click. A builder code is sealed inside the EIP-712 hash the user signed — change the byte and the signature dies. Replay protection is structural, not enforced by a backend. The V2 stack moved attribution from "trust the partner's backend" to "trust the cryptographic primitive every Polymarket order already uses." That's the whole move.

## How It Actually Works

1. **The order struct gains three fields, loses four.** V2's EIP-712 typed data is `Order(uint256 salt, address maker, address signer, uint256 tokenId, uint256 makerAmount, uint256 takerAmount, uint8 side, uint8 signatureType, uint256 timestamp, bytes32 metadata, bytes32 builder)`. V2 added `timestamp`, `metadata`, `builder`. V2 removed `taker`, `expiration`, `nonce`, `feeRateBps` ([docs.polymarket.com](https://docs.polymarket.com/v2-migration)).

2. **The integrator's SDK encodes a `builderCode` string into `bytes32`.** No on-chain registration is required for the field itself — `builder` is a public identifier, not a permissioned address ([docs.polymarket.com](https://docs.polymarket.com/trading/orders/attribution)). A wrapper integrator picks a code, hashes it, drops it in.

3. **The user signs.** EIP-712 hashes the full struct, including the builder bytes. EIP-1271 support means the signer can be a smart-contract wallet — a desk doesn't need a raw EOA. That's the institutional integration surface.

4. **The matching engine doesn't validate the builder field.** It accepts whatever `bytes32` the signer signed. Tampering after-the-fact breaks the signature; an intermediary cannot rewrite the field in flight without invalidating the order. The cryptography does the policing.

5. **On match, the trade is indexed by `builder`.** Polymarket's accrual service tags every fill — both maker and taker side — with the bytes32 in the original order. Builders read their attributed volume via `getBuilderTrades()` from the SDK.

6. **Rebates settle daily, weighted by fee-equivalent.** For each filled maker order the system computes `fee_equivalent = C × feeRate × p × (1 − p)`, where `C` = shares traded, `p` = share price, `feeRate` ranges 0.030–0.072 by category. A builder's daily payout is `(your_fee_equivalent / total_fee_equivalent) × rebate_pool`, paid in USDC to the builder address ([docs.polymarket.com](https://docs.polymarket.com/developers/market-makers/maker-rebates-program)). $1 USDC minimum for distribution, per-market competition, no cross-market netting.

7. **The taker-side rebate split is fixed by category.** Crypto returns 20% of taker fees, Politics/Sports/Finance/Tech/Economics each 25%, Geopolitics 0% ([docs.polymarket.com](https://docs.polymarket.com/developers/market-makers/maker-rebates-program)). The `builder` field is the routing label that decides who in that pool actually gets paid.

## Numbers That Anchor It

- Builder-program volume rose from **$100M in Nov 2025 to $600M+ in March 2026** — 6x in four months, ~16% of Polymarket total volume by March ([phemex.com](https://phemex.com/news/article/polymarket-reviews-builders-program-amid-copy-trading-concerns-73411)).
- ~**200 developers** registered; up to **$2.5M in grants** earmarked across the program ([phemex.com](https://phemex.com/news/article/polymarket-reviews-builders-program-amid-copy-trading-concerns-73411)).
- **$1M cutover-day maker-rebate pool**, with $500k front-loaded into the first two hours after V2 went live, structured to refill the resting book before competing makers re-quoted ([crypto.news](https://crypto.news/polymarket-rolls-out-clob-v2-with-1m-liquidity-rewards-to-harden-prediction-markets/)).
- **`feeRate` envelope: 0.030–0.072** across categories — the multiplier inside the per-fill fee-equivalent formula ([docs.polymarket.com](https://docs.polymarket.com/developers/market-makers/maker-rebates-program)).
- 30-day total volume going into V2: **~$9.55B**, ~$25M monthly fees — the pool the rebate program redirects from ([crypto.news](https://crypto.news/polymarket-rolls-out-clob-v2-with-1m-liquidity-rewards-to-harden-prediction-markets/)).

## What Would Break This

If the builder field aligned integrator economics with depth provision, you'd expect the top builders by attributed volume to also be the names tightening inside-quote spreads on top-20 binaries. Falsifier: if 30 days post-V2, the highest-rebate builder accounts are dominated by copy-trade wrappers (replicating high-win-rate accounts, not posting two-sided depth) — the same concern Polymarket flagged when it paused the program for review in Q1 2026 ([phemex.com](https://phemex.com/news/article/polymarket-reviews-builders-program-amid-copy-trading-concerns-73411)) — then on-chain attribution rewarded routing rather than liquidity, and the mechanism is decorative rather than load-bearing.

## Why It Matters

For Polymarket: builder codes turn integrator attribution from a quarterly handshake into a per-fill cryptographic property — the kind of thing a CFTC-regulated venue can audit cleanly. For agentic infra: a `bytes32` slot inside a signed order is now a programmable revenue stream, which lowers the activation energy for any LLM agent or autonomous wrapper that wants to take a cut of the flow it generates without becoming a custodian. The architecture is reusable. The first US prediction market to ship it gets the network effect.

## Sources

- [Polymarket Documentation — Builder Program Overview](https://docs.polymarket.com/builders/overview) — primary
- [Polymarket Documentation — V2 Migration / EIP-712 Order Schema](https://docs.polymarket.com/v2-migration) — primary
- [Polymarket Documentation — Maker Rebates Program](https://docs.polymarket.com/developers/market-makers/maker-rebates-program) — primary
- [Polymarket Help Center — Exchange Upgrade Apr 28 2026](https://help.polymarket.com/en/articles/14762452-polymarket-exchange-upgrade-april-28-2026)
- [crypto.news — Polymarket rolls out CLOB v2 with $1M liquidity rewards](https://crypto.news/polymarket-rolls-out-clob-v2-with-1m-liquidity-rewards-to-harden-prediction-markets/)
- [Phemex News — Polymarket Reviews Builders Program Amid Copy-Trading Concerns](https://phemex.com/news/article/polymarket-reviews-builders-program-amid-copy-trading-concerns-73411)
