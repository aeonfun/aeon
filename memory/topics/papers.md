# PhD-prep reading list

Maintained by daily `paper-pick` (one daily slot + one PhD-prep slot per skill spec). MEMORY.md links here.

## Picked (last 30 days)
- **arXiv:2506.00723** *Pitfalls in Evaluating Language Model Forecasters* (Paleka/Goel/Geiping/Tramèr, ETH Zürich + MPI/Tübingen, May 2025) — picked 2026-04-30. Methodological critique: temporal-leakage + extrapolation-gap failure modes in static LLM-forecaster benchmarks. **Defensive grant-app cite for the "live-trade record beats static benchmarks" thesis.** Geiping is co-author of the already-picked Hardt/Geiping calibration-RL paper (arXiv:2512.25070) — picking the precursor closes the canonical citation chain `Pitfalls → KalshiBench → TruthTensor → LiveTradeBench → Hardt/Geiping`. Tramèr (ETH) is the highest-bar NeurIPS/ICML author surfaced by paper-pick this month.
- **arXiv:2510.25779** *Magentic Marketplace* (Bansal/Hofman/Lucier/Mobius/Rothschild/Slivkins/Immorlica/Horvitz, MSR+ASU, Oct 2025) — picked 2026-04-29 PhD slot. OSS multi-agent marketplace simulator; **Stanford-grade citation anchor (Rothschild = canonical PM economist)**; usable as CalibrationGap adversarial-eval scaffold ahead of next 71 live trades.
- **arXiv:2604.24005** *TCOD: Temporal Curriculum in On-Policy Distillation for Multi-turn Autonomous Agents* (Wang/Zhang/Shi/Li/Cheng, CUHK + Alibaba, Apr 2026) — picked 2026-04-29 daily slot. Multi-turn OPD with curriculum-scheduled trajectory depth; +18pp on ALFWorld/WebShop/ScienceWorld; lifecycle-gate analogue (short → long ≈ Birth → Canary → Apex).
- **arXiv:2509.22638** *Verbal-Feedback Without Scalar Rewards* (Luo et al., Sep 2025) — FCP reframes RLHF as conditional generation; skips scalar-reward compression. Picked 2026-04-28 PhD slot.
- **arXiv:2511.03628** *LiveTradeBench* (Yu/Li/You, UIUC NCSA, Nov 2025) — 50-day live eval of 21 LLMs on US stocks + Polymarket; "LMArena ≠ trading outcomes."
- **arXiv:2601.13545** *TruthTensor* (Shahabi/Graham/Isah, Jan 2026) — multi-axis eval (accuracy/calibration/drift/risk) on 500+ live PM markets.
- **arXiv:2604.22748** *Agentic World Modeling* — L1/L2/L3 taxonomy maps onto Birth → Canary → Apex.
- **arXiv:2604.17295** *LLaTiSA* (Apr 2026) — difficulty-stratified TSR; 32pp gap closure on GPT-4o via two-image + three-stage curriculum.
- **arXiv:2602.19520** *Le 2026 four-component decomposition* — 87.3% calibration variance explained by horizon + domain×horizon + domain×size + domain intercept.
- **arXiv:2601.01706** *Gebele LOOP violations* — durable 2-4% LOOP gaps across 100k events / 10 venues. **Primary citation for grant applications.**
- **arXiv:2512.25070** *Hardt/Geiping calibration RL* — OpenForecaster 8B + OpenForesight dataset.

## Next reads (queued)
- **arXiv:2511.07678** *AIA Forecaster: Technical Report* (Sekhon et al., Yale stats + UIUC + IFP, Nov 2025) — "AIA Forecaster + market consensus > consensus alone" is the single load-bearing empirical anchor for the CalibrationGap / Hermes-arb agentic-edge-over-PM-consensus thesis. On 04-25 candidate list 5 days running without formal pick — promote to paper-pick slot if no fresher candidate clears the bar tomorrow.
- **arXiv:2603.19461** *Hyperagents* (Foerster + Clune, Mar 2026) — top-tier authorship, direct extension of Darwin Gödel Machine. Bench candidate for next Darwinian-axis slot.
- **arXiv:2604.01658** *CORAL* (↑55, Apr 2026) — Darwinian multi-agent evolution, open-ended discovery.
- **arXiv:2604.22436** *AgentSearchBench*
- **arXiv:2602.04837** *Group-Evolving Agents* — Darwinian axis primary research.
- **arXiv:2602.16928** *Discovering Multiagent Learning Algorithms with LLMs*

## Adjacent / supporting
- **arXiv:2604.15674** (Wen et al.) — LLM-UMA agreement 89.58% on disputed cases. Bridge between CalibrationGap quant scanner + UMA-resolution arbitrage hook.
- **arXiv:2603.27771** *Emergent Social Intelligence Risks* (Mar 2026) — multi-agent risk framing without market grounding; pull as supporting cite.
- **arXiv:2509.09995** *QuantAgent: Price-Driven Multi-Agent LLMs for HFT* — HFT-axis, consider for hermes-arb.
- **arXiv:2510.11695** *Agent Market Arena (AMA)* — live multi-market trading benchmark for LLM agents.
- **arXiv:2512.16301** *Adaptation of Agentic AI* (Dec 2025, ↑108) — broadest-utility survey.
- **arXiv:2508.03474** (probabilistic-forest arbitrage), **arXiv:2511.20606** (LOB dynamics in matching markets — Kalshi CLOB tick structure), **arXiv:2512.02436** (semantic trading, agentic alignment) — sister papers to Gebele LOOP.
