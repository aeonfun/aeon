---
name: Deal Flow
category: productivity
description: Funding round tracker across configurable verticals
var: ""
tags: [research]
---

<!-- autoresearch: variation B — sharper output via leverage scoring, valuation context, and banned-phrase quality gates -->

> **${var}** — Optional. Normally empty (runs the full weekly digest across tracked verticals). A value starting with `add-topic:` (e.g. `add-topic:stablecoin infra`) is the Telegram force-reply shape — it appends `<topic>` to the tracked verticals in `memory/MEMORY.md` and ends the run without producing a digest (see Step 0).

Read `memory/MEMORY.md` for context (tracked verticals, active theses).
Read the last 14 days of `memory/logs/` and extract company names from prior `### deal-flow` entries to build the dedup set.

## Goal

Produce a weekly funding-round digest that tells the reader **what the capital reveals**, not just what closed. A flat list of rounds is noise; a ranked, contextualized read is signal.

## Steps

### 0. Inbound reply + onboarding offer (Telegram force-reply wiring)

**Handle a reply first — this branch takes priority over the digest below.** If `${var}` starts with `add-topic:`, this run is the operator answering the "track a new vertical?" prompt, not a scheduled digest:

1. Strip the prefix and trim: `topic="${var#add-topic:}"` then strip surrounding whitespace. The value is free text and may contain spaces (e.g. `stablecoin infra`, `prediction markets`) — keep it whole.
2. If `topic` is empty/blank after trimming, send a friendly re-ask (no force-reply loop) and END the run:
   `./notify "No vertical received — reply to the prompt with a vertical to track (for example: stablecoin infra, or prediction markets), and I'll add it to deal-flow's tracked verticals."`
