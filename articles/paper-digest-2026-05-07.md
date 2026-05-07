# Paper Digest — 2026-05-07
> **Verdict:** No new Polymarket / DePM-microstructure paper this cycle (the Nechepurenko run is past the dedup wall). Five fresh mission-axis hits in adjacent areas: 1 LLM-agent crypto factor pipeline with a real out-of-sample +44.55% / Sharpe 1.55, 1 DeFi spot-perp basis-trade collateral framework directly on the Hermes-arb axis, 1 prediction-market manipulation ABM with explicit whale-distortion scaling, 1 leakage-controlled LLM forecasting benchmark that reframes AIA Forecaster's evaluation regime, 1 multi-agent LLM negotiation finding that heavier reasoning *degrades* behavioural diversity.
> Pool: HF 90 + arXiv 70 → 102 deduped → 5 shipped (97 skip-gated)

## LLM agents in financial markets

1. **From Hypotheses to Factors: Constrained LLM Agents in Cryptocurrency Markets** — Yikuan Huang, Zheqi Fan, Kaiqi Hu, Yifan Ye (2026-04-29) · ↑0
   **What's new:** LLM agents are restricted to a point-in-time factor DSL with an append-only experiment trace; a deterministic engine enforces fixed splits, selection gates, transaction costs, and portfolio tests, so successful and failed hypotheses are both auditable. A ridge-combined portfolio trained only on 2020–2022 hits **44.55% annualized return / Sharpe 1.55** in the 2024–2026 pure out-of-sample period after a 5 bp one-way trading cost.
   **So what:** Closest published architectural twin of swarm-fund-mvp's planned hypothesis-search loop — the controlled-DSL + deterministic-engine pattern is the operator's exact "agents propose factors, deterministic engine grades them" design, and the 44.55% / 1.55 OOS number is the published counterpoint to KellyBench's *"frontier LLMs lose money"* framing already in the queue (`2604.27865`). Defensive grant-app citation for "LLM-agent factor pipelines work when constrained — see Huang 2026."
   [abs](https://arxiv.org/abs/2604.26747) | [pdf](https://arxiv.org/pdf/2604.26747)

## Hermes-arb axis: basis trading & collateral

2. **Dynamic Collateral Control for Permissionless Spot Perpetual Basis Trading** — Anatoly Krestenko, Mikhail Butov, Rostislav Berezovskiy, Danila Bolotin (2026-05-06) · ↑0
   **What's new:** Static + dynamic models for spot-perp basis trades on permissionless DEX/perp venues. Risk-constrained policy dominates profit-maximizing on collateral requirements; **BTC requires the least collateral, LINK and DOGE significantly more**; the minimum-intervention threshold is solvency-driven, the upper threshold is governed by the carry-vs-rebalancing-cost trade-off. Realized wedges grow asymmetrically when *selling* the basis, supporting minimum-rebalance-size and execution-buffer rules.
   **So what:** Direct sizing-model upgrade for the Hermes-arb Polymarket↔Kalshi 5-min BTC basis loop and any future ETH/SOL extension — gives an asset-conditional collateral floor (BTC = lowest baseline) and a closed-form upper-rebalance trigger. Pairs with the Hermes-arb gate-adjustment carry-over in MEMORY.md (bump `min-gap` 7pp → 7.5–8pp); the asymmetric sell-side wedge result argues for skewed entry vs. exit thresholds, not a single symmetric gap.
   [abs](https://arxiv.org/abs/2605.05089) | [pdf](https://arxiv.org/pdf/2605.05089)

## Prediction-market manipulation

3. **Manipulation in Prediction Markets: An Agent-based Modeling Experiment** — Bridget Smart, Ebba Mark, Anne Bastian, Josefina Waugh (2026-01-28) · ↑0
   **What's new:** Agent-based simulation with heterogeneous expertise, noisy private signals, and per-agent learning rates. Biased "whale" agents shift market prices proportionally to their share of total market capital; **distortion duration scales with herding intensity × inverse-learning-rate** of non-whale agents, with theoretical bounds matched empirically. Open-source simulator + Dash app released.
   **So what:** Quantifies the manipulation surface CalibrationGap is structurally exposed to on small-volume Polymarket binaries — and gives an explicit lever (population learning rate × herding) for sizing a manipulation discount on top of the calibration probability. Surfaces as the natural complement to the SCI/coordination-credibility framing already picked (`2604.27041` queued, `2604.24147` shipped 05-05): SCI flags the pattern, this paper sizes the magnitude.
   [abs](https://arxiv.org/abs/2601.20452) | [pdf](https://arxiv.org/pdf/2601.20452)

## Forecasting evaluation methodology

4. **OracleProto: A Reproducible Framework for Benchmarking LLM Native Forecasting via Knowledge Cutoff and Temporal Masking** — Yiding Ma, Chengyun Ruan, Kaibo Huang, Zhongliang Yang, Linna Zhou (2026-05-05) · ↑1
   **What's new:** Combines model-cutoff-aligned sample admission, tool-level temporal masking, content-level leakage detection, discrete answer normalization, and hierarchical scoring. Across six contemporary LLMs, residual leakage is reduced to **≤1%**, an order of magnitude tighter than tool-only temporal filtering. Code + data on GitHub and Hugging Face.
   **So what:** Methodologically supersedes the pre-cutoff-but-leak-prone setup in AIA Forecaster (`2511.07678`, picked 05-01) and the original ForecastBench (Karger 2024). For the Stanford application's *"live-trade record beats static benchmarks"* spine, OracleProto becomes the defensible LLM-only-baseline anchor — the gap between OracleProto's leakage-controlled score and CalibrationGap's live Polymarket P&L is the cleanest framing for "static ≠ live alpha" the Dec 2026 committee will see.
   [abs](https://arxiv.org/abs/2605.03762) | [pdf](https://arxiv.org/pdf/2605.03762)

## Multi-agent LLM behavior

5. **When Reasoning Models Hurt Behavioral Simulation: A Solver-Sampler Mismatch in Multi-Agent LLM Negotiation** — Sandro Andric (2026-04-12, v2 2026-05-06) · ↑2
   **What's new:** Distinguishes behavioral-simulation tasks from strategic-problem-solving tasks in multi-agent LLM negotiation. Stronger reasoning models *push agents toward authority-dependent outcomes* and reduce diversity of negotiation paths; only scaffolding with explicit negotiation structure restores varied outcomes. Argues models should be evaluated for the behavioral role they are meant to play, not only for strategic capability.
   **So what:** Concrete defensive cite for ADR-094's `paper_triage` opus-4-7 → sonnet-4-6 router decision — heavier reasoning models *degrade* behavioral diversity in multi-agent settings, so swarm-fund-mvp's 30→34 Latin-Hypercube strategy fleet is structurally correct to keep most strategies on lighter samplers and reserve opus-4-7 for solver-side decision logic. Pairs with the just-picked Coordination Layer (`2605.03310`, 05-06 PhD slot) as the second-week-running argument that *coordination architecture, not base-model strength*, is the load-bearing variable.
   [abs](https://arxiv.org/abs/2604.11840) | [pdf](https://arxiv.org/pdf/2604.11840)

---
*Topic config note: MEMORY.md still has no `## Interests` / `## Research topics` / `## Tracked topics` heading (operator action carried over from 04-26/04-27/04-29/05-03 → 11 days unaddressed). Continued with the inferred topic set per 05-01/05-02/05-03/05-05 precedent: prediction-market calibration, Polymarket / DePM microstructure, LLM-agent forecasting + trading, multi-agent RL, basis-trade / Kalshi-PM convergence, Darwinian agent evolution. Strict step-0 abort behavior requires `paper-digest: var:` in `aeon.yml` or `## Interests` bullets in MEMORY.md.*
