---
name: Startup Idea
description: 2 evidence-backed startup memos with ICP, wedge, monetization, and numeric kill criteria
var: ""
tags: [creative]
---
<!-- autoresearch: variation B — sharper output via rigid memo schema + tarpit filter + cited pain evidence -->

> **${var}** — Constraint or theme (e.g. "solo founder", "crypto infra", "B2B SaaS", "under $10k to launch"). If empty, generates freely.

Read `memory/MEMORY.md` for current goals and recent thinking.
Read the last 14 days of `memory/logs/` for recent research, articles, and signals — and to dedup against recently proposed ideas.
If soul files exist (`soul/SOUL.md`, `soul/STYLE.md`), read them for identity, expertise, and voice.

## Steps

### 1. Build the founder profile
From memory, soul, and recent logs, extract:
- **Domains of earned expertise** — what has the user actually shipped or deeply researched? ("earned secret" test)
- **Active projects** — what's currently being worked on
- **Recent signal** — topics, papers, market moves tracked this week
- **Recently proposed ideas** — scan the last 14 days of logs; do not re-pitch these

If none of this exists, generate broadly applicable ideas anchored to `${var}` and 2026 tech trends.

### 2. Gather fresh pain evidence

Use WebSearch + WebFetch to collect **real customer pain signals**, not model priors. Aim for ≥3 high-signal sources across at least 2 of these channels:

- **G2 / Capterra 1–3★ reviews** — named frustrated buyers with budget. Search: `"[category] site:g2.com" OR "[category] 1 star review"`
- **Reddit pain threads** — `r/SaaS`, `r/startups`, `r/smallbusiness`, `r/Entrepreneur`. Search: `"I wish there was" OR "why is there no" OR "anyone else frustrated with"`
- **Indie Hackers + HN "Ask HN: who is hiring"** — bottom-up demand signals
- **YC Requests for Startups** — `ycombinator.com/rfs` (current cycle)
- **Upwork / job postings** — people paying humans to do it → productizable
- **ProductHunt comment sections** (not launches) — gaps in recent launches

Save 2+ permalinks per idea with a one-line quote of the pain. If `${var}` is set, scope the search to that theme. **Vary domains across runs** — if recent logs pitched crypto, go elsewhere this time.

Sandbox fallback: if curl/WebFetch both fail for a source, note `[source unreachable]` inline and proceed with remaining sources. Never fabricate quotes.

### 3. Apply the tarpit filter (reject before generation)

Pre-reject these categories unless the user has an overwhelming earned-secret advantage:
- Generic "ChatGPT/AI for [X]" wrappers with no data or workflow moat
- AI meeting notetakers, AI email assistants, AI chatbots for SMBs
- Social apps for niche demographics
- Crypto "community/social" apps without distribution
- Anything where the answer to "why hasn't this been built" is "it has, 50 times"

### 4. Generate 2 startup memos

Produce **exactly 2 ideas**:
- **Idea 1 — Executable**: launchable in 2–6 weeks solo, clear first customer, <$5k to MVP
- **Idea 2 — Ambitious**: bigger swing (new category, harder tech, or platform play) but with a defensible wedge

Each idea **must** fill every field below. If a field can't be filled with a concrete answer, drop the idea and try another.

```
### Idea [1|2] — [Name]

**Thesis** (1 sentence): why this wins
**ICP** (role + trigger event): e.g. "Ops manager at 50–200-person logistics co who just lost a client to tracking failures"
**Wedge** (first 12 months): the single sharp product
**Pain evidence** (2+ permalinks):
  - [quote] — [url]
  - [quote] — [url]
**Monetization**: price point, target gross margin, rough unit economics
**Distribution** (specific channel + CAC estimate): not "content marketing" — name the channel
**Moat** (what compounds): data, workflow lock-in, regulatory, network, proprietary integration
**Why now (2026)**: one of — regulatory shift, capability unlock, cost-curve shift, distribution change
**MVP test** (2 weeks): what to build, what metric proves/disproves demand
**Kill criteria** (numeric): e.g. "<3 paid pilots in 60 days → kill"
**Expansion** (what if it works): the adjacent market
```

Quality bar before emitting:
- Does each idea pass Paul Graham's organic test (something the user would want, can build, few others see)?
- Is the ICP a named role with a trigger event, not "SMBs" or "developers"?
- Is distribution a specific channel, not a generic category?
- Is the kill criteria numeric and time-bound?

If an idea fails the bar, iterate. Do not emit slop.

### 5. Send via `./notify` (under 4000 chars)

```
*Startup Ideas — ${today}*${var ? ` (${var})` : ``}

*1. [Name]* (executable) — [thesis]
ICP: [role + trigger]
Wedge: [first product]
Why now: [one sentence]
MVP test: [what to build, metric]
Kill: [numeric criteria]

*2. [Name]* (ambitious) — [thesis]
ICP: [role + trigger]
Wedge: [first product]
Why now: [one sentence]
MVP test: [what to build, metric]
Kill: [numeric criteria]
```

Keep the notification tight — full memos go to the log.

### 6. Log to `memory/logs/${today}.md`

Append the full 2-memo output (all fields from step 4), plus:

```
## Startup Idea
- **Constraint:** [var or "none"]
- **Idea 1:** [name] — [one-liner]
- **Idea 2:** [name] — [one-liner]
- **Sources cited:** [count of permalinks]
- **Notification sent:** yes
```

## Sandbox note

The sandbox may block outbound curl. Use **WebFetch** as a fallback for any URL fetch. If both fail for a pain source, note `[source unreachable]` inline and proceed — never fabricate quotes or permalinks. For auth-required APIs, use the pre-fetch/post-process pattern (see CLAUDE.md).

## Constraints

- Never emit an idea without 2+ cited pain permalinks (or explicit `[source unreachable]` for the attempted source).
- Never emit a tarpit-category idea (step 3) without an explicit earned-secret justification.
- Never repeat an idea proposed in the last 14 days of logs.
- Notification stays under 4000 chars; full memos live in the daily log.
