---
topic: Resolution-text ingestion for prediction-market trading agents
date: 2026-05-08
source_count: 7w / 3a
confidence: medium
thesis: "A Polymarket trading agent that ingests full resolution-criteria text and routes around clauses with high historical dispute rates will outperform a title-only baseline by at least 3pp net on a rolling 100-trade window within 90 days."
---

## BLUF

A clause-aware Polymarket agent now beats a title-only agent by a measurable margin. $972.4M of Polymarket volume sits in disputed events; semantically equivalent contracts persist 2-4% apart across venues; and on the same Super Bowl night Cardi B's halftime appearance settled YES at $1.00 on Polymarket and NO at $0.26 on Kalshi. Title-only feeds price the headline; clause-aware feeds price the payout function.

## Thesis

A trading agent that ingests Polymarket's full resolution-criteria text — clause, source-of-truth, edge-case rules — and weights confidence by the historical dispute rate of similar clauses will outperform a title-only baseline by ≥3pp net on a rolling 100-trade window within 90 days. The justification is empirical: Wen et al. (2026) measured $972,370,804.71 of disputed-event volume on Polymarket alone, and Gebele & Matthes (2026) found that semantically equivalent markets across ten venues hold 2-4% execution-aware price deviations that do not arbitrage out ([arXiv 2604.15674](https://arxiv.org/abs/2604.15674); [arXiv 2601.01706](https://arxiv.org/abs/2601.01706)). The mispricing is structural, persistent, and addressable with text input agents already accept.

## Context

