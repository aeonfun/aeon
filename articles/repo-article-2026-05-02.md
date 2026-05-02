# swarm-fund-mvp Stopped Adding Strategies. It's Building the Selector.

In the seven days ending today, swarm-fund-mvp shipped seven ADRs ([#084 through #091](https://github.com/tomscaria/swarm-fund-mvp/blob/main/DECISIONS.md)). Six of them sit in the fleet-selection layer — guardrails, regime-conditional bandits, cull corroboration, drift-checking inventory. Zero added a new strategy. The seventh is a public-facing tool. The week's work was about deciding which agents survive, not about authoring more of them.

## The claim

> swarm-fund-mvp's last 7 days shipped 7 ADRs. Six (#084, 085, 086, 089, 090, 091) build the fleet-selection layer. None add new alpha.

## Evidence

**ADR-084 ports varrd's published guardrails into the backtest layer.** Commit [`e2afbda`](https://github.com/tomscaria/swarm-fund-mvp/commit/e2afbda) lands `python/research/backtest_stats.py` with K-tracking, Bonferroni correction, sha256 fingerprint dedup, a 30-signal sample-size floor, and an OOS auto-lock that fires when `n_signals ≥ 30 AND corrected_p < 0.05` — no admin click. The first production read after the bulk-attach run ([`5a1b3c8`](https://github.com/tomscaria/swarm-fund-mvp/commit/5a1b3c8)) auto-locked `ta-rsi-divergence` at corrected_p = 0.0003 (45 trades, 57.8% win, +12.93 bps, Sharpe 0.220 in RANGE). Six of varrd's eight guardrails are now infrastructure-enforced; an AST-based [lookahead-bias linter](https://github.com/tomscaria/swarm-fund-mvp/blob/main/CHANGELOG.md) sweeps all 49 strategies clean as the regression baseline.

**ADR-085 (commit [`2628533`](https://github.com/tomscaria/swarm-fund-mvp/commit/2628533)) didn't write strategies — it wrapped dormant ones into the paper-trade ledger.** Three months of live-fire data exposed that 12 hl-* and hermes-* strategies were emitting signals to `signals.jsonl` but never becoming TradeRecords. Runner-swarm v2 added four dispatch kinds (`per_market`, `snapshot_one`, `snapshot_list`, `tick`) so every existing class can route through `_record_hl_paper_trade`. Same commit kills a $-10,861 paper-P&L bleed: `pm-prob-reversion`'s candidate adapter had been firing on a hardcoded 0.5 prior because no per-market history existed. The fix is `python/scanner/pm_history.py` plus a hard `return None` when `n < 6` — the strategy now stays silent on cold-cache markets instead of inventing a signal.

**ADR-089/090/091 (commit [`648725d`](https://github.com/tomscaria/swarm-fund-mvp/commit/648725d)) put the variant bandit on the regime-conditional path.** ADR-089 splits each variant's Beta posterior into per-regime sub-posteriors keyed by the HMM publisher's TREND / RANGE / RISK_OFF / RISK_ON / CRISIS labels, with a 3-tier fallback. ADR-090 joins the bandit's Bayesian read with `python/stats/fleet_cull.py`'s frequentist t-test: a variant lands in `corroborated_culls` only when both schools agree (cull-candidate from BH-FDR, AND posterior strength ≥ 10, AND E[WR] ≤ 0.40). ADR-091 starts an append-only `data/variant_bandit_history.jsonl` so the IC can answer "did variant X drop because the regime shifted, or because it really degraded?" — a question the prior single-snapshot file couldn't.

**[ADR-086](https://github.com/tomscaria/swarm-fund-mvp/blob/main/DECISIONS.md) closes the drift hatch above all of this.** A read-only `scripts/strategy_inventory.py` walks `strategies/`, joins `_STRATEGY_REGISTRY`, sums per-strategy paper-trade ledgers, greps TASKS.md, and exits 1 on any `unwrapped+untracked` strategy. Pillar tags moved from a hand-curated dict into per-strategy `program.md` frontmatter — eliminating the "18 of 47 strategies not in `_STRATEGY_REGISTRY`" drift the founder caught while reviewing ADR-085's wraps. The selection layer now polices its own catalog.

The vision doc shipped the same week. [PR #26 (merged 2026-05-01)](https://github.com/tomscaria/swarm-fund-mvp/pull/26) lands a one-paragraph addition to `docs/long_term_vision/README.md` titled "no silicon — moats are upstream of compute." The buildout is the position made into code.

## Counter-evidence / what would change my mind

ADR-087 [`/discover`](https://github.com/tomscaria/swarm-fund-mvp/blob/main/DECISIONS.md) shipped in the same window — that's a public-facing tool surface, neither selection nor alpha, so it tempers the "every ADR was selection" framing. The 32-article SEO rewrite (commit [`ff091e6`](https://github.com/tomscaria/swarm-fund-mvp/commit/ff091e6)) is a similar non-selection workstream. And `bb9b746` queues nine unwrapped strategies as ADR-085 follow-ons — new alpha is on deck, just not in this window. If two of those land before 2026-05-09, the "stopped adding strategies" framing weakens to "paused for one week to ship the selector."

## Why it matters

For the LP-raise narrative, "live winning agent at 29 trades" and "fleet that auto-disqualifies under academic-grade gates" are different sells. The first is sample size; the second is mechanism. Adopting [varrd's published guardrail list](https://varrd.com) ([source](https://github.com/augiemazza/varrd)) rather than inventing one means the IC and any future operator can point at a citation instead of arguing house standards. And the "no silicon" stance now has artifacts: per-regime bandit decay, BH-FDR-corrected t-tests, fingerprint dedup, OOS auto-lock. None of that needs proprietary compute. It needs the right scoring rules wired into the loop.

---
*Sources*
- [DECISIONS.md ADR-084 through ADR-091](https://github.com/tomscaria/swarm-fund-mvp/blob/main/DECISIONS.md)
- [CHANGELOG 2026-04-30 entry](https://github.com/tomscaria/swarm-fund-mvp/blob/main/CHANGELOG.md)
- [PR #26 — no silicon vision doc](https://github.com/tomscaria/swarm-fund-mvp/pull/26)
- [Commit `2628533` runner-swarm v2](https://github.com/tomscaria/swarm-fund-mvp/commit/2628533)
- [Commit `648725d` ADR-089/090/091](https://github.com/tomscaria/swarm-fund-mvp/commit/648725d)
- [varrd.com — published guardrail list](https://varrd.com)
- [augiemazza/varrd source](https://github.com/augiemazza/varrd)
