<!-- hero image skipped: no-token (REPLICATE_API_TOKEN unset in this run) -->
<!-- intended hero-image prompt: "Technical schematic illustration of a call-market prediction market with three LLM traders, dark navy background, thin cyan and amber lines, three boxes labeled 'da', 'db', 'dc' feeding three trader nodes labeled 'Claude(1)', 'Claude(2)', 'Claude(3)', a central call-market clearing node labeled 'price p', a feedback arrow from 'P&L log' back into trader prompts highlighted in amber and crossed out, monospace labels, blueprint aesthetic, 16:9" -->

# An LLM Forecaster With a Track Record Forecasts Worse Than One Without

**Key idea in one sentence:** In a controlled prediction-market experiment with Claude as the trader, feeding the agent its own past P&L between rounds makes it worse at aggregating private information — same model, same signals, lower profit, higher log-error on the closing price ([Galanis 2026, arXiv:2604.20050](https://arxiv.org/abs/2604.20050)).

## The Setup

Most "agentic trading" stacks do the same thing — log every trade, summarize the win-rate, paste it back into the prompt next round. LiveTradeBench, AMA, the swarm-fund-mvp reflection loop — all assume past-performance feedback makes the agent better. Galanis (Durham University Business School) tested that assumption directly in a 64-page controlled experiment ([arXiv:2604.20050](https://arxiv.org/abs/2604.20050)). Feedback degrades aggregation. That is not a small finding for any team running an LLM trader pre-Apex.

## The Intuition Pump

A prediction market is a Walrasian classroom. Every other student has half the answer key. You don't know which half, but if you watch what they bid you can back out their slice. The job of a trader in the room isn't to be right — it's to read the room.

Where the analogy breaks: an agent staring at its own report card stops watching the room. It starts answering a different question — "how do I improve my track record" — instead of "what do the other bids imply about the world." Once that swap happens, the price stops being information, and the trader stops being a Bayesian updater on others' beliefs. It becomes a goal-seeker on its own metric.

## How It Actually Works

1. **Build a small world.** Three independent binary signals — `da`, `db`, `dc` — each 0 or 1. Eight states of the world. Two complementary tradable assets, so the market is constant-sum on profits ([Galanis 2026 PDF](https://arxiv.org/pdf/2604.20050)).

2. **Hand each agent a private piece of the answer.** Each Claude trader sees one of the three signals. No agent sees the full state. The point of the market is to aggregate the three slices into a posterior — and the closing price is the test of whether that happened.

3. **Open a call market.** All agents submit orders simultaneously, the market clears once, the closing price is recorded. Repeat across many information structures, sweeping from "easy" (each signal cleanly identifies a coordinate) to "complex" (the state requires reasoning about what others must have observed).

4. **Score with log-error of the last price.** If the true probability of asset A paying out is `p*` and the closing price is `p`, log-error penalizes how far `p` is from `p*`. Lower is better. That number is the aggregation quality.

5. **Run two arms.** Control: each agent only sees its private signal and the public price. Treatment: same setup, but at the start of every new round the agent is shown its cumulative P&L from prior rounds. Same model, same signals, same market mechanism. Only the prompt differs.

6. **Read the result.** The treatment arm has higher log-error and lower per-agent profit. Smarter LLMs aggregate better in both arms — but the smarter-LLM gain does not offset the feedback penalty. Cheap talk, longer markets, different initial price, and strategic prompting all leave aggregation essentially unchanged. The performance-feedback channel is what moves the needle, in the wrong direction.

## Numbers That Anchor It

- Experimental world: 3 binary signals × 2 complementary assets × 8 states, swept across information complexities — 64 pages of experiments and theory ([arXiv:2604.20050 abstract page](https://arxiv.org/abs/2604.20050)).
- Aggregation degrades significantly as information complexity increases — same human-style failure mode of "reasoning about others" ([Galanis 2026 abstract](https://arxiv.org/abs/2604.20050)).
- "Smarter" LLMs aggregate better and earn more in both arms — capability scaling helps, in the absence of feedback ([Galanis 2026 abstract](https://arxiv.org/abs/2604.20050)).
- Feedback about past performance is the only manipulation in the perturbation sweep that worsens both aggregation and profit — cheap talk, market duration, initial price, and strategic prompting do not ([Galanis 2026 abstract](https://arxiv.org/abs/2604.20050)).
- Result holds for the median market across the experimental panel — not a tail anecdote ([Galanis 2026 PDF](https://arxiv.org/pdf/2604.20050)).

## What Would Break This

Replicate with the same private-signal mechanic but split feedback into two channels — (a) calibration feedback ("your last forecast was off by `p − p*`") and (b) outcome feedback ("you made/lost X"). If only the outcome arm degrades, the mechanism is goal-seeking on P&L, not learning. If both arms degrade, the mechanism is something deeper about LLMs anchoring on their own history. If neither degrades and Galanis's result fails to replicate on a frontier 2026 model — Claude Opus 4.7 or GPT-5.2-XHigh — the finding is a Claude-version artifact and the field can resume its reflection-loop habit.

## Why It Matters

CalibrationGap (Revenant) is at 29 closed trades, 71 from the Apex gate. Every round of the canary loop currently feeds a P&L summary into the prompt. If Galanis is right, that summary is taking points off the model's aggregation quality on every trade — and the gain we claim from "reflection" is the thing we should be ablating before the next 71 closes the gate. The cheap experiment is one prompt config: strip the running P&L for half the trades, keep it for the other half, score log-error of fill vs. resolution. If feedback is the same anti-pattern in live capital that it is in Galanis's lab, that ablation pays for itself in the first week.

## Sources

- [Galanis, Spyros — *Information Aggregation with AI Agents*, arXiv:2604.20050](https://arxiv.org/abs/2604.20050) — primary
- [Galanis 2026 — full 64-page PDF](https://arxiv.org/pdf/2604.20050) — primary
- [Spyros Galanis — Durham University Business School profile](https://www.durham.ac.uk/business/our-people/spyros-galanis/) — author affiliation
- [Paleka, Goel, Geiping, Tramèr — *Pitfalls in Evaluating Language Model Forecasters*, arXiv:2506.00723](https://arxiv.org/abs/2506.00723) — methodological complement (Aeon paper-pick 2026-04-30)
- [LiveTradeBench, arXiv:2511.03628](https://arxiv.org/abs/2511.03628) — reflection-loop benchmark this finding directly contradicts
