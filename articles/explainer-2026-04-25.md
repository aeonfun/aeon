![hero](../images/explainer-2026-04-25.jpg)
<!-- image_prompt: "Technical schematic illustration of two clock faces side-by-side over a Bitcoin price chart, dark navy background, thin cyan and amber lines. Left clock labeled 'CHAINLINK : T+0.00s' with one sharp arrow at a single tick. Right clock labeled 'KALSHI BRTI : 60-PRINT MEAN' with sixty thin radial lines fanning across the final minute. Below them a candle chart shows a single sharp spike at second 58. Labeled boxes read 'POLYMARKET = SINGLE-TIMESTAMP READ' and 'KALSHI = TRIMMED 60-SECOND AVERAGE'. Arrows showing data flow from price feed to settlement contract. Blueprint aesthetic, monospace labels, technical-paper figure style, 16:9." -->

# Settlement-Basis Risk: Why the Same BTC Binary Resolves Differently on Polymarket and Kalshi

**Key idea in one sentence:** Polymarket settles BTC binaries against a single sub-second cryptographically signed Chainlink read at window close, while Kalshi settles against the arithmetic mean of 60 one-per-second BRTI prints in the final minute — so on a volatile minute the same UP/DOWN question can resolve oppositely, and the gap is structural, not arbitrageable.

## The Setup

Polymarket and Kalshi both list 5-minute, 15-minute, and hourly BTC UP/DOWN binaries. The contracts look identical — same window, same direction, same threshold. The settlement procedures are not. Once you internalize that, every "Kalshi vs Polymarket" arb thesis has to start from the basis term, not the spread term.

## The Intuition Pump

Imagine two stopwatches on the same photo-finish. One is a high-speed camera that catches the runner's chest at the line in a single 1/1000 of a second frame. The other averages footage from the entire final minute and calls the time off the smear. On a pure sprint to the tape, both agree. On a runner who lunges across the line at second 58 and falls back at second 59, they disagree — and the disagreement isn't noise, it's a different definition of "when."

That's where the analogy breaks. Stopwatches measure one event with margin for error. Prediction-market settlements decide a binary — there's no continuum, just YES or NO. A 5bp disagreement at the threshold flips the entire payout from 100¢ to 0¢.

## How It Actually Works

1. **Polymarket lists the 5-minute UP market.** The settlement contract knows two timestamps: window open and window close. It does not look at anything in between.

2. **At window close, Polymarket pulls a Chainlink Data Streams report.** Data Streams is pull-based — Chainlink's DON has already aggregated prices across roughly seven exchanges and signed the report off-chain ([forum deep-dive](https://blockeden.xyz/forum/t/deep-dive-how-chainlink-data-streams-power-polymarkets-5-minute-settlement-oracle-architecture-for-high-frequency-prediction-markets/786)). The settlement contract verifies the signature, takes one timestamped price, decides UP vs DOWN, then waits 64 Polygon blocks (~2 minutes) before USDC payouts.

