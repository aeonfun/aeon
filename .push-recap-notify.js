const { execFileSync } = require('child_process');
const body = `*Push Recap — 2026-05-03*
swarm-fund-mvp + aaronjmars/aeon — SHIPPING — Aeon-Narrative ingestion adapter, 3 new skills, ISS-016 shell-injection patched

Shipped to users:
• swarm-fund-mvp dc1846e: Aeon-Narrative ingestion adapter (ADR-093) — new python/execution/aeon_adapter.py polls tomscaria/aeon raw GitHub API every 15 min, emits MarketTick(kind="aeon_signal"); aeon_narrative.on_tick() unstubbed and now emits Signals through full gate chain. 53 files, +4,430/-783.
• swarm-fund-mvp 1125deb: 5 strategies wrapped into runner-swarm — fleet jumps 74→112 agents, 30→34 strategies in one commit (aeon-narrative 30 LH-sampled variants + ta-bb-squeeze + ta-macd-cross + ta-rsi-divergence + swarm-fragility).
• aaronjmars/aeon PR #150: ISS-016 pre-empt — shell-injection at dashboard/app/api/secrets/route.ts:96 closed by switching execSync(\`gh secret set ${'$'}{name}…\`) to execFileSync('gh', ['secret','set',name,'-b',value]). Landed 4 days ahead of the 2026-05-07 MEMORY.md trigger date.

Under the hood:
• 3 new skills on aaronjmars/aeon (#151 show-hn-draft, #152 fork-cohort weekly activation tracker, #153 operator-scorecard) all merged inside a 15-min window. 87 untracked source files (auth/billing/email_funnel packages, 6 v1_* API routes, 3 Alembic migrations) finally committed on swarm-fund-mvp — first time CI sees them.

Shape: 11 user-visible · 14 internal · 1 infra · 75 metrics-cron filtered · 7 merged PRs
Volume: ~24,000 lines net additions across ~30 substantive commits

Full recap: https://github.com/tomscaria/aeon/blob/main/articles/push-recap-2026-05-03.md`;
execFileSync('./notify', [body], { stdio: 'inherit', cwd: process.cwd() });