The thing prediction markets sell is a binary settlement. The thing they show traders is a title. The two are not the same artifact. Polymarket itself states the convention bluntly: "the market title describes the market, but the rules define how it should be resolved" ([Polymarket Help Center](https://help.polymarket.com/en/articles/13364548-how-are-markets-clarified)).

For most of Polymarket's history this gap was rounding error. With 2026 volume at the $1B-disputed mark and venue count rising, it is no longer rounding error. Three forces compound. First, ambiguous-clause supply is rising: Polymarket has begun issuing clarifications more liberally, partly in response to growing mistrust in the UMA process and an increase in poorly written market descriptions ([PolymarketGuide Archive](https://polymarketguide.gitbook.io/polymarketguide-archive/precedents/polymarket/market-clarifications)). Second, settlement-divergence risk is now empirically observed across venues. Third, agent traders have proliferated faster than agent-readable resolution metadata, which means most automated capital is still trading the title.

Two specific 2026 cases anchor the argument. Cardi B's Super Bowl appearance produced opposite resolutions on the same evening: Kalshi invoked Rule 6.3(c) and settled at $0.26 YES on $47.3M of volume; Polymarket relied on consensus-of-credible-reporting and settled YES at $1.00 on >$10M ([DeFirate](https://defirate.com/prediction-markets/how-contracts-settle/)). On Polymarket, Iran-airspace markets quoting the same five-airport closure clause priced 4% YES on the May-8 ladder while a sibling "major closure" market priced 52% YES — a 48pp clause-text divergence that the quant scanner used by the operator's CalibrationGap agent could not see (`memory/topics/polymarket.md`).

## Evidence

- $972,370,804.71 of Polymarket trading volume sits in events that were disputed at least once, per the Wen et al. dataset compiled from on-chain UMA voting records ([arXiv 2604.15674](https://arxiv.org/abs/2604.15674)).
- Semantically equivalent prediction markets across ten venues, 2018-2025, show persistent 2-4% execution-aware price deviations on the ~6% of events that are cross-listed ([arXiv 2601.01706](https://arxiv.org/abs/2601.01706)).
- Web-enabled LLMs reach 89.58% agreement with UMA's final dispute resolutions when asked to arbitrate after a dispute is already raised, but cannot reliably predict which markets will be disputed in advance ([arXiv 2604.15674](https://arxiv.org/abs/2604.15674)).
- Polymarket's documented dispute timeline runs 2-hour challenge → 24-48 hour debate → ~48 hour token-holder vote, which means clause-aware agents have a measurable window to act on disputed-state pricing before final settlement ([Polymarket Help Center](https://help.polymarket.com/en/articles/13364551-how-are-markets-disputed)).
- Legal-domain prediction markets compress non-binary court outcomes — pluralities, dismissals, remands — into binary contracts, forcing drafters to write clauses "easy enough to parse without butchering the law" and producing systematic title-vs-rule divergence ([U Chicago Law Review, 2026-03-04](https://lawreview.uchicago.edu/online-archive/when-market-watches-court)).

## Key papers

- **Can LLMs Help Decentralized Dispute Arbitration? A Case Study of UMA-Resolved Markets on Polymarket** — Wen, Zhou, Huang. Published 2026-04-17. Builds an on-chain dataset of every disputed Polymarket event, totaling $972.4M in volume, and benchmarks web-enabled LLMs against UMA's DVM votes. Finds 89.58% post-dispute agreement and zero predictive power before disputes are raised. This is the strongest available baseline for "what an LLM can do once it sees the clause." [arXiv:2604.15674](https://arxiv.org/abs/2604.15674)
- **Semantic Non-Fungibility and Violations of the Law of One Price in Prediction Markets** — Gebele & Matthes. Published 2026-01-05. 100,000+ events across ten venues, 2018-2025; ~6% cross-listed; 2-4% persistent semantic-equivalence price deviation that does not collapse to arbitrage because event identity is unclear across platforms. The paper's framing — "structural friction, not informational disagreement" — is the cleanest available statement of the alpha. [arXiv:2601.01706](https://arxiv.org/abs/2601.01706)
- **Per-Market Information Leakage Score (ILS-dl)** — Nechepurenko et al. The 0.444-magnitude leakage shift on the Iran-cluster slice (already cited in `memory/topics/papers.md`) is the methodological scaffold for measuring clause-vs-title divergence inside a single venue. [arXiv:2605.02286](https://arxiv.org/abs/2605.02286)

## What would change my mind

- A clause-aware Polymarket agent ships, runs ≥100 trades, and clears ≤1pp uplift over its title-only sibling on the same instrument set. Below 1pp the cost of clause ingestion (token spend + latency + a more brittle prompt surface) likely outweighs the lift.
- The 2-4% semantic-equivalence band measured by Gebele & Matthes collapses to <1% in the next replication after 2026 venue consolidation, indicating the gap is closing without intervention.
- Wen et al.'s 89.58% post-dispute LLM agreement fails to replicate at >85% on a held-out sample of 2026-Q3 disputes, implying LLMs cannot read clauses reliably enough to feed a trading signal.
- A direct head-to-head: a clause-text-blind quant model (e.g., a price-time-series-only baseline) outperforms a clause-aware LLM model over 100 matched markets. This would invert the priority order in the operator's roadmap.

## Open questions

- Does clause ingestion compose with the resolution-debate window (2-hour challenge + 24-48 hour debate)? Most edge probably lives in the dispute interval, not at clause-publication.
- Is the semantic-equivalence gap symmetric across topic classes? Cardi B and Iran-airspace are different beasts — sports-entertainment uses consensus-of-reporting, geopolitical uses literal-text. The clause type may be more predictive than the clause itself.
- Is dispute likelihood predictable from clause features alone, or does it require off-clause context (newscycle volatility, source-of-truth reliability)? Wen et al. say no for raw text; whether feature-engineered metadata changes that is open.
- Once a clause-aware agent shows lift, how fast does the gap close as competitors adopt it? The 2-4% band has held since 2018, which suggests slowly — but adoption pressure is now visibly higher.

## Connections

- **CalibrationGap (Revenant)** — The operator's lead Polymarket canary agent (29 trades, 76% win, +$415, Sharpe 0.31; `memory/MEMORY.md`) is currently title-only. ADR-096+ resolution-text-ingest is flagged in MEMORY.md as "the single highest-leverage CalibrationGap upgrade" with no open ADR slot. This brief is the cite stack for that ADR.
- **Iran-airspace 48pp clause-text divergence (2026-05-06)** — Same Polymarket five-airport clause priced 4% YES on May-8 ladder vs 52% YES on "major closure" sibling (`memory/topics/polymarket.md`). Direct empirical anchor for the thesis.
- **Iran-ceasefire-vs-Hezbollah-ceasefire UMA arbitrage** — 0.25% NO vs 99.85% YES on near-identical clauses; calibration gap not visible in the operator's quant scanner (`memory/MEMORY.md`).
- **Hermes-arb (Kalshi↔PM)** — `min-gap` 7pp → ~7.5-8pp queued. Gebele & Matthes' 2-4% structural floor is the exogenous validator for raising the gate.
- **Stanford PhD application (Dec 2026)** — Resolution-text-ingest sits cleanly inside agentic-finance / prediction-market-calibration. Cite stack: PolySwarm + Anatomy + Foresight Arena + TimeSeek + Prediction Arena + Wen-UMA + Gebele-LOOP.

## Sources

### Academic
- [arXiv:2604.15674](https://arxiv.org/abs/2604.15674) — Wen, Zhou, Huang. *Can LLMs Help Decentralized Dispute Arbitration? A Case Study of UMA-Resolved Markets on Polymarket.* 2026-04-17.
- [arXiv:2601.01706](https://arxiv.org/abs/2601.01706) — Gebele & Matthes. *Semantic Non-Fungibility and Violations of the Law of One Price in Prediction Markets.* 2026-01-05.
- [arXiv:2605.02286](https://arxiv.org/abs/2605.02286) — Nechepurenko et al. *Per-Market Information Leakage Score (ILS-dl).* 2026.

### Web
- [Polymarket Help Center — How Are Markets Clarified?](https://help.polymarket.com/en/articles/13364548-how-are-markets-clarified)
- [Polymarket Help Center — How Are Markets Disputed?](https://help.polymarket.com/en/articles/13364551-how-are-markets-disputed)
- [Polymarket Documentation — Resolution](https://docs.polymarket.com/concepts/resolution)
- [DeFirate — How Kalshi and Polymarket Settle Markets (Cardi B Super Bowl, 2026-02)](https://defirate.com/prediction-markets/how-contracts-settle/)
- [University of Chicago Law Review — When the Market Watches the Court (2026-03-04)](https://lawreview.uchicago.edu/online-archive/when-market-watches-court)
- [PolymarketGuide Archive — Market Clarifications](https://polymarketguide.gitbook.io/polymarketguide-archive/precedents/polymarket/market-clarifications)
- [Phemex News — Polymarket Faces Rule Dispute Over Market Resolution](https://phemex.com/news/article/polymarket-faces-rule-dispute-over-market-resolution-39945)
