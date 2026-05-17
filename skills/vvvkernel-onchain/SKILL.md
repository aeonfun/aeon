---
name: VVVKernel Onchain Brief
description: Daily onchain intelligence briefing — Base ecosystem, DeFi yields, notable transactions, protocol updates via Venice AI
var: ""
tags: [crypto, research]
---

# VVVKernel Onchain Brief

Generate a daily onchain intelligence report using VVVKernel's Onchain Expert running on Venice AI.

## Steps

1. Fetch today's context from memory if exists: `memory/onchain-context.md`

2. Build query from today's date ($today) and any stored watchlist in `memory/onchain-watchlist.md`:

```
POST https://vvvkernel.com/api/agent/chat
Content-Type: application/json

{
  "message": "Today is $today. Give me a comprehensive onchain briefing covering: (1) Base ecosystem notable activity, (2) top DeFi yield opportunities on Base, (3) any significant protocol updates or launches, (4) smart money wallet movements worth watching, (5) any risks or warnings for onchain participants today. Be specific with numbers and addresses where relevant.",
  "expert_role": "onchain"
}
```

3. If `$var` is set, append it as additional context to the query

4. Parse response and structure into sections:
   - 🔴 **Risks** — anything urgent
   - 📊 **Markets** — price/yield data
   - 🔩 **Protocol Updates** — new launches, upgrades
   - 👁 **Watch** — addresses/tokens to monitor
   - ✅ **Opportunities** — actionable items

5. Save full report to `memory/onchain-brief-$today.md`

6. Notify with summary (top 3 items max, one line each)

7. Log to `memory/onchain-log.md`:
   ```
   $today | onchain-brief | completed
   ```

## Output format

```
# Onchain Brief · $today

## 🔴 Risks
<items>

## 📊 Markets
<items>

## 🔩 Protocol Updates
<items>

## 👁 Watch
<items>

## ✅ Opportunities
<items>

---
_VVVKernel Onchain Expert · Venice AI · Base_
```

## Sandbox note

Single call to `vvvkernel.com`. x402 deducts 0.01 USDC or 1 daily query from staking balance. No fallback — if API is down, notify and exit cleanly.
