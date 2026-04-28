## Summary

Ran search-skill per `skills/search-skill/SKILL.md`.

- **Mode:** `SEARCH_SKILL_OK_CANDIDATES` (weak match, UNTRUSTED)
- **Query:** `polymarket` (derived from `cron-state.json` — `monitor-polymarket` sr=0.15, 20 runs; reinforced by the "Pre-Apex push" priority).
- **Catalogs hit:** npx skills find=ok (6 results), vercel=0, anthropics=0, BankrBot=0, skills.sh=fail (page didn't render to WebFetch). Used `gh api search/code` as supplementary surface.
- **Gates applied:** of ~10 candidates surveyed, only `NousResearch/hermes-agent@polymarket` survived Gate 2 (read-only public API, no auth, pushed today). Every trading-bot candidate dropped — required `POLYMARKET_PRIVATE_KEY`, `py_clob_client`, `NIXTLA_TIMEGPT_API_KEY`, or a full Node/Python bot stack.
- **Decision:** survivor is `UNTRUSTED` (not in `skills/security/trusted-sources.txt`) AND only weakly fills the gap — `monitor-polymarket` already covers the same Gamma/CLOB query surface. Both conditions force `OK_CANDIDATES` per Step 5. Did not auto-install.
- **Notification:** queued at `.pending-notify/1777344000-search-skill.md`. Direct `./notify` hit the documented `Unhandled node type: string` hook-block again — the queue is the documented workaround but pickup depends on `scripts/postprocess-notify.sh`, which is still missing in tree (per MEMORY.md Lessons Learned).
- **Log:** appended `## search-skill` block to `memory/logs/2026-04-28.md` with full mode/query/catalog/top-3 detail.

Files modified:
- `/home/runner/work/aeon/aeon/.pending-notify/1777344000-search-skill.md` (created)
- `/home/runner/work/aeon/aeon/memory/logs/2026-04-28.md` (appended log block)

Follow-up: monitor-polymarket's low success rate is ISS-013 storm aftermath, not a capability gap. The higher-leverage fix is `chain-runner.yml dispatch_skill()` (already top of MEMORY.md "Next Priorities") — installing another polymarket reader wouldn't help. Operator should also confirm whether `scripts/postprocess-notify.sh` is wired so the queued notification actually delivers.
