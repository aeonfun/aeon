# Paper Digest — 2026-05-05
> **Verdict:** Polymarket microstructure / informed-trading detection week — 4 fresh PM-axis papers (3 from Nechepurenko's ILS series, 1 NBA-arb LOB study), plus 1 multivariate Kelly scaling result. No new Darwinian agent-evolution work past the dedup set.
> Pool: HF 79 + arXiv 33 → 102 deduped → 5 shipped (97 skip-gated)

## Polymarket microstructure & informed-trading detection

1. **Empirical Evaluation of Deadline-Resolved Information Leakage on Documented Polymarket Insider Cases** — Maksym Nechepurenko (2026-05-04) · ↑0
   **What's new:** ILS-dl computed on the $269M *"US forces enter Iran by April 30"* contract yields +0.113 vs a resolution-anchored proxy of −0.331 — a 0.444 magnitude shift on opposite sides of zero, demonstrating the deadline extension distinguishes signal from proxy artefact; military-geopolitics markets fit an exponential-hazard with half-life 2.3 days (KS p = 0.609), regulatory-decision rejected as bimodal (p = 0.013).
   **So what:** Direct quantification framework for the operator's *"ingest resolution text not titles"* upgrade thesis; the Iran cluster overlaps the open Hormuz-NO 54.5¢ position (MEMORY.md tradable hooks). Closes the empirical companion to already-queued ForesightFlow (2605.00493).
   [abs](https://arxiv.org/abs/2605.02286) | [pdf](https://arxiv.org/pdf/2605.02286)

2. **Per-Market Information Leakage and Order-Flow Skill: Two Methodological Lenses on Informed Trading** — Maksym Nechepurenko (2026-05-04) · ↑0
   **What's new:** Methodological reconciliation of the three concurrent April-2026 informed-trading detectors — Mitts & Ofir's composite screen on 210,000 wallet-market pairs; Gomez-Cram et al.'s sign-randomization classifying 3.14% of Polymarket accounts as "skilled winners" plus 1,950 lifecycle-flagged "insiders"; Nechepurenko's per-market ILS — argues these are three distinct detection layers, not competing methods on one layer; the January 2026 US-Venezuela DOJ indictment of M.Sgt. Gannon Van Dyke is the rare external enforcement benchmark.
   **So what:** Frames the academic field CalibrationGap competes with — sign-randomization is account-level not per-market, so the swarm-fund-mvp quant scanner can keep its market-conditional unit of analysis without reframing. Pairs with already-picked PolySwarm (2604.03888) for the negation-pair / informed-flow detection axis.
   [abs](https://arxiv.org/abs/2605.02287) | [pdf](https://arxiv.org/pdf/2605.02287)

3. **Arbitrage Analysis in Polymarket NBA Markets** — Guang Cheng, Jiaxin Yang, Haoxuan Zou (2026-04-22) · ↑0
   **What's new:** 75M LOB snapshots across 173 NBA games — single-market in-game arbitrage is exceedingly rare (only 7 episodes, median 3.6s persistence); combinatorial inefficiencies produce 290 episodes concentrated in the final minutes with 101 bps median return, but **76.9% of combinatorial opportunities are constrained to ~14.8 share executable size** by shallow LOB depth; the theoretical "Middle" jackpot is never empirically realized.
   **So what:** Direct comparable for Cong's NBA-calibration case study (2604.20421, picked 05-04 PhD slot); supersedes the implicit deep-liquidity assumption in the Anatomy of Polymarket Microstructure (2604.24366, picked 05-04 daily slot) on the NBA-specific axis. Quant-scanner combinatorial-arbitrage logic must enforce the 14.8-share depth bound — risk-free extraction is structurally retail-scale.
   [abs](https://arxiv.org/abs/2605.00864) | [pdf](https://arxiv.org/pdf/2605.00864)

4. **Price as Focal Point: Prediction Markets, Conditional Reflexivity, and the Politics of Common Knowledge** — Maksym Nechepurenko (2026-04-27) · ↑0
   **What's new:** Reframes prediction markets as coordination mechanisms (self-fulfilling / self-defeating) rather than pure forecasting devices; transaction-level evidence from the 2024 US presidential election + the Signal Credibility Index (variance ratio VR(6) + two-sidedness diagnostic + trader-concentration adjustment) applied to three 2024 political shocks; cross-platform comparison establishes systematic decoupling of social authority from epistemic robustness — **the most visible market produced the least accurate forecasts**.
   **So what:** Theoretical complement to the SCI methodology paper (2604.27041, shipped 05-01) — relabels what CalibrationGap is actually measuring (coordination credibility, not pure information content) and names two failure modes (Type II on whale repricing, Type I on coordinated multi-wallet manipulation). Direct citation hook for the *"single-venue confidence is a feature to fade"* TN-falsification lesson.
   [abs](https://arxiv.org/abs/2604.24147) | [pdf](https://arxiv.org/pdf/2604.24147)

## Position sizing

5. **Efficient Multivariate Kelly Optimization Reveals Sigmoidal Scaling Laws** — Ruslan Tepelyan, Daniel Lam (2026-04-27) · ↑0
   **What's new:** Reduces multivariate Kelly evaluation from O(2^N) to **O(N) for independent bets** via an integral-transform formulation with numerically-stable quadrature; a complementary decomposition method bounds the optimal growth rate via feasible/infeasible subproblems with **shortfall-ratio fitting a sigmoid in relative subproblem size**, parameters predictable from low-dimensional summaries. Synthetic data inspired by prediction markets.
   **So what:** Replaces PolySwarm's quarter-Kelly heuristic (2604.03888, picked 05-03 daily slot) with a closed-form scalable method usable for swarm-fund-mvp's planned 30→34 strategies and 74→112 fleet (ADR-094); defensive cite alongside queued KellyBench (2604.27865) — *"we know LLMs lose money under naive Kelly; here is the exact-solver that scales to hundreds of bets."*
   [abs](https://arxiv.org/abs/2604.24723) | [pdf](https://arxiv.org/pdf/2604.24723)

---
*Topic config note: MEMORY.md still has no `## Interests` / `## Research topics` / `## Tracked topics` heading (operator action carried over from 04-26/04-27/04-29/05-03 → 9 days unaddressed). Continued with the inferred topic set per 05-01/05-02/05-03 precedent: prediction-market calibration, Polymarket microstructure, LLM agent forecasting, multi-agent RL trading, Darwinian agent evolution. Strict step-0 abort behavior requires `paper-digest: var:` in `aeon.yml` or `## Interests` bullets.*
