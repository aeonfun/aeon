<!-- hero image skipped: no REPLICATE_API_TOKEN -->

# The Sealed Harness: Why "Hypotheses to Factors" Hits 1.55 OOS Sharpe Where AlphaAgent Hits 1.05

**Key idea in one sentence:** Huang et al. cage the LLM inside a point-in-time factor DSL and a deterministic gating engine the agent can't see or rewrite — so the agent's only freedom is to propose hypotheses, and every "discovery" is forced through the same train-only selection screen.

## The Setup

Most LLM-driven alpha mining looks the same on paper: an agent reads prior results, proposes new factors, runs them, and revises. The mid-2025 wave (AlphaAgent at KDD 2025, QuantaAlpha) tried to fix the obvious failure modes — alpha decay from overfitting, factor crowding, hallucinated rationales — by stacking regularizers on the agent itself: AST-based originality penalties, complexity caps, semantic alignment scores. AlphaAgent gets 11% excess / IR 1.5 on CSI 500 and 8.74% / 1.05 on S&P 500 net of costs, January 2021–December 2024 ([KDD paper](https://dl.acm.org/doi/10.1145/3711896.3736838)). Reasonable. But the regularizers live inside the agent's reach. If the agent can adjust splits, change features mid-run, or quietly retune the cost model, the OOS number is partly a search artifact.

Huang, Fan, Hu, and Ye took the opposite move: shrink the agent's authority, not its prompt.

## The Intuition Pump

Think of the agent as a graduate student in a lab. AlphaAgent gives the student a clean lab and a code of conduct. "Hypotheses to Factors" gives the student a sealed-envelope protocol: they hand recipes through a slot, an automated rig runs them on data the student never touches, the rig posts pass/fail with metrics, and the student reads the log. The student can write any recipe — but only in a constrained syntax, and only the rig knows the test set.

The analogy breaks at the DSL itself. A real lab notebook is open-ended; a factor DSL has a closed grammar — cross-sectional ranks, z-scores, rolling stats, log/abs/clip, linear combinations. That closure is the load-bearing constraint. It bounds the search space *before* the agent talks to the data, which is where most LLM-quant papers leak.

## How It Actually Works

1. **Lock the grammar.** Permitted ops: cross-sectional `rank_t` and z-score, time-series `lag` / `MA` / `std`, nonlinear `log` / `abs` / `clip`, and linear combinations. No forward-looking features, no opcodes outside the list. Sample factor: `s_i,t = rank_t(-0.6·log(1+mcap_i,t) + 0.5·MA10(range_i,t) - 0.2·MA3(Δvolume_i,t))` ([paper §3](https://arxiv.org/html/2604.26747v1)).
2. **Lock the splits.** Train 2020–2022, validate 2023, pure OOS 2024–2026. The agent never sees 2023+ during search. The deterministic engine enforces this — the agent can't request a new split.
3. **Lock the gate.** A candidate enters the hold pool only if `IC̄ ≥ τ_IC` *and* `t_IC ≥ τ_t` on the training window. Validation statistics are explicitly excluded from the entry decision — they're held back so the agent can't anchor on them.
4. **Append-only trace.** Each round writes hypothesis name, rationale, recipe, metrics (IC̄, t_IC, Sharpe_LS, coverage), pass/fail, and a natural-language interpretation. The agent reads the trace before proposing the next round. Nothing gets retroactively edited — failed hypotheses stay in the log.
5. **Five rounds, then ridge-combine.** The agent runs five proposal rounds. Survivors get combined via ridge regression — equal-weighted long-short on the top quantiles. The combined portfolio is the headline number.
6. **Pay the costs.** Every backtest gets 5 bp one-way transaction costs subtracted. No survivorship adjustments, no after-the-fact slippage relief.

The non-obvious move is point 3. By keeping validation off the entry decision, the engine prevents the agent from selectively reporting only validation-good factors — the failure mode that quietly inflates almost every "LLM finds alpha" result.

## Numbers That Anchor It

- **44.55% annualized return / 1.55 Sharpe / −23.6% max drawdown / 36.8% turnover** on the equal-weighted ridge-combined long-short portfolio, 2024–2026 pure OOS, 5 bp one-way costs ([Huang et al. 2026, §5](https://arxiv.org/html/2604.26747v1)).
- **Top three single factors hit OOS Sharpes of 2.412, 2.410, 2.250** — concentrated in small-cap, low-volume, persistent-range names ([§5.2](https://arxiv.org/html/2604.26747v1)).
- **At 10 bp one-way fees, Sharpe collapses to ~0.57** — a 64% haircut from the 5 bp number. Capacity is real ([§5.4](https://arxiv.org/html/2604.26747v1)).
- **Market-cap-weighted version performs poorly** — alpha lives in the small/illiquid tail, not in BTC/ETH ([§5.3](https://arxiv.org/html/2604.26747v1)).
- **AlphaAgent baseline:** 8.74% excess / 1.05 IR on S&P 500, January 2021–December 2024 ([Tang et al. 2025, §5](https://arxiv.org/html/2502.16789v2)). Different universe, but the closest published comparable for an LLM-agent alpha pipeline run net of costs.

## What Would Break This

If a third party reruns identical DSL + splits + gate thresholds and the factor pool diverges materially, the framework is bit-for-bit nondeterministic — the OOS Sharpe is then a sample of agent stochasticity, not a property of the protocol. Separately, if a market-cap-weighted variant ever outperforms equal-weighted on the same factor pool, the capacity-constrained-on-small-caps claim collapses and the alpha is probably a small-token-rebalance artifact, not a real risk premium.

## Why It Matters

This is the architectural twin of swarm-fund-mvp's hypothesis-search loop: agents propose, deterministic engine grades. The Huang paper is the first published version with a clean enough harness that the OOS number is worth taking seriously, and it gives the operator a concrete cite for "constrained agent + sealed engine works at 5 bp" against KellyBench's *frontier-LLMs-lose-money* framing already in the queue. The 5-to-10 bp fee cliff is the warning: any agent pipeline run on Polymarket or DEX venues without a live cost model is one transaction-cost calibration away from the 0.57 number, not the 1.55. CalibrationGap's 76%/29-trade record sits in the same regime — the gate is whether the harness around it is sealed enough that the next 71 trades stay an out-of-sample read, not a search artifact.

## Sources

- [From Hypotheses to Factors: Constrained LLM Agents in Cryptocurrency Markets — Huang, Fan, Hu, Ye (arXiv:2604.26747)](https://arxiv.org/abs/2604.26747) — primary
- [HTML version of the paper](https://arxiv.org/html/2604.26747v1) — primary
- [AlphaAgent: LLM-Driven Alpha Mining with Regularized Exploration — Tang et al., KDD 2025 (arXiv:2502.16789)](https://arxiv.org/abs/2502.16789)
- [AlphaAgent KDD 2025 proceedings](https://dl.acm.org/doi/10.1145/3711896.3736838)
- [AlphaAgent reference implementation (RndmVariableQ/AlphaAgent)](https://github.com/RndmVariableQ/AlphaAgent)
