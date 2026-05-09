---
name: Vercel deploy budget on Hobby tier
description: Hard cap of 100 production deploys/day on Hobby. Any cron that deploys per-tick needs interval math up front.
type: feedback
originSessionId: b13dbf26-06a1-40a9-9766-2d4ff7773916
---
**Vercel Hobby tier:** 100 production deploys per day, per project.
**Vercel Pro tier ($20/mo):** ~6,000 production deploys per month = ~200/day.

## 2026-04-21 — We blew through it in one day

Set `scripts/refresh-site-metrics.sh` to fire every 5 min via LaunchAgent. That's 288 deploys/day — ~3× Hobby limit on its own, and the day already had plenty of manual `vercel --prod` calls stacked on top. Hit `api-deployments-free-per-day` error mid-afternoon; commit `b479b41` was pushed but could not deploy until the 24h window reset.

## The math

| StartInterval | Deploys/day (worst case) | Hobby (100) | Pro (~200) |
|---|---|---|---|
| 300s (5m) | 288 | ❌ BLOWS | ❌ BLOWS |
| 600s (10m) | 144 | ❌ BLOWS | ✅ fits |
| **900s (15m)** | **96** | ✅ tight fit | ✅ fits |
| 1800s (30m) | 48 | ✅ comfortable | ✅ fits |
| 3600s (1h) | 24 | ✅ safest | ✅ fits |

"Worst case" = every run regenerates metrics and fires a deploy. Realistic usage is lower because the script fast-exits when `metrics.json` is unchanged — but during active trading, it changes basically every tick.

## Guardrails in place

- `~/Library/LaunchAgents/ai.rswarm.metrics.plist` → `StartInterval=900` (15 min) as the default. Comment in the plist explains why.
- `scripts/refresh-site-metrics.sh` header carries the deploy-budget table so any agent editing this script sees it immediately.

## Before tightening the interval, check actual daily deploys

```bash
vercel ls --scope thomas-scarias-projects 2>&1 | \
  grep -E "(m|h|d) ago" | \
  head -100 | \
  awk '{print $1}' | \
  sort -u
# Count the "Nh" / "Nm" lines to estimate current daily burn.
```

If the count approaches 80+ during any 24h window, LOWER the interval or pause the cron — don't raise it.

## Upgrade trigger

If we need interval < 15 min AND are willing to pay, Vercel Pro ($20/mo) gives headroom to ~10-min. Tighter than that, switch deployment strategy entirely (e.g., Cloudflare Workers for metrics.json hosting, or Vercel git-integration which may use a different quota).

## Related
- `scripts/refresh-site-metrics.sh` — the cron script with deploy-budget math in its header
- `~/Library/LaunchAgents/ai.rswarm.metrics.plist` — plist lives outside the repo
- `DECISIONS.md` — no ADR yet; this is operational, not architectural
