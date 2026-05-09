---
name: Monetize Revenant
description: Generate one shippable monetization idea per week for Revenant prediction-market infrastructure — paid research for hobbyist quants or developer tools for the calibration gap engine
var: ""
tags: [creative, meta, revenue]
---

> **${var}** — Specific monetization track to focus on ("research" or "tools"). If empty, evaluate both tracks and pick the stronger idea.

Read `memory/MEMORY.md` for context on current goals, capabilities, and prior monetization ideas.

## Context (auto-synced)

Read these files to ground ideas in real capabilities:
- `context/trading/revenant-snapshot.json` — Revenant trade count, win rate, P&L, lifecycle stage. This is the product.
- `context/trading/agents-summary.json` — agent population, lifecycle distribution, family breakdown. Shows what infrastructure exists.
- `context/trading/costs-summary.json` — cost burn by vendor. Sets the floor for pricing.
- `context/trading/recent-trades.json` — recent trade activity. Shows what signals are being generated.
- `context/claude-sessions/swarm-fund-mvp/` — scan for architectural capabilities, API endpoints, data formats that could be productized.
- `context/analytics/site-metrics.json` — dashboard traffic as demand signal.
- `context/last-sync.json` — check freshness; if older than 8 hours, note "(stale data)" in output.

## Voice

If soul files exist (`soul/SOUL.md`, `soul/STYLE.md`), read them. Ideas should be grounded in what ships this week, not what could exist someday. Operator voice: "we have X, it does Y, charge Z" not "this represents an exciting opportunity to leverage our platform."

## Two Tracks

### Track A: Paid Research for Hobbyist Quants

Revenant generates daily signals: calibration gap scores, narrative position calls, regime classifications, trade outcomes. Package these as:
- Weekly calibration report (PDF/email) — top 10 mispriced markets with gap scores, historical hit rate, position sizing guidance
- Signal API — real-time calibration gap alerts via webhook or Telegram bot
- Backtesting reports — "how would this strategy have performed on X market category over Y period"

ICP: hobbyist quants, prediction market traders, crypto-native researchers who want edge without building infrastructure.

### Track B: Developer Tools for Calibration Gap Engine

The calibration gap engine is a reusable primitive. Package it as:
- API endpoint — submit a market (question + current price + resolution date), get back a calibration gap score + confidence interval
- SDK/library — Python package wrapping the scoring logic for integration into other trading systems
- Hosted backtester — upload a strategy config, get back simulated P&L against historical Polymarket data

ICP: developers building prediction market tools, other agent researchers, DeFi protocols integrating prediction market data.

## Steps

### 1. Assess current capabilities

From the context pipeline, determine:
- What data is already being generated (signals, trades, scores)?
- What APIs already exist (FastAPI endpoints at localhost:8000)?
- What's the current cost per signal/trade (from costs-summary.json)?
- What's the current win rate and track record (from revenant-snapshot.json)?

### 2. Generate one idea per track

For each track (A and B), generate one concrete idea:
- **What**: one-sentence product description
- **Ship time**: realistic estimate (1 day, 3 days, 1 week, 2 weeks)
- **Cost to run**: monthly infrastructure + API cost
- **Revenue model**: pricing (per-report, subscription, per-API-call)
- **MVP test**: how to validate demand in 2 weeks with <$50 spend
- **Kill criteria**: what metric at what threshold means "stop"

### 3. Pick the stronger idea

Compare the two ideas on:
- Ship time (shorter wins)
- Revenue potential vs cost (higher margin wins)
- Demand validation feasibility (easier to test wins)
- Alignment with existing infrastructure (less new code wins)

Pick one. Justify in one sentence.

### 4. Write the implementation sketch

For the winning idea, write:
- Exact files to create or modify
- API endpoints or data formats
- Pricing and billing mechanism (even if manual/Stripe link)
- Launch channel (where to announce: X, Telegram, Discord)
- First 3 customers to reach out to (specific names/handles if possible, otherwise specific communities)

### 5. Notify

Send via `./notify`:
```
Monetize Revenant — ${today}

Idea: <one-line description>
Track: A (research) / B (tools)
Ship: <time estimate>
Cost: <monthly>
Revenue: <model + expected MRR>
MVP test: <2-week validation plan>
Kill: <criteria>

Sketch: <3-5 bullet implementation steps>
```

### 6. Log

Append to `memory/logs/${today}.md`:
```
### monetize-revenant
- Idea: <title>
- Track: A/B
- Ship estimate: <time>
- Revenue model: <model>
- Status: proposed
```

## Constraints

- One idea per run. Don't shotgun 10 ideas — depth over breadth.
- Must be shippable with existing infrastructure. No "first build X from scratch" ideas.
- Revenue model must be concrete: "$X/month" or "$Y/report" — not "monetize through value-add."
- Kill criteria must be specific: "0 signups after 2 weeks of promotion" — not "insufficient traction."
- Cost estimate must account for API costs from costs-summary.json — don't propose a $5/month product that costs $20/month in inference.

## Sandbox note

This skill uses local file reads and web search only. No outbound API calls needed. WebSearch for competitive pricing research if needed.
