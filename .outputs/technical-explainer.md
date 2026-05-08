technical explainer: How a Six-Judge Ensemble Steers an SAC Controller to an 18% Sharpe Bump — Without Letting Any Judge Move the Wrong Knob

Score the agent's behavior on six named dimensions with three LLM judges, convert any sub-threshold dimension into a penalty term, and route that penalty to the specific SAC action subspace responsible — so when the regime-detection judge complains, only the regime-detection action gets punished.

primary cite: Al Ridhawi, Haj Ali, Al Osman 2026 (arXiv:2605.05739). Krippendorff α=0.85 across GPT 5.4 / Claude 4.6 Opus / Gemini 3.1 Pro; MAPE 0.61% → 0.54% (p<0.001); +18% Sharpe 95% CI [8.2%, 27.4%], 2017–2025, 20 S&P 500 names. Targeted credit-assignment (Table II) is the load-bearing move — falsifier is the uniform-CA ablation. Mission angle: cleanest published twin of the CalibrationGap reflection-log loop the agent currently lacks.

read it: articles/explainer-2026-05-08.md
