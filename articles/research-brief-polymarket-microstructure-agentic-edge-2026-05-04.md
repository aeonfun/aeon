---
topic: Polymarket microstructure and the architecture of agentic edge
date: 2026-05-04
source_count: 8w / 3a
confidence: medium
thesis: "By April 30 2027, every Polymarket strategy that sustains positive net P&L over ≥1,000 trades will source trade direction from on-chain OrderFilled events rather than the public WebSocket order-book feed."
---

## BLUF

Polymarket's public WebSocket order-book feed agrees with on-chain ground truth on trade direction only ~59% of the time — barely above a coin flip, and far below the ~80% rate seen on equity venues ([Dubach 2026, arXiv:2604.24366](https://arxiv.org/abs/2604.24366)). Combined with a 22% upper-tail self-counterparty wash share and category-conditional spread asymmetries on the same venue, the architectural choice between feed-only bots and `OrderFilled`-grounded bots is the load-bearing edge of the next 12 months. The PolyBench/AIA-Forecaster generation of LLM agents that beat Brier baselines on price still loses money largely because they ingest the wrong primitive.

## Thesis

By April 30 2027, every Polymarket strategy that sustains positive net P&L over ≥1,000 trades will source trade direction from on-chain `OrderFilled` events, not the public WebSocket feed. The case rests on three converging facts: Lee-Ready aggressor inference on Polymarket's public feed recovers sign at chance levels ([Dubach 2026](https://arxiv.org/abs/2604.24366)); 25% of platform-wide volume and 14% of wallets are flagged as wash-trade on lower-bound estimates ([Kanoria, Ma, Sethi & Sirolly 2025, SSRN](https://fortune.com/2025/11/07/polymarket-wash-trading-inflated-prediction-markets-columbia-research/)); and Kyle's λ on the highest-volume markets has fallen by more than an order of magnitude as institutional participation broadened ([Tsang & Yang 2026, arXiv:2603.03136](https://arxiv.org/abs/2603.03136)). Anyone trading direction from the noisy primitive is paying impact to the wallets that do not.

## Context

Polymarket's V2 cutover left ~$514M TVL and a centrally-cleared CTF token model whose order book is observable through two channels: a public WebSocket feed used by every retail dashboard, and the Polygon-emitted `OrderFilled` event log, which is the venue's authoritative settlement record. Until April 2026 the public-feed-vs-on-chain divergence was an open empirical question. Dubach closed it: a 30-billion-event archive over 52 days, joined to on-chain trades on a pre-registered 600-market panel, shows the WebSocket feed misses a third of the direction signal even before wash filtering ([Dubach 2026, full PDF](https://arxiv.org/pdf/2604.24366)).

Why this matters now is timing. The PolyBench / Prophet Arena / AIA Forecaster generation of LLM agents has crossed the Brier threshold against Polymarket prices but still bleeds at the cashier window — the gap between calibration and profitability is microstructural, not predictive ([prediction-market-analysis dataset, Becker 2026](https://github.com/jon-becker/prediction-market-analysis)). The next two grant cycles (Polymarket Builders, Anthropic Research Credits) will fund teams that close that gap; the architectural fork — feed-only vs `OrderFilled`-grounded — is the gate.

The disconfirming angle deserves the same airtime: Tsang & Yang's order-of-magnitude collapse in Kyle's λ on the highest-volume contract is itself evidence that the venue is microstructurally efficient where retail attention is highest ([Tsang & Yang 2026](https://arxiv.org/abs/2603.03136)). Edge persists only in the seams the public feed cannot see — the thin tail, the wash-asymmetric categories, the resolution-text-language gap.

## Evidence

- Dubach's panel mean for trade-direction recovery is 0.615 (95% CI [0.58, 0.65]); the Lee-Ready estimator on equity venues typically reaches ~0.80 ([Dubach 2026](https://arxiv.org/abs/2604.24366)).
- Self-counterparty wash trades carry a median share of 1% per market but a 22% upper tail in the same panel — the wash distribution is asymmetric and category-conditional ([Dubach 2026](https://arxiv.org/abs/2604.24366)).
- The Columbia study estimates 25% of three-year platform volume is wash, peaking near 60% in December 2024 — driven by airdrop-eligibility-farming, not market-view trading ([Fortune, 2025-11-07](https://fortune.com/2025/11/07/polymarket-wash-trading-inflated-prediction-markets-columbia-research/)); the same paper flags 14% of 1.26M wallets as wash-pattern ([CoinDesk, 2025-11-07](https://www.coindesk.com/markets/2025/11/07/polymarket-s-trading-volume-may-be-25-fake-columbia-study-finds)).
- Across the 2024 Presidential cycle, Tsang & Yang find Kyle's λ on the highest-volume contract fell by more than an order of magnitude as institutional participants joined — i.e. price impact has already collapsed where the volume is, leaving edge to the long tail ([Tsang & Yang 2026](https://arxiv.org/abs/2603.03136)).
- Polymarket charges no trading fees and requires no KYC — making the wash-trade economics neutral and the on-chain audit trail the only durable identity primitive ([Gizmodo, 2025-11-07](https://gizmodo.com/study-finds-around-a-quarter-of-polymarket-trades-are-fake-2000683231)).

## Key papers

- **Dubach (Apr 27 2026) — *The Anatomy of a Decentralized Prediction Market: Microstructure Evidence from the Polymarket Order Book*** — Single-author 15pp empirical paper, 30B WebSocket events × 52 days joined to on-chain trades on a pre-registered 600-market panel. Eight stylized facts plus the load-bearing methodological finding that public-feed direction inference is only ~59% accurate. Code at `github.com/philippdubach/polymarket-microstructure`. ([arXiv:2604.24366](https://arxiv.org/abs/2604.24366)).
- **Tsang & Yang (Mar 3 2026) — *The Anatomy of Polymarket: Evidence from the 2024 Presidential Election*** — Decomposes on-chain volume across mint/burn/conversion/exchange, identifies three regime-shaping episodes (Biden withdrawal, September debate, October whale activity), and documents an order-of-magnitude collapse in Kyle's λ as institutional participation broadened. ([arXiv:2603.03136](https://arxiv.org/abs/2603.03136)).
- **Kanoria, Ma, Sethi & Sirolly (Nov 7 2025) — *Wash Trading on Polymarket*** — SSRN preprint, three-year volume audit, lower-bound 25% wash share, sport markets at 45% and election markets at 17%. Methodology is direct on-chain pattern flagging, not statistical inference. ([Fortune coverage](https://fortune.com/2025/11/07/polymarket-wash-trading-inflated-prediction-markets-columbia-research/)).

## What would change my mind

- A documented Polymarket strategy demonstrates ≥1,000 trades and positive net P&L while sourcing trade direction exclusively from the public WebSocket feed (no on-chain enrichment). Single counter-example breaks the thesis.
- Polymarket ships a v2 WebSocket protocol that exposes signed trade-aggressor metadata at the API edge, collapsing the public-feed/on-chain gap below 5pp before Q4 2026.
- An independent replication of Dubach's 59% direction-recovery finding fails to reproduce on a comparable panel, lifting the public-feed accuracy above 75%.
- Kyle's λ in the long tail (markets <$100K notional) collapses to within an order of magnitude of the head — i.e. the microstructural seams the thesis depends on close.

## Open questions

- Does category-conditional spread asymmetry survive a wash-filter at the trade level, or is it an artifact of the 22% upper-tail wash distribution?
- Will the FinCEN AML/CFT comment-period close (June 9 2026) push Polymarket toward KYC, and does that make wash-pattern flagging easier or harder?
- Does the order-of-magnitude Kyle's λ collapse Tsang & Yang document survive the 2026 election cycle, or was it a one-shot 2024 institutionalisation event?
- How does the public-feed/on-chain gap scale on Kalshi (centralized matching engine) — does the same architectural fork apply, or is it Polymarket-specific?

## Connections

- **CalibrationGap (Revenant)** — `memory/topics/swarm-fund.md` — adapter design choice between WebSocket and `OrderFilled` ingest is the highest-leverage upgrade per Dubach's finding. Pre-Apex push: surface to ADR-093 tick-broker spec.
- **Hermes-arb** — same ingest fork applies on the Kalshi↔PM 5-min BTC convergence trade; PM-leg direction must come from on-chain.
- **Grants pipeline** — `memory/topics/grants.md` — Anatomy + Gebele LOOP + SoK DePMs trilogy now anchored by an empirical layer; cite Dubach in Polymarket Builders Program application.
- **Stanford PhD app** — `memory/topics/papers.md` — Dubach + Tsang/Yang + Kanoria et al form the empirical microstructure spine of an agentic-finance reading list.

## Sources

### Academic
- Dubach, P. D. (2026-04-27). *The Anatomy of a Decentralized Prediction Market: Microstructure Evidence from the Polymarket Order Book*. arXiv:2604.24366. https://arxiv.org/abs/2604.24366
- Tsang, K. P. & Yang, Z. (2026-03-03). *The Anatomy of Polymarket: Evidence from the 2024 Presidential Election*. arXiv:2603.03136. https://arxiv.org/abs/2603.03136
- Kanoria, Y., Ma, H., Sethi, R. & Sirolly, A. (2025-11-07). *Wash Trading on Polymarket*. SSRN preprint, summarised in Fortune & CoinDesk coverage.
- Yang, J., Cheng, G. & Zou, H. (2026). *Arbitrage Analysis in Polymarket NBA Markets*. SSRN 6624718 (abstract page). https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6624718 — listed for reference; SSRN page returned 403 on direct fetch, not used as a load-bearing citation in this brief.

### Web
- Fortune (2025-11-07) — *Polymarket volume inflated by 'artificial' activity, study finds*. https://fortune.com/2025/11/07/polymarket-wash-trading-inflated-prediction-markets-columbia-research/
- CoinDesk (2025-11-07) — *Polymarket's Trading Volume May Be 25% Fake, Columbia Study Finds*. https://www.coindesk.com/markets/2025/11/07/polymarket-s-trading-volume-may-be-25-fake-columbia-study-finds
- Gizmodo (2025-11-07) — *Study Finds Around a Quarter of Polymarket Trades Are Fake*. https://gizmodo.com/study-finds-around-a-quarter-of-polymarket-trades-are-fake-2000683231
- TheStreet Crypto (2025-11) — *Columbia University study claims 25% of Polymarket trades are inflated*. https://www.thestreet.com/crypto/business/columbia-university-study-claims-25-of-polymarket-trades-are-inflated
- CBS News — *Polymarket buckles down on insider trading after scrutiny over suspiciously timed bets*. https://www.cbsnews.com/news/polymarket-insider-trading-rules-iran-war-venezuela/
- Polymarket docs — *Using the Order Book*. https://docs.polymarket.com/polymarket-learn/trading/using-the-orderbook
- Becker, J. (2026) — *prediction-market-analysis* (largest public Polymarket+Kalshi dataset). https://github.com/jon-becker/prediction-market-analysis
- GameTyrant (2026) — *Order Book Mechanics on Prediction Markets — Complete Guide to Trading Systems 2026*. https://gametyrant.com/news/order-book-mechanics-on-prediction-markets
