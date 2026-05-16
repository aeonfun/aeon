---
name: api.rswarm.ai is hosted on the founder laptop via Cloudflare tunnel (laptop-as-server)
description: Decision evolved 2026-05-16 — founder explicitly committed to laptop-as-server in NYC. Cloudflare tunnel LaunchAgent now active; off-laptop migration deferred.
type: project
originSessionId: 3a509466-2821-41e6-8fe0-a50c918e168a
---
**Current state (as of 2026-05-16):** `api.rswarm.ai` resolves to the founder's MacBook in NYC via a Cloudflare tunnel managed by the `com.cloudflare.cloudflared` LaunchAgent (`~/Library/LaunchAgents/com.cloudflare.cloudflared.plist`). Tunnel UUID `cc4a2dc4-db0e-4b31-992e-a48379a5a540` (named `swarm-api`). Config at `~/.cloudflared/config.yml` routes `api.rswarm.ai → http://localhost:8000`. Caffeinate (`ai.rswarm.caffeinate`, `-dimsu`) prevents sleep. Daily log-rotate at 04:00 (`ai.rswarm.log-rotate`) keeps disk from filling.

**Why this evolved from the prior off-laptop direction:** founder explicitly chose to leave the MacBook running unattended as the production server when relocating to NYC 2026-05-16. The laptop SPOF concern from the 2026-05-01 decision is now an accepted risk, traded against: zero cloud spend, no migration time, no second-environment drift, founder still has full local-tool access. Off-laptop migration is no longer prioritized until either (a) the laptop physically fails, (b) AUM crosses a threshold where SLA matters, or (c) a regulator/diligence need forces it.

**How to apply:**
- Treat `api.rswarm.ai` as reachable from the public internet — investor-access Stage 2, dashboard, RequestAccessModal can all rely on it.
- If the API endpoint is unreachable, FIRST check `launchctl list | grep cloudflared` and `pmset -g assertions | grep Prevent` (caffeinate dropped?) before assuming a deeper outage.
- Don't propose Fly.io / Railway / DigitalOcean / EC2 migrations as the default for the API — that's now a tier-2 contingency, not the plan.
- QuestDB, Postgres, the trading loop, and the dashboard all remain on the laptop. Same SPOF, same accepted risk.

**Reversibility:** the prior decision (off-laptop hosting) is still valid as a contingency. The Cloudflared tunnel was a 10-min install — re-hosting on EC2 / Cloudflare Workers is similarly cheap to revisit if conditions change. Decision is reversible without code lock-in.
