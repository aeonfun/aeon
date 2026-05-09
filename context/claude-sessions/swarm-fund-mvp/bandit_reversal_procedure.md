---
name: Variant bandit reversal procedure
description: Standard ML-engine-loop diagnostic for flattening the variant Thompson bandit when investigating anomalies — toggle, verify, observe, restore.
type: reference
originSessionId: 96b938ba-7a23-4095-aa35-765d9d78ea21
---
The variant bandit (ADR-071/072) modulates Kelly sizing 0.5–1.5× per variant and auto-holds persistent losers. Because it can mask underlying failures (a real signal-pipeline regression damped because it looks like a losing variant), every anomaly investigation should include a "flatten the bandit, see what's underneath" step.

## When to run this
Any of:
- Trade flow looks anomalous vs market conditions
- Sizing on a known-good variant looks wrong
- Graduation rate stalled despite plausible Sharpe trajectories
- Auto-hold list looks suspiciously long or empty
- IC is investigating "is this caused by the bandit or by something underneath?"

This is **standard diagnostics**, not emergency-only. Treat it like turning off a load balancer to debug an upstream — common, reversible, no harm done.

## Procedure

### 1. Suspicion → toggle
```
echo 'SWARM_BANDIT_DISABLE=1' >> /Users/stew/scaria/swarm-fund-mvp/swarm-fund-mvp/.env
```
(or set the env var before relaunching the loop). Then restart the main loop:
```
pkill -f 'python -m python.main'   # main loop auto-respawns under launchd
```
The Telegram bot subprocess restarts automatically when the main loop comes back up.

### 2. Verify flat state
Send `/bandit_status` from Telegram. The "Effective config" line should read:
- `multiplier=[1.00, 1.00]`
- `auto_hold<0.00`

If those values aren't flat, the env var didn't take — check `.env` parsing and that the loop actually restarted.

### 3. Observe
Wait one full scan iteration (15 minutes default) and re-check trade flow / sizing. Three outcomes:
- **Anomaly persists** → bandit isn't the cause; investigate deeper (signal pipeline, regime detector, conviction modifiers, risk gates).
- **Anomaly disappears** → bandit was masking a variant-level failure. Drill into the specific variants whose multiplier was non-1.0 before the toggle (their `expected_win_rate` and `n_trades` are in the state file).
- **Anomaly partially changes** → mixed cause; both bandit and something underneath. Keep bandit flat and fix the underneath layer first.

### 4. Re-engage
Remove `SWARM_BANDIT_DISABLE` from `.env`, restart the loop. Posterior state is **preserved** across the toggle — `data/.variant_bandit_state.json` is untouched by the disable mechanism, so the bandit picks up exactly where it left off.

## Knobs (`python/signal/variant_bandit.py`)
The four class-level constants the env var overrides at instance level:
- `KELLY_MULTIPLIER_MIN_STRENGTH = 5.0` — posterior strength below which multiplier stays 1.0
- `KELLY_MULTIPLIER_MIN = 0.5` / `KELLY_MULTIPLIER_MAX = 1.5` — multiplier bounds
- `AUTO_HOLD_BELOW = 0.40` — winner threshold for auto-hold
- `AUTO_RELEASE_ABOVE = 0.50` — auto-release once posterior recovers

For finer-grained reversal (e.g., disable just auto-hold but keep multiplier active), edit the class-level constants directly. Env var is the standard "all-off" toggle.

## Cross-references
- ADR-071 — bandit math + observation-only wire-up
- ADR-072 — capital wire-up (Kelly multiplier + auto-hold)
- ADR-074 — env-var toggle + `/bandit_status` Telegram command
- ADR-089 — per-regime variant-bandit posteriors + `/bandit_regime` Telegram command (`SWARM_BANDIT_DISABLE` flattens both global and per-regime multipliers; posterior state including `regime_posteriors` is preserved across the toggle)
- ADR-090 — bandit-aware cull corroboration (joins frequentist t-test with Bayesian posterior in the cull driver)
- ADR-091 — daily posterior history snapshots at `data/variant_bandit_history.jsonl` (forensic trail; survives the env-var toggle)
- `python/main.py` (bandit init block) — env var application site
- `python/alerting/telegram.py::render_bandit_status` — IC-facing read view
