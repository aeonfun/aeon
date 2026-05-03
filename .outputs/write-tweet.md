tweet drafts: ingest resolution text not titles (calibrationgap upgrade)

— one-liner —
1a. Quant scanners read titles. Markets resolve on text.
1b. Most calibration models lose to a kid with a comments tab.

— two-punch —
2a. Russia-Ukraine ceasefire May-31 sits at 6% YES. Resolution rule excludes humanitarian, unilateral, and non-general pauses by name. Putin's offer fails 3 of 4.
2b. The edge isn't predicting the war. It's reading the resolution clause. CalibrationGap was blind to language asymmetry until we ingested the text.

— paragraph —
3a. Quant scanners read market titles. They miss the one place edge actually lives: resolution text. Iran-cease-fire 0.25% NO. Hez-cease-fire 99.85% YES. Near-identical clauses, opposite resolutions. Same scanner, blind to both.
3b. Calibration-on-titles is a solved problem. Brier-beating LLMs still lose money on Polymarket because the alpha moved into the clause-level language a paragraph below the headline. Read the rules or punt the trade.

— long tweet —
4a. Spent the week instrumenting CalibrationGap to ingest resolution clauses, not just market titles. Found the obvious thing in the obvious place: Russia-Ukraine ceasefire markets price the headline event ('truce announced') and ignore the legal bar ('general, bilateral, multi-day'). Putin's May 9 Victory Day pause fails three of four resolution criteria. May-31 6% YES is correctly priced. June-30 11.5%. EoY 25.5%. The trade is the comments-side leverage window 05-08 to 05-10.
4b. Everyone is building Brier-beating LLM forecasters. The 2026 papers converge on the same answer: calibration is solved, profit is not. Why? The Brier benchmark scores against the title. The market resolves against a 400-word legal clause attached to a UMA oracle. PolyBench, Prophet Arena, Semantic Trading — all measuring the wrong gap. The unsolved problem is reading the rules, not predicting the news.

— thread opener —
5a. Why do LLMs now beat the Brier baseline on Polymarket but still lose money? Looked at every binary CalibrationGap closed last month. The answer is unsexy and one paragraph long.
5b. 29 closed trades. 76% win. +$415 P&L. Sharpe 0.31. The single biggest upgrade we have queued for the last 71 trades to Apex isn't a model swap. It's reading the small print.

best: #4a — operator voice, concrete trade window, threads CalibrationGap thesis with a live Polymarket position
