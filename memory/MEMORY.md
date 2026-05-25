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
- **GDOR name-farm (sol)** — distinct contracts under the same `GDOR` ticker topped `monitor-runners` for 4 straight days (2026-05-18, 05-19, 05-20 morning, 05-21), each on a fresh address. **2026-05-22 broke the streak** — no GDOR-named contract scored into today's top 5. **2026-05-23 morning + afternoon confirmed streak-broken** — fresh GDOR contracts surfaced in survivor set at rank 11 both runs (+363% afternoon) but outside top 5. **2026-05-23 late-evening re-run broke the fade on the upside** — a fresh GDOR-named sol contract (`6xNE2iSN...UE2f`) landed at rank 2 (+833% on $37m vol/$327k liq, 5h pool) after two sessions mid-table. **2026-05-24 morning + afternoon: GDOR fully absent** from the survivor set across both runs (third consecutive run without a meaningful GDOR surface). The 05-23 evening upside-break did not sustain — treat the soft-fade as broken now, not paused. Original flag 2026-05-21; streak-break 2026-05-22; soft-fade confirmed 2026-05-23 morning + afternoon; upside-break 2026-05-23 evening; fade-confirmed-broken 2026-05-24.
- **SPCX name-farm (sol)** — fading cluster. 2026-05-22 afternoon had SPCX at rank 3 (same pool); 2026-05-23 morning + afternoon both surface the same SPCX pool at rank 3 plus three additional distinct SPCX-named sol contracts in the surviving set. **2026-05-24 morning: SPCX at rank 4** (same lead pool, 19.9h, fully dormant) with three distinct contracts in survivor set. **2026-05-24 afternoon: SPCX dropped out of top 5** (single contract surviving at rank 11, score 71.3, lead pool 23.3h with h1/h6 = 0). Day 3 of the cluster, intensity declining — same fade arc as GDOR's 05-22 streak break. SpaceX narrative anchor (Hypercore pre-IPO perps, 05-18 BHYP context). The 3-day flag-rule already fired on 05-23 — the cluster is now in decay phase rather than expansion.
- **GENIUS name-farm (bsc)** — confirmed multi-day cluster, fifth-contract threshold crossed 2026-05-24 afternoon. 2026-05-22 afternoon GENIUS rank 2 (+5787% on a fresh 5h pool); 2026-05-23 morning rank 1 (+1891%, 58-minute pool, distinct base_token); 2026-05-23 afternoon rank 1 (+2448%, 1.5h pool, third distinct base_token); 2026-05-23 late-iteration rank 1 (+5523% on a 5h pool, base_token `bsc_0xed6e2b...4444` — fourth distinct contract). **2026-05-24 morning: GENIUS absent** from top 5 and from the survivor set in any meaningful position (the cluster paused mid-day). **2026-05-24 afternoon: GENIUS reactivates at rank 2** on a fifth distinct fresh bsc contract `bsc_0xc42f7accbe70fb5b5e4a131b` (+5946% on $51m vol / $134k liq, 6.3h pool, h1 +7.9%). Five distinct contracts inside 72h crosses the threshold set on 05-23 evening — the cluster warrants a dedicated topic file at next memory-flush. The half-day pause then reactivation matches GDOR's 05-23 evening burst pattern (clusters are not in linear daily mode but in burst mode).
- **SAOS name-farm (sol)** — day-2 confirmed cluster. **2026-05-24 morning: 5 distinct SAOS-named sol contracts** cleared the gate (top score 93.8, +5492%, $40.6m vol, $292k liq, 3.7h pool, h1 +48%). **2026-05-24 afternoon: 6 distinct SAOS contracts** (cluster expanded by one), top-pct contract +7992% on a 23h pool fully dormant. **2026-05-25 morning: 5 distinct SAOS contracts again** with top contract at rank 4 (+9661% on $43.1m vol / $337k liq, 13h pool, h1 0% / h6 -1.9%) — lead pool dormant, cluster still surfacing five-deep into the survivor set on day 2. Cluster confirms per the 05-24 plan and warrants its own topic file at next memory-flush (alongside GENIUS). Recycling pattern matches the burst-mode signature seen on GENIUS (day-1 → pause → day-2 reactivation); SAOS came in heavier than GDOR / GENIUS / SPCX at their respective day-1 marks and now extends the depth into day 2 without a meaningful pause.

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
