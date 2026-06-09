---
name: Token Alert
description: Notify on price or volume anomalies for tracked tokens
var: ""
tags: [crypto]
requires: [COINGECKO_API_KEY?]
capabilities: [external_api, sends_notifications]
---
> **${var}** — Token symbol or CoinGecko ID. If empty, checks all tracked tokens.

If `${var}` is set, only check that token.


## Config

This skill reads tracked tokens from a "Tracked Tokens" section in `memory/MEMORY.md`. If the section doesn't exist yet, add it to MEMORY.md or skip this skill.

```markdown
## Tracked Tokens
| Token | CoinGecko ID | Alert Threshold |
|-------|-------------|-----------------|
| ETH   | ethereum    | 10%             |
| SOL   | solana      | 10%             |
```

---

Read memory/MEMORY.md for tracked tokens and alert thresholds.
Read the last 2 days of memory/logs/ for previous prices to detect changes.

Steps:
1. For each token tracked in MEMORY.md (under "Tracked Tokens"):
   - Fetch current price data using a free API:
     ```bash
     # CoinGecko API (works without key, but COINGECKO_API_KEY improves rate limits)
     if [ -n "${COINGECKO_API_KEY:-}" ]; then
       curl -s "https://pro-api.coingecko.com/api/v3/simple/price?ids=TOKEN_ID&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true" \
         -H "x-cg-pro-api-key: $COINGECKO_API_KEY"
     else
       curl -s "https://api.coingecko.com/api/v3/simple/price?ids=TOKEN_ID&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true"
     fi
     ```
   - Compare against last logged price in memory/logs/
2. Alert if any of these conditions are met:
   - Price change > 10% in 24h
   - Volume spike > 3x average
   - Price crosses a threshold set in MEMORY.md
3. If any alerts triggered, send via `./notify`:
   ```
   *Token Alert — ${today}*

   TOKEN: $X.XX (up/down Y% 24h)
   Volume: $Z (N x average)
   Trigger: reason for alert
   ```
4. Log all current prices to memory/logs/${today}.md (for next comparison).
If no anomalies detected, log "TOKEN_ALERT_OK" and end.

## Sandbox note

The sandbox may block outbound curl. Use **WebFetch** as a fallback for any URL fetch. For auth-required APIs, use the pre-fetch/post-process pattern (see CLAUDE.md).
