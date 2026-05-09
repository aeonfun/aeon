# Agent Architecture (Bridgewater Pattern)

## Core Concept
- Each agent = trading thesis with detection code + fitness score
- Lifecycle: shadow → canary ($50 max) → live (full Kelly) → demoted → killed
- State persists as JSON in `data/agents/{agent_id}.json`, survives across sessions

## Promotion Gates
- shadow→canary: 20 paper trades, >52% win rate, fitness > 0.3
- canary→live: 60 trades, Sharpe > 0.5, fitness > 0.5, 30+ days elapsed
- live→demoted: Sharpe < -0.5 over 20+ trades, or drawdown > 15%
- demoted→killed: sustained underperformance or thesis invalidated

## FitnessScore Weights
- Sharpe ratio: 40%
- Calibration accuracy: 25%
- Win rate: 15%
- MiroFish: 10%
- Peer comparison: 10%

## Current Agents
- **CalibrationGapAgent v1** — shadow mode, 13 trades (6 closed), 66.7% win rate, Sharpe 0.554
- Needs 14 more closed trades for shadow→canary promotion

## Learning Mechanisms
- Trade resolution: `python/cli/resolve_trades.py` checks Polymarket outcomes
- Thesis self-assessment: `evaluate_thesis()` returns continue/adjust/kill
- Trade-review skill: batch review 20+ trades, detect surface drift
- Memory-to-skill promotion: 3+ confirmations → skill update → `data/skill-changelog.jsonl`
