# Paper Digest — 2026-05-03
> **Verdict:** Thin week. One fresh reward-free self-evolution result with concrete deltas, one multi-agent governance experiment that puts a 57pp ceiling on selector mis-specification, one replay-grade financial market simulator. Zero new Polymarket microstructure work since the 05-01 harvest closed it out.
> Pool: HF 90 (5 topic queries × 15 + 15 daily) + arXiv 37 (4 queries, last 14d) → combined 127 → deduped 92 (after 7-day skip set: paper-digest 05-01 + 05-02 shipped IDs + topics/papers.md picked/queued/adjacent) → skip-gated 89 → shipped 3

## Self-evolution / Darwin-axis

1. **Training LLM Agents for Spontaneous, Reward-Free Self-Evolution via World Knowledge Exploration** — Anonymous et al. (2026) · ↑9
   **What's new:** Outcome-based reward (delta in downstream success rate from agent-generated world knowledge) used train-only — at inference no external reward, the agent self-explores and self-summarises before tasks; on Qwen3-30B and Seed-OSS-36B this yields +20% on WebVoyager and WebWalker, and a 14B Qwen3 with its own generated world knowledge beats unassisted Gemini-2.5-Flash on the same tasks.
   **So what:** Directly probes the load-bearing assumption in CalibrationGap's reflection-log loop — that live P&L feedback must keep flowing or the loop stalls. Sets up a cheap pre-Apex ablation: strip the P&L feedback from the reflection summary on half the remaining 71 trades and score log-error of fill vs. resolution. If zero-reward holds, CalibrationGap survives an oracle outage; if it doesn't, Galanis (`2604.20050`, picked 05-01) wins twice.
   [abs](https://arxiv.org/abs/2604.18131) | [pdf](https://arxiv.org/pdf/2604.18131)

## Multi-agent systems / governance

2. **When Agents Evolve, Institutions Follow** — Anonymous et al. (2026) · ↑1
   **What's new:** Translates 7 historical political institutions (4 canonical governance patterns) into executable multi-agent architectures, runs them across 3 LLMs on 2 benchmarks under identical conditions; the gap between best and worst institution within a single model exceeds 57 percentage points, and the optimal architecture shifts systematically with model capability — i.e. there is no single optimal organisational form. Code at `github.com/cf3i/SocialSystemArena`.
   **So what:** swarm-fund-mvp's fleet-selection layer (ADRs #084-091, 6 of the last 7 ADRs) is exactly the institution-design problem this paper formalises empirically. The 57pp gap puts a hard upper bound on selector mis-specification; the "optimal architecture shifts with capability" finding argues for an explicit ADR on selector reconfiguration at Apex graduations or LLM-base upgrades. Direct lineage extension of CORAL (`2604.01658`, picked 05-02) and GEA (`2602.04837`, picked 05-02) — same axis, governance-layer cut.
   [abs](https://arxiv.org/abs/2604.27691) | [pdf](https://arxiv.org/pdf/2604.27691)

## Market microstructure / simulators

3. **EvoMarket: A High-Fidelity and Scalable Financial Market Simulator** — Anonymous et al. (2026) · ↑0
   **What's new:** Discrete-event multi-agent simulator with Oracle-guided in-run self-calibration (interprets microstructure discrepancy vs replay as missing order flow, synthesises corrective orders at recording checkpoints — bypasses black-box parameter calibration); replays China A-share order-flow + LOB across 5 trading days with depth-level fidelity gains, includes opening call auctions, price limits, T+1 settlement; cross-asset linkage and event-study intervention runs.
   **So what:** Replay-grade complement to Magentic Marketplace (Bansal/Rothschild et al. 2025, picked 04-29 PhD slot) — that one studies synthetic-marketplace LLM agents, this one replays actual LOB tape with mechanism fidelity. Usable as the adversarial-eval scaffold the operator-side post-Apex checklist has been queueing for the CalibrationGap fleet, and the LOB-replay layer is the missing cross-venue piece for hermes-arb's BTC 5-min Kalshi↔Polymarket leg falsifier window.
   [abs](https://arxiv.org/abs/2604.18046) | [pdf](https://arxiv.org/pdf/2604.18046)
