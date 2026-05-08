*Push Recap — 2026-05-08*
aaronjmars/aeon — SHIPPING: huggingface-trending skill lands, reply-maker XAI prefetch unblocks day-13 carrier

Shipped to users:
• `9c36154` (#162) feat: huggingface-trending — new daily skill pulls trending HF models/datasets/spaces from keyless `/api/{models,datasets,spaces}?sort=trendingScore`, applies six noise filters, tags DEBUT/ACCELERATING/RETURNING/HOLDOVER, clusters into five buckets, forces ≤18-word "why notable" line per pick. 09:30 UTC slot, ships disabled.
• `795a5a1` (#156) fix(reply-maker): adds `reply-maker)` case to `scripts/prefetch-xai.sh` (numeric → list, `@` → handle, else → topic) and rewrites SKILL.md to read `.xai-cache/reply-maker.json` as Path A. Closes ISS-014 day-13 carrier.

Shape: 2 user-visible · 0 internal · 0 infra · 96 automation-folded · 2 merged PRs
Volume: 7 files, +229/-5 lines (excluding 96× swarm-fund-mvp `metrics.json` heartbeat ticks)

swarm-fund-mvp: only the 15-min `metrics.json` heartbeat (96 commits, single file). 72h merge-cadence test tightens.
lore-financial-teaser: silent.

Full recap: https://github.com/tomscaria/aeon/blob/main/articles/push-recap-2026-05-08.md
