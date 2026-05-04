*Push Recap — 2026-05-04*
SHIPPING — ADR-094 LLM router, skill-freshness watchdog, and 5 stalled fix PRs all land

Shipped to users:
• swarm-fund-mvp d010846 — ADR-094 task-aware LLM router (python/llm/router.py NEW +353): `task=classify|extract|...` picks cheapest tier; suggestion log catches over-tiered call sites without override; paper_triage opus→sonnet (~$70 saved per 3.5k-paper run); /router_suggestions Telegram cmd
• aeon #157 32c77d7 — skill-freshness (skills/skill-freshness/SKILL.md NEW +286): walks aeon.yml + grep over enabled SKILL.md for articles/.outputs/topics refs, scores mtimes per class, sha1-fingerprint dedup. Closes silent-staleness gap heartbeat/skill-health cannot see
• swarm-fund-mvp 5 PRs all merge 21:57 UTC within 4s (#19 ssrn rowcount, #20 image-strip regex, #23 fractional pm-tail-risk horizon, #24 triage defensive parse, #28 variant_bandit tests) — operator unblocked aeonframework email on Vercel; closes yesterday's ACT NOW item

Under the hood:
• lore-financial-teaser 9b53f11 — perf(bundle): lazy-load 6 below-fold sections, main bundle -13%; brand-voice enforcement (#6) ships same day as swarm-fund-mvp design cleanup (bf21c22)

Shape: 12 user-visible · 9 internal · 0 infra · 99 bot-filtered · 7 merged PRs
Volume: ~30 files, +2,168/-167 lines

Full recap: https://github.com/tomscaria/aeon/blob/main/articles/push-recap-2026-05-04.md
