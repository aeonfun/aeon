*Repo Action Ideas — tomscaria/swarm-fund-mvp — 2026-05-06*
Yesterday's #1 (Investors.tsx InvestorViz wiring) shipped. Last 100 commits on main are all metrics-refresh churn — top pick attacks that surface with a script-level skip-when-noop guard.

Top pick: Skip-when-noop guard in scripts/refresh-site-metrics.sh (DX, Small, Priority HIGH)
 → Cuts main-branch metrics commits from 96/day to 10-20/day; reclaims 75+ Vercel deploys/day; flips the public commit log from 'metrics-bot graveyard' to 'real activity' for grant-reviewer click-throughs.

1. Skip-when-noop guard in scripts/refresh-site-metrics.sh (HIGH, DX, Small)
2. .github/workflows/aeon-falsifier-canary.yml — daily probe + T-3 issue-open against ADR-093 deadline 2026-05-17 (HIGH, DX, Small)
3. python/tests/test_aeon_adapter_recovery.py — locks in PR #31 _last_error clear-on-recovery via httpx.MockTransport (HIGH, DX, Small)
4. tests/test_site_metrics_schema.py — JSON-shape regression for swarm-lab-site/public/metrics.json (MED, DX, Small)
5. python/tests/test_aeon_signal_tickkind.py — regression that aeon_signal stays a recognized TickKind Literal (MED, DX, Small)

Full details: https://github.com/tomscaria/aeon/blob/main/articles/repo-actions-2026-05-06.md
