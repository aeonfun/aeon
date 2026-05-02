# Paper Digest — 2026-05-02
> **Verdict:** 3 LLM-agent-finance papers worth reading, none on Polymarket microstructure or calibration this week — pool is thin on PM-specific signal after yesterday's microstructure harvest, but the LLM-trader behavioral-mechanism thread (Galanis, Magentic) gets two strong extensions plus a constrained-discovery factor-mining protocol that prefigures swarm-fund's promotion ladder.
> Pool: HF (5 topic queries) 60 + arXiv (5 topic queries, last 14 d) 38 → 98 combined → 82 after 7-day dedup → 3 shipped.

## LLM agents in financial markets

1. **From Hypotheses to Factors: Constrained LLM Agents in Cryptocurrency Markets** — Yikuan Huang, Zheqi Fan, Kaiqi Hu (2026-04-29)
   **What's new:** casts crypto factor discovery as sequential hypothesis search in which an LLM agent reads an append-only experiment trace, proposes falsifiable factor hypotheses against a point-in-time factor DSL, and a deterministic engine enforces fixed splits, selection gates, transaction costs, and portfolio tests; ridge-combined portfolio trained only on 2020-2022 data hits **44.55% annualized return / Sharpe 1.55** on the 2024-2026 pure out-of-sample window after 5 bps one-way costs.
   **So what:** the "deterministic engine wraps a hypothesis-proposing LLM with selection gates + transaction costs + auditable success/failure trace" architecture is exactly the shape of CalibrationGap's Birth → Canary → Apex protocol with the factor-DSL constraint added — a 1.55 OOS Sharpe with reproducible costs is the bar the Apex write-up needs to argue against (CalibrationGap's current Sharpe 0.31 isn't comparable until the 100-trade gate closes), and the auditable factor-DSL idea is a near-drop-in for the swarm-fund quant scanner's hypothesis log. Direct citation hook for Anthropic Research Credits / dYdX / Polymarket Builders grants on "constrained agent discovery vs. uncontrolled search."
   [abs](https://arxiv.org/abs/2604.26747) | [pdf](https://arxiv.org/pdf/2604.26747)

2. **Dissecting AI Trading: Behavioral Finance and Market Bubbles** — Shumiao Ouyang, Pengfei Sui (2026-04-20)
   **What's new:** simulated open-call auction populated by autonomous LLM agents replicates Smith et al. 1988 bubble-and-crash dynamics including the predictive power of excess demand for future prices and the positive disagreement-volume relation; identifies disposition effect + recency-weighted extrapolative beliefs as the LLM-side mechanisms via a 20-mechanism scoring framework, and **causally moves bubble magnitude up or down via targeted prompt interventions** that amplify or suppress specific mechanisms.
   **So what:** extends the same LLM-trader thread that Magentic Marketplace (arXiv:2510.25779) and Galanis (arXiv:2604.20050) opened, and supplies the missing causal lever — Galanis showed past-performance feedback hurts aggregation, this paper shows targeted prompt edits move bubble-magnitude in measurable ways, which is the ablation primitive CalibrationGap needs before the remaining 71 trades close the Apex gate. If recency-weighted extrapolation is what's degrading aggregation, this paper hands you the prompt-intervention recipe to test it.
   [abs](https://arxiv.org/abs/2604.18373) | [pdf](https://arxiv.org/pdf/2604.18373)

## Multi-agent RL in market simulation

3. **Financial Market as a Self-Organized Ecosystem: Simulation via Learning with Heterogeneous Preferences** — Ryuji Hashimoto, Ryosuke Takata, Masahiro Suzuki (2026-04-27)
   **What's new:** MARL framework in which agents endowed with heterogeneous risk aversion, time discounting, and information access learn trading strategies interactively; learning *plus* heterogeneity jointly produce **functionally differentiated strategies through interaction (role specialization, not trait-specific hard-coded rules)** plus emergent fat-tailed returns and volatility clustering — a computational realization of the Adaptive Market Hypothesis.
   **So what:** cleanest "MARL → emergent market ecology" paper since Magentic Marketplace (arXiv:2510.25779) and supersedes the trait-specific-rule heterogeneous-agent tradition that the swarm-fund agent-promotion ladder inherits — the empirical claim "interaction, not trait, drives differentiation" is the academically defensible version of swarm-fund's Darwinian-axis narrative, and lets the PhD application cite role-specialization across CalibrationGap / Hermes-arb / future agents without RenTech-flavored framing.
   [abs](https://arxiv.org/abs/2604.23975) | [pdf](https://arxiv.org/pdf/2604.23975)

---

**Skipped (signal but not this digest):**
- arXiv:2604.18576v2 *Agentic Forecasting using Sequential Bayesian Updating of Linguistic Beliefs* (Kevin Murphy) — claims SoTA on ForecastBench with a linguistic belief-state recipe; mission-perfect, but v2 → banned by skip-gate "extended previous work" rule. Worth a manual paper-pick override on a future PhD slot.
- arXiv:2604.27358 *Safe Bilevel Delegation* — runtime safety-efficiency trade-off for multi-agent delegation; tracked-topic tie too loose (general LLM safety, not finance).
- arXiv:2604.27151 *Step-level Optimization for Computer-use Agents* (↑9) — clears upvote gate but off-mission.
- arXiv:2604.28139 *Claw-Eval-Live* (↑23) — live agent benchmark for workflows, no finance tie.
- arXiv:2603.19685 *Subgoal-driven Long-Horizon LLM Agents* (↑21) — outside 14-day window for recency rule, generic LLM-agent framing without market grounding.
- arXiv:2604.26479 *Recipes for Calibration Checks in Safety-Critical Applications* — "calibration" keyword but autonomous-vehicle / weather / medical scope, not forecasting markets.
