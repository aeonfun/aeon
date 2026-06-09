---
name: compute-pulse
description: Tracker for the AI compute market — GPU/hardware deals, inference pricing trends, decentralized compute token signals, and lab vs hyperscaler dynamics.
schedule: "0 11 * * 6"
commits: true
permissions:
  - contents:write
tags: [ai, compute, infra, depin]
---

Today is ${today}. Read `memory/MEMORY.md` before starting. If `soul/SOUL.md` + `soul/STYLE.md` exist and are populated, read them to match the operator's voice; otherwise use a clear, direct, neutral tone.

## Why this skill exists

The compute layer is where most of the AI market spread lives. Labs buy GPU time at wholesale, sell per-token at retail — the delta is the business. As inference commoditizes, the spread compresses, and whoever controls the upstream compute relationship benefits.

Three things move in parallel:
1. **Centralized capex arms race** — frontier labs and hyperscalers spending $10B+ on clusters. Incumbent moats.
2. **Decentralized compute** — DePIN tokens positioning as the anti-cartel layer (GPU spot markets, ZK compute, ML subnet networks).
3. **Pricing signals** — inference API prices dropping fast (GPT-4 class fell ~97% in 2 years). That compression is the evidence base for commoditization.

This skill is one clean weekly read on the compute layer.

## Config

This skill reads the watched decentralized-compute token list from `memory/topics/compute-tokens.md` if present. Example format:

```markdown
# Watched Compute Tokens

| Symbol | Project | Notes |
|--------|---------|-------|
| RENDER | Render Network | GPU/ML compute |
| AKT | Akash Network | permissionless cloud compute |
| IO | io.net | GPU cluster marketplace |
| TAO | Bittensor | ML model subnet network |
```

If the file doesn't exist, fall back to a generic DePIN sweep on the major narrative tokens of the moment via WebSearch (no hardcoded list).

## Steps

### 1. Load current context

Read:
- `memory/MEMORY.md` — overall context, prior compute signals
- `memory/topics/compute-pulse.md` — compute-specific baseline (create with seed if missing — see end of this section)
- `memory/topics/compute-tokens.md` — operator-defined watched tokens (optional)

Extract from the topic file:
- `inference_prices_last` — last recorded inference pricing for major APIs
- `depin_tokens_last` — last recorded prices/mcaps for the watched tokens
- `hardware_signals_last` — last recorded major hardware/cluster announcements
- `last_run` — date of prior run

If `memory/topics/compute-pulse.md` doesn't exist, create it:

```markdown
# Compute Pulse Tracker

*Last run: never*

## Inference Pricing Baseline
- Track $/1M tokens in/out for the major closed-model APIs (Claude, GPT, Grok, Gemini). Update each run.
- *Note: GPT-4 class inference fell ~97% in 2 years — track the compression curve over time.*

## Decentralized Compute Tokens
- Populated from `memory/topics/compute-tokens.md` (or a default DePIN sweep when absent).
- *Track price, mcap, narrative velocity — not financial advice.*

## Hardware Signal Log
- (append per-run summaries here)

## Pricing Signal Log
- (append per-run summaries here)
```

### 2. Fetch inference pricing signals

Use WebSearch to find the latest published inference API prices:

```
WebSearch: "OpenAI GPT API pricing per million tokens ${year}"
WebSearch: "Anthropic Claude API pricing ${year}"
WebSearch: "xAI Grok API pricing ${year}"
WebSearch: "Google Gemini API pricing ${year}"
```

Also check for any pricing changes in the last 7 days:
```
WebSearch: "inference API price cut ${year}"
WebSearch: "AI model pricing reduction ${year}"
```

Record:
- Current published prices for each major API ($/1M tokens in/out where available)
- Any price cuts announced in the last 7 days — these are the commoditization signal
- Note which direction prices moved vs `inference_prices_last`

**High signal events:**
- Price cut >20% — notable compression
- New model launch at significantly lower cost than prior generation
- Open-source model achieving parity with a frontier closed model at near-zero marginal cost

### 3. Hardware and cluster news

Use WebSearch for compute infrastructure announcements from the last 7 days:

```
WebSearch: "GPU cluster data center AI ${year} announcement"
WebSearch: "xAI Colossus Stargate OpenAI compute ${year}"
WebSearch: "Anthropic compute hardware partnership ${year}"
WebSearch: "NVIDIA Blackwell deployment ${year}"
```

