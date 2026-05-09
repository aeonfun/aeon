---
name: EC2 migration plan for Swarm Lab trading loop
description: Sequenced plan to move the trading loop and FastAPI off Thomas's Mac onto AWS EC2, eliminating keyman hardware risk and unlocking a live metrics endpoint for rswarm.ai
type: project
originSessionId: 5fd770bf-05c1-4de4-86af-a7b2056e5831
---
**Decision:** Move the trading loop + FastAPI off the Mac onto AWS EC2. Keyman risk is real (Thomas had an accident in early 2026), and the Mac-hosted architecture ties everything — P&L, site metrics, Telegram bot, HL execution — to one laptop.

**Why:** Once a live `/api/metrics` endpoint exists on a public host, the rswarm.ai stale-metrics problem disappears entirely. No more scheduled redeploys, no more baked `metrics.json`, just live fetches at page load. The migration is also table stakes for any conversation with DRW/Tower/D.E. Shaw — "runs on my Mac" is not an institutional-readiness story.

**How to apply — minimum viable migration, one day of work:**

Shape:
- `t4g.small` (ARM, ~$12/mo) or `t3.small` (x86, similar). Single-AZ, single-instance. Do NOT overbuild — no ECS, no Fargate, no EKS. One Python process + one HTTP server.
- Elastic IP (stable address)
- systemd unit wrapping `python -m python.main` with auto-restart on crash
- FastAPI on port 8000, exposed via Cloudflare Tunnel (free, no port forwarding) at `https://api.rswarm.ai/metrics`
- AWS Secrets Manager for HL private key, Telegram token, Polymarket creds
- EBS volume mounted at `/data` for `data/agents/*.json`, with daily snapshots to S3

Sequencing:
1. **Week 1 — stand up parallel infra.** Provision EC2, install deps, clone repo, wire secrets, start trading loop in paper mode. Run for 48h parallel to the Mac loop. Diff agent state JSONs nightly to verify parity — same signals, same trades, same P&L evolution. If divergence, investigate before cutover.
2. **Week 2 — cut over.** Stop Mac loop. Point `api.rswarm.ai` DNS at Cloudflare Tunnel. Update site to fetch `/api/metrics` at page load instead of reading baked `metrics.json`. Delete `scripts/generate_site_metrics.py` cron/launchd entry. Keep `deploy_site.sh` for code deploys only (remove metrics-regen step).
3. **Week 3+ — harden.** CloudWatch alarms for process death, S3 backup verification, Telegram alerts if the loop drops. Add read replica or failover ONLY if a real incident motivates it — don't pre-build resilience for hypothetical problems.

**Do NOT:**
- Move HL private key to Secrets Manager before verifying the instance is locked down (IMDSv2, no public SSH, SG tight).
- Cut over DNS before 48h of parity verification. The cost of stale metrics is embarrassment; the cost of silent divergence in trade execution is capital.
- Turn on auto-scaling or multi-AZ. You are one process.
- Let the EC2 instance become a pet with hand-edited config. Everything in a Terraform file or a setup shell script checked into repo.

**Deprecations after cutover:**
- `scripts/generate_site_metrics.py` cron/launchd — delete
- Metrics-regen step in `scripts/deploy_site.sh` — remove, keep only `cd swarm-lab-site && vercel --prod`
- `public/metrics.json` as source of truth — replace with live fetch in `useSystemMetrics` hook

**Cost envelope:** ~$12/mo EC2 + $3/mo EBS + $0 Cloudflare Tunnel + minimal S3. Well under $30/mo. Activate credits ($10K-$100K via M8 or Portfolio tier) fund this for years.
