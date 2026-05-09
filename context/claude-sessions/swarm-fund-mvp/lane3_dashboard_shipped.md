---
name: Lane 3 Dashboard Enhancement Shipped
description: Lane 3 (dashboard-v2) shipped as enhancement to existing Next.js dashboard, not new Vite app — 6 commits on claude/eager-easley
type: project
---

Lane 3 shipped 2026-03-30 on branch `claude/eager-easley`, merged into existing `dashboard/` (Next.js) instead of building new `dashboard-v2/` (Vite).

**Why:** Existing dashboard already had ~40% of Lane 3 features. Building a new Vite app would duplicate work and create merge conflicts. Enhancing in place was faster and more maintainable.

**How to apply:** Future dashboard work should continue in `dashboard/` (Next.js 16). The `dashboard-v2/` directory in TASKS.md is obsolete — skip it.

**What shipped:**
- 4 new FastAPI endpoints: `/api/regime/history`, `/api/autoresearch/experiments`, `/api/agents/{id}/cold-store`, `/api/prices/{asset}/ohlcv`
- Strategy Scoreboard with IC promote/cold-store + signal history drawer
- Candlestick PriceChart with volume bars (upgraded from line chart)
- 30-day Regime Timeline (color-coded horizontal bar)
- Autoresearch page wired to eval_log.jsonl

**Base UI patterns used:** `render` prop (not `asChild`) for DialogTrigger/DialogClose — children go as text content, render prop gets the self-closing element.
