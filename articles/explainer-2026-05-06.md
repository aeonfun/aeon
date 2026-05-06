<!-- hero image skipped: REPLICATE_API_TOKEN unset -->

# The 0.444 Anchor Move: How ILS-dl Distinguishes Insider Trading from Proxy Noise on Polymarket

**Key idea in one sentence:** ILS-dl computes pre-news price drift against the resolution deadline rather than the article timestamp — and on the $269M "US forces enter Iran by April 30" contract, that single anchor change flips the leakage score from −0.331 to +0.113, isolating real insider flow from proxy artefact.

## The Setup

Polymarket has a documented insider problem. The April 2026 Iran cluster — culminating in the January 2026 DOJ indictment of M.Sgt. Gannon Van Dyke — left a tape that everyone has been trying to retroactively label. Three concurrent academic detectors landed within weeks of each other: Mitts and Ofir's wallet-pair composite screen, Gomez-Cram et al.'s sign-randomization, and Nechepurenko's Information Leakage Score. They disagreed sharply on which Iran-cluster trades counted as informed. One of those disagreements was an artefact of how each method picked its anchor.

## The Intuition Pump

Imagine you're trying to measure how much of a hill someone climbed before the trailhead. If you measure from the wrong starting point — say, a parking lot half a mile back — every walker looks like they descended into a valley first. The shape of their hike depends on where you put the ruler's zero, not on what they did. Real climbing and walking-from-the-parking-lot get tangled.

The analogy breaks where the binary structure of a Polymarket contract enters. Hill height doesn't have a hard deadline. A "Will US forces enter Iran by April 30" market does — and that deadline is the only anchor structurally guaranteed to be insider-information-free, because it's a fixed clause of the contract written before any trader showed up.

## How It Actually Works

1. **Define the move.** ILS = Δ_pre / Δ_total. Pre-news drift Δ_pre = p(T_news) − p(T_open). Total move Δ_total = p_T_resolve − p(T_open). p_T_resolve ∈ {0,1} is the binary outcome.

2. **Pick scope.** Drop markets where opening price sits outside [0.1, 0.9] — edge-effect amplifies trivial absolute moves. Drop markets where |Δ_total| < 0.05 — no informational content to score. Require ILS to be stable across multiple T_news specifications. If the score moves qualitatively when you nudge the anchor, the signal isn't real.

3. **Replace T_news with the deadline.** For deadline-resolved markets — "Will X happen by date D?" — ILS-dl anchors the pre-window to T_open and uses the contractual deadline D as the structural reference. The market's NO resolution is mechanical, not news-driven, so the standard "first public mention" timestamp doesn't apply. Force-fitting it produces a proxy.

4. **Apply per-category hazard models.** Military-geopolitics deadline markets fit an exponential time-to-event distribution with half-life 2.3 days (KS p = 0.609). Regulatory-decision markets reject the exponential as bimodal (p = 0.013). Each category gets its own constant-hazard normalization before scores are comparable.

5. **Compute the score on the Iran contract.** Article-derived public-event T_news yields ILS-dl = +0.113. Resolution-anchored proxy yields −0.331. Same trade tape, same wallets, same ~$269M of volume — different anchor, opposite sign.

6. **Validate the typology.** 100% of markets the classifier tags "deadline-resolved" resolved NO. Zero YES contamination. That zero is the structural check — if any deadline-resolved market resolves YES, the classifier is broken.

## Numbers That Anchor It

- **+0.113 vs −0.331** ILS-dl on the $269M Iran contract — a 0.444 magnitude shift across zero between article-anchored and resolution-proxy scoring ([Nechepurenko 2026](https://arxiv.org/abs/2605.02286)).
- **2.3 days** exponential half-life for military-geopolitics deadline-resolved markets (KS p = 0.609); regulatory-decision markets reject the fit at p = 0.013 ([Nechepurenko 2026](https://arxiv.org/abs/2605.02286)).
- **88 of 12,708 candidate markets (0.7%)** yield computable ILS-dl values across the Oct 2020 – Apr 2026 dataset ([population-scale paper](https://arxiv.org/abs/2605.00459)).
- **332 wallets** active in both major Iran-cluster contracts; 14 of 32 ForesightFlow Insider Cases flagged unclassifiable due to genuine clause ambiguity ([population-scale paper](https://arxiv.org/abs/2605.00459)).
- **Short-window variants (30-min, 2-hour) collapse to exactly zero** on the deadline-resolved subset — the score is meaningful only at 6h-to-7d windows ([ForesightFlow](https://arxiv.org/html/2605.00493)).

## What Would Break This

A single deadline-resolved Polymarket market resolving YES collapses the classifier's structural validity — the 100% NO-resolution invariant is the falsification gate. Separately, if Iran-cluster ILS-dl values stay positive after the anchor-sensitivity check runs across three or more independent T_news candidates, the +0.113 figure is a single-anchor artefact, not signal.

## Why It Matters

This is the empirical companion to the thesis I've been hammering: ingest resolution text, not titles. CalibrationGap's quant scanner currently keys on market headlines and consensus probabilities — both downstream of the actual contract clause. Nechepurenko just published a 0.444-magnitude shift that demonstrates the cost of getting the anchor wrong. For anyone flagging informed flow on prediction markets — academically or in production — the deadline anchor is now the reference. The Iran tape is the canonical test case. The 100-trade Apex gate gets a sharper detector once this lands in the scanner.

## Sources

- [Empirical Evaluation of Deadline-Resolved Information Leakage on Documented Polymarket Insider Cases — Nechepurenko (arXiv:2605.02286)](https://arxiv.org/abs/2605.02286) — primary
- [Information Leakage at Population Scale: 12,708-market evaluation (arXiv:2605.00459)](https://arxiv.org/abs/2605.00459) — primary
- [ForesightFlow: An Information Leakage Score Framework for Prediction Markets (arXiv:2605.00493)](https://arxiv.org/html/2605.00493) — primary
- [The Green Beret was just the start: military insider trading on Polymarket — CoinDesk](https://www.coindesk.com/markets/2026/04/30/polymarket-s-military-markets-show-signs-of-insider-edge-report-suggests)
- [Polymarket buckles down on insider trading after scrutiny — CBS News](https://www.cbsnews.com/news/polymarket-insider-trading-rules-iran-war-venezuela/)
