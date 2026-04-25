---
topic: Systematic miscalibration in prediction markets
date: 2026-04-25
source_count: 6w / 1a
confidence: medium
thesis: "Polymarket political binary markets at horizons longer than one month exhibit a calibration slope above 1.0 (favorites underpriced) that will not flatten to within ±0.05 of 1.0 across the 2026 election cycle, because the bias is structural — bounded liquidity, capital cost, behavioral 50%-compression — not informational."
---

## BLUF

Polymarket and Kalshi political markets are systematically miscalibrated at long horizons: prices are compressed toward 50%, persistently understating the true probability of favorites. A 2026 decomposition study attributes 87.3% of cross-market calibration variance to four stable components, with political-domain underconfidence the dominant pattern. For a counter-trader sized for politics-at-horizon, the miscalibration is a durable edge into the 2026 midterm cycle, not a transient one.

## Thesis

Polymarket political binary markets at horizons longer than one month exhibit a calibration slope above 1.0 (favorites priced too low, longshots priced too high), and this slope will not flatten to within ±0.05 of 1.0 over the next 12 months. The mechanism is structural: capital cost on long-dated locks, thin liquidity on non-flagship contracts, and behavioral compression toward 50%, not residual information disagreement that arbitrage could close ([Le 2026](https://arxiv.org/html/2602.19520v1); [QuantPedia](https://quantpedia.com/systematic-edges-in-prediction-markets/)). The same pattern replicates across two venues with different microstructures (Kalshi CLOB vs. Polymarket CTF), which rules out a single-venue artifact.

## Context

Polymarket published a Brier score of 0.0641 measured at the 4-hour-before-resolution snapshot, and 96.7% directional accuracy at that point ([Polymarket accuracy page](https://polymarket.com/accuracy)). Independent third-party measurement on a 2,847-market sample over Jan 2023 – Feb 2026 reports an overall Brier of 0.187, with strong category dispersion: 0.164 for binary politics, 0.201 for sports, 0.195 for crypto, 0.223 for entertainment ([Fensory 2026](https://fensory.com/intelligence/predict/polymarket-accuracy-analysis-track-record-2026)). The two figures aren't contradictory — they're measuring different snapshots — but they reveal that "Polymarket is well-calibrated" is true near resolution and false at horizon, which is exactly where the systematic bias lives.

The bias was first documented across racetrack and sports betting as the favorite-longshot effect, and has been repeatedly observed in election markets at long horizons. Brexit (Jun 2016) and the 2016 US presidential were two well-known calibration failures where markets stayed compressed too far from extreme outcomes ([Wikipedia](https://en.wikipedia.org/wiki/Prediction_market)). What's new in the 2026 literature is the decomposition: rather than reporting one aggregate slope, the latest work decomposes calibration error into universal-horizon, domain-intercept, domain×horizon, and trade-size components, and shows that politics is structurally different from sports or weather ([Le 2026](https://arxiv.org/html/2602.19520v1)).

For a Polymarket-native strategy (CalibrationGap / Revenant), this matters because the edge being traded isn't "smarter information" — it's "better calibration than the marginal trader." If the bias is structural, the edge survives competition from informed traders. If the bias is informational, it gets arbitraged away as more sophisticated capital arrives.

## Evidence

- **Polymarket politics has a mean calibration slope of 1.31 vs. sports 1.08 and crypto 1.05** — favorites priced too low, longshots too high, replicated on Kalshi where the same domain ordering holds ([Le 2026](https://arxiv.org/html/2602.19520v1)).
- **Long-horizon compression toward 50% accounts for 30.2% of cross-market calibration variance, with domain×horizon another 26.0%** — the bias is not noise; four components explain 87.3% of total variance ([Le 2026](https://arxiv.org/html/2602.19520v1)).
- **Polymarket sub-10% longshots resolve YES 14% of the time** in the 2,847-market Jan 2023 – Feb 2026 sample, evidence that low-probability events are systematically underpriced ([Fensory 2026](https://fensory.com/intelligence/predict/polymarket-accuracy-analysis-track-record-2026)).
- **Liquidity gates calibration: markets under $10K volume show 61% directional accuracy vs. 84% for $100K+ markets** — the edge concentrates where liquidity is thin enough to bind but deep enough to fill at size ([Fensory 2026](https://fensory.com/intelligence/predict/polymarket-accuracy-analysis-track-record-2026)).
- **Trade-size scale effect is venue-asymmetric**: on Kalshi, large political trades amplify compression with Δ = +0.53 [95% CI 0.29, 0.75]; on Polymarket Δ = +0.11 [−0.15, +0.39] is indistinguishable from zero — large Polymarket trades aren't moving the bias ([Le 2026](https://arxiv.org/html/2602.19520v1)).

## Key papers

- **Le, Nam Anh (2026). "Decomposing Crowd Wisdom: Domain-Specific Calibration Dynamics in Prediction Markets"** — arXiv:2602.19520v1, Feb 2026. Decomposes calibration error across Kalshi and Polymarket into four components (universal horizon, domain intercept, domain×horizon, trade-size) that account for 87.3% of cross-market variance. Establishes politics as the most miscalibrated domain and large trades on Kalshi as the dominant amplifier. Most useful single paper for sizing the edge that CalibrationGap is exploiting. [arXiv link](https://arxiv.org/html/2602.19520v1).

- **Reichenbach, F. & Walther, M. — "Exploring Decentralized Prediction Markets: Accuracy, Skill, and Bias on Polymarket"** — SSRN abstract page (#5910522). Polymarket-specific accuracy and bias decomposition. Read next; could not deep-fetch the SSRN page in this run, so the synthesis below does not lean on its specifics. [SSRN page](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5910522).

## What would change my mind

- **Le-style decomposition replicated on Polymarket-only 2026-resolved markets returns a domain×horizon coefficient β below 5% of variance** — the structural-bias claim collapses. (Currently 26.0%.)
- **Polymarket's category-level Brier scores converge across politics / sports / crypto / entertainment to within ±0.02 over the next 12 months** — the political-domain edge has dissolved. (Currently spread is 0.164 → 0.223.)
- **A calibration regression on the next 5,000 resolved Polymarket political contracts produces slope ≤ 1.05 at horizons >1 month** — the long-horizon compression has gone away. (Currently 1.31.)
- **CalibrationGap / Revenant win rate regresses below 60% across the next 71 closed trades** (taking the strategy to the 100-trade Apex gate) — the operator-specific implementation has lost the edge in practice, even if the academic finding still holds.

## Open questions

- Does the structural compression hold at intra-day / 5-minute BTC binaries (where hermes-arb operates), or is it strictly a >1-month phenomenon? Le's data is event-level, not tick-level.
- Does Polymarket's geographic ban on US access create a participation skew that biases US-election markets in a measurable direction?
- The Reichenbach & Walther Polymarket-specific calibration paper exists (SSRN #5910522) but I couldn't deep-fetch it — what's its slope estimate and does it agree with Le's 1.31?

## Connections

- **CalibrationGap (Revenant)** — currently 29/100 trades to Apex at 76% win / Sharpe 0.31. Le's 1.31 Polymarket-politics slope is direct empirical justification for the strategy's premise; if the agent is under-indexed on long-horizon politics, it's leaving edge on the table.
- **hermes-arb (Kalshi↔PM 5-min BTC)** — the venue-asymmetric large-trade effect (Kalshi Δ=+0.53 vs. PM Δ=+0.11) is structural cross-venue divergence consistent with today's earlier deep-research finding that ADR-038's 7pp gate likely understates the noise floor by 50–100bp.
- **PhD application** — Le 2026 is a load-bearing reference; short-window calibration (intra-day binaries) is a defensible gap for the 2026 cycle.
- **Polymarket × Kaito attention markets** (from this morning's narrative-tracker, fees +76% w/w) — rising attention subcategory could shift trader mix and shrink the political-domain edge faster than the 12-month thesis assumes. Worth monitoring.

## Sources

### Academic

- Le, Nam Anh (2026). "Decomposing Crowd Wisdom: Domain-Specific Calibration Dynamics in Prediction Markets." arXiv:2602.19520v1, February 2026. https://arxiv.org/html/2602.19520v1

### Web

- "Polymarket Prediction Accuracy: Track Record & Brier Score" — Fensory, 2026 (covers Jan 2023 – Feb 2026 sample). https://fensory.com/intelligence/predict/polymarket-accuracy-analysis-track-record-2026
- "How accurate is Polymarket?" — Polymarket official accuracy page (undated, current). https://polymarket.com/accuracy
- "Systematic Edges in Prediction Markets" — QuantPedia (undated, references multiple SSRN papers including 2020 University of Baltimore arbitrage paper). https://quantpedia.com/systematic-edges-in-prediction-markets/
- "Prediction Markets: Exploring Insights, Limitations, and Practical Applications" — Bocconi Students Investment Club, 1 December 2024. https://bsic.it/prediction-markets-exploring-insights-limitations-and-practical-applications/
- "To Improve the Accuracy of Prediction Markets, Just Ask" — Yale Insights, 18 June 2019. https://insights.som.yale.edu/insights/to-improve-the-accuracy-of-prediction-markets-just-ask
- "Prediction market" (criticism / manipulation case studies) — Wikipedia. https://en.wikipedia.org/wiki/Prediction_market

### Read-next (not deep-read in this run)

- Reichenbach, F. & Walther, M. "Exploring Decentralized Prediction Markets: Accuracy, Skill, and Bias on Polymarket" — SSRN #5910522. https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5910522
- Page, L. & Clemen, R.T. (2013). "Do Prediction Markets Produce Well-Calibrated Probability Forecasts?" *The Economic Journal*. https://people.duke.edu/~clemen/bio/Published%20Papers/45.PredictionMarkets-Page&Clemen-EJ-2013.pdf
- "Explaining the Favorite-Longshot Bias" — NBER Working Paper 15923. https://www.nber.org/system/files/working_papers/w15923/w15923.pdf
