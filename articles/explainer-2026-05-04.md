<!-- hero image skipped: REPLICATE_API_TOKEN unset -->
<!-- topic source: newest article (repo-article-2026-05-03.md) — single mechanism extracted: Latin-Hypercube sampling over 10-dim AeonNarrativeFactors used to instantiate 30 of 38 net-new agents on swarm-fund-mvp this week -->

# Latin-Hypercube Sampling: One Strategy, Thirty Variants, Ten Dimensions

**Key idea in one sentence:** Latin-Hypercube sampling stratifies an N-dimensional hyperparameter cube so that *every axis projection* is uniformly covered with exactly one sample per stratum — and that single constraint turns one strategy into thirty diverse-but-balanced variants without paying for grid search.

## The Setup

This week swarm-fund-mvp pushed its fleet from 74 to 112 agents in a single commit ([`1125deb`](https://github.com/tomscaria/swarm-fund-mvp/commit/1125deb), 2026-05-03). Of the 38 net-new agents, **30 are Latin-Hypercube-sampled variants** of the same `aeon-narrative` strategy template, scattered across a 10-dim `AeonNarrativeFactors` space ([`aeon_narrative.py`](https://github.com/tomscaria/swarm-fund-mvp/blob/main/strategies/aeon_narrative/aeon_narrative.py)). The choice of LHS over random or grid was deliberate. The question worth answering: what does LHS actually buy you, and where does it stop buying?

## The Intuition Pump

Picture a 10×10 chessboard. Drop ten rooks so no rook attacks another. Every row is covered. Every column is covered. The *joint* layout is random — but the *marginals* are perfect. That's a 2-dim Latin square. A Latin hypercube is the same trick in N dimensions: every axis-aligned hyperplane through any sample contains exactly that one sample ([Wikipedia](https://en.wikipedia.org/wiki/Latin_hypercube_sampling)).

Where the analogy breaks: rooks-on-a-chessboard tells you the *projections* are uniform, but it tells you nothing about whether the rooks cluster diagonally. They can. LHS guarantees marginal coverage, not joint coverage — that gap is the entire reason people argue about it.

## How It Actually Works

1. **Pick N (variables) and M (samples)** — for swarm-fund-mvp, N=10 (gates: regime affinity, signal-age max, narrative-score floor, multi-skill-confirmation k, momentum filter, confidence floor, HMM-transition guard, kelly fraction, max position, and the Aeon-skill subset bitmask), M=30.
2. **Stratify each axis.** Slice each variable's range into M equal-probability intervals. With 30 variants and `confidence_floor ∈ [0.55, 0.85]`, you get 30 strata of width 0.01.
3. **Sample inside each stratum.** Draw one point uniformly from each interval, one axis at a time. Now you have N independent length-M sequences.
4. **Permute and combine.** Randomly permute each sequence, then zip them: variant *i* takes the *i-th* draw from each axis. The Latin-square property holds by construction — every stratum on every axis appears exactly once.
5. **(Optional) optimize the permutation.** Plain LHS still allows correlated draws by accident; "optimal LHS" minimizes pairwise Pearson correlation across the M samples ([SAS](https://blogs.sas.com/content/subconsciousmusings/2020/04/08/maximize-model-performance/)) or maximizes minimum pairwise distance.
6. **Instantiate.** Each row of the resulting M×N matrix is one variant agent's hyperparameter vector — `kelly_fraction=0.072, signal_age_max_hours=27.4, …` — fed into the strategy template's constructor.

The whole procedure is O(N·M·log M). Cheap.

## Numbers That Anchor It

- **30 / 38 net-new agents on swarm-fund-mvp** are LH-sampled `aeon-narrative` variants — 79% of this week's fleet capacity ([commit `1125deb`](https://github.com/tomscaria/swarm-fund-mvp/commit/1125deb)).
- **Asymptotic variance under LHS is strictly less than IID** for any function with a non-zero additive component — Stein 1987's headline theorem ([Technometrics 29(2)](https://www.tandfonline.com/doi/abs/10.1080/00401706.1987.10488205)). The reduction equals the additive variance share — pure-interaction functions get nothing.
- **Origin: McKay, Beckman, Conover, 1979** at Los Alamos — the foundational paper is still the canonical reference 47 years later ([Wikipedia](https://en.wikipedia.org/wiki/Latin_hypercube_sampling)).
- **"LHS outperforms random search only by a constant factor"** in fully-parallel hyperparameter search — Cauwet et al., ICML 2020 ([proceedings](http://proceedings.mlr.press/v119/cauwet20a.html)). This is the load-bearing limit. The constant matters; the asymptotic doesn't.
- **Curse of dimensionality:** to get *complete* hypercube coverage of an N-dim space at resolution M, you need M^N samples, not M. LHS needs only M, but coverage degrades as N approaches M ([Sampling Smarter, Dai 2024](https://shuhongdai.github.io/blog/2024/Latin_Hypercube_Sampling/)). At N=10, M=30, the ratio is barely workable — every variant is alone on every axis but the joint cube is sparse.

## What Would Break This

If you ran the same 38-agent fleet bump twice — once with LH-sampled `aeon-narrative` variants and once with iid-uniform random variants over the same 10-dim ranges — and after 100 trades per variant the live Sharpe distributions were statistically indistinguishable (Kolmogorov-Smirnov p > 0.1), LHS bought you nothing for this problem. Cauwet et al. 2020 explicitly predicts this: when the budget is small relative to dimensionality, the LHS-vs-random gap *is* a constant factor and that constant can be near 1. The honest test is a paired live run, not an in-sample benchmark.

## Why It Matters

Variant generation is the rate-limiting step in any selector-layer trading apparatus — swarm-fund-mvp shipped seven selector-layer ADRs in seven days last week (#084-091) without adding a strategy, then poured all 30 of this week's variants into one new strategy. LHS lets you turn one good idea into thirty parameterized hypotheses without committing to a grid you can't afford or a random scatter that wastes coverage. The catch is that LHS only buys you *marginal* coverage; if the edge lives in a specific *joint* region of the cube, you'll still need a follow-up Bayesian-optimization pass to find it.

## Sources

- [Latin hypercube sampling — Wikipedia](https://en.wikipedia.org/wiki/Latin_hypercube_sampling) — primary canonical reference (McKay/Beckman/Conover 1979 origin)
- [Stein, 1987 — Large Sample Properties of Simulations Using Latin Hypercube Sampling, *Technometrics* 29(2)](https://www.tandfonline.com/doi/abs/10.1080/00401706.1987.10488205) — primary variance theorem
- [Cauwet et al., 2020 — *Fully Parallel Hyperparameter Search: Reshaped Space-Filling*, ICML](http://proceedings.mlr.press/v119/cauwet20a.html) — primary, the constant-factor claim
- [Hakimi, 2025 — *Robust Estimation With Latin Hypercube Sampling*, arXiv:2502.06321](https://arxiv.org/abs/2502.06321) — recent CLT for Z-estimators under LHS
- [Dai, 2024 — *Sampling Smarter: Unlocking the Power of Latin Hypercube Sampling*](https://shuhongdai.github.io/blog/2024/Latin_Hypercube_Sampling/) — dimensional-coverage analysis
- [`tomscaria/swarm-fund-mvp` commit `1125deb`](https://github.com/tomscaria/swarm-fund-mvp/commit/1125deb) — primary, the 30/38 fleet-bump artifact
- [`strategies/aeon_narrative/aeon_narrative.py`](https://github.com/tomscaria/swarm-fund-mvp/blob/main/strategies/aeon_narrative/aeon_narrative.py) — primary, the 10-dim `AeonNarrativeFactors` source
