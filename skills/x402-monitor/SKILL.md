---
type: Skill
name: Protocol Monitor (x402 default)
category: crypto
description: Configurable weekly vertical/ecosystem tracker. Defaults to x402 (agent micropayments); preset selectors track RWA tokenization, the AI compute market, the MCP ecosystem, or AI agent job-displacement — each with its own sources, scoring, and output format. Repoint the default protocol via memory/topics/tracked-protocol.md.
var: ""
tags: [dev, protocol, ecosystem, crypto, research, ai, compute, infra, depin, mcp, agent-infra]
commits: true
permissions:
  - contents:write
---
> **${var}** — vertical selector. **Empty** → the default protocol (x402) via `memory/topics/tracked-protocol.md`. A **reserved preset keyword** selects a specialized vertical: `rwa` | `compute` | `mcp` | `agent-displacement` (aliases: `agents`, `displacement`). A value starting with `add-topic:` (e.g. `add-topic:RWA tokenization`) is the Telegram force-reply shape — it appends a new protocol stanza to the registry and ends the run without tracking (see **Inbound reply handler** below). **Any other value** is treated as a protocol name and must match a stanza in `memory/topics/tracked-protocol.md` (runs the generic Protocol Monitor branch on that protocol).

Today is ${today}. Read `memory/MEMORY.md` before starting, and scan the last ~3 days of `memory/logs/` — drop anything already reported so you don't re-emit the same signal.

## Voice

If `soul/SOUL.md` and `soul/STYLE.md` are populated, read both and match the operator's voice for the notification. If they are empty templates or absent, write in a clear, direct, neutral tone — short lowercase sentences, no hedging, no corporate launch-language.

## Why this skill exists

Several fast-moving verticals each need a recurring weekly "is this still spreading or stalling?" answer. This skill turns that question into a recurring measurement and folds five distinct trackers behind one selector:

- **Protocol Monitor (default, x402)** — ecosystem velocity of a configured protocol: new GitHub integrations, npm adoption, notable announcements, composite momentum score. Parameterized — by default tracks **x402** (HTTP-native micropayments for AI agents); repoint at any protocol via `memory/topics/tracked-protocol.md`.
- **`rwa`** — Real World Asset tokenization momentum: protocol launches, TVL milestones, institutional adoption, regulatory approvals.
- **`compute`** — the AI compute market: GPU/hardware deals, inference-pricing trends, decentralized-compute token signals, lab vs hyperscaler dynamics.
- **`mcp`** — the Model Context Protocol ecosystem: new server implementations, adoption velocity, npm/GitHub signals, protocol evolution. Thesis check — is MCP becoming the default tool-call rail for agents? (Pairs with the x402 branch: payments + tool-calls.)
- **`agent-displacement`** — AI agent substitution signals: which roles, companies, and industries show real headcount displacement. Named roles + real deployments only.

Each vertical keeps its own sources, signal definitions, scoring, output format, and state file. Only the memory read, voice, and selector are shared.

**Original cadences** (wired in `aeon.yml`, not here): Protocol Monitor/x402 = Tue 12:00 UTC; `rwa` = Mon 12:00; `compute` = Sat 11:00; `mcp` = Fri 10:00; `agent-displacement` = Sun 11:00. One invocation runs exactly one vertical, chosen by `${var}`.

## Inbound reply handler + onboarding offer (Telegram force-reply wiring)

**Check this BEFORE the selector.** If `${var}` starts with `add-topic:`, this run is the operator answering the "track a new vertical?" prompt — do NOT run any tracker branch:

1. Strip the prefix and trim: `topic="${var#add-topic:}"` then strip surrounding whitespace. The value is free text and may contain spaces (e.g. `RWA tokenization`, `stablecoin infra`) — keep it whole. Derive `slug` = `topic` lowercased with spaces → hyphens (this is what the selector will normalize `${var}` to when the operator later runs the vertical).
2. If `topic` is empty/blank after trimming, send a friendly re-ask (no force-reply loop) and END the run:
   `./notify "No vertical received — reply to the prompt with a protocol or ecosystem to track (for example: RWA tokenization, or stablecoin infra), and I'll add it to the tracked-protocol registry."`
