<!-- hero image attempted via .pending-replicate/explainer-2026-05-08.json; image line below auto-resolves if postprocess-replicate.sh succeeds, otherwise broken-link is the no-image signal -->
<!-- image prompt: Technical schematic illustration of a closed-loop reinforcement-learning controller for a stock-prediction agent, dark navy background, thin cyan and amber lines, six labeled rectangular boxes in a vertical stack on the left reading 'REGIME DETECTION', 'ROUTING', 'ADAPTATION', 'RISK CALIBRATION', 'STRATEGY COHERENCE', 'ERROR RECOVERY', a large center node labeled 'LLM JUDGE ENSEMBLE (GPT / CLAUDE / GEMINI)', arrows from the six boxes feeding into the center node, then a single arrow exiting right labeled 'PENALTY R' into a circular node labeled 'SAC CONTROLLER (delta-tau, delta-alpha)', a feedback arrow looping back to the leftmost stack labeled 'BEHAVIORAL TRACE', monospace labels, blueprint aesthetic, technical-paper figure style, no human figures, 16:9 -->

# How a Six-Judge Ensemble Steers an SAC Controller to an 18% Sharpe Bump — Without Letting Any Judge Move the Wrong Knob

**Key idea in one sentence:** Score the agent's behavior on six named dimensions with three LLM judges, convert any sub-threshold dimension into a penalty term, and route that penalty to the *specific* SAC action subspace responsible — so when the regime-detection judge complains, only the regime-detection action gets punished.

## The Setup

Most agentic-trading evaluation today is one number: did the next-bar prediction beat the baseline. That hides everything that matters in a sequential-decision system — when the agent failed to switch regimes, when it kept routing to the wrong sub-policy, when it didn't down-size after vol spiked. Aggregate Sharpe is a noisy lagging proxy for those failures. Al Ridhawi, Haj Ali, and Al Osman (Ottawa, 2026-05-07) cut a different surface: judge the *behavior trace* per autonomous decision, then push a credit-assigned reward signal back into the controller. The agent under test is a Soft-Actor-Critic that adjusts a regime-detection threshold τ and a routing weight α on top of an autoencoder + dual node-transformer pipeline ([§3](https://arxiv.org/html/2605.05739)).

## The Intuition Pump

Performance review for an analyst. Bad version: "your Sharpe was −40 bps this quarter, fix it." Good version: "your regime calls were sharp, your hedging was sloppy, your error-recovery is what cost you 80% of the drawdown — work on those two." The behavioral-judge ensemble is the second kind. It tells the agent which *competence*, not just which *outcome*, slipped.

The analogy breaks where it always breaks. The analyst can rationalize back; the model only updates when the feedback shows up as a gradient. The trick of the paper is making per-dimension scores into a gradient that hits the *right parameter*.

## How It Actually Works

