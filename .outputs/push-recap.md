*Push Recap — 2026-05-03*
3 repos — SHIPPING: Aeon-tick adapter, lore brand-voice + bundle cut, 3 new aeon skills

Shipped to users:
• swarm-fund-mvp dc1846e — Aeon-Narrative ingestion adapter ships (ADR-093, +180 LOC python/execution/aeon_adapter.py); polls tomscaria/aeon raw API every 15 min, emits MarketTicks with kind=aeon_signal
• swarm-fund-mvp 1125deb — runner-swarm fleet 74→112 agents (+30 LH-sampled aeon-narrative variants = 79% of net-new capacity)
• lore-financial-teaser 9b53f11 — main bundle 766 kB → 663 kB (gzip 226→202 kB) via lazy-load of 6 below-fold sections

Under the hood:
• swarm-fund-mvp d010846 — ADR-094 LLM router; paper_triage default opus-4-7 → sonnet-4-6 (~$70/run save); /router_suggestions Telegram cmd; 28 new tests
• aeon PR #150 — dashboard/secrets shell-injection closed via execFileSync (ISS-016 pre-empt, 4 days ahead of trigger)
• lore brand-voice — em-dashes banned site-wide; 13-file enforcement + 6 dead components removed + @tanstack/react-query uninstalled

Shape: 14 user-visible · 19 internal · 0 infra · 88 bot-filtered · 8 merged PRs
Volume: ~28,500 lines net additions, 3 authors

Full recap: https://github.com/tomscaria/aeon/blob/main/articles/push-recap-2026-05-03.md