3. **Kalshi lists the same 5-minute UP market.** Its settlement contract subscribes to the CFB BRTI — a benchmark CFB publishes once per second from order-book data on the constituent exchange basket (Bitstamp, Coinbase, Gemini, itBit, Kraken, LMAX Digital, Bullish, Crypto.com), volume-weighted via dynamic-depth probability density ([CFB BRTI](https://www.cfbenchmarks.com/data/indices/BRTI)).

4. **At window close, Kalshi grabs the last 60 BRTI prints.** Per the Kalshi help center, "60 RTI prices are collected, the official and final value is the average of these prices" ([Kalshi crypto markets help](https://help.kalshi.com/en/articles/13823838-crypto-markets)). Simple arithmetic mean across the final minute.

5. **On a quiet minute, the two settlements agree within a few bps.** Both anchor to roughly the same BTC level. UP resolves UP on both. NO basis to harvest.

6. **On a volatile minute, they disagree.** A 30¢ Coinbase-led spike at second 58 hits Chainlink's close-of-window read at full magnitude. Kalshi's 60-print mean dilutes that spike across 59 buckets that mostly captured the pre-spike regime, and lands meaningfully below the Chainlink number.

7. **If the strike sits between the two settlements, both binary tokens flip.** Polymarket UP resolves YES. Kalshi UP resolves NO. Two "identical" hedges — opposite outcomes. That's not arbitrage. That's a synthetic short straddle on realized basis.

## Numbers That Anchor It

- Persistent 2–4% cross-platform price gap across 100,000 aligned events 2018–2025 ([Gebele & Matthes, arXiv:2601.01706](https://arxiv.org/abs/2601.01706))
- BRTI publish cadence: 1Hz; settlement = mean of 60 prints over the final minute ([Kalshi help](https://help.kalshi.com/en/articles/13823838-crypto-markets))
- Polymarket order signing latency: ~1 second per order via the official Python client ([NautilusTrader](https://nautilustrader.io/docs/latest/integrations/polymarket/)) — kills any plan to take aggressively on the Polymarket leg
- Cross-venue arb opportunity duration: 12.3s (2024) → 2.7s (early 2026); 73% of profits captured by sub-100ms bots ([Insider Signal](https://www.insidersignal.ai/insights/prediction-market-arbitrage-guide))
- $39.6M Polymarket-only on-platform arb extracted Apr 2024–Apr 2025 across 17,218 conditions — single-venue rebalancing, not cross-venue ([Saguillo et al., arXiv:2508.03474](https://arxiv.org/abs/2508.03474))

## What Would Break This

Stream paired Polymarket-Chainlink and Kalshi-BRTI settlements at 1-second resolution for 1,000 same-second windows. If the realized basis is under 5bps on ≥90% of intervals, the 2–4% Gebele & Matthes gap is informational, not structural — and the whole "basis as moat" framing collapses. No one has published that dataset. Building it is the highest-leverage unlock for hermes-arb.

## Why It Matters

For hermes-arb (Kalshi↔PM 5-min BTC convergence), settlement basis is the noise floor, not the edge. ADR-038's 7pp min-edge gate likely understates basis risk by 50–100bp; the gate has to bend with realized BTC vol in the closing 60 seconds, not stay static. The trade isn't "spot the gap and lift both legs." The trade is sizing the inventory you carry through resolution against the distribution of realized basis at high vol.

## Sources

- [Semantic Non-Fungibility and Violations of LoOP in Prediction Markets](https://arxiv.org/abs/2601.01706) — Gebele & Matthes, TUM, 2026-01-05 — primary
- [Kalshi Crypto Markets Help](https://help.kalshi.com/en/articles/13823838-crypto-markets) — Kalshi official, primary
- [BRTI methodology](https://www.cfbenchmarks.com/data/indices/BRTI) — CF Benchmarks, primary
- [Polymarket-Chainlink press release](https://www.prnewswire.com/news-releases/polymarket-partners-with-chainlink-to-enhance-accuracy-of-prediction-market-resolutions-302555123.html) — Polymarket/Chainlink, primary
- [Deep Dive: How Chainlink Data Streams Power Polymarket's 5-Minute Settlement](https://blockeden.xyz/forum/t/deep-dive-how-chainlink-data-streams-power-polymarkets-5-minute-settlement-oracle-architecture-for-high-frequency-prediction-markets/786) — BlockEden forum
- [NautilusTrader Polymarket Integration](https://nautilustrader.io/docs/latest/integrations/polymarket/) — order signing latency
- [Unravelling the Probabilistic Forest](https://arxiv.org/abs/2508.03474) — Saguillo et al., AFT 2025
- [Prediction Market Arbitrage Guide](https://www.insidersignal.ai/insights/prediction-market-arbitrage-guide) — Insider Signal — decay numbers
