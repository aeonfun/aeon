![hero](../images/explainer-2026-05-03.jpg)

<!-- hero image queued via .pending-replicate/explainer-2026-05-03.json; postprocess generates the file after Claude exits -->
<!-- image prompt: Technical schematic illustration of an information-theoretic market analysis engine, dark navy background, thin cyan and amber lines. Two labeled probability distribution histograms on the left reading "SWARM P" and "MARKET Q" feeding into a central rectangular block labeled "JS DIVERGENCE = 0.5*KL(P||M) + 0.5*KL(Q||M)". A horizontal gauge below the block labeled "[0, log 2]" with a vertical tick crossing a threshold line labeled "TRIGGER". Above, a second pathway labeled "NEGATION PAIR" with two market title boxes reading "E" and "NOT E" connected by a dotted line labeled "semantic match", feeding a sum block reading "P(E) + P(NOT E) = 1?". Monospace labels, blueprint aesthetic, technical paper figure style, 16:9, no human figures, no photorealistic elements. -->

# PolySwarm reads two markets as one distribution. The gap is the trade.

**Key idea in one sentence:** PolySwarm flags Polymarket mispricings by treating the swarm's consensus as one probability distribution and the market's implied price as another, scoring the gap with Jensen-Shannon divergence — and on negation pairs (event E and its logical opposite), it just checks whether the two YES prices sum to 1.

## The Setup