3. Otherwise append `topic` as a `- ${topic}` bullet under a `## Tracked Verticals` section in `memory/MEMORY.md` (create the section if it doesn't exist — this is the same section Tier 2 reads). **Dedup:** skip the append if the vertical already appears there (case-insensitive).
4. Confirm (keep it ≥120 chars so a topic containing a filtered word can't be dropped as a probe):
   `./notify "Now tracking \"${topic}\" for deal-flow. It's been added to the Tracked Verticals in memory/MEMORY.md and will get its own source sweep in next week's funding-round digest."`
5. Log under `### deal-flow`: `- add-topic: "${topic}" → appended to ## Tracked Verticals in memory/MEMORY.md` and **END the run** (skip all steps below).

**Onboarding offer (normal runs only, deduped).** If `${var}` did NOT start with `add-topic:` AND `memory/MEMORY.md` has no `## Tracked Verticals` section (or it's empty) AND the last 14 days of `memory/logs/` contain no `FORCE_REPLY_OFFERED: add-topic` marker for this skill, send one force-reply offer, then continue the normal digest below:
```bash
./notify "Want deal-flow to track another vertical beyond AI / crypto / infra? Reply with one (e.g. stablecoin infra) and I'll sweep it each week." \
  --force-reply --placeholder "a topic to track" --context "deal-flow::add-topic"
```
Then log a `FORCE_REPLY_OFFERED: add-topic` marker line under `### deal-flow` so it doesn't re-offer next run. (The force-reply is a separate notify, never combined with other output.)

### 1. Gather candidates from tiered sources

Run searches in parallel. Use the **current month + year** in queries. Aim for ≥25 candidate deals before filtering. If a source fails, record `source=fail` for the footer; do not abort.

**Source fetch rule (applies to every WebFetch below):** if the fetch returns 404, 403, is rate-limited, or times out, log `DEAL_FLOW_SOURCE_MISS: <url> (<reason>)` and continue with remaining sources. Never abort the run on a single source miss — the tiered design is specifically so that any one source can fail.

**Tier 1 — broad aggregators (always run):**
- WebSearch: `"biggest funding rounds" week ${month} ${year} site:news.crunchbase.com`
- WebSearch: `funding round ${month} ${year} site:techcrunch.com`
- WebSearch: `"Series A" OR "Series B" OR "seed" raised ${month} ${year} startup`
- WebFetch `https://news.crunchbase.com/sections/venture/` — extract this week's roundup if present (apply source-miss rule above)

**Tier 2 — vertical-specific (run for the operator's tracked verticals; defaults: AI, crypto, infra/devtools):**

Read the `## Tracked Verticals` section of `memory/MEMORY.md` (Step 0 maintains it — one `- ` bullet per vertical) and merge those with the defaults below. For any operator-added vertical not already covered by the three built-in sweeps, add one `WebSearch: "<vertical>" funding round OR raised ${month} ${year}`.
- AI: WebFetch `https://aifundingtracker.com/`; WebSearch `"AI startup" "raised" Series ${month} ${year}`
- Crypto: WebFetch `https://crypto-fundraising.info/` and `https://cryptorank.io/funding-rounds` (apply source-miss rule); WebSearch `crypto funding round ${month} ${year}`
- Infra/devtools: WebSearch `developer tools OR infrastructure OR compute startup raised ${month} ${year}`

**Tier 3 — signal flags (always include if found, regardless of size):**
- Prediction markets, coordination markets, agentic payments, x402, autonomous-agent infra, on-chain identity
- WebSearch: `prediction market OR agentic payment OR x402 funding ${month} ${year}`

**X/Twitter fallback signal path (always run, especially when Tier 1/2 sources miss):**
- Use `fetch-tweets` outputs or direct X search for the following queries — these surface deals that aggregators miss or haven't indexed yet:
  - `funding-announcement` (literal hashtag and phrase)
  - `"announcing our Series" OR "we raised" ${month} ${year}`
  - `"led by @<tier1_fund>" raised` (substitute a16z, paradigm, sequoia, etc.)
  - `"thrilled to announce" funding ${month} ${year}`
- Treat tweets from verified founder/investor accounts as primary-source candidates; still dedup by company name and verify amount/lead from a second source before including.

### 2. Dedup and enrich

- Drop any deal whose company name (case-insensitive) appears in the last-14-days dedup set, **unless** the new round is materially different (later stage, >2× larger, or new lead).
- For each surviving candidate, capture:
  - **Company** + ≤12-word description
  - **Round** (pre-seed / seed / A / B / C / strategic)
  - **Amount** in USD
  - **Valuation** (post-money) if disclosed
  - **Prior valuation** if known → flag **UP / FLAT / DOWN** vs prior round
  - **Lead investor(s)** + notable co-leads
  - **Source URL**

If valuation or prior is unknown, write `n/d`. **Never hallucinate numbers.**

### 3. Score for leverage (1–5 each)

| Dimension | 5 (high) | 3 (mid) | 1 (low) |
|---|---|---|---|
| **Magnitude** | Round size unusual for stage (Series A >$50M; seed >$15M) | Standard for stage | Below median |
| **Investor signal** | Lead is a16z, Paradigm, Founders Fund, Sequoia, Benchmark, Pantera, USV, Lightspeed | Reputable but not top-tier | Unknown / pure syndicate |
| **Thesis fit** | Validates a tracked vertical/thesis directly | Adjacent | Off-thesis |
| **Narrative weight** | First-of-kind, contrarian, or category-defining | Confirmation of existing trend | Me-too |
| **Valuation signal** | UP >2× prior, OR DOWN (down rounds are signal) | FLAT or UP <2× | n/d |

Sum the five. Keep the **top 8** deals by total. Ties broken by recency.

### 4. Quality gates (drop if any fail)

- Acqui-hire, grant <$1M, or token sale → drop (token-pick covers tokens)
- Round older than 14 days → drop
- Amount or lead unverifiable → drop (no rumors)
- Total leverage score <12 → drop **unless** it carries a Tier-3 signal flag
- Cannot write a non-vague "Why it matters" line (see banned phrases below) → drop

### 5. Write the digest

```
*Deal Flow — ${today}*

**Read:** [1 sentence: what this week's capital signals — where smart money clustered, what's overfunded/underfunded, which thesis got validated or broken]

1. **Company** — what they do (≤12 words)
   $XXM ${round} @ $YYM post (${UP|FLAT|DOWN|n/d} vs prior) | Lead: ${investor}
   *Why it matters:* [≤20 words; must name the specific signal]

2. ...

*Sources:* crunchbase=ok|fail, techcrunch=ok|fail, cryptorank=ok|fail, aift=ok|fail | candidates=${N} → kept=${K}
```

**Hard rules for "Why it matters":**
- Banned phrases (drop the deal if you can't avoid them): *"interesting", "growing", "exciting", "potential", "could be", "watch this space", "important space", "validates the trend"*
- Must reference at least one of: a named thesis, a competitive dynamic, a valuation anomaly, an investor-pattern shift, a regulatory/macro trigger, or a first-of-kind structural detail.

Cap total at 4000 chars. If everything gets dropped, send:
`*Deal Flow — ${today}* — No deals cleared signal threshold this week. Sources: ...`

### 6. Log to `memory/logs/${today}.md`

```
### deal-flow
- Candidates: ${N} → Kept: ${K}
- Top deal: ${company} ($${amount} ${round}, lead ${investor}) — score ${score}/25
- Themes: [1–2 sentence cluster summary]
- Source health: [any source=fail with reason]
- Dedup: ${count} candidates dropped as already-covered
- Deals (for next-week dedup):
  - ${company1}, ${company2}, ...
```

### 7. Send via `./notify`

Run `./notify "<digest>"`. The fan-out handles channels.

## Sandbox note

The sandbox may block outbound curl. Use **WebFetch** (built-in Claude tool) for any URL fetch — it bypasses the sandbox. WebSearch is always available.

## Constraints

- Never invent numbers. `n/d` is acceptable; fabrication is not.
- Never include the same deal as last week unless materially different (later stage, >2× bigger, or new lead).
- Compare week-over-week implicitly via the **Read:** lead — is capital accelerating or decelerating in each vertical?
- Quality over completeness: if only 3 deals clear the threshold, ship 3.

## Environment Variables Required
- None (uses WebSearch + WebFetch)
