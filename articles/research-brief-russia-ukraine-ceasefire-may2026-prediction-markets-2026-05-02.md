---
topic: Russia-Ukraine ceasefire prediction markets (May 2026)
date: 2026-05-02
source_count: 6w / 4a
confidence: medium
thesis: "Conditional on no Kremlin or White House statement before May 15 expanding the May 9 proposal beyond a Victory Day pause, fair value on Polymarket's May-31 Russia-Ukraine ceasefire market is ≤2%, making the current 6% YES a structurally short clause-arbitrage trade."
---

## BLUF

Polymarket's "Russia-Ukraine ceasefire by May 31, 2026" market sits at **6% YES on $2.07M volume** after Putin floated a May 9 Victory Day truce to Trump on April 29 ([Polymarket](https://polymarket.com/event/russia-x-ukraine-ceasefire-by-may-31-2026); [NPR/KPBS](https://www.kpbs.org/news/international/2026/04/30/zelenskyy-says-hes-seeking-details-of-putins-may-9-ceasefire-proposal)). The market's resolution rules require a "general pause" that "publicly and mutually" halts engagement — not a parade-day or humanitarian lull. The headline proposal as stated **cannot** resolve YES; the 6% is paying for a scope-expansion scenario nobody has announced.

## Thesis

Conditional on no Kremlin or White House statement before May 15 expanding the May 9 proposal beyond a Victory Day pause, fair value on the May-31 ceasefire market is ≤2%, making the current 6% YES a structurally short clause-arbitrage trade for traders willing to read resolution rules.

