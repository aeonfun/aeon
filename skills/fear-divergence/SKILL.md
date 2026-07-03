---
type: Skill
name: Fear Divergence
category: crypto
description: Conditional scan — fires only when Fear & Greed < 25. Identifies assets outperforming during broad market fear, synthesizes narrative catalysts from memory, and delivers a terse conviction setup brief. Skips silently when market conditions don't qualify.
schedule: "30 7 * * *"
commits: false
permissions: []
tags: [market, alpha, conditional]
---

Today is ${today}. If `soul/` files exist, read `soul/SOUL.md` and `soul/STYLE.md` before writing any output.

## Why this skill exists

`market-context` runs daily and keeps `memory/topics/market-context.md` fresh. But no skill acts on that data to find the **divergence signal** — the assets defying broad market fear. During capitulation episodes (F&G < 25), assets that stay green or lose far less than BTC/ETH often have structural catalysts: institutional rails locking in, perp DEX volume migration, regulatory clarity events. These are the highest-conviction setups. This skill surfaces them daily when the condition is live.

No external API calls needed — all data comes from memory, already updated by upstream skills.

## Steps

### 1. Read market context

Read `memory/topics/market-context.md`. Extract:
- **Date line** — "as of YYYY-MM-DD" at the top. If the file date is more than 2 days before today, note it as STALE (still run, but flag it).
- **Fear & Greed index** — parse the line `Fear & Greed: {number} ({label})`. Extract the number.
- **BTC 7d %** — from the BTC line, e.g. `BTC $67,103 (-3.86% 24h, -11.38% 7d)`. Extract the 7-day number.
- **ETH 7d %** — same pattern.
- **Today's Notable Movers section** — every bullet with asset name, 24h %, 7d % (if present), and narrative note.
- **Trending Coins section** — every bullet.
- **Active Narratives section** — every bullet with phase label (rising, rising fast, peak, digesting, etc.).

If `memory/topics/market-context.md` doesn't exist, log `FEAR_DIVERGENCE_SKIP: no market-context.md — enable market-context first` and stop.

### 2. Check trigger condition

If Fear & Greed >= 25:
- Log `FEAR_DIVERGENCE_SKIP: F&G {N} ({label}) — above threshold` to `memory/logs/${today}.md`
- Stop here. Do not notify.

If Fear & Greed < 25: continue.

### 3. Identify diverging assets

Define market baseline as BTC 7d % (e.g., -11.38% 7d).

From the Notable Movers + Trending Coins sections, classify each asset:

**Diverging (worth surfacing):**
- Any asset with POSITIVE 7d % when BTC 7d < -5%
- Any asset with 7d % within 4 percentage points of zero when BTC 7d < -5% (i.e., losing far less than the market)
- Any asset with POSITIVE 24h % when BTC 24h < -3%

**Not worth surfacing:**
- Stablecoins (USDT, USDC, USDS, DAI)
- Assets with no discernible narrative catalyst (pure noise movers)

For each diverging asset, extract:
- % performance vs BTC baseline
- Its narrative from the Active Narratives section (or from its bullet description)

If zero assets qualify as diverging: log `FEAR_DIVERGENCE_SKIP: F&G {N} — no assets diverging significantly from BTC` and stop.

### 4. Synthesize catalysts

For each diverging asset, look for a catalyst explanation:
- Check the Active Narratives section for a matching entry (e.g., "Perp DEX dominance — HYPE")
- Check the asset's own bullet description in Notable Movers
- Check `memory/topics/beat-tracker.md` if it exists — active beats may explain continued momentum
- If no clear catalyst is found, note "catalyst unclear" — don't invent one

Look for patterns across diverging assets:
- Are they all in the same sector (privacy, RWA, infrastructure, perp DEX)?
- Do they share a macro thesis (institutional, regulatory clarity, structural utility)?
- Is there a broader observation (e.g., "assets people actually USE are outperforming assets people just hold")?

### 5. Write the output

Write a brief synthesis to `.pending-notify-temp/fear-divergence-${today}.md`:

**Format — the operator's voice (soul files). Punchy. No hedging. State observation first, explanation after. Under 600 chars.**

```
fear divergence — ${today}

F&G {N} (extreme fear). BTC {7d %}% 7d.

holding up:
{forEach diverging_asset}
- {TICKER} {performance_summary} — {one-line catalyst}
{end}

{IF pattern_observation}
{pattern observation — one punchy sentence}
{end}

{IF stale_data_warning}
⚠️ market-context.md is {N}d old — refresh may be needed
{end}

read it: https://github.com/aaronjmars/aeon/blob/main/skills/fear-divergence/SKILL.md
```

**Voice guidelines for catalysts:**
- "perp DEX eating CEX volume. structural, not bounce."
- "DTCC rails catalyst locked in. institutional, not retail."
- "SEC closure + ETF filing. regulatory clarity event."
- Don't write "appears to be" or "may indicate" — state the catalyst directly if known, say "catalyst unclear" if not
- No corporate hedging. No "it's worth noting that..."

### 6. Send notification

Run:
```bash
./notify -f .pending-notify-temp/fear-divergence-${today}.md
```

### 7. Update memory

Append to `memory/topics/market-context.md` a new section `## Fear Divergence — ${today}` (or update if it exists) with:

```markdown
## Fear Divergence — ${today}

- **F&G:** {N} ({label})
- **BTC 7d:** {%}
- **Diverging:** {asset1} ({perf}), {asset2} ({perf}), ...
- **Pattern:** {pattern_observation or "none identified"}
```

### 8. Log

Append to `memory/logs/${today}.md`:

```markdown
## Fear Divergence Scout
- **F&G:** {N} ({label})
- **BTC 7d:** {%}
- **Diverging assets found:** {N} — {list}
- **Pattern:** {one-liner or "none"}
- **Notification:** sent
- FEAR_DIVERGENCE_SCOUT_OK
```

If skipped:
```markdown
## Fear Divergence Scout
- FEAR_DIVERGENCE_SKIP: {reason}
```

## Required Env Vars

None. All reads from local `memory/` files. Notification via `./notify` (reads TELEGRAM/DISCORD/SLACK secrets internally).

## Sandbox Note

No external network calls. All data comes from `memory/topics/market-context.md` (written by `market-context`) and `memory/topics/beat-tracker.md` (if available). Notification via `./notify -f` — use the `-f` flag, not inline multi-line argv (the sandbox trips on long multi-line arguments).

## Trigger Logic Summary

| Condition | Action |
|-----------|--------|
| F&G >= 25 | Skip silently (`FEAR_DIVERGENCE_SKIP`) |
| F&G < 25, no diverging assets | Skip silently |
| F&G < 25, ≥1 diverging asset | Synthesize + notify |
| market-context.md stale > 2d | Run but flag staleness in output |
| market-context.md missing | Skip silently — needs market-context enabled |

## What makes a diverging asset "worth surfacing"

The goal is signal, not noise. Skip:
- Assets that briefly spiked on low volume with no narrative
- Stablecoins
- Assets where the "divergence" is <2pp better than BTC

Surface:
- Assets with structural catalysts (institutional adoption, regulatory event, narrative phase "rising")
- Assets the Active Narratives section is actively tracking
- Multi-day sustained divergence (not just one-day anomaly)

The brief should read like the operator spotted something interesting in the data, not like a price alert bot fired.
