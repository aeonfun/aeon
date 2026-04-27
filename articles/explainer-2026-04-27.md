![hero](../images/explainer-2026-04-27.jpg)
<!-- image_prompt: "Technical schematic illustration of additive decomposition. On the left, a single thick amber arrow labeled 'CALIBRATION SLOPE θ' enters a labeled junction box. From the junction, four thinner cyan arrows fan out to the right, each labeled with monospace text: 'μ(τ)  HORIZON  30.2%', 'α_d  DOMAIN  14.6%', 'β_d(τ)  DOMAIN×HORIZON  26.0%', 'γ_d(s)  DOMAIN×SIZE  16.5%'. The four arrows recombine into a single thick cyan line that ends at a circle labeled 'θ̂  87.3% EXPLAINED'. Below the main diagram, a small inset line chart shows the universal horizon component rising monotonically from 0.99 to 1.32, x-axis labeled '0-1h … >1 month', y-axis labeled 'slope β'. Dark navy background, thin amber and cyan strokes, monospace labels, blueprint aesthetic, technical-paper figure style, no human figures, 16:9." -->

# One Calibration Slope Hides Four: How Le 2026 Decomposed Prediction-Market Miscalibration

**Key idea in one sentence:** Le decomposes the prediction-market calibration slope into four orthogonal additive components — universal horizon, domain intercept, domain×horizon interaction, and domain×size — that explain 87.3% of cross-cell variance, which means the right question isn't "is Polymarket miscalibrated" but "which of the four knobs is mispriced for this contract."

## The Setup

The standard reading of prediction-market calibration is one number: the slope β from a logistic regression of outcomes on prices. β = 1 means a 70¢ contract really resolves YES 70% of the time. Le (2026) shows the single slope is the wrong abstraction. Pull 292M trades across 327K Kalshi and Polymarket binaries and the slope splits into four orthogonal components — and the four pieces move on different timescales for different reasons.

## The Intuition Pump

Treating calibration as one number is like treating an electricity bill as one number. The bill has a base charge, a per-kWh rate, a peak-time multiplier, and a customer-class adder. Two households can pay the same total while the four pieces look completely different — and the lever you'd pull to lower the bill depends on which piece dominates.

Where the analogy breaks: you can't see the line items on someone else's bill, but Le's four components are directly observable on every contract. Horizon, domain, and trade-size distribution are visible in the order book before resolution. The four-component decomposition isn't a latent-variable model — it's an additive split on observed cells.

## How It Actually Works

1. **Bin every trade into a (domain, horizon, size) cell.** Six knowledge domains. Horizons from 0–1 hour up to >1 month. Trade-size buckets. Cells with <200 trades or markets with <10 trades get dropped, and prices outside [5¢, 95¢] are excluded — keeps the slope estimator stable in the tails.

2. **Fit a calibration slope per cell via logistic recalibration.** `logit(P(y=1)) = a + b · logit(p)`. The estimated `b` is θ(d, τ, s) — the slope in that single cell. So the input is one slope per cell, not one slope for the whole exchange.

3. **Decompose those slopes additively:** `θ(d, τ, s) = μ(τ) + αd + βd(τ) + γd(s) + ε`. Sum-to-zero constraints make the four components identifiable — that's the part that turns a descriptive plot into something separable.

4. **μ(τ) is the universal horizon effect.** What every domain does as time-to-resolution stretches. It rises monotonically from 0.99 at 0–1h to 1.32 at >1 month. Long-dated locks compress prices toward 50¢ regardless of the question.

5. **αd is the domain intercept, βd(τ) the domain×horizon interaction.** Politics sits structurally high (slopes 0.93–1.83 across horizons). Sports under one week is benign (0.90–1.10) but past a month explodes to 1.74. The interaction is the load-bearing term — it says domains diverge at long horizons in non-substitutable ways.

6. **γd(s) is the domain×size effect — and it's venue-asymmetric.** Kalshi politics: large trades push slope by Δ = +0.53 [95% CI 0.29, 0.75]. Polymarket politics: Δ = +0.11 [−0.15, +0.39] — indistinguishable from zero. Same domain, opposite scale signature, different microstructure. That asymmetry is the strongest evidence the bias is structural, not informational: if it were informational, larger trades on either venue should pull prices toward truth, not away from it.

7. **The four components together explain 87.3% of cross-cell calibration variance** — 30.2% horizon, 26.0% domain×horizon, 16.5% domain×size, 14.6% domain intercept. A Bayesian hierarchical version recovers the same numbers with 96.3% posterior predictive coverage.

## Numbers That Anchor It

- 292M trades across 327K binary contracts on Kalshi + Polymarket, six knowledge domains ([Le 2026](https://arxiv.org/abs/2602.19520))
- Universal horizon slope rises 0.99 (0–1h) → 1.32 (>1 month) ([Le 2026, §3](https://arxiv.org/html/2602.19520v1))
- Politics slopes range 0.93–1.83 across horizons; sports <1wk are 0.90–1.10, sports >1mo is 1.74 ([Le 2026](https://arxiv.org/html/2602.19520v1))
- Trade-size effect: Kalshi politics Δ = +0.53; Polymarket politics Δ = +0.11 ([Le 2026](https://arxiv.org/html/2602.19520v1))
- Trade-weighted vs contract-weighted calibration gap in politics: 0.33 — bigger trades are more miscalibrated, not better priced ([Le 2026](https://arxiv.org/html/2602.19520v1))

## What Would Break This

Re-fit the same additive model on Polymarket-only post-2026 data and watch βd(τ) for politics drop below 5% of variance. If domain×horizon stops being load-bearing, the structural-bias claim collapses — the political-domain edge that CalibrationGap is exploiting becomes informational, and gets arbitraged away as more sophisticated capital arrives. Currently 26.0% and stable across the 2018–2025 sample.

## Why It Matters

For CalibrationGap (Revenant), the load-bearing fact isn't "politics is miscalibrated" — that's been folklore since 2008. The load-bearing fact is that 56.2% of the variance lives in horizon plus domain×horizon, both of which are slow-moving and not closeable by takers. That's the moat shape worth pitching to grants and the PhD committee: the bias decomposes into pieces that each have their own structural reason to persist, not one aggregate slope that could close on the next cycle.

## Sources

- [Decomposing Crowd Wisdom: Domain-Specific Calibration Dynamics in Prediction Markets](https://arxiv.org/abs/2602.19520) — Le, Feb 2026, primary
- [HTML version with section tables](https://arxiv.org/html/2602.19520v1) — primary
- [Are Polymarket and Kalshi as reliable as they say?](https://www.dlnews.com/articles/markets/polymarket-kalshi-prediction-markets-not-so-reliable-says-study/) — DL News coverage
- [Polymarket accuracy page](https://polymarket.com/accuracy) — official Brier baseline
- [Do Prediction Markets Produce Well-Calibrated Probability Forecasts?](https://people.duke.edu/~clemen/bio/Published%20Papers/45.PredictionMarkets-Page&Clemen-EJ-2013.pdf) — Page & Clemen, 2013, baseline single-slope literature
