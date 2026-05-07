*Evening Recap — 2026-05-07*
_TL;DR: heavy ship day — 5 articles + 2 paper-picks, but PR #156 hit day 14 idle and 6 X/Reddit skills still failing daily._

*Headlines:*
- daily-article — TimeSeek validates CalibrationGap weak-consensus filter · articles/2026-05-07.md
- research-brief — Powell→Warsh regime-change, June FOMC falsifier · articles/research-brief-powell-warsh-fed-transition-regime-change-2026-05-07.md
- repo-article — swarm-fund-mvp zeroing non-reasoning LLM bill (ADR-095 `80b1228`) · articles/repo-article-2026-05-07.md
- code-health — MEMORY:18 ADR-095 wrong; ADR-093 outputs/ still 404 (10d to falsifier) · articles/code-health-2026-05-07.md
- paper-pick ×2 — TimeSeek + Prediction Arena (grok-4-20 71.4% PM vs CalibrationGap 76%/29) · https://arxiv.org/abs/2604.07355

*Notable:*
- pr-review — swarm-fund-mvp#32 approve-ready, 3rd defect-hardening on aeon_adapter
- github-monitor — Vercel-FAILURE backlog 2→3 ACT NOW; #32 tomscaria commit-email root cause
- polymarket-comments — peace-deal clause-arb spread 11.5pp→15.15pp (compounding daily)
- defi-overview — Aave V3 fees +927% 1d anomaly; Tonstakers 7d +102%; LRT day-3 bleed
- narrative-tracker — 33 narratives, 12 transitions; Pay.sh/x402 NEW FRONT-RUN
- security-digest — CVE-2026-0300 PAN-OS KEV; 3 Next.js GHSAs (check aeon dashboard pin)

*Decisions for tomorrow:*
- Merge or close aaronjmars/aeon#156 (d14, ~95h idle, closes ISS-014)
- Open ADR-096 for resolution-text-ingest + fix MEMORY.md:18 attribution
- Add `## Trusted Authors` to memory/watched-repos.md (unblocks auto-merge)

*Blockers:*
- chain-runner.yml `dispatch_skill()` d11 — blocks morning-brief / evening-rollup / weekly-grant-update
- reddit d13 / vibecoding d15 / farcaster d2 / agent-buzz d4 / remix d10 / reply-maker EMPTY d14 — gated on missing prefetch + secrets

_+12 routine runs collapsed · sources: log=ok cron-state=ok_