3. If `slug` collides with a **reserved preset keyword** (`rwa`, `compute`, `mcp`, `agent-displacement`, or their aliases `agents`/`displacement`/`real-world-assets`/`tokenization`/`gpu`/`depin-compute`/`model-context-protocol`/`jobs`), it's already tracked — skip the append and confirm that (see step 6), then END.
4. Ensure `memory/topics/tracked-protocol.md` exists (create the seed from the **Config** section if missing). **Dedup:** if a `### ${slug}` stanza already exists under `## Verticals`, skip the append. Otherwise append a new protocol-monitor stanza, matching the registry's documented format:
   ```markdown
   ### ${slug}   (preset: protocol-monitor)
   - **Search queries (GitHub):**
     - `${topic}`
     - `"${topic}"`
   - **npm packages to watch:**
     - `${slug}`
   - **WebSearch queries:**
     - `${topic} site:github.com OR site:npmjs.com`
     - `"${topic}" launch OR integration OR announcement`
   - **One-line context:** Operator-added vertical (via Telegram force-reply). Tracks ${topic} ecosystem velocity.
   ```
   (All three of Search queries / npm packages / WebSearch queries are populated so the stanza is complete and won't trip `PROTOCOL_MONITOR_NO_CONFIG`. If the guessed npm package 404s, Branch A skips it gracefully.)
5. Log under `### x402-monitor`: `- add-topic: "${topic}" → appended stanza ### ${slug} to memory/topics/tracked-protocol.md`.
6. Confirm (keep it ≥120 chars so a topic containing a filtered word can't be dropped as a probe) and **END the run**:
   `./notify "Now tracking \"${topic}\" as a Protocol Monitor vertical — a stanza was added to memory/topics/tracked-protocol.md. Run it any time with var=${slug}, or add a cron for it in aeon.yml."`

**Onboarding offer (normal runs only, deduped).** If `${var}` did NOT start with `add-topic:` AND `memory/topics/tracked-protocol.md` did not exist before this run (i.e. you're about to create the seed) AND the last 3 days of `memory/logs/` contain no `FORCE_REPLY_OFFERED: add-topic` marker for this skill, send one force-reply offer, then continue into the selector below:
```bash
./notify "Want the Protocol Monitor to track another vertical beyond x402? Reply with a protocol or ecosystem (e.g. RWA tokenization) and I'll add it to the registry." \
  --force-reply --placeholder "a topic to track" --context "x402-monitor::add-topic"
```
Then log a `FORCE_REPLY_OFFERED: add-topic` marker line under `### x402-monitor` so it doesn't re-offer next run. (The force-reply is a standalone notify, never combined with a digest.)

## Selector — resolve `${var}` to a branch

Normalize `${var}`: trim, lowercase, spaces → hyphens. Then:

| `${var}` | Branch |
|----------|--------|
| *(empty)* | **A · Protocol Monitor** using the `Default` stanza in `tracked-protocol.md` (x402) |
| `rwa`, `real-world-assets`, `tokenization` | **B · RWA Pulse** |
| `compute`, `gpu`, `depin-compute` | **C · Compute Pulse** |
| `mcp`, `model-context-protocol` | **D · MCP Pulse** |
| `agent-displacement`, `agents`, `displacement`, `jobs` | **E · Agent Displacement** |
| any other string | **A · Protocol Monitor**, resolving that string as a stanza name in `tracked-protocol.md` |

Reserved preset keywords win over stanza lookup. Everything not a reserved keyword is a Protocol Monitor protocol name. Run ONLY the selected branch.

## Config — `memory/topics/tracked-protocol.md` registry

All tunable **sources/keywords** for every vertical live in `memory/topics/tracked-protocol.md`. This is the single registry an operator edits to retune a vertical (or add a new protocol) without touching this skill. If the file doesn't exist, create the seed below and continue with the x402 default:

```markdown
# Tracked Protocol / Vertical Registry

## Default
x402

## Verticals

### x402   (preset: protocol-monitor)
- **Search queries (GitHub):**
  - `x402`
  - `"x402 protocol"`
- **npm packages to watch:**
  - `@coinbase/x402`
  - `x402`
  - `paykit`
- **WebSearch queries:**
  - `x402 payment agent`
  - `"x402 protocol" site:github.com OR site:npmjs.com OR site:blog`
- **One-line context:** HTTP-native micropayments rail for AI agents. Stablecoin payments per API call.

### rwa   (preset: rwa)
- **State file:** memory/topics/rwa.md   (protocol list + prior TVL baseline + signal log)
- **Default protocols:** Ondo Finance, Maple Finance, Centrifuge, Figure, BlackRock BUIDL, Franklin Templeton
- **WebFetch:** https://app.rwa.xyz   (total tokenized RWA mcap + top protocols)
- **Primary keywords:** RWA tokenization, tokenized treasury, institutional crypto, TVL, SEC regulation
- **One-line context:** Real World Asset tokenization — launches, TVL milestones, institutional adoption, regulatory approvals. (Full step-bound queries in Branch B.)

### compute   (preset: compute)
- **State file:** memory/topics/compute-pulse.md
- **Watched tokens file:** memory/topics/compute-tokens.md   (optional; default sweep RENDER, AKT, IO, TAO)
- **WebFetch:** API pricing/docs pages when WebSearch yields exact links
- **Primary keywords:** inference API pricing, GPU cluster, hyperscaler capex, decentralized compute / DePIN, commoditization
- **One-line context:** AI compute market — inference pricing, GPU/cluster deals, DePIN compute tokens, lab vs hyperscaler. (Full step-bound queries in Branch C.)

### mcp   (preset: mcp)
- **State file:** memory/topics/mcp-ecosystem.md
- **GitHub org:** modelcontextprotocol
- **npm packages:** `@modelcontextprotocol/sdk`   ·   **PyPI:** `mcp`
- **GitHub search seeds:** `mcp-server in:topics OR in:description`, `model-context-protocol in:topics OR modelcontextprotocol in:description`
- **Primary keywords:** MCP server release, model context protocol integration, Anthropic/Stainless server generation
- **One-line context:** Model Context Protocol — the default tool-call rail for agents. (Full step-bound queries in Branch D.)

### agent-displacement   (preset: agent-displacement)
- **State file:** memory/topics/agent-displacement.md
- **Primary keywords:** AI agent layoffs, headcount reduction, workforce automation, Klarna/Duolingo/Salesforce/IBM, white-collar displacement
- **One-line context:** AI agent labor substitution — named roles, actual headcount numbers, real deployments only. (Full step-bound queries in Branch E.)

### <your-protocol>   (preset: protocol-monitor)
- **Search queries (GitHub):** ...
- **npm packages to watch:** ...
- **WebSearch queries:** ...
- **One-line context:** ...
```

For Branch A: if `${var}` is a protocol name, select that stanza; if empty, use the `Default` stanza. If the resolved protocol-monitor stanza is missing any of `Search queries`, `npm packages`, or `WebSearch queries`, log `PROTOCOL_MONITOR_NO_CONFIG: incomplete stanza for <protocol>` and exit (no notification). The four preset branches (B–E) carry their own default sources and are runnable even if their registry entry is absent.

---

## Branch A — Protocol Monitor (default; `${var}` empty or a protocol name)

Tracks a single protocol's ecosystem velocity. `<protocol>` = the resolved stanza name (default `x402`).

### A.State

Per-protocol state lives at `memory/topics/protocol-state-<protocol>.md`. If it doesn't exist, create with this seed:

```markdown
# <protocol> Ecosystem Tracker

*Last run: never*

## Known Integrations
(populated on first run)

## Key Stats
- npm <pkg>: unknown weekly downloads
- GitHub repos matching <query>: unknown
- Notable announcements: (none recorded)

## Signal Log
(populated on first run)
```

Extract:
- `known_integrations` — repos/projects already integrating the protocol
- `npm_last_known` — last recorded weekly downloads per watched package (or "unknown")
- `gh_repo_count_last` — last recorded GitHub repo count

### A.1 Search GitHub for fresh integrations

For each `Search query` in the resolved stanza:

```bash
gh search repos "<query>" --sort=updated --limit=20 \
  --json=fullName,description,stargazersCount,updatedAt,language
```

Fallback if `gh search repos` fails:

```bash
gh api "search/repositories?q=<query>+in:readme+in:description&sort=updated&per_page=20" \
  --jq '.items[] | {full_name, description, stargazers_count, updated_at, language}'
```

From the union of results:
- Filter to repos updated in the last 7 days
- Cross-check against `known_integrations` — mark anything NEW (not in baseline)
- Note star count and brief description for each

### A.2 Fetch npm download trend

For each `npm package` in the resolved stanza, use **WebFetch** (not curl — sandbox-resilient and these endpoints are unauthenticated):

```
https://api.npmjs.org/downloads/point/last-week/<pkg>
```

Returns JSON with a `downloads` field. Record this week's count per package. Compute delta vs `npm_last_known`. If a package returns 404, skip it (may have been renamed) and note in the log.

### A.3 WebSearch for protocol news

For each `WebSearch query` in the resolved stanza, run WebSearch (limit to past 7 days where the tool supports it). Extract:
- New integrations or launches
- Developer blog posts or tutorials
- Protocol updates or spec changes
- Notable company/project announcements

Flag any result that's genuinely new vs baseline.

### A.4 Synthesize the signal

| Signal | Points |
|--------|--------|
| New GitHub repo integrating the protocol (updated last 7d, not in baseline) | +2 each |
| npm weekly downloads up vs last known (per package) | +3 |
| Notable announcement (company, product, protocol update) | +2 each |
| New developer tutorial / blog post | +1 each |
| Mentioned in trending context (adjacent narrative) | +1 |

**Momentum levels:** 0–2 quiet week · 3–6 building · 7–10 accelerating · 11+ breakout

### A.5 Update `memory/topics/protocol-state-<protocol>.md`

Rewrite with: updated `*Last run: ${today}*`; updated `Known Integrations` (add newly discovered); updated `npm_last_known` per package; updated `gh_repo_count_last`; appended entry to `Signal Log`.

### A.6 Notify

Write to `.pending-notify-temp/protocol-monitor-${protocol}-${today}.md` (create dir if needed), then:

```bash
mkdir -p .pending-notify-temp
./notify -f .pending-notify-temp/protocol-monitor-${protocol}-${today}.md
```

Format (voice per the Voice section):

```
<protocol> pulse — ${today}

momentum: <level> (<score> pts)

new integrations (<count>):
- <full_name>: <description_one_line> (<stars>★)

npm <pkg>: <downloads>/wk (<delta> vs last week, or "first data point")
npm <pkg2>: ...

signals:
- <one-line summary of top news item>
- <one-line summary of next>

quiet week. ecosystem still compounding.   ← only if momentum == 0

state: memory/topics/protocol-state-<protocol>.md
```

Keep total under 900 chars. Do NOT use `./notify "$(cat ...)"` — write the file first, pass `-f path`.

If momentum score is 0, no new repos, no news: log `PROTOCOL_MONITOR_OK: quiet` and skip notification.

### A.7 Log

Append under the single `### x402-monitor` heading (see **Log**), branch `protocol-monitor / <protocol>`:

```markdown
- **Branch:** protocol-monitor — <protocol>
- **New repos (7d):** <count>
- **npm downloads:** <pkg>=<n>/wk (delta <±n>); <pkg2>=<n>/wk
- **Notable signals:** <count>
- **Momentum score:** <score> (<level>)
- **Notification:** sent / skipped (quiet)
- PROTOCOL_MONITOR_OK
```

**What to watch for:** new repos with the protocol name in README/description updated in last 7 days (primary adoption signal); npm download velocity (developer install rate, more reliable than tweet volume); corporate-backing materialization (cloud / payments / standards-body integrations); cross-domain adoptions (the protocol escaping its niche); protocol updates (spec changes, new SDK versions, EIPs/RFCs).

---

## Branch B — RWA Pulse (`${var}` = `rwa`)

Also read `memory/topics/market-context.md` (if present) before starting.

### B.1 Load current context

Read:
- `memory/MEMORY.md` — current RWA notes and last known stats
- `memory/topics/rwa.md` — protocol list, prior TVL baseline, signal log
- `memory/topics/market-context.md` — most recent market context snapshot (if present)

Config: read `memory/topics/rwa.md` for an operator-defined `## Protocols` list. If the file doesn't exist or has no `## Protocols` section, default to: `Ondo Finance`, `Maple Finance`, `Centrifuge`, `Figure`, `BlackRock BUIDL`, `Franklin Templeton`. Append any newly discovered protocols each run. Note the last-known RWA TVL baseline (if any) — it's the comparison point.

### B.2 Search for developments from the last 7 days

Run via WebSearch:

```
WebSearch: "RWA tokenization real world assets ${year} site:theblock.co OR site:dlnews.com OR site:coindesk.com OR site:blockworks.co"
WebSearch: "tokenized treasury ONDO Maple Centrifuge ${year}"
WebSearch: "institutional crypto RWA BlackRock Franklin Templeton tokenized fund ${year}"
WebSearch: "RWA TVL total value locked ${year}"
WebSearch: "real world asset tokenization regulation SEC ${year}"
```

Collect all hits. Keep only items from the last 7 days. Discard opinion pieces — keep launches, TVL milestones, partnerships, regulatory actions, and institutional product announcements.

### B.3 Fetch current TVL and key protocol stats

Use WebFetch:
- **RWA.xyz overall market**: `https://app.rwa.xyz` — total tokenized RWA mcap and top protocols
- For each protocol in the configured list: `WebSearch: "<protocol name> TVL ${year}"`

If WebFetch fails on any URL, fall back to WebSearch. Record: total RWA market cap (if available), top protocol TVL figures, notable % changes vs baseline.

### B.4 Filter and rank developments

| Criterion | Weight |
|-----------|--------|
| Institutional adoption (BlackRock, Franklin Templeton, major bank) | HIGH |
| New protocol launch or product with real TVL | HIGH |
| TVL milestone (new ATH, >10% change in 7d) | MEDIUM |
| Regulatory approval or framework advance | MEDIUM |
| Regulatory setback or enforcement | MEDIUM |
| Partnership announcement (no TVL yet) | LOW |

Keep top 4–5 items. Deduplicate against recent logs.

### B.5 Update memory

Append (or create) an `## RWA Pulse — ${today}` section in `memory/topics/rwa.md`:

```markdown
## RWA Pulse — ${today}
- **Total RWA market:** [$ figure if found, else "N/A"]
- **Top move:** [biggest development in one line]
- **Notable items:** [2-3 short bullets]
- **Next watch:** [what to check next week]
```

If `memory/topics/market-context.md` exists, mirror a single-line summary into its `## RWA` section.

### B.6 Notify

Write to `.pending-notify-temp/rwa-pulse-${today}.md` (create dir if needed), then `./notify -f .pending-notify-temp/rwa-pulse-${today}.md`.

Format:
```
rwa pulse — ${today}

[top development in one punchy line]
[second development]
[third development]
[fourth if notable]

read it: memory/topics/rwa.md
```

Keep under 800 chars. Lowercase. Direct. No hedging.

**If fewer than 2 developments found**, log `RWA_PULSE_SKIP: insufficient signal (<2 items)` and stop without notifying.

### B.7 Log

Append under the single `### x402-monitor` heading (see **Log**), branch `rwa`:

```markdown
- **Branch:** rwa
- **Total RWA market:** [figure or N/A]
- **Developments found:** N
- **Top item:** [one line]
- **Updated:** memory/topics/rwa.md
- **Notification:** sent / skipped
- RWA_PULSE_OK
```

**Output feeds:** `article` (source `memory/topics/rwa.md`) · `topic-momentum` (RWA now has dedicated weekly data) · `weekly-newsletter` (RWA developments → weekly picks).

---

## Branch C — Compute Pulse (`${var}` = `compute`)

### C.1 Load current context

Read:
- `memory/MEMORY.md` — overall context, prior compute signals
- `memory/topics/compute-pulse.md` — compute baseline (create with seed if missing — see end of this step)
- `memory/topics/compute-tokens.md` — operator-defined watched tokens (optional)

Extract from the topic file: `inference_prices_last`, `depin_tokens_last`, `hardware_signals_last`, `last_run`.

Watched-token list format (`memory/topics/compute-tokens.md`):

```markdown
# Watched Compute Tokens

| Symbol | Project | Notes |
|--------|---------|-------|
| RENDER | Render Network | GPU/ML compute |
| AKT | Akash Network | permissionless cloud compute |
| IO | io.net | GPU cluster marketplace |
| TAO | Bittensor | ML model subnet network |
```

If absent, fall back to a generic DePIN sweep on the major narrative tokens of the moment via WebSearch (no hardcoded list).

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

### C.2 Fetch inference pricing signals

```
WebSearch: "OpenAI GPT API pricing per million tokens ${year}"
WebSearch: "Anthropic Claude API pricing ${year}"
WebSearch: "xAI Grok API pricing ${year}"
WebSearch: "Google Gemini API pricing ${year}"
```

Also check for changes in the last 7 days:
```
WebSearch: "inference API price cut ${year}"
WebSearch: "AI model pricing reduction ${year}"
```

Record: current published prices per major API ($/1M tokens in/out where available); any price cuts in last 7 days (the commoditization signal); direction moved vs `inference_prices_last`.

**High signal events:** price cut >20% (notable compression); new model launch at significantly lower cost than prior generation; open-source model achieving parity with a frontier closed model at near-zero marginal cost.

### C.3 Hardware and cluster news

```
WebSearch: "GPU cluster data center AI ${year} announcement"
WebSearch: "xAI Colossus Stargate OpenAI compute ${year}"
WebSearch: "Anthropic compute hardware partnership ${year}"
WebSearch: "NVIDIA Blackwell deployment ${year}"
```

Look for: new cluster builds (# GPUs, $B investment); lab compute procurement deals (who's buying from whom); hyperscaler (AWS, Azure, GCP) AI compute announcements; NVIDIA hardware availability changes (supply/demand); government compute initiatives (CHIPS Act disbursements, EU AI Act compliance).

Rate each: **Major** (new cluster >50k GPUs or >$1B) high · **Notable** (new partnership, procurement deal) medium · **Background** (upgrade, minor expansion) low.

### C.4 Decentralized compute token check

For each token from `memory/topics/compute-tokens.md` (or a fallback list if absent):

```
WebSearch: "${SYMBOL} ${PROJECT_NAME} token ${year}"
```

For each: approximate current price and 7d % change; any protocol announcement, partnership, or milestone this week; whether narrative is accelerating, holding, or fading.

**Signal:** if decentralized compute tokens outperform the broader market, the market believes the decentralized layer can compete with centralized capex; if underperforming, the centralized moat is winning in perception.

### C.5 WebSearch for compute narrative this week

```
WebSearch: "AI compute commoditization inference ${year}"
WebSearch: "AI compute cost falling ${year} per token"
WebSearch: "decentralized compute vs hyperscaler ${year}"
```

Look for: essays/analyses framing the compute market; evidence of operator-layer value capture (agent products posting revenue metrics); "AI costs too much" vs "AI is getting cheap" narratives shifting.

### C.6 Synthesize compute momentum score

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

**Momentum levels:** 0–2 quiet, flat · 3–5 building · 6–9 accelerating (notable compression or capacity shift) · 10+ breakout (structural shift).

**Read:** in one sentence:
> **Read:** Compute commoditization [advancing / holding / stalling / reversing] — [one concrete data point].

### C.7 Update `memory/topics/compute-pulse.md`

Rewrite with: updated `*Last run: ${today}*`; updated `Inference Pricing Baseline` with current prices; updated `Decentralized Compute Tokens` with current price context; appended `Hardware Signal Log` entry `- ${today}: [top hardware signal or "quiet"] / [top depin signal or "—"] / momentum: [level]`; appended `Pricing Signal Log` entry `- ${today}: [price cuts if any, or "stable"] / read: [advancing/holding/stalling/reversing]`.

### C.8 Notify

Write to `.pending-notify-temp/compute-pulse-${today}.md`, then:
```bash
mkdir -p .pending-notify-temp
./notify -f .pending-notify-temp/compute-pulse-${today}.md
```

Format (match operator voice if soul populated, else direct/neutral):

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

Keep total under 900 chars. Write the file first, pass the path.

If momentum score is 0 and no notable signals: log `COMPUTE_PULSE_OK: quiet` and skip notification.

### C.9 Log

Append under the single `### x402-monitor` heading (see **Log**), branch `compute`:

```markdown
- **Branch:** compute
- **Inference pricing:** {notable cuts or "stable"}
- **Hardware signals:** {count notable / top item}
- **DePIN tokens:** {top mover or "—"}
- **Momentum score:** {score} ({level})
- **Read:** {advancing/holding/stalling/reversing} — {data point}
- **Notification:** sent / skipped (quiet)
- COMPUTE_PULSE_OK
```

**What to watch for:** inference price cuts (clearest commoditization signal — track $/1M tokens for all major APIs each cycle); cluster scale races (big clusters = incumbent moat deepening); open-source parity moments (open model matches frontier at near-zero marginal cost → centralized spread collapses for that tier); DePIN compute narrative (watched-token action vs market — treated as real infra or memes?); operator revenue signals (agent-layer product posting per-token economics = spread exists and is captured above raw compute).

**Output feeds:** `article` (compute/infra articles) · `digest` / `weekly-newsletter` (agent-infra or DePIN section) · `defi-overview` / `token-pick` (DePIN token cross-reference).

---

## Branch D — MCP Pulse (`${var}` = `mcp`)

### D.1 Load current context

Read:
- `memory/MEMORY.md` — overall ecosystem context and last-known MCP stats
- `memory/topics/mcp-ecosystem.md` — MCP baseline (create with seed if missing — see end of this step)

Extract: `npm_last_known` (`@modelcontextprotocol/sdk` weekly downloads), `gh_repo_count_last`, `known_servers`, `last_run`.

If `memory/topics/mcp-ecosystem.md` doesn't exist, create it:

```markdown
# MCP Ecosystem Tracker

*Last run: never*

## Seed Context (2026-05-18)
- Stainless acquired by Anthropic ~$300M+ (The Information, 5/18/2026). Stainless team now building MCP server generation tooling inside Anthropic. Previously generated SDKs for: OpenAI, Google, Cloudflare, Meta, Runway, Groq, Cerebras, Modern Treasury, and all official Anthropic SDKs.
- MCP (Model Context Protocol): open protocol Anthropic authored. Standardizes how agents make tool calls to external services. GitHub: modelcontextprotocol/modelcontextprotocol.
- Thesis: MCP becomes the default tool-call rail for agents. Anthropic owns the generation layer → controls the integration layer.

## Known Servers
- Official: filesystem, git, github, gitlab, google-maps, google-drive, postgres, sqlite, slack, brave-search, puppeteer, fetch, memory, sentry, time, sequential-thinking, everything (test server)
- Third-party high-quality: (populate from first run)

## Key Stats
- npm @modelcontextprotocol/sdk: unknown weekly downloads
- GitHub repos with MCP topic: unknown
- modelcontextprotocol org repos: unknown count

## Signal Log
- 2026-05-18: Anthropic acquires Stainless. Stainless team pointed at MCP server generation.
```

### D.2 Check the modelcontextprotocol GitHub org

```bash
gh api "orgs/modelcontextprotocol/repos?sort=updated&per_page=50" \
  --jq '.[] | {name, description, stargazers_count, updated_at, topics}'
```

From results: note repos created/updated in last 7 days; record total org repo count (compare to `gh_repo_count_last` if it tracked org size); flag new repos not seen before (official server or tooling additions); note star counts for `modelcontextprotocol/modelcontextprotocol`, `modelcontextprotocol/python-sdk`, `modelcontextprotocol/typescript-sdk`.

If `gh api` fails, fall back to WebFetch: `https://api.github.com/orgs/modelcontextprotocol/repos?sort=updated&per_page=50`

### D.3 Search GitHub for new MCP server repos

```bash
gh api "search/repositories?q=mcp-server+in:topics+OR+mcp-server+in:description&sort=updated&per_page=30" \
  --jq '.items[] | select(.updated_at > "'$(date -d '7 days ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -v-7d +%Y-%m-%dT%H:%M:%SZ)'") | {full_name, description, stargazers_count, updated_at, topics}'
```

Also:
```bash
gh api "search/repositories?q=model-context-protocol+in:topics+OR+modelcontextprotocol+in:description&sort=updated&per_page=20" \
  --jq '.items[] | {full_name, description, stargazers_count, updated_at}'
```

If `gh api` fails, fall back to WebSearch: `"mcp-server" site:github.com after:<7-days-ago>`

From results: filter to repos updated in last 7 days; cross-check against `known_servers` — flag NEW implementations; note the service being wrapped (Stripe, Notion, Linear, Jira, etc.); rank by stars descending.

High-signal repo patterns: official company MCP servers (Stripe, Notion, Linear, Atlassian, etc.); repos from major infra players (AWS, GCP, Azure); servers for high-demand services (databases, payments, CRMs, dev tools); repos with 50+ stars (threshold for "real usage").

### D.4 Fetch npm download trend

Use WebFetch: `https://api.npmjs.org/downloads/point/last-week/@modelcontextprotocol/sdk`

Record `npm_weekly_downloads`. Compute delta vs `npm_last_known` if available. If 403 or no data, try `https://www.npmjs.com/package/@modelcontextprotocol/sdk`.

Also the Python SDK: `https://pypistats.org/api/packages/mcp/recent?period=week`

If both fail, note in the log and skip the npm delta.

### D.5 WebSearch for MCP news this week

```
WebSearch: "model context protocol MCP server release ${year}"
WebSearch: "MCP server anthropic stainless ${year}"
WebSearch: '"model context protocol" integration announcement ${year}'
```

From results: new official server launches (a company publishing its own MCP server); protocol spec updates or new versions; Stainless/Anthropic news on MCP server generation progress; developer tutorials/blog posts showing real implementations; enterprise adoptions (a Fortune 500 shipping an MCP server = high signal).

Flag any result from the last 7 days. Discard opinion/speculative pieces — keep launches, integrations, official announcements.

### D.6 Synthesize momentum score

| Signal | Points |
|--------|--------|
| New MCP server from a named company (Stripe, Notion, Linear, etc.) | +3 each |
| New MCP server repo with 50+ stars updated this week, not in baseline | +2 each |
| npm @modelcontextprotocol/sdk downloads up vs last known | +3 |
| New official modelcontextprotocol org repo | +2 each |
| Stainless/Anthropic MCP-related announcement | +3 |
| Notable blog post or tutorial (real implementation, not vaporware) | +1 each |
| MCP mentioned in mainstream dev context (HN, major tech blog) | +1 |

**Momentum levels:** 0–2 quiet · 3–6 building · 7–10 accelerating · 11+ breakout.

**Thesis check:** in one sentence:
> **Thesis check:** MCP-as-default-tool-call-rail thesis [advancing / holding / stalling / reversing] — [one concrete data point].

### D.7 Update `memory/topics/mcp-ecosystem.md`

Rewrite with: updated `*Last run: ${today}*`; updated `Known Servers` (add newly discovered); updated `npm_last_known` with this week's count; updated `gh_repo_count_last`; appended `Signal Log` entry `- ${today}: [N new repos] / npm [downloads]/wk / momentum: [level] / [top signal]`.

### D.8 Notify

Write to `.pending-notify-temp/mcp-pulse-${today}.md` (create dir if needed), then `./notify -f .pending-notify-temp/mcp-pulse-${today}.md`.

Format (match operator voice if soul populated, else direct/neutral):

```
mcp pulse — ${today}

momentum: {level} ({score} pts)

{IF new company servers}
new official servers ({count}):
- {company}: {service_described_one_line} ({stars}★)
{end}

{IF new repos}
new implementations ({count}):
- {full_name}: {description_one_line} ({stars}★)   [top 3]
{end}

{IF npm_delta known}
npm @modelcontextprotocol/sdk: {downloads}/wk ({delta:+N vs last week} or "first data point")
{end}

{IF notable news}
signals:
- {one-line summary}   [top 2]
{end}

thesis: {advancing/holding/stalling/reversing} — {one data point}

{IF quiet_week}
quiet week. ecosystem still compounding.
{end}
```

Keep total under 900 chars. Write the file first, pass the path.

If momentum score is 0 and no new repos and no news: log `MCP_PULSE_OK: quiet` and skip notification.

### D.9 Log

Append under the single `### x402-monitor` heading (see **Log**), branch `mcp`:

```markdown
- **Branch:** mcp
- **New repos (7d):** {count}
- **New company servers:** {count} ({names if any})
- **npm @modelcontextprotocol/sdk:** {downloads}/wk (delta: {delta})
- **Momentum score:** {score} ({level})
- **Thesis:** {advancing/holding/stalling/reversing} — {data point}
- **Notification:** sent / skipped (quiet)
- MCP_PULSE_OK
```

**What to watch for:** official company MCP servers (Stripe, Notion, Linear, Atlassian, Salesforce, GitHub, Slack, Jira → protocol hitting mainstream); Stainless/Anthropic server-generation updates (automated server-count spike is the key inflection point); npm download velocity (`@modelcontextprotocol/sdk` installs measure real adoption); enterprise adoptions (Fortune 500 shipping an MCP server = institutional lock-in); protocol spec versions (breaking changes / new capabilities); non-Anthropic framework integrations (LangChain, AutoGen, LlamaIndex, CrewAI adopting MCP = winning the inter-framework standard war).

**Output feeds:** `article` (infrastructure/agent-tools articles) · `topic-momentum` (dedicated weekly MCP data) · `digest` (agent-infra section) · x402 branch (payments + tool-calls = full agentic infra).

---

## Branch E — Agent Displacement (`${var}` = `agent-displacement`)

### E.1 Load context

Read:
- `memory/MEMORY.md` — current state + any prior displacement signals logged
- `memory/topics/agent-displacement.md` — if it exists, extract baseline: last-known companies, roles, displacement scale

If `memory/topics/agent-displacement.md` doesn't exist, create it with this seed and continue:

```markdown
# Agent Displacement Tracker

*Last run: never*

## Known Displacement Events (baseline)
- Klarna (2024): replaced 700 customer support agents with AI. Support resolution time 2min vs 11min human avg.
- Duolingo (2024): cut ~10% of contractors, cited AI content generation replacing human translators.
- Salesforce (2025): froze non-essential hiring across sales/support, citing AI agent handle rate.
- IBM (2024): paused hiring ~7,800 back-office roles that AI could replace within 5 years.

## Roles Under Pressure (running list)
- Customer support / tier-1 help desk
- Content translation and localization
- Data entry and document processing
- Code review (junior-level)
- Legal document review (discovery)

## Displacement Scale Estimates
- 2024: ~2M white-collar roles affected (McKinsey / Goldman estimates)
- Accelerating in: SaaS customer success, financial services ops, insurance claims

## Signal Log
- Baseline: seeded from public reports.
```

### E.2 Search for developments from the last 7 days

Run these WebSearches (replace year with current year as needed):

```
WebSearch: "AI agent layoffs replaced workers ${year} site:techcrunch.com OR site:theverge.com OR site:wsj.com OR site:bloomberg.com"
WebSearch: "AI replaced human jobs headcount reduction ${year}"
WebSearch: "agentic AI workforce automation company announcement ${year}"
WebSearch: "Klarna Duolingo Salesforce IBM AI agent headcount ${year}"
WebSearch: "AI agent customer support white collar displacement ${year}"
WebSearch: "OpenAI Anthropic agent enterprise automation replacing workers ${year}"
```

Keep only items from the last 7 days. Discard think pieces and opinion — keep: company announcements naming specific roles cut; headcount figures cited alongside AI deployment; research reports with named verticals + quantified displacement; earnings-call quotes attributing headcount reduction to AI agents.

### E.3 Fetch deeper context on high-signal items

For any company announcement, use WebFetch to pull the source article or press release. Extract: number of roles affected; role type / seniority level; AI system named (if any); outcome comparison (before/after metrics if given).

If WebFetch fails, fall back to `WebSearch: "[company name] AI agent headcount ${year}"`.

### E.4 Filter and score signals

| Criterion | Points |
|-----------|--------|
| Named company + named role + headcount number | +5 |
| Before/after metric (resolution rate, cost, speed) | +3 |
| Industry first (first displacement in a new vertical) | +4 |
| Fortune 500 / public company (verifiable, credible) | +3 |
| Research report with quantified estimates | +2 |
| Vague "AI productivity" with no specifics | -3 (discard) |

Keep top 4-5 items. Deduplicate against the baseline in `memory/topics/agent-displacement.md` — only count if new or a meaningful update to an existing event.

### E.5 Categorize by role type

Assign each signal to a displacement category:
- **Tier-1 ops** — customer support, data entry, help desk, document processing
- **Creative / content** — translation, copywriting, design, video production
- **Code / dev** — junior devs, QA, code review, test writing
- **Finance / legal** — document review, compliance checking, financial analysis
- **Sales / success** — SDRs, customer success, outbound prospecting
- **Management** — middle management coordination, project tracking
- **Other** — anything that doesn't fit the above

### E.6 Thesis check

In one sentence:
> **Thesis check:** agent displacement [accelerating / holding / decelerating] — [one concrete data point].

Criteria:
- **Accelerating** — new vertical breached this week, or headcount numbers up >10% vs last known baseline, or major company announced AI-first hiring freeze
- **Holding** — consistent signals in same verticals, no major new breaches
- **Decelerating** — fewer signals than typical, company reversals or rehiring mentioned

### E.7 Update `memory/topics/agent-displacement.md`

Rewrite: `*Last run: ${today}*`; append new events to `Known Displacement Events` (keep all, don't prune — historical); update `Roles Under Pressure` if a new role type emerged; update `Displacement Scale Estimates` if new research gives better numbers; append entry to `Signal Log`.

Keep file under ~200 lines. If it grows beyond that, consolidate older signal-log entries into a single "Prior signals (archived)" bullet.

### E.8 Notify

Write to `.pending-notify-temp/agent-displacement-${today}.md`, then:
```bash
mkdir -p .pending-notify-temp
./notify -f .pending-notify-temp/agent-displacement-${today}.md
```

Format:
```
agent displacement — ${today}

[thesis check in one line: accelerating/holding/decelerating + why]

[top development — company, role, number if available]
[second development]
[third development if notable]
[fourth if it breaks a new vertical]

roles affected this week: [comma-separated categories]
```

Keep under 800 chars. Match the operator's voice if soul files exist; otherwise neutral and concrete.

**Skip notification if fewer than 2 new signals found this week.** Log `AGENT_DISPLACEMENT_SKIP: insufficient signal (<2 items)` instead.

### E.9 Log

Append under the single `### x402-monitor` heading (see **Log**), branch `agent-displacement`:

```markdown
- **Branch:** agent-displacement
- **Signals found:** N (N new vs baseline)
- **Top item:** [company/role/number in one line]
- **Thesis check:** [accelerating/holding/decelerating]
- **Categories touched:** [comma-separated]
- **Updated:** memory/topics/agent-displacement.md
- **Notification:** sent / skipped
- AGENT_DISPLACEMENT_OK
```

**Output feeds:** `article` (source `memory/topics/agent-displacement.md` for "agent substitution" angle pieces) · `weekly-newsletter` / `digest` ("what's moving" section) · `paper-pick` (displacement research papers flagged for deeper coverage).

---

## Log

All branches append to `memory/logs/${today}.md` under a single heading so the health loop parses one shape:

```markdown
### x402-monitor
```

Under that heading, write the block from the branch that ran (its `- **Branch:** <name>` discriminator line first, then its fields and status code, exactly as specified in each branch's log step above). One branch runs per invocation, so only one block is appended.

## Required Env Vars

None. Uses the `gh` CLI (GITHUB_TOKEN via workflow — Branches A and D), WebFetch, and WebSearch. No additional auth needed.

## Sandbox Note

- `gh search repos` / `gh api` use the gh CLI — handles auth internally, no env-var expansion in headers (Branches A, D).
- npm API, PyPI stats, GitHub API fallbacks, `app.rwa.xyz`, pricing/docs pages: use **WebFetch** (not curl — sandbox may block outbound). WebFetch bypasses the sandbox network gate.
- WebSearch: built-in tool, always available (all branches).
- Do NOT use curl for external APIs — the sandbox blocks outbound network. WebFetch or WebSearch are the paths.
- No prefetch/postprocess scripts needed.
