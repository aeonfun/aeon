---
name: Vercel deployment constraints for Swarm Lab
description: What Vercel can and cannot do for the swarm-lab-site stack — prevents recommending Vercel Cron or Functions for workloads that need access to local agent state
type: reference
originSessionId: 5fd770bf-05c1-4de4-86af-a7b2056e5831
---
**Core constraint:** Vercel Functions and Vercel Cron Jobs run in Vercel's serverless runtime. They have NO access to:
- Thomas's local filesystem (`data/agents/*.json`, agent state, regime model pickles)
- The running trading loop on his Mac (`python -m python.main`, PID varies)
- QuestDB / PostgreSQL / RedPanda running in local Docker
- The HL wallet private key in `.env` (and should never)

**Why this matters:** It rules out Vercel Cron as a solution for metrics staleness on rswarm.ai. The `public/metrics.json` source of truth lives in local agent state; a Vercel function cannot reach it.

**How to apply — default recommendations:**
- **Metrics-staleness problem:** the right fix is a live HTTP endpoint on the host running the trading loop (Mac now, EC2 later) fronted by Cloudflare Tunnel, NOT a scheduled redeploy. Pre-rendering `metrics.json` into the build is a bandaid.
- **Scheduled jobs that read local state:** use macOS launchd (local) or systemd (cloud host). Not Vercel Cron, not GitHub Actions.
- **Scheduled jobs that only need HTTP:** Vercel Cron is fine — e.g., pinging Polymarket Gamma API and writing to a managed DB.

**What Vercel IS good for in this repo:**
- Static Vite/React site hosting (`swarm-lab-site/`)
- Edge-cached JSON endpoints that read from Vercel-managed storage (Blob, Edge Config, Neon Postgres)
- Preview deployments tied to GitHub PRs
- Domain + DNS + CDN for rswarm.ai

**The two-project gotcha:** When you push to `tomscaria/swarm-fund-mvp`, Vercel auto-creates a project pointing at the repo root. That project tries to build the Python trading system as a web app and fails on every push. The banner on the main Vercel dashboard showing red `Error` is usually this zombie project, not the real `swarm-lab-site` project. CLAUDE.md says to delete it; revisit the dashboard periodically to confirm it's gone.
