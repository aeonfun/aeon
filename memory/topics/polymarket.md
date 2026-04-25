# Polymarket — operational state

> Single source of truth for Polymarket-specific facts that surface across skills (CalibrationGap/Revenant edge, hermes-arb, polymarket-comments, monitor-polymarket, digest, deep-research). MEMORY.md links here.

## Account / attribution
- Polymarket proxy wallet: `0x0a10…52B1`
- Builder code (Revenant attribution): `0xcddc4ba3...8286f`
- Datacenter / VPN IP ban: Polymarket blocks GHA / co-lo IPs at the edge. Co-lo strategy applies to the **Hyperliquid leg only**; PM leg must run from residential / consumer egress.
- `py-clob-client` install blocked in current env — paper mode only for live order placement until resolved.

## Settlement mechanism (load-bearing for hermes-arb)
- **Polymarket BTC binaries:** single sub-second cryptographically signed Chainlink Data Streams read at window close.
- **Kalshi BTC binaries (CFB):** arithmetic mean of 60 one-per-second BRTI prints across the final minute (8-exchange basket; trim happens upstream in BRTI construction, not in Kalshi's settlement layer — earlier deep-research framing of "60s trimmed mean" is imprecise).
- Implication: on a volatile minute the **same UP/DOWN question can resolve oppositely** across venues. Gap is structural, not arbitrageable. See `articles/explainer-2026-04-25.md` for the dual-clock walkthrough.
- **Order signing latency:** Polymarket order signing is ~1s per order (NautilusTrader docs) — forces resting limits on PM leg, takes on Kalshi leg.

## Edge / decay numbers
- **LOOP violations** (Gebele & Matthes, arXiv:2601.01706, Jan 2026): persistent 2–4% cross-platform price gaps measured across ~100k aligned events 2018–2025 (10 venues). Frames residual gap as **structural friction (capital cost, fragmented liquidity, identity ambiguity), not information disagreement** — durable, not arb'd-away. Methodological contribution = semantic alignment over (NL description × resolution semantics × temporal scope). Paper does **not** zoom into 5-min / tick-level — that's open problem for hermes-arb.
- **Opportunity-duration decay** (vendor-source, T2/T3): 12.3s (2024) → 2.7s (early 2026). 73% of arb profit goes to sub-100ms bots. No T1 measurement of headline curve yet.
- **IMDEA Networks 2025**: $40M realized prediction-market arbitrage profits over 12 months across cross-platform binaries.
- **Hermes-arb ADR-038 gate:** 7pp min-gap = 2% PM taker + 5bps funding + 4.95pp buffer. Deep-research suggests gate likely understates noise floor by 50–100bp; bump to **~7.5–8pp** queued.
- **Sister-paper backlog:** arXiv:2508.03474 (probabilistic-forest arbitrage), 2511.20606 (LOB dynamics in matching markets — Kalshi CLOB tick structure), 2512.02436 (semantic trading, agentic alignment).

## Live market state (snapshot 2026-04-25)
- **Polymarket fees +76% w/w** (DeFiLlama) — confirms post-election handle persistence; high-volume binaries remain liquid → directly load-bearing for Revenant / CalibrationGap edge thesis.
- **Polymarket × Kalshi crypto-perps launch convergence:** Polymarket shipped perps Apr 21 (up to 10x leverage on BTC, NVDA, gold; sign-up waitlist only). Kalshi "Timeless" perps slipped from Monday to "coming weeks" — Apr 27 target now soft. Both venues moving from event contracts → derivatives. Gate.io listed pre-market perps at Kalshi $20.5B / Polymarket $14.35B implied valuation.
- **First US prediction-market insider-trading prosecution** (DOJ, Apr 23): Special Forces sergeant won $409K betting on the Maduro raid he planned. Coplan public response: "we flagged this, referred it, cooperated throughout the process." Both venues now leaning hard into compliance signaling.
- **Brazil ban:** Polymarket banned in Brazil (covered in today's prediction-markets digest).

## Comments-side calibration signals (from polymarket-comments today, var=narrative-shift mining politics+crypto)
Recurring high-signal handles:
- **@Ignorant-Case** — geopolitical primary-source reasoning (e.g. Iran ceasefire UMA dispute: Jalili appointed + Qalibaf removed → "ultimate signal that a quick deal is DEAD"; INARA legal review takes 30+ days)
- **@Valid-Bonding** — NYT/Reuters citations
- **@Beautiful-Interpreter** — Iranian-official direct quotes
- **@Tart-Recommendation** — whale-flow callouts on BTC books
- **@Dimpled-Planet** — UMA-resolution playbook
- **@Glossy-Carpenter** — cross-market arb candidate flags (BTC $150k duplicate-market price discrepancy)

Concrete tradable hooks today: Iran ceasefire UMA-dispute (near-deterministic NO read from comments), Fed Chair "Other" synthetic-position arb (bet no → convert → sell yes leg), BTC $150k duplicate-market.

## Open work / blockers
- 100-trade Apex gate — 71 trades to go on CalibrationGap/Revenant (current 29 closed / 76% / +$415 / Sharpe 0.31). 2–3 weeks at current rate.
- `py-clob-client` install blocked → paper mode only for live order placement.
- Tier-1 latency for PM leg blocked by datacenter/VPN ban; co-lo strategy applies to HL only.
- Need to wire Kalshi-BRTI vs PM-Chainlink **basis recorder** into hermes-arb backtest (deep-research recommendation).

## Source-of-truth pointers
- `articles/deep-research-2026-04-25.md` — Kalshi↔PM 5-min BTC arb deep-dive (32 sources)
- `articles/explainer-2026-04-25.md` — settlement-basis dual-clock mechanism walkthrough
- `articles/research-brief-prediction-market-calibration-2026-04-25.md` — calibration-slope structural-bias thesis
- Live `metrics.json`: https://rswarm.ai/metrics.json (trust this over MEMORY.md when they conflict)
- arXiv:2601.01706 (Gebele & Matthes) — primary LOOP-violation citation for grant applications
- arXiv:2512.25070 (Chandak, Goel, Prabhu, Hardt, Geiping) — PhD-prep calibration-training paper
