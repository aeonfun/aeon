# Long-term Memory
*Last consolidated: 2026-05-18*

## About This Repo
- Autonomous agent running on GitHub Actions via Claude Code
- Configured as a personal crypto-signals agent delivering to Telegram
- Future plan: split signals to Discord, keep agent conversations on Telegram (see `topics/telegram-discord-split.md`)

## Active Configuration

### Enabled skills (v1 — broad-scan crypto signals)

| Skill | Schedule (UTC) | Purpose |
|---|---|---|
| `aixbt-pulse` | `0 9,21 * * *` | Cross-domain pulse (crypto/macro/geo/tradfi) twice daily |
| `token-movers` | `0 12 * * *` | Daily winners/losers/trending with anti-pump filtering |
| `monitor-runners` | `0 12 * * *` | Top 5 24h runners via GeckoTerminal |
| `token-call` | `30 12 * * *` | One token call per day, scored with skip-day branch (renamed from `token-pick` in v2; prediction-market half removed — Polymarket flows via `market-context-refresh`) |
| `market-context-refresh` | `0 13 * * *` | Refresh macro context into `memory/topics/market-context.md` |
| `narrative-tracker` | `30 13 * * *` | Quantitative narrative map + position calls |
| `heartbeat` | `0 8,14,20 * * *` | Watchdog — silent unless something needs attention |

### Notification channel
- Telegram (agent + signals)

### Auth
- Claude OAuth via Pro/Max subscription (flat cost)

### Deferred for later
- `price-threshold-alert` — needs Tracked Token section in MEMORY.md first
- `on-chain-monitor` — needs `memory/on-chain-watches.yml` populated first

## Active topics
- **GDOR name-farm (sol)** — distinct contracts under the same `GDOR` ticker topped `monitor-runners` for 4 straight days (2026-05-18, 05-19, 05-20 morning, 05-21), each on a fresh address. **2026-05-22 broke the streak** — no GDOR-named contract scored into today's top 5. **2026-05-23 morning + afternoon confirmed streak-broken** — fresh GDOR contracts surfaced in survivor set at rank 11 both runs (+363% afternoon) but outside top 5. **2026-05-23 late-evening re-run broke the fade on the upside** — a fresh GDOR-named sol contract (`6xNE2iSN...UE2f`) landed at rank 2 (+833% on $37m vol/$327k liq, 5h pool) after two sessions mid-table. The name-farm cluster is reactivating; treat the soft-fade as paused, not over. Original flag 2026-05-21; streak-break noted 2026-05-22; soft-fade confirmed 2026-05-23 morning + afternoon; upside-break 2026-05-23 evening.
- **SPCX name-farm (sol)** — emerging cluster. 2026-05-22 afternoon had SPCX at rank 3 (same pool); 2026-05-23 morning + afternoon both surface the same SPCX pool at rank 3 plus three additional distinct SPCX-named sol contracts in the surviving set (rank 9 +380%, rank 13 王纯 same family, one rugged at >1.2m% gate). Same name-recycling pattern as GDOR. SpaceX narrative anchor (Hypercore pre-IPO perps, 05-18 BHYP context). Day 2. If a third distinct fresh-contract day lands tomorrow this hits the 3-day flag rule and warrants its own topic file.
- **GENIUS name-farm (bsc)** — confirmed cluster. 2026-05-22 afternoon had GENIUS at rank 2 (+5787% on a fresh 5h pool); 2026-05-23 morning had GENIUS at rank 1 (+1891%, 58-minute-old pool, distinct base_token id from 05-22); 2026-05-23 afternoon has GENIUS again at rank 1 (+2448%, 1.5h pool, third distinct base_token id in 36h). Three appearances on three distinct fresh contracts inside 36h triggers the 3-day flag rule. Same name-recycling pattern as GDOR (which ran 4 straight days 05-18 → 05-21). Watch for the 4th-contract appearance tomorrow.

## Pointers
- `topics/setup-checklist.md` — fork + secrets + push walkthrough
- `topics/telegram-discord-split.md` — future migration plan for signals → Discord

## Recent Articles
| Date | Title | Topic |
|------|-------|-------|

## Recent Digests
| Date | Type | Key Topics |
|------|------|------------|

## Skills Built
| Skill | Date | Notes |
|-------|------|-------|

## Lessons Learned
- Digest format: Markdown with clickable links, under 4000 chars
- Always save files AND commit before logging
- Telegram is the better personal-signals surface; Discord better for shared/team feeds

## Next Priorities
1. Fork the repo, add Telegram + OAuth secrets, push
2. Verify first-day notifications land (~6–7 messages on day 1)
3. After 1–2 weeks of feed: decide which tokens/wallets to track for the deferred skills
