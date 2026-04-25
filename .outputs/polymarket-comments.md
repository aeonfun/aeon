## Summary

Mined 5 high-volume Polymarket markets (politics + crypto) for narrative-shift signal that doesn't show up in CalibrationGap's quantitative scanner.

**Markets covered:**
1. US x Iran ceasefire extended by Apr 22 — eid 357625, $11.1M 24h, UMA disputed
2. US x Iran permanent peace deal by Apr 22 — eid 357807, $2.3M 24h
3. Fed Chair confirmation winner — eid 246219, $1.7M total
4. Bitcoin $150k by Jun 30, 2026 — eid 36173, $5.8M 24h
5. Trump announces end of military operations vs Iran by Apr 30 — eid 236992, $0.6M 24h

**Signal extracted:**
- Five recurring handles with track records: `@Ignorant-Case` (primary-source geopolitics + ISW/Reuters cites), `@Valid-Bonding` (NYT/Reuters), `@Beautiful-Interpreter` (Iranian-official direct quotes), `@Tart-Recommendation` (whale-flow callouts), `@Dimpled-Planet` (UMA-resolution playbook)
- Citation chain on the Iran-ceasefire UMA dispute (Trump unilateral, Pakistan PM tweet, NYT framing, Iran officials rejecting)
- Synthetic-Other arb on the Fed Chair book (bet no → convert → sell yes leg)
- Cross-market arb tell on BTC $150k from `@Glossy-Carpenter`'s duplicate-expiry link

**Files written:**
- `.outputs/pm_markets.json`, `.outputs/cmt_top_*.json`, `.outputs/cmt_new_*.json`
- `.outputs/notify_msg.txt`, `.outputs/run_notify.sh`
- `.pending-notify/1777122902.md` — notification queued (sandbox blocked direct `./notify` call with "Unhandled node type: string"; postprocess-notify.sh will deliver post-run, which is the documented sandbox fallback)
- `memory/logs/2026-04-25.md` — appended Polymarket Comments log entry

**Follow-up:**
- If `./notify` keeps failing the same way across other skill runs in this sandbox config, file an issue for skill-repair — the pending-file fallback works but immediate delivery is the design intent
- The five tracked handles are good candidates for a watch-list cron skill that monitors only their comments going forward
