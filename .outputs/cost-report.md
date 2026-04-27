## Summary

Cost report for 2026-04-27 complete.

**Key numbers** (19 runs, 2026-04-25 → 2026-04-27, gateway: direct):

- Total spend: **$118.03**
- Composition: Cache read $61.26 (52%) · Cache write $28.53 (24%) · Output $27.90 (24%) · Input $0.34 (<1%)
- 97% of spend on claude-opus-4-7 ($114.74); 3% on claude-sonnet-4-6 ($3.28)
- 30-day projection: **~$505.83** at 7-day daily avg (⚠ burn-rate watch); could reach ~$1,180/month at the 3-day actual daily rate
- Anomalies: 0 (no skill has ≥ 3 runs yet; CSV too young for WoW)
- Optimization levers: 0 (all 4 patterns checked — high output ratios, high cache utilization, no model drift, no long-tail loops)

Top spenders: monitor-runners $16.87 · reddit-digest $13.83 · agent-buzz $13.24 — all driven by 5-7M cache-read tokens per run.

Files: `articles/cost-report-2026-04-27.md` · notification queued at `.pending-notify/1745706000-cost-report.md` · log appended to `memory/logs/2026-04-27.md`.
