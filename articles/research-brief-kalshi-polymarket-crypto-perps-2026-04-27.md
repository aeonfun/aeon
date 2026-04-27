---
topic: Kalshi and Polymarket onshore crypto perpetual futures
date: 2026-04-27
source_count: 13w / 1a
confidence: medium
thesis: "Onshore CFTC-supervised BTC perpetual futures on Kalshi and Polymarket will capture at least 5% of US retail BTC perp volume away from offshore venues by Q4 2026, because Kalshi's CFTC margin license narrows the regulatory-arbitrage gap and both platforms inherit warm distribution that Coinbase spent years building."
---

## BLUF

Kalshi and Polymarket each filed competing plans on the same day, April 21, 2026, to launch onshore crypto perpetual futures, with Kalshi targeting a phased BTC-first rollout in coming weeks under the codename "Timeless" ([Bloomberg](https://www.bloomberg.com/news/articles/2026-04-21/kalshi-to-expand-crypto-wagers-with-perpetual-futures-push), [The Information](https://www.theinformation.com/briefings/exclusive-kalshi-launch-crypto-trading-perpetual-futures)). The move converts both prediction-market venues from binary-event platforms into leveraged-derivatives venues, and is timed to capture US retail perp flow that has historically lived on offshore exchanges like Binance and Hyperliquid ([The Block](https://www.theblock.co/post/398325/kalshi-take-on-exchanges-binance-hyperliquid-perpetual-futures-trading-report)).

## Thesis

Onshore CFTC-supervised BTC perpetual futures on Kalshi and Polymarket will capture ≥5% of US retail BTC perp volume away from offshore venues by Q4 2026. The regulatory-arbitrage gap that historically sent leverage flow to Binance and Hyperliquid was narrowed when Kalshi secured CFTC margin trading approval in March 2026 ([Bloomberg](https://www.bloomberg.com/news/articles/2026-04-21/kalshi-to-expand-crypto-wagers-with-perpetual-futures-push)), and CFTC Chair Michael Selig has publicly stated the agency intends to bring perpetuals onshore "soon" ([PYMNTS](https://www.pymnts.com/news/bitcoin-tracker/2026/prediction-market-kalshi-targets-crypto-perpetuals/)). Both platforms enter with warm distribution — Kalshi's crypto category alone exceeded $1B in March 2026 monthly volume ([crypto.news](https://crypto.news/kalshi-explores-crypto-perpetual-futures-as-competition-widens/), [Investing.com](https://www.investing.com/news/company-news/kalshi-reportedly-launching-crypto-perpetual-futures-in-coming-weeks-93CH-4627105)).

## Context

Perpetual futures are the dominant instrument in crypto trading: leveraged contracts with no expiration, settled continuously through a funding-rate mechanism between longs and shorts ([Yellow](https://yellow.com/news/kalshi-crypto-perpetual-futures-coinbase-competition)). Until 2026, the onshore-US version was effectively prohibited under CFTC rules, pushing flow to offshore venues that retail traders accessed through VPNs. Kalshi spent years winning a separate fight to legalize event contracts — the case "resolved in Kalshi's favor in 2024" ([Yellow](https://yellow.com/news/kalshi-crypto-perpetual-futures-coinbase-competition)) — and that ruling, plus the 2026 margin trading license, opened a regulatory path no other US venue had assembled.

The competitive timing is deliberate. Kalshi was reportedly closing a $1B raise at a $22B valuation while Polymarket was talking to investors at $15B ([Unchained](https://unchainedcrypto.com/kalshi-and-polymarket-race-to-launch-crypto-perpetual-futures-challenging-coinbase-and-robinhood/)). The same-day announcements were a "one-two punch" aimed at Coinbase's "$2.9 billion derivatives moat" ([Coindesk](https://www.coindesk.com/markets/2026/04/21/kalshi-takes-on-coinbase-robinhood-with-new-plan-to-offer-crypto-perpetual-futures-the-information)) and Robinhood's retail derivatives push.

For swarm-fund-mvp, the launch matters because the hermes-arb agent template depends on Kalshi-BRTI ↔ Polymarket-Chainlink BTC settlement-basis spreads being a real, recurring trade. The first 48 hours post-launch already showed Kalshi DEX-adjacent volume +38% 1d at $250M (defi-overview run, 2026-04-27) — early evidence the absorption is happening.

## Evidence

- Kalshi will collateralize initial perps in US dollars at launch, with stablecoin collateral targeted for Q2 2026 — meaning the first weeks of trading will be USD-margined, not USDC-margined ([Investing.com](https://www.investing.com/news/company-news/kalshi-reportedly-launching-crypto-perpetual-futures-in-coming-weeks-93CH-4627105)).
- Kalshi's existing user base is a "warm audience already comfortable with event-based financial contracts," giving it onboarding economics offshore venues lack ([Yellow](https://yellow.com/news/kalshi-crypto-perpetual-futures-coinbase-competition)).
- Polymarket's perp launch announcement on the same day as Kalshi's plan ("perps are coming") signals coordinated competitive timing rather than independent product roadmaps ([Marketplace](https://www.marketplace.org/story/2026/04/22/kalshi-polymarket-to-start-offering-perpetual-futures-markets), [crypto.news](https://crypto.news/kalshi-explores-crypto-perpetual-futures-as-competition-widens/)).
- Critics note retail-investor risk: with 10x leverage, a 10% adverse move wipes out the position, and observers argue it is "unlikely that retail investors, to whom these perpetual futures seem to be marketed, are going to understand the risks" ([CNBC](https://www.cnbc.com/2026/04/21/polymarket-launches-trading-of-heavily-leveraged-perps-contracts.html)).
- New York's pending lawsuit against Coinbase and Gemini argues prediction markets on US elections constitute gambling, not financial instruments — if it succeeds, the precedent could force PM/Kalshi to shut down certain contracts and complicate the perps roadmap ([CNBC](https://www.cnbc.com/2026/04/21/polymarket-launches-trading-of-heavily-leveraged-perps-contracts.html)).

## Key papers

- **Alexander et al. (2020), "Price discovery in Bitcoin: The impact of unregulated markets,"** *Journal of Financial Stability*. Indexed in OpenAlex with 30+ citations. Topic-relevant for the onshore-vs-offshore thesis because it studies how unregulated BTC venues compare to CFTC-regulated CME futures on price discovery — the same question the Kalshi launch will re-litigate, in reverse, for perps. [DOI](https://doi.org/10.1016/j.jfs.2020.100776), publication date 2020-07-30.

## What would change my mind

- By 2026-08-01, combined Kalshi+Polymarket BTC perp daily volume below $50M while Hyperliquid stays at $1B+ daily — would mean onshore distribution failed to overcome offshore leverage and execution.
- CFTC reverses, stalls, or conditions Kalshi's margin license in the next 90 days.
- New York lawsuit against PM/Kalshi event contracts succeeds, forcing one or both venues to shut down event-contract business and pivoting capital away from the perps build.
- Kalshi-BRTI vs PM-Chainlink BTC settlement basis blows out persistently above 5pp, indicating settlement-mechanic divergence is severe enough that flow re-routes to offshore venues to avoid the basis ([memory/topics/polymarket.md](memory/topics/polymarket.md), settlement-basis brief 2026-04-25).

## Open questions

- What is the actual leverage cap Kalshi files with the CFTC at launch? Public reports do not yet specify (none of [The Information](https://www.theinformation.com/briefings/exclusive-kalshi-launch-crypto-trading-perpetual-futures), [Bloomberg](https://www.bloomberg.com/news/articles/2026-04-21/kalshi-to-expand-crypto-wagers-with-perpetual-futures-push), or [Investing.com](https://www.investing.com/news/company-news/kalshi-reportedly-launching-crypto-perpetual-futures-in-coming-weeks-93CH-4627105) gives a number). Lower caps narrow the displacement effect.
- Will Polymarket route US flow through its existing Polygon-based CTF or a new venue? Distribution mechanics determine basis stability with Kalshi's BRTI settlement.
- How does the funding-rate mechanism handle the cross-venue arb when only one of (Kalshi, PM) goes live first?

## Connections

- **hermes-arb** (Next Priority in MEMORY): the launch creates the live Kalshi↔PM basis trade the template was designed for. Bump min-gap from 7pp to 7.5–8pp per the 2026-04-25 deep-research finding before going live.
- **CalibrationGap (Revenant)**: Polymarket binary calibration depends on PM handle persistence. Polymarket International fees +7.3% vs 7d-avg post-perps-launch ([defi-overview log 2026-04-27](memory/logs/2026-04-27.md)) is supportive — perps are pulling flow, not cannibalizing binary handle.
- **Settlement-basis brief (2026-04-25)** documented the BRTI vs Chainlink mechanism difference; perps inherit that risk and amplify it through funding rates.

## Sources

**Academic**
- Alexander et al. (2020), [Price discovery in Bitcoin: The impact of unregulated markets](https://doi.org/10.1016/j.jfs.2020.100776), *Journal of Financial Stability*.

**Web (all 2026-04 unless noted)**
- Bloomberg, [Kalshi Plans Perpetual Crypto Futures Launch After Margin Trading License Win](https://www.bloomberg.com/news/articles/2026-04-21/kalshi-to-expand-crypto-wagers-with-perpetual-futures-push) (2026-04-21).
- The Information, [Kalshi to Launch Crypto Trading With Perpetual Futures](https://www.theinformation.com/briefings/exclusive-kalshi-launch-crypto-trading-perpetual-futures) (2026-04-21).
- Coindesk, [Kalshi takes on Coinbase, Robinhood with new plan to offer crypto perpetual futures](https://www.coindesk.com/markets/2026/04/21/kalshi-takes-on-coinbase-robinhood-with-new-plan-to-offer-crypto-perpetual-futures-the-information) (2026-04-21).
- CNBC, [Polymarket launches trading of heavily leveraged 'perps' contracts](https://www.cnbc.com/2026/04/21/polymarket-launches-trading-of-heavily-leveraged-perps-contracts.html) (2026-04-21).
- Marketplace, [Kalshi, Polymarket to start offering "perpetual futures" markets](https://www.marketplace.org/story/2026/04/22/kalshi-polymarket-to-start-offering-perpetual-futures-markets) (2026-04-22).
- Unchained, [Kalshi and Polymarket Race to Launch Crypto Perpetual Futures](https://unchainedcrypto.com/kalshi-and-polymarket-race-to-launch-crypto-perpetual-futures-challenging-coinbase-and-robinhood/) (2026-04).
- The Block, [Kalshi eyes crypto expansion with perpetual futures trading](https://www.theblock.co/post/398325/kalshi-take-on-exchanges-binance-hyperliquid-perpetual-futures-trading-report) (2026-04).
- crypto.news, [Kalshi explores crypto perpetual futures as competition widens](https://crypto.news/kalshi-explores-crypto-perpetual-futures-as-competition-widens/) (2026-04).
- Investing.com, [Kalshi reportedly launching crypto perpetual futures in coming weeks](https://www.investing.com/news/company-news/kalshi-reportedly-launching-crypto-perpetual-futures-in-coming-weeks-93CH-4627105) (2026-04-21).
- PYMNTS, [Prediction Market Kalshi Targets Crypto Perpetuals](https://www.pymnts.com/news/bitcoin-tracker/2026/prediction-market-kalshi-targets-crypto-perpetuals/) (2026-04).
- Yellow.com, [Kalshi Enters Crypto Trading, Targeting Coinbase With Perpetual Futures Offering](https://yellow.com/news/kalshi-crypto-perpetual-futures-coinbase-competition) (2026-04).
- Coinspectator, [Kalshi and Polymarket Move Into Perpetual Futures, Taking On Offshore Exchanges](https://coinspectator.com/mainstream/2026/04/22/kalshi-and-polymarket-move-into-perpetual-futures-taking-on-offshore-exchanges/) (2026-04-22).
- Benzinga, [Kalshi, Polymarket Announce Plans To Launch Crypto Perpetual Futures](https://www.benzinga.com/markets/prediction-markets/26/04/51953861/kalshi-polymarket-announce-plans-to-launch-crypto-perpetual-futures-report) (2026-04).