Polymarket bleeds money on math. A 2025 IMDEA / arXiv study tagged 7,051 of 17,218 conditions as single-market arbitrage — 41% — with the median pair summing to roughly $0.60 instead of $1.00 ([arXiv:2508.03474](https://arxiv.org/abs/2508.03474)). Sophisticated traders extracted around $40M in mathematically-guaranteed profit between April 2024 and April 2025 ([navnoorbawa Substack](https://navnoorbawa.substack.com/p/prediction-market-arbitrage-how-quants)). Most quant scanners catch the numerical version of this. They miss the language version — two near-identical-clause markets resolved opposite because of one word in the resolution text. PolySwarm, an April 2026 paper from Barot and Borkhatariya ([arXiv:2604.03888](https://arxiv.org/abs/2604.03888)), drops a JS-divergence layer on top of semantic-similarity title matching. That's the right shape for the language case.

## The Intuition Pump

Two thermometers in the same room. One reads 70°F, the other 71°F. JS divergence is the bounded "average disagreement" — symmetric, capped at log 2 nats (~0.693), so neither thermometer's scale dominates. One number. Cross a threshold, the room is being misreported. Where the analogy breaks: a thermometer doesn't lie. Prediction markets do. And the swarm of 50 LLM personas doing the second reading can be wrong in correlated ways — every persona reading the same headline mishears it the same way, so the disagreement number stays small even when both sides are off. The mechanism is information-theoretic. The failure mode is sociological.

## How It Actually Works

1. **Build distribution P (swarm).** 50 LLM personas independently rate the market. Confidence-weighted Bayesian fusion produces P, the swarm's posterior over the binary outcome.
2. **Build distribution Q (market).** Pull the order-book mid for the YES contract. Q = (price_yes, 1 − price_yes).
3. **Compute KL divergence.** D_KL(P‖Q) = Σ P(x) log(P(x)/Q(x)). Asymmetric. It punishes the swarm for putting mass on outcomes the market underprices.
4. **Compute JS divergence.** D_JS(P‖Q) = 0.5·D_KL(P‖M) + 0.5·D_KL(Q‖M), where M = 0.5(P+Q). Symmetric, bounded in [0, log 2], a proper metric. This is the actual trade signal.
5. **Single-market trigger.** Trade fires only when expected value > 5% **and** swarm standard deviation < 30%. Below 30% std means the personas agree; if they don't, the swarm itself is unsure and PolySwarm sits out.
6. **Negation-pair detector.** Scan all market titles. Cluster pairs by semantic similarity into (E, ¬E). The no-arbitrage condition demands P(E_yes) + P(¬E_yes) = 1. Flag deviation past a configurable threshold (the paper does not name the value). This is where the language-asymmetry hook lives — title-string semantic matching is what surfaces "Iran ends ops" vs "Hezbollah ceasefire," not raw price math.
7. **Size with quarter-Kelly.** On flagged trades, position = 0.25 × Kelly fraction implied by the divergence-derived edge. Caps drawdown when the swarm is wrong.

## Numbers That Anchor It

- 41% of Polymarket conditions (7,051 / 17,218) had single-market arbitrage on the IMDEA crawl ([arXiv:2508.03474](https://arxiv.org/abs/2508.03474)).
- Median mispricing: paired markets summed to ~$0.60 instead of $1.00 — 40% off ([arXiv:2508.03474](https://arxiv.org/abs/2508.03474)).
- NegRisk multi-condition arbitrage: 8.6% of opportunities, 73% of profits ([Bawa NegRisk writeup](https://medium.com/@navnoorbawa/negrisk-market-rebalancing-how-29m-was-extracted-from-multi-condition-prediction-markets-2f1f91644c5b)).
- ~$40M total guaranteed-profit extraction April 2024 to April 2025 ([navnoorbawa Substack](https://navnoorbawa.substack.com/p/prediction-market-arbitrage-how-quants)).
- JS divergence range: [0, log 2] ≈ [0, 0.693] nats ([Wikipedia: Jensen-Shannon divergence](https://en.wikipedia.org/wiki/Jensen%E2%80%93Shannon_divergence)).
- PolySwarm single-market trigger gates: EV > 5%, swarm std-dev < 30% ([arXiv:2604.03888](https://arxiv.org/html/2604.03888v1)).

## What Would Break This

The paper publishes formulas and gates. It does not publish results. No Brier scores, no calibration error, no log-loss, no win rate, no Sharpe, no actual divergence threshold value, no count of markets evaluated. The abstract claims swarm aggregation "consistently outperforms single-model baselines" with no table behind the claim. If Barot and Borkhatariya release numbers and the JS-divergence engine fails to beat a single GPT-4-class baseline on the same Polymarket sample, the mechanism is dressed-up linear arithmetic. A second falsifier: re-run the negation-pair detector on a 2026 Polymarket crawl. If the median paired-market gap is now under 1% — i.e., the IMDEA-era $0.60 mispricings are arbed away — the engine has nothing to extract no matter how clean the math.

## Why It Matters

CalibrationGap, the operator's live Polymarket agent, is at 29 closed trades, 76% win rate, +$415 P&L. Its quant scanner catches numerical inconsistencies — paired YES/NO not summing to 1, simple cross-market arbs. It misses the language-asymmetry case (Iran ceasefire NO 0.25% vs Hezbollah ceasefire YES 99.85%, near-identical clauses, resolved opposite). JS divergence on top of semantic-similarity title matching is the right shape for that class of miss. PolySwarm is the operationalized full stack of swarm-fund-mvp's CalibrationGap + Hermes-arb in one paper — independent third-party validation of the architecture. Cite it as prior art on the next grant application. Then ignore the abstract's marketing claims until the authors publish a benchmark.

## Sources

- [PolySwarm: A Multi-Agent Large Language Model Framework for Prediction Market Trading and Latency Arbitrage](https://arxiv.org/abs/2604.03888) — primary, arXiv:2604.03888, Barot/Borkhatariya, April 2026
- [PolySwarm HTML rendering on arXiv](https://arxiv.org/html/2604.03888v1) — primary, full text source for the divergence formulas and gate values
- [Unravelling the Probabilistic Forest: Arbitrage in Prediction Markets](https://arxiv.org/abs/2508.03474) — primary, IMDEA Networks, the 41% / $0.60 / 17,218-condition dataset
- [Prediction Market Arbitrage: How Quants Extracted $40M From Structural Mispricing](https://navnoorbawa.substack.com/p/prediction-market-arbitrage-how-quants) — secondary, $40M extraction figure
- [NegRisk Market Rebalancing: How $29M Was Extracted From Multi-Condition Prediction Markets](https://medium.com/@navnoorbawa/negrisk-market-rebalancing-how-29m-was-extracted-from-multi-condition-prediction-markets-2f1f91644c5b) — secondary, NegRisk profit-share decomposition
- [Jensen-Shannon divergence — Wikipedia](https://en.wikipedia.org/wiki/Jensen%E2%80%93Shannon_divergence) — reference, formula and bounds
