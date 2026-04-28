*Push Recap — 2026-04-28*
aaronjmars/aeon — SHIPPING: public /status/ page now ships a daily Token Pulse table

Shipped to users:
• PR #146 (4782c4a) — heartbeat now lifts the latest articles/token-report-*.md into a one-row Price/24h/Liquidity/Volume/FDV block on docs/status.md, with both legacy 'Value | 24h Change' and new 'Now | 24h Δ' table layouts tolerated, 24h-stale fallback, and per-cell — when a value is missing.

Under the hood:
• None — the same 31-line PR is the entire window; tolerant regex extraction is the only future-rot risk.

Shape: 1 user-visible · 0 internal · 0 infra · 0 bot-filtered · 1 merged PR
Volume: 2 files, +31/-3 lines

Full recap: https://github.com/aaronjmars/aeon/blob/main/articles/push-recap-2026-04-28.md
