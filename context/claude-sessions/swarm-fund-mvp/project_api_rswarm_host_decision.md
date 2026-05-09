---
name: api.rswarm.ai must be hosted off the founder laptop
description: Decision 2026-05-01 — host the FastAPI behind api.rswarm.ai (not mailto shim). Reason is laptop-offline resilience, not just funnel completion.
type: project
originSessionId: 3a509466-2821-41e6-8fe0-a50c918e168a
---
`api.rswarm.ai` will be hosted, not stubbed with a mailto shim.

**Why:** as long as the FastAPI lives at `localhost:8000`, the fund pauses every time the founder's laptop sleeps, reboots, hits a launchd env-var trap (cf. 2026-04-25 phantom-NAV), or loses a cron token (cf. site-metrics 2026-04-27). The `--paper` band-aid still in `~/Library/LaunchAgents/ai.rswarm.trading-loop.plist:20` is a symptom of the same fragility class. Hosting the API removes the founder-laptop SPOF from the entire investor + dashboard surface.

**How to apply:** when proposing any change that depends on `api.rswarm.ai` resolving — investor-access Stage 2, dashboard approval queue, RequestAccessModal, email subscribers — assume hosting is the path; do not propose mailto: fallbacks or "keep it local for now." Recommended destination is Cloudflare tunnel (lightest lift, pairs with the queued Cloudflare-for-Startups credit application). Fly.io / Railway / DigitalOcean are acceptable alternatives. **Scope is API-only at first** — QuestDB, Postgres, and the trading loop itself remain on the laptop until a separate EC2-migration decision (Path B in `outputs/manual_tasks_thomas.md`).
