technical explainer: An LLM Forecaster With a Track Record Forecasts Worse Than One Without

In a controlled prediction-market experiment with Claude as the trader, feeding the agent its own past P&L between rounds makes it worse at aggregating private information — same model, same signals, lower profit, higher log-error on the closing price (Galanis 2026, arXiv:2604.20050).

CalibrationGap is 71 trades from the Apex gate and the canary loop currently feeds P&L into the prompt every round. Cheap ablation: strip the running P&L for half the next 71 trades, score log-error of fill vs. resolution.

read it: articles/explainer-2026-05-01.md

