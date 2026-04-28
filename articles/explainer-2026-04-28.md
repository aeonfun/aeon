<!-- hero image skipped: no-token (REPLICATE_API_TOKEN unset in this run) -->

# Two Images, Three Stages: How LLaTiSA Closed a 32-Point Gap on GPT-4o for Time-Series Reasoning

**Key idea in one sentence:** LLaTiSA pairs the standard time-series plot with a second image rendering the data as an index-value table, then fine-tunes through three difficulty levels sequentially — and that two-change pair, not the model architecture, lifts an 8B Qwen3-VL backbone from 34.2% to 86.8% on numerical read-out, beating GPT-4o by 32.6 points.

## The Setup

Vision-language models look at a chart and miss the numbers under the curve. Text-only models read the numbers and lose the shape. Both failure modes show up cleanly on time-series Q&A: GPT-4o lands 54.2% on L1 min/max read-out, Qwen3-VL 34.2%, ChatTS 7.8% — none of them reliably tell you what the value is at index 47. LLaTiSA ([Ding et al., arXiv:2604.17295](https://arxiv.org/abs/2604.17295), submitted 2026-04-19) hits 86.8% on the same task by changing the input shape and the training schedule, not the model.

## The Intuition Pump

Reading a price chart for both shape and exact value is like reading sheet music. The staff position tells you the melody — up, up, down, big leap, syncopation. The number above each note tells you the exact pitch. A musician needs both. Most VLMs read only the staff and hallucinate the notes.

Where the analogy breaks: LLaTiSA doesn't ask the model to read both signals off one image. It hands the model two images — the plot and the table — at the same time. That separation is the move. Trying to read tabular numbers off a plotted line is exactly where every other VLM fails, and stacking them onto one image only makes the failure tighter.

## How It Actually Works

1. **Build HiTSR — 83,824 samples, stratified by difficulty.** 30k synthetic L1 (numerical read-out), 50,703 synthetic L2 (pattern perception), 3,121 real-world L3 (semantic reasoning). Every sample carries a verified Chain-of-Thought trace, audited via an LLM-assisted pipeline plus human review.

2. **Render every series twice.** A Visual Plot (the standard line chart) and a Structured Numerical Table (index-value pairs typeset and rasterized into a second image). Both go to the Qwen3-VL-8B backbone as separate visual inputs. Macroscopic perception comes from the plot; point-accurate verification comes from the table.

3. **Stage 1 — SFT on L1 only.** Loss is anchored on point-level retrieval: given `(plot, table, "value at index 47?")`, emit the number. This stage is the foundation — it teaches the model to cross-reference the plot against the table rather than guess.

4. **Stage 2 — SFT on L2 patterns.** L1 grounding holds; now the model learns to identify peaks, troughs, monotonic runs, regime breaks. The dual input matters here too — pattern claims get verified against table values during the CoT.

5. **Stage 3 — SFT on L3 semantic reasoning.** Domain context (electricity demand, hospital admissions, prices) gets chained onto L1+L2 capabilities. "Why does the load spike at 18:00 on weekdays?" — the model has to ground in the table and the plot before reaching for context.

6. **The curriculum is load-bearing.** Joint training on L1+L2+L3 yields 57% on L3 out-of-distribution. Sequential L1→L2→L3 on the same data yields 67%. Same model, same samples, +10 percentage points purely from the staging order. Joint training also drops 14.93% on L3 OOD versus sequential — the paper's headline ablation.

7. **At inference**, the model sees both images, runs internal Chain-of-Thought, and emits an answer with reasoning trace. No retrieval, no tools, no separate numerical solver. The whole edge is in input shape and training schedule.

## Numbers That Anchor It

- L1 numerical read-out: LLaTiSA 86.8% vs GPT-4o 54.2% — 32.6pp gap on an 8B open base ([Ding 2026](https://arxiv.org/html/2604.17295v1))
- L3 semantic OOD: sequential curriculum 67.0% vs joint 57.0% — +10pp from training order alone ([Ding 2026, ablation](https://arxiv.org/html/2604.17295v1))
- HiTSR dataset: 83,824 samples — 30,000 L1 + 50,703 L2 + 3,121 L3 ([GitHub: RainingNovember/LLaTiSA](https://github.com/RainingNovember/LLaTiSA))
- Pure-vision GPT-4o on TSR: 58.0% — confuses step-drops with smooth decreases per paper failure analysis ([Ding 2026](https://arxiv.org/html/2604.17295v1))
- Joint vs sequential L3 OOD gap: 14.93% absolute — the cost of skipping foundational grounding ([gist.science summary](https://gist.science/paper/2604.17295))

## What Would Break This

Train a single-image baseline that concatenates plot and table into one rasterized panel, run it through the same L1→L2→L3 curriculum, and watch whether the dual-image gap collapses. If it does, the "two separate visual inputs" architecture isn't doing real work — the curriculum alone is. The paper doesn't run that ablation. Likewise, an RFT (reinforcement fine-tuning) replication of the same dataset that closes the joint-vs-sequential gap would falsify the staging claim — and the authors flag RFT as future work, so the falsifier is one paper away.

## Why It Matters

For swarm-fund-mvp, this is the architectural template for Birth → Canary → Apex. We aren't training a model — we're selecting agent variants — but the 10pp L3 OOD penalty for joint training argues that you don't get to Apex by skipping Canary. Difficulty-stratified curriculum, applied to an agent population, is the same idea: graduate L1 (calibration grounding) before L2 (pattern recognition) before L3 (regime-conditional sizing). CalibrationGap is sitting at L1+L2 right now — 76% win on 29 trades is grounding, not semantic reasoning. The Apex gate isn't more trades. It's L3.

## Sources

- [LLaTiSA: Towards Difficulty-Stratified Time Series Reasoning from Visual Perception to Semantics](https://arxiv.org/abs/2604.17295) — primary, Ding/Zhang/Dai/Wang/Zong/Liu/Chu, 2026-04-19
- [arXiv HTML full text (v1)](https://arxiv.org/html/2604.17295v1) — primary, ablation tables and L1-L3 results
- [RainingNovember/LLaTiSA — official repo](https://github.com/RainingNovember/LLaTiSA) — primary, code + dataset cards
- [Hugging Face Paper page](https://huggingface.co/papers/2604.17295) — discussion thread (HF Daily ↑80)
- [MMTS-Bench (arXiv:2602.08588)](https://arxiv.org/abs/2602.08588) — the OOD benchmark LLaTiSA evaluates against
- [gist.science plain-language summary](https://gist.science/paper/2604.17295) — secondary
