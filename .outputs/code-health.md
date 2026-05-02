code-health 2026-05-02: first multi-repo report (swarm-fund-mvp, lore-teaser, aeon).

Top fixes:
1. aeon dashboard/app/api/secrets/route.ts:96 shell-injection — Day 12 unpatched (correcting yesterday's 24+ claim — file introduced 2026-04-20). ISS-016 filing 2026-05-07 if still open.
2. lore-financial-teaser tracks .env in violation of own .gitignore — values are publishable-anon (Vite-baked, Supabase RLS-gated) so low blast today, but next real secret leaks. Untrack + rename to .env.local.
3. swarm-fund-mvp has 3 "TODO: verify" hardcoded feed IDs in pyth_ws.py (XRP/USD) and birdeye_rest.py (bIB01, dSPY) — gate trading correctness.

swarm-fund-mvp scale: 24 author files >500 lines (server.py 3030 is the outlier), 106 test files, 73 TODOs (mostly TASK-tagged Rust scaffolding, healthy). tools/kraken-cli-main/ is vendored krakenfx upstream. Dashboard clean of the execSync pattern. Full report: articles/code-health-2026-05-02.md.
