# Working Code Inventory

## Scanner Pipeline
- `python/scanner/polymarket_live.py` — fetches live markets from Gamma API, classifies by asset
- `python/scanner/calibration_bootstrap.py` — longshot bias heuristic (pre-Becker)
- `python/scanner/opportunity.py` — pipeline: scan → calibrate → Kelly → rank

## Signals
- `python/signal/kelly.py` — empirical Kelly with Monte Carlo CV estimation
- `python/signal/calibration.py` — Becker surface loader (needs parquet file)

## Agents
- `python/agents/base.py` — TradingAgent ABC with fitness tracking + lifecycle
- `python/agents/calibration_gap.py` — first concrete agent
- Agent state persists to `data/agents/{agent_id}.json`

## CLI
- `python/cli/scan.py` — raw scanner CLI
- `python/cli/agent_run.py` — agent-based scanner with paper trade recording
- `python/cli/resolve_trades.py` — resolve paper trades against Polymarket outcomes
- Run with: `.venv/bin/python -m python.cli.agent_run --min-gap 0.03`

## Research
- `python/research/surface_rebuild.py` — incremental calibration surface learning
- `python/research/split_becker_trades.py` — train/val/test data split
- `python/research/walk_forward_validation.py` — walk-forward backtest harness