The justification is mechanical, not narrative. Polymarket's market rules disqualify "informal or humanitarian pauses" and require an explicitly *general* halt ([Polymarket](https://polymarket.com/event/russia-x-ukraine-ceasefire-by-may-31-2026)). Putin's proposal, as relayed by aide Yuri Ushakov, is "for the May 9 holiday"; spokesperson Dmitry Peskov said "no concrete decision has been made"; Zelenskyy himself asked whether the offer was "a few hours of security for a parade in Moscow or something more" ([NPR/KPBS](https://www.kpbs.org/news/international/2026/04/30/zelenskyy-says-hes-seeking-details-of-putins-may-9-ceasefire-proposal)). A truce scoped to one day of Victory Day pageantry fails the rule both on duration *and* on stated intent.

## Context

Polymarket has six adjacent ceasefire markets — by April 30 (resolved NO at near-zero), May 31, June 30, end-of-2026, and end-of-2027 ([Polymarket Ukraine page](https://polymarket.com/geopolitics/ukraine)). The sequence shows a smooth term structure: 6% by May 31, 11.5% by June 30, ~25.5% by end-2026 ([Polymarket end-2026](https://polymarket.com/event/russia-x-ukraine-ceasefire-before-2027)). That structure is internally consistent only if the May-31 price compounds the *same* underlying probability of any ceasefire emerging between now and resolution — but the May 9 proposal is *not* "any ceasefire"; it is a narrowly-defined offer the rules already exclude.

This matters now because the proposal lit up market activity *despite* not being eligible. The Victory Day proposal was discussed in a Trump–Putin call the morning of April 30; Zelenskyy is "seeking details" but has signaled Ukraine wants a longer-term arrangement ([NPR/KPBS](https://www.kpbs.org/news/international/2026/04/30/zelenskyy-says-hes-seeking-details-of-putins-may-9-ceasefire-proposal)). Independent analysts framing the gap call market pricing a "political theater" mispricing ([AInvest](https://www.ainvest.com/news/market-prices-2026-ukraine-ceasefire-diplomacy-devolves-political-theater-gap-growing-risk-500-2604/)) — but the gap they describe runs the opposite direction (markets too credulous of any deal). The clause-arbitrage gap runs the same direction with a sharper edge: pay 6¢ for a scenario that requires the proposal to be *re-cut* before resolution, not for the proposal as announced.

## Evidence

- Polymarket May-31 rules require a "publicly announced and mutually agreed" general halt; sector-specific (energy, Black Sea) and humanitarian pauses do not qualify ([Polymarket May-31](https://polymarket.com/event/russia-x-ukraine-ceasefire-by-may-31-2026)).
- Putin's proposal as relayed targets the May 9 holiday only; Peskov: "no concrete decision has been made" ([NPR/KPBS](https://www.kpbs.org/news/international/2026/04/30/zelenskyy-says-hes-seeking-details-of-putins-may-9-ceasefire-proposal)).
- Volume on the May-31 market is $2.07M, sufficient depth that 1-2pp moves carry P&L ([Polymarket May-31](https://polymarket.com/event/russia-x-ukraine-ceasefire-by-may-31-2026)).
- Historical baseline: 73% of declared ceasefires in territorial conflicts collapse within 90 days ([Value The Markets analysis](https://www.valuethemarkets.com/cryptocurrency/news/market-analysis-on-the-russia-ukraine-ceasefire-prospects)).
- Polymarket's reported one-month event accuracy is ~94% near resolution; geopolitical-event accuracy historically tracks lower at 65-70% ([Value The Markets](https://www.valuethemarkets.com/cryptocurrency/news/market-analysis-on-the-russia-ukraine-ceasefire-prospects)).

## Key papers

- **Wen, Zhou & Huang (April 2026)** — *Can LLMs Help Decentralized Dispute Arbitration?* Tested LLMs against UMA's resolution decisions on Polymarket and found 89.58% agreement with final UMA rulings on rule-text-resolvable events ([arXiv 2604.15674](https://arxiv.org/abs/2604.15674)). Implication for the May-31 market: when the catalyst is rule-text not headline, an LLM-augmented reader has measurable edge.
- **Le, Nam Anh (Jan 2026)** — *Decomposing Crowd Wisdom: Domain-Specific Calibration Dynamics in Prediction Markets.* 292M trades on Kalshi/Polymarket; political-market prices cluster toward 50% on both platforms, but large trades amplify the underconfidence on Kalshi and not on Polymarket ([arXiv 2602.19520](http://arxiv.org/abs/2602.19520)). The implication is that ceasefire-market mispricing — which is also clustered near 0/100, not 50 — is a *different* defect than the political-market underconfidence Le measures, and the trade-size correction does not transfer.
- **McGurk & Becker (Jan 2025)** — *Political Uncertainty and Credit Risk.* Found event-market prices on prediction platforms forecast Ukraine sovereign credit spreads — the cross-asset signal is real, but lags on rule-driven catalysts ([SSRN 5163719](https://doi.org/10.2139/ssrn.5163719)).
- **Halawi et al. (Feb 2024)** — *Approaching Human-Level Forecasting with Language Models.* Retrieval-augmented LLMs near crowd-aggregate forecaster performance; rule-parsing tasks are where the model already wins ([arXiv 2402.18563](http://arxiv.org/abs/2402.18563)).

## What would change my mind

- A Kremlin or White House statement before May 15 that explicitly extends the proposed truce **beyond** Victory Day — duration ≥ 7 days OR scope including all fronts. That would make a YES path mechanically open.
- An UMA pre-emptive ruling clarifying that a Victory-Day-only pause *would* qualify as "general." (No such ruling visible on the market page as of 2026-05-02.)
- The market drifting up *without* corresponding scope-expansion news — would imply liquidity-providers have seen private signal the rule-text reading misses.
- A Wen-et-al-style LLM-vs-UMA backtest applied retroactively to ceasefire markets showing the rule-parsing edge is already arbitraged out (current paper does not test this venue specifically).

## Open questions

- Why does the Dec 31 2026 market price 25.5% — does that compound a series of pause-then-collapse cycles, or does it embed a single high-probability deal post-November? The term structure is internally consistent on the surface but its decomposition is not visible.
- Is there a UMA-side dispute incentive to interpret a Victory Day truce as eligible? UMA tokenholder economics around contested resolutions are an open lever (Iran-cf round-3 dispute is current evidence the lever can swing).

## Connections

- Direct extension of `memory/topics/polymarket.md` UMA Iran-cf vs Hez-cf clause-resolution arb hook — same family: rule-text divergence from headline.
- CalibrationGap (Revenant) quant scanner does not parse market resolution rules; per `memory/MEMORY.md` ("Quant scanner blind to War-Powers catalyst"), this is structurally the same gap as the Trump-Iran end-mil-ops thread that resolved on 2026-05-01.
- Adjacent to 2026-05-01 *Polymarket regulatory front 2026* brief — both are bets on rule-text interpretation, not narrative.

## Sources

**Web (6, all dated within last 12 months)**
- [Polymarket: Russia-Ukraine ceasefire by May 31, 2026](https://polymarket.com/event/russia-x-ukraine-ceasefire-by-may-31-2026) — primary market, fetched 2026-05-02.
- [Polymarket: Russia-Ukraine ceasefire by Dec 31, 2026](https://polymarket.com/event/russia-x-ukraine-ceasefire-before-2027) — adjacent term-structure anchor.
- [Polymarket Ukraine geopolitics page](https://polymarket.com/geopolitics/ukraine) — full market list.
- [NPR / KPBS — Zelenskyy seeking details of Putin's May 9 proposal](https://www.kpbs.org/news/international/2026/04/30/zelenskyy-says-hes-seeking-details-of-putins-may-9-ceasefire-proposal) — 2026-04-30.
- [Value The Markets — Market analysis on Russia-Ukraine ceasefire prospects](https://www.valuethemarkets.com/cryptocurrency/news/market-analysis-on-the-russia-ukraine-ceasefire-prospects) — 2026-04-30.
- [AInvest — Market prices 2026 Ukraine ceasefire while diplomacy devolves into political theater](https://www.ainvest.com/news/market-prices-2026-ukraine-ceasefire-diplomacy-devolves-political-theater-gap-growing-risk-500-2604/) — disconfirming-angle source.

**Academic (4)**
- Wen, Zhou & Huang. *Can LLMs Help Decentralized Dispute Arbitration?* April 2026. [arXiv:2604.15674](https://arxiv.org/abs/2604.15674).
- Le, Nam Anh. *Decomposing Crowd Wisdom: Domain-Specific Calibration Dynamics.* January 2026. [arXiv:2602.19520](http://arxiv.org/abs/2602.19520).
- McGurk & Becker. *Political Uncertainty and Credit Risk.* January 2025. [SSRN:5163719](https://doi.org/10.2139/ssrn.5163719).
- Halawi, Zhang, Yueh-Han & Steinhardt. *Approaching Human-Level Forecasting with Language Models.* February 2024. [arXiv:2402.18563](http://arxiv.org/abs/2402.18563).
