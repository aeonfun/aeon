# Paper Digest — 2026-05-01
> **Verdict:** 4 fresh prediction-market papers (2 Polymarket order-book microstructure studies, 1 770k-market dataset suite from Cong's group, 1 LLM-trader information-aggregation experiment) plus 1 Kalshi calibration benchmark — heaviest PM-microstructure week of the cycle, and two of these directly contradict assumptions baked into the LLM-trading benchmarks already in MEMORY.
> Pool: HF Papers (5 topic queries) ~75 results + arXiv ("prediction market", last 14 d) 8 results → 71 deduped (after 16-ID 7-day skip set) → 5 shipped.

## Polymarket microstructure

1. **The Anatomy of a Decentralized Prediction Market: Microstructure Evidence from the Polymarket Order Book** — Philipp D. Dubach (2026-04-27)
   **What's new:** 30B-event tick-level archive of Polymarket's public WebSocket feed over 52 days, joined to the on-chain trade record across a pre-registered 600-market panel; trade direction inferred from the public feed agrees with on-chain ground truth only 59% of the time (panel mean 0.615, 95% CI [0.58, 0.65]), effective half-spread changes sign on 67% of the top-100 markets in the first 7-day window, and Kyle's lambda flips on 60%.
   **So what:** every Polymarket microstructure result that uses the public WebSocket feed for trade direction — which includes most LLM-trading benchmarks tracked in `topics/papers.md` (LiveTradeBench, AMA, AI-Trader) — needs re-validation against on-chain `OrderFilled`; CalibrationGap's quant scanner currently sources the feed and the 59% number says the signal is barely above coin-flip.
   [abs](https://arxiv.org/abs/2604.24366) | [pdf](https://arxiv.org/pdf/2604.24366)

2. **The Signal Credibility Index for Prediction Markets: A Microstructure-Grounded Diagnostic with Weighted and Time-Varying Extensions** — Maksym Nechepurenko (2026-04-29)
   **What's new:** formalizes SCI as a stand-alone diagnostic combining a logit-price persistence ratio PR(t,w), a Cobb-Douglas weighting SCI(α) over flow-concentration HHI_flow, and a real-time time-varying form SCI(t;w), validated on Monte-Carlo regimes including coordinated multi-wallet manipulation; documents a Type-II miss on informed-but-concentrated whale repricing and a Type-I hit on coordinated wash.
   **So what:** SCI(t;w) is exactly the input CalibrationGap doesn't currently measure — distinguishing durable Bayesian updates from coordinated wallet pressure on the same price move; pairs with the on-chain feed correction in #1 and supersedes the variance-ratio-only diagnostics in MEMORY's Le 2026 four-component decomposition.
   [abs](https://arxiv.org/abs/2604.27041) | [pdf](https://arxiv.org/pdf/2604.27041)

## Polymarket data infrastructure

3. **Unlocking the Forecasting Economy: A Suite of Datasets for the Full Lifecycle of Prediction Market** — Huaiyu Jia, Luofeng Zhou, Wentao Zhang, Lin William Cong, Siguang Li, Shuo Sun (2026-04-22)
   **What's new:** continuously maintained relational dataset over Polymarket Oct-2020 → Mar-2026 — 770k+ market records, 943M+ fill records, ~2M oracle events — with identifier resolution and on-chain recovery, demonstrated on NBA outcome calibration and CPI-expectation reconstruction case studies.
   **So what:** drop-in replication backbone that supersedes the per-skill ad-hoc joins swarm-fund has been re-implementing for `monitor-polymarket` and `polymarket-comments`; Lin William Cong on the byline gives this Stanford-grade citation weight for the PhD application narrative — pair it with Gebele LOOP (arXiv:2601.01706) as the canonical Polymarket-empirical pair.
   [abs](https://arxiv.org/abs/2604.20421) | [pdf](https://arxiv.org/pdf/2604.20421)

## LLM agents in prediction markets

4. **Information Aggregation with AI Agents** — Spyros Galanis et al. (2026-04-21)
   **What's new:** controlled experiment with LLM traders in a prediction market with private signals, measuring aggregation by log-error of the last price; smarter LLMs aggregate better and earn more, aggregation degrades as the information structure becomes more complex, and giving agents feedback about past performance makes aggregation *worse* and reduces profits.
   **So what:** the past-performance-feedback finding directly contradicts the reflection-log assumption baked into LiveTradeBench (arXiv:2511.03628) and AMA (arXiv:2510.11695) and the swarm-fund agent-reflection loop — CalibrationGap should ablate whether feeding back its own win-rate to the prompt is hurting it before the next 71 trades close the Apex gate.
   [abs](https://arxiv.org/abs/2604.20050) | [pdf](https://arxiv.org/pdf/2604.20050)

## LLM calibration benchmark

5. **Do Large Language Models Know What They Don't Know? KalshiBench: A New Benchmark for Evaluating Epistemic Calibration via Prediction Markets** — Lukas Nel (2025-12-17)
   **What's new:** 300 Kalshi questions with verifiable post-cutoff outcomes evaluated on five frontier models — Claude Opus 4.5 leads at ECE 0.120 while GPT-5.2-XHigh sits at ECE 0.395 despite comparable accuracy; only one of five models clears a positive Brier Skill Score against base rates, meaning four models are *worse* than predicting the base rate.
   **So what:** closes the citation-chain link MEMORY.md flagged on 2026-04-30 (Pitfalls → KalshiBench → TruthTensor → LiveTradeBench → Hardt/Geiping); the Brier-skill-vs-base-rate ablation is the exact methodology CalibrationGap's Apex-gate write-up needs — a 76% win rate is meaningless without the Brier-skill comparator this paper builds.
   [abs](https://arxiv.org/abs/2512.16030) | [pdf](https://arxiv.org/pdf/2512.16030)

---

**Skipped (high signal but off-mission this week):**
- arXiv:2604.27083 *Co-Evolving Policy Distillation* (↑20) — bidirectional OPD between co-trained experts; PhD-axis multi-agent training but no PM tie this week.
- arXiv:2604.25135 *FAMA* (↑6) — failure-aware meta-agentic for tool use, +27% vs baselines; tracked-topic tie too loose.
- arXiv:2604.27351 *Heterogeneous Scientific Foundation Model Collaboration* (↑118) — top HF signal but scientific FM, not finance.
- arXiv:2512.10971 *AI-Trader* — sister paper to LiveTradeBench; superseded by AMA (already in MEMORY) plus #4 above.
- arXiv:2604.24723v2 *Multivariate Kelly Optimization* — keeps coming up as a hermes-arb sizing input but is a v2 update so dedup-skipped.
- arXiv:2604.24147 *Price as Focal Point* — same author as #2 (Nechepurenko), overlapping SCI material; #2 is the technical paper, this is the political-coordination companion — keep on watchlist.