1. **Six-dimension trace scoring.** Every five-day episode is logged as a behavioral trace. An ensemble of three judges — GPT 5.4, Claude 4.6 Opus, Gemini 3.1 Pro — scores it 1–5 on regime detection, routing, adaptation, risk calibration, strategy coherence, and error recovery ([§4](https://arxiv.org/html/2605.05739)). The ensemble exists to dampen single-model bias. Cross-model agreement hits Krippendorff α = 0.85.

2. **Dimension-weighted penalty term.** The reward becomes `R'_t = R_t − λ ∑_a max(0, θ − s̄_a) · w_a` with λ = 0.15 and θ = 3 (midpoint of the 1–5 scale). A dimension at-or-above 3 contributes nothing. A dimension at 1.5 contributes a weighted penalty proportional to how far below threshold it sits. Dimension weights `w_a` are the empirical Spearman correlation between that dimension's score and realized 20-day Sharpe. The dimensions that historically forecast P&L weigh more.

3. **Credit assignment to SAC action subspace.** This is the move that makes the penalty surgical. The SAC action is `u_t = (Δτ_t, Δα_t) ∈ [-0.1, 0.1]²`. A static mapping table routes each dimension to a subset of those actions: regime detection and risk calibration → Δτ only; routing → Δα only; adaptation, strategy coherence, and error recovery → both ([Table II](https://arxiv.org/html/2605.05739)). The judge's complaint about regime detection cannot move the routing parameter. That's the whole point.

4. **Perturbation validation as a sanity gate.** Before trusting the loop, the authors mechanically corrupt each dimension and check the judges actually flag it. Inverting the regime label (`ℓ'_t = 1 − ℓ_t`), forcing wrong routing (`α'_t = 0.9·ℓ_t + 0.1·(1−ℓ_t)`), freezing the SAC action, disabling vol scaling, injecting contradictions between component outputs, suppressing recovery — six perturbations, 60 episodes each, 3 judges, 1,260 evaluations. Targeted dimensions drop −1.6 to −2.4 points. Off-target dimensions drift just −0.32. The judges aren't summarizing — they're discriminating.

5. **Closed-loop fine-tuning, three cycles.** Each cycle is 40 trading days, eight non-overlapping five-day episodes. If any dimension's mean score across the cycle falls below θ = 3, SAC is fine-tuned for 10 epochs on that cycle's replay buffer using the modified reward `R'`. Three cycles is the whole loop — not three ablations, three actual policy updates.

6. **The behavioral-Sharpe correlation that justifies all of it.** The composite behavioral score correlates with realized 20-day Sharpe at ρ = 0.72. Without that number, the judges are scoring vibes. With it, the rubric is doing forecasting work.

## Numbers That Anchor It

- **Krippendorff α = 0.85** across GPT 5.4 / Claude 4.6 Opus / Gemini 3.1 Pro on episode-level scores ([abs](https://arxiv.org/abs/2605.05739)).
- **MAPE 0.61% → 0.54%, an 11.5% relative reduction (p < 0.001, Cohen's d = 0.31)** post fine-tuning, 2017–2025 test period on 20 S&P 500 names ([abs](https://arxiv.org/abs/2605.05739)).
- **Directional accuracy 71% → 74%** on the same test window ([abs](https://arxiv.org/abs/2605.05739)).
- **18% Sharpe improvement, 95% bootstrap CI [8.2%, 27.4%]** — gain is concentrated in high-volatility episodes ([abs](https://arxiv.org/abs/2605.05739)).
- **Targeted perturbation drops −1.6 to −2.4 vs. −0.32 off-target** across 6 perturbations × 60 episodes × 3 judges = 1,260 evaluations ([§4](https://arxiv.org/html/2605.05739)).

## What Would Break This

If targeted credit assignment (Table II's per-dimension routing) does *not* outperform uniform credit assignment in the paper's own ablation, the surgical-routing claim collapses — the gain is then from generic reward shaping, and the six-dimension theatre is decorative. Separately, if a generalist-LLM judge ensemble fails to Granger-cause forward Sharpe out-of-sample on a different universe (Polymarket binaries, Kalshi decision markets), the 0.72 correlation is regime-locked to S&P 500 names and the framework doesn't transfer.

## Why It Matters

CalibrationGap's reflection log is exactly the place this slots in. Today the agent grades itself on closed-trade P&L — one number compressed from market selection, clause-text read, sizing, and exit timing. The Al Ridhawi setup is a working blueprint for replacing that single number with six named dimensions, an ensemble Krippendorff α, and a credit-assigned reward update — and it ships with a perturbation-validation protocol that makes the judges falsifiable. Two operator caveats. First, the 0.72 behavioral-Sharpe correlation is computed on the same 2017–2025 test window the policy was tuned on; until a Polymarket replication closes that loop, treat it as suggestive, not load-bearing. Second, the authors flag "alignment tax" explicitly — an agent can learn to look good to the judges without trading better. λ = 0.15 is small for a reason. Anything bigger and the policy optimizes the rubric, not the tape.

## Sources

- [Multi-Dimensional Behavioral Evaluation of Agentic Stock Prediction Systems Using LLM Judges with Closed-Loop Reinforcement Learning Feedback — Al Ridhawi, Haj Ali, Al Osman (arXiv:2605.05739)](https://arxiv.org/abs/2605.05739) — primary
- [HTML render of the paper](https://arxiv.org/html/2605.05739) — primary
- [LLM-as-a-Judge & Reward Model: What They Can and Cannot Do — Son, Ko et al. (arXiv:2409.11239)](https://arxiv.org/abs/2409.11239) — failure-mode reference (over-optimization, position bias, verbosity exploitation)
- [J1: Incentivizing Thinking in LLM-as-a-Judge via Reinforcement Learning](https://arxiv.org/html/2505.10320v3) — companion on RL-trained judges
