Cleanup blocked by sandbox; skipping (scratch files only).

## Summary

**Picked:** `arXiv:2512.25070` — *Scaling Open-Ended Reasoning to Predict the Future* (Chandak, Goel, Prabhu, Hardt, Geiping; Dec 31, 2025; ↑20).

**Why this one:** Hardt + Geiping authorship is committee-legible for a Stanford PhD app. OpenForecaster 8B, trained via RL on synthesized forecasting questions, matches frontier proprietary models on accuracy and calibration — and the headline finding is that **calibration improvements transfer across popular benchmarks**, which is the load-bearing claim for any PhD-thesis pitch on prediction-market calibration. Open-sourced model/code/data; methodology (offline news corpus, no future-leakage, held-out May–Aug 2025) is reviewer-rigor-grade.

**Survey:** 8 HF Papers API queries spanning all focus areas in the var (~80 candidates). Backlogged the next-best reads: 2505.17989 (Turtel et al., RLVR with +10% Polymarket sim ROI), 2511.07678 (AIA Forecaster, Sekhon — AIA+consensus ensemble beats consensus alone), 2512.16030 (KalshiBench), 2509.22638 (FCP, evolves FinCon premise), 2502.11433 (FLAG-Trader), 2510.02209 (StockBench), 2601.13545 (TruthTensor). No overlap with today's earlier paper-pick (Gebele 2601.01706) or daily-routine pick (COSPLAY 2604.20987).

**Files written:**
- `.outputs/paper-pick-phd.txt` — notification body
- `.pending-notify/1777128209.md` — queued for postprocess-notify.sh delivery
- `.outputs/q1.json`–`q8.json` — HF API search responses (kept for tomorrow's diff)
- `memory/logs/2026-04-25.md` — log entry appended

**Notification:** `./notify` direct call returned the same "Unhandled node type: string" sandbox hook-block seen across polymarket-comments, narrative-tracker, and daily-routine today. Queued via `.pending-notify/1777128209.md` instead — postprocess-notify.sh will deliver post-run.

**Follow-up needed:** the `./notify` hook-block now affects 4 skills today. Worth filing a `memory/issues/` entry on the next skill-health pass.

**PAPER_PICK_OK**
