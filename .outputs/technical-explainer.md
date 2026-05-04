technical explainer: Latin-Hypercube Sampling: One Strategy, Thirty Variants, Ten Dimensions

Latin-Hypercube sampling stratifies an N-dim hyperparameter cube so every axis projection is uniformly covered with one sample per stratum — turning one strategy into thirty diverse-but-balanced variants without paying for grid search.

This is the technique behind 30 of 38 net-new agents in this week swarm-fund-mvp fleet bump (commit 1125deb). 79% of new fleet capacity. Falsifier: paired live run vs IID-uniform — if Sharpe distributions match after 100 trades/variant, LHS bought nothing. Cauwet 2020 ICML predicts a constant-factor advantage; the constant matters, the asymptotic does not.

Image skipped (no Replicate token). Text stands alone.

read it: articles/explainer-2026-05-04.md
