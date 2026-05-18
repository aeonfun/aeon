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
