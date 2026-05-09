# Roadmap & Next Steps

## Immediate Next Steps
1. Complete remaining parallel lanes: Lane 1 (Data Pipeline), Lane 4 (Regime Detection)
2. Merge lanes: Lane 1 + Lane 4 first → Lane 2 + Lane 3 rebase → merge
3. Wire live data to dashboard (replace mock chart data with real WebSocket feeds)
4. Add Telegram alerts for manual execution
5. Accumulate 20+ paper trades → promote to canary
6. Use `market-research` skill (last30days) to build context for remaining 7 CalibrationGapAgent paper trades
7. Use `parallel-code-review` skill on Phase 3 risk gate code before merge
8. Add more agents: GeoOilAgent, FundingRateAgent, SmartMoneyAgent

## Known Gaps (not in TASKS.md)
- **TASK-1.7:** Nightly calibration surface rebuild. Static Becker surface needs cron rebuild when Phase 1 ingestion goes live.
- **~~Dashboard/UI~~** ✅ RESOLVED: Dashboard V2 complete (Lane 3, Phase 3.5, commit 313234c)
- **Dashboard live data:** Mock price chart data needs replacement with real market feeds post-merge