Look for:
- New cluster build announcements (scale: # of GPUs, $B investment)
- Lab compute procurement deals (who's buying from whom)
- Hyperscaler (AWS, Azure, GCP) AI compute announcements
- NVIDIA hardware availability changes (affects supply/demand balance)
- Government compute initiatives (CHIPS Act disbursements, EU AI Act compliance)

Rate each announcement:
- **Major** (new cluster >50k GPUs or >$1B): high signal
- **Notable** (new partnership, procurement deal): medium signal
- **Background** (upgrade, minor expansion): low signal

### 4. Decentralized compute token check

For each token from `memory/topics/compute-tokens.md` (or a fallback list if absent), use WebSearch:

```
WebSearch: "${SYMBOL} ${PROJECT_NAME} token ${year}"
```

For each token, note:
- Approximate current price and 7d % change (from search results)
- Any protocol announcement, partnership, or milestone this week
- Whether narrative is accelerating, holding, or fading

**Signal:** If decentralized compute tokens are outperforming the broader market, the market believes the decentralized layer can compete with centralized capex. If underperforming, the centralized moat is winning in market perception.

### 5. WebSearch for compute narrative this week

Run:
```
WebSearch: "AI compute commoditization inference ${year}"
WebSearch: "AI compute cost falling ${year} per token"
WebSearch: "decentralized compute vs hyperscaler ${year}"
```

Look for:
- Essays, analyses, or announcements framing the compute market
- Evidence of operator-layer value capture (agent products posting revenue metrics)
- Any "AI costs too much" vs "AI is getting cheap" narratives shifting

### 6. Synthesize compute momentum score

Rate the week's compute signals:

| Signal | Points |
|--------|--------|
| Inference price cut from major lab (>10%) | +4 |
| New cluster announcement >100k GPUs | +3 |
| New cluster announcement 10k–100k GPUs | +2 |
| Watched DePIN token major milestone (new subnet, partnership, TGE) | +2 each |
| New open-source model achieving frontier-class inference at lower cost | +3 |
| Operator-layer revenue milestone (agents capturing the spread) | +2 |
| Government compute policy (chips act, AI act) affecting supply/demand | +1 |
| Notable essay/analysis on compute commoditization | +1 |

**Momentum levels:**
- 0–2: quiet week, signal flat
- 3–5: building, signals accumulating
- 6–9: accelerating, notable compression or capacity shift
- 10+: breakout, structural shift underway

**Read:** After reviewing all data, answer in one sentence:
> **Read:** Compute commoditization [advancing / holding / stalling / reversing] — [one concrete data point].

### 7. Update memory/topics/compute-pulse.md

Rewrite with:
- Updated `*Last run: ${today}*`
- Updated `Inference Pricing Baseline` with current prices
- Updated `Decentralized Compute Tokens` with current price context
- Appended entry to `Hardware Signal Log`:
  ```
  - ${today}: [top hardware signal or "quiet"] / [top depin signal or "—"] / momentum: [level]
  ```
- Appended entry to `Pricing Signal Log`:
  ```
  - ${today}: [price cuts if any, or "stable"] / read: [advancing/holding/stalling/reversing]
  ```

### 8. Send notification

Write to `.pending-notify-temp/compute-pulse-${today}.md`, then:
```bash
mkdir -p .pending-notify-temp
./notify -f .pending-notify-temp/compute-pulse-${today}.md
```

**Format — match the operator's voice if soul files are populated, otherwise direct and neutral:**

```
compute pulse — ${today}

momentum: {level} ({score} pts)

{IF any price cuts}
inference pricing:
{forEach price_cut}
- {model}: {old_price} → {new_price}/1M tokens ({delta}%)
{end}
{end}

{IF hardware signals}
hardware signals:
{forEach top 2 hardware items}
- {one-line summary}
{end}
{end}

{IF depin signals}
decentralized compute:
{forEach notable depin items (max 3)}
- {token}: {7d change} — {one-line signal}
{end}
{end}

read: {advancing/holding/stalling/reversing} — {one data point}

{IF quiet_week}
quiet week. the compression is happening below the noise floor.
{end}
```

Keep total under 900 chars. Do NOT use `./notify "$(cat ...)"` — write the file first, pass the path.

If momentum score is 0 and no notable signals: log `COMPUTE_PULSE_OK: quiet` and skip notification.

### 9. Log to memory/logs/${today}.md

Append:

```markdown
## Compute Pulse
- **Inference pricing:** {notable cuts or "stable"}
- **Hardware signals:** {count notable / top item}
- **DePIN tokens:** {top mover or "—"}
- **Momentum score:** {score} ({level})
- **Read:** {advancing/holding/stalling/reversing} — {data point}
- **Notification:** sent / skipped (quiet)
- COMPUTE_PULSE_OK
```

## Required Env Vars

None. Uses `gh` CLI (GITHUB_TOKEN via workflow), WebFetch, WebSearch. No additional auth needed.

## Sandbox Note

- WebSearch: built-in tool, always available. Use for inference pricing, hardware news, token signals.
- WebFetch: bypasses sandbox network gate. Use for specific URLs (API docs, pricing pages) when WebSearch yields exact links.
- `gh api`: handles auth internally via GITHUB_TOKEN. Use for any GitHub-hosted data.
- Do NOT use curl for external APIs — sandbox blocks outbound network. WebFetch or WebSearch are the paths.

## What to watch for (recurring signal classes)

- **Inference price cuts** — the clearest commoditization signal. Track $/1M tokens for all major APIs each cycle.
- **Cluster scale races** — big clusters = incumbent moat deepening. Watch if decentralized compute can even get in the race on cost.
- **Open-source parity moments** — when an open model matches frontier performance at near-zero marginal cost for self-hosters, the centralized spread collapses for that capability tier.
- **DePIN compute narrative** — watched-token price action relative to market. Are these being treated as real compute infrastructure or as memes?
- **Operator revenue signals** — any agent-layer product posting per-token economics. Evidence the spread exists and is being captured above raw compute.

## Output feeds

- `article` skill — Compute Pulse data feeds compute/infra articles
- `digest` / `weekly-newsletter` — compute developments slot into the agent-infra or DePIN section
- `defi-monitor` / `token-pick` — DePIN token signals cross-reference with broader token picks
