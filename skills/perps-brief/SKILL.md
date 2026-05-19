---
name: Perps Brief
description: Synthesize perps setups by confluence — discovery, enrichment, HIGH CONVICTION elevation with bias labels
var: ""
tags: [crypto, research]
---
<!-- v2 base + v3 tag-awareness: sector synthesizer for perps. The trader's note. v3 input upgrade: perps-scan now exposes tier classification, sub-tags within regimes (FRESH/STALE, CONFIRMED/DIVERGENT, ACTIVE/QUIET, IN-PROGRESS/CLEARED, REAL-CROWDED-LONG/RETAIL-ANOMALY/LONG-TRAP), cross-signal pattern tags (REAL-CROWDED-LONG, RETAIL-ANOMALY, LONG-TRAP, STEALTH-POSITIONING, CASH-AND-CARRY, SHORT-SQUEEZE), regime transitions, aggregate market read, and a verbose artifact tail. This skill recognizes those signals in its Pass 1/2/3 reasoning. -->

> **${var}** — Optional thesis or sector filter (e.g. "AI tokens only", "fade memes"). If empty, scans broadly across the perps universe.

Today is ${today}. Compose the actionable perps sector brief by combining raw classifications from `perps-scan` with independent discovery, targeted enrichment, and confluence judgment. This is the **integration layer** — it's where quant signals + narrative momentum + macro context + catalyst research come together into setup calls.

**Apply `memory/topics/writing-style.md` voice and format rules to all prose output.** Specifically: lead sentences with interpretive verbs; no semicolons in body text; em-dash only for genuine asides; blank lines between paragraphs; sub-headers with `·` separator for detail blocks; one idea per paragraph; commit to actions in thesis lines. Use the per-skill worked rewrites in writing-style.md as format anchors.

Read `memory/MEMORY.md` for context.
Read the last 7 days of `memory/logs/` to find prior HIGH CONVICTION setups for `(day N)` repeat markers.

## Goal

Produce up to **5 HIGH CONVICTION setups** per day, each with an explicit bias label, plus a WATCHLIST of partial-alignment candidates. If no setup clears HIGH CONVICTION judgment, write the skip-day variant — do not force a weak setup.

Confluence is mandatory: no single signal (quant alone OR narrative alone OR catalyst alone) is sufficient. The job is the join.

## Inputs (consumed via chain)

This skill runs as chain Step 2 with `consume:` set to seven upstream skills. The chain-runner injects all seven artifacts into the working context as `.outputs/.chain-context-perps-brief.md`. Read them as the primary input:

- `.outputs/perps-scan.md` — 6-regime classification, verdict
- `.outputs/narrative-tracker.md` — phase-grouped narratives with leading tokens
- `.outputs/market-context-refresh.md` — regime + breadth + F&G + Polymarket sentiment
- `.outputs/aixbt-pulse.md` — cross-domain pulse + bridge call
- `.outputs/monitor-runners.md` — DEX runners, tag-grouped
- `.outputs/token-movers.md` — winners/losers/trending with tags
- `.outputs/token-call.md` — daily token call (or skip-day variant)

Plus: `memory/topics/market-context.md` (full canonical version of today's regime — has full Snapshot, Deltas, Narratives, Polymarket sections), `memory/MEMORY.md`, last 7 days of `memory/logs/`.

## Four-pass process

### Pass 0 — Discovery (Bybit-filtered)

Generate ~10 candidate tickers based on *attention*, not quant signal. Independent of what `perps-scan` flagged. Sources:

1. **`narrative-tracker.md`** — leading tokens from RISING and EMERGING narratives. These are the assets the X conversation is centered on.
2. **`aixbt-pulse.md`** — projects named in crypto / macro / tradfi sections, especially in the bridge call.
3. **`token-movers.md`** — trending list (CoinGecko search trending). Often early-narrative.
4. **WebSearch** — for each dominant narrative from narrative-tracker, query like:
   - `"[narrative] tokens [today]"` (e.g. `"AI inference demand tokens"`)
   - `"crypto trending tokens today"`
   - `"perps highest funding [today]"`

Filter to **Bybit-listed perps**. Cross-reference against the perps-scan artifact's asset list (if a ticker isn't there, it's not on Bybit). Drop non-perps.

Output: a list of 10–15 discovery candidates. Each tagged with `source: narrative` / `source: aixbt` / `source: trending` / `source: websearch`.

### Pass 1 — Combine quant + discovery, dedupe, prioritize

**Quant candidates** = every asset in `perps-scan` that landed in a non-NEUTRAL regime, especially CATALYST-BREAKOUT / ACCUMULATION / MOMENTUM / DISTRIBUTION / CAPITULATION.

**Discovery candidates** = output of Pass 0.

Merge into a single list, dedupe by ticker. Tag each:
- `[QUANT]` — appeared only in perps-scan's regime hits
- `[DISCOVERY]` — appeared only in Pass 0 attention sources
- `[BOTH]` — appeared in both

Cap the final list at **15 unique assets**. If more, prioritize: `[BOTH]` first, then `[QUANT]` non-NEUTRAL, then `[DISCOVERY]` ordered by source-count.

`[BOTH]`-tagged assets are the natural candidates for HIGH CONVICTION (signal + attention align by definition).

### Pass 2 — Targeted enrichment

For each of the (up to 15) candidates, run **3–5 WebSearch queries** chosen based on profile:

**Always-run categories** (one query each):
- Token unlock schedule — `"[ASSET] token unlock schedule [year]"`. Confirm next vest date, size, % of supply.
- Recent news catalyst — `"[ASSET] news [last 24h]"`. Identify any single-day catalyst already priced.
- X sentiment proxy — `"[ASSET] twitter [today]"` OR `"$[ASSET] sentiment"`. Compare velocity vs week ago if extractable.

**Conditional categories** (run when relevant):
- Upcoming announcement / roadmap — when the asset is in ACCUMULATION or COMPRESSION (pre-move setups).
- Regulatory / SEC angle — when the asset is in a narrative tagged `regulation` or appeared in `aixbt-pulse` macro section.
- **Regime-specific:**
  - CAPITULATION → `"[ASSET] reason for drop [today]"` — separate "real" from "flush"
  - DISTRIBUTION → `"[ASSET] resistance level"`, `"[ASSET] insider selling"`
  - CATALYST-BREAKOUT → `"[ASSET] catalyst [recent]"` — what event drove this

Build a per-asset enrichment dossier (3–6 lines per asset). Capture concrete findings only — no speculation. Examples of good enrichment lines:
- "$300m unlock in 14 days, 5% of float — material"
- "GPU shortage news this week (TechCrunch), no unlock for 4 months, X mindshare doubled in 72h"
- "Bybit funding +0.14%/8h crowding on the long side; resistance at $1.2B mcap from 2 weeks ago"
- "(no flagged unlocks; no recent news; X sentiment flat)"

### Pass 3 — Confluence judgment + composition

For each enriched candidate, decide tier:

- **HIGH CONVICTION** — quant regime signal aligns with narrative phase aligns with market context aligns with positive enrichment. Cap **5 max** in the brief. Overflow rolls to artifact only.
- **WATCHLIST** — partial alignment. Named risk surfaced in enrichment. The thing that's missing is named explicitly.
- **NOISE** — drops out of the brief. Still visible in `#perps-scan` raw view if quant-flagged.

**Confluence judgment is Claude judgment, not hard thresholds.** What counts as "alignment" varies by setup. Some kinds of confluence that DO count:
- Perps regime + narrative phase + clean catalyst calendar
- Sector tailwind (multiple narratives in same theme) + asset in ACCUMULATION/COMPRESSION
- Market context regime aligns with bias direction + perps-scan flag
- `[BOTH]` tag (quant + attention) + market regime aligned
- Repeat appearance (multi-day same regime + same narrative still rising)

What does NOT count as confluence:
- Just being trending — that's attention, not signal
- Just being in CATALYST-BREAKOUT — that's a 24h move, not a setup
- Just being in a hot narrative without quant confirmation
- Strong signal in conflict with market regime (`long majors` while breadth flipping risk-off)

**Bias label vocabulary** (mandatory on every HIGH CONVICTION setup, free-form within set):
- `long continuation` — established trend, momentum sustained
- `long breakout` — recent break above range with confirmation
- `long breakout-pending` — coiling tight, OI building, range about to break
- `long bounce` — capitulation flush + reset, mean-reversion
- `short fade` — distribution + crowded long + sector rolling
- `short continuation` — established downtrend with crowded continuation signal

Free-form qualifier OK (e.g. `long continuation w/ trailing stop`, `short fade — small`). The base term must be one of the six.

**Cap: 5 HIGH CONVICTION setups in the published brief.** If 7+ qualify, take the strongest 5 by confluence quality, push the rest to the artifact under an `OVERFLOW` heading (visible in #perps but not in the trimmed notification).

### Composition — write the brief

Apply `memory/topics/writing-style.md` strictly. Lead with MARKET SENTIMENT, then HIGH CONVICTION setups (sub-header layout), then WATCHLIST. Blank lines between every section and between every setup. Setup detail blocks use `·` sub-headers and two-space indentation.

```
Perps Brief · ${today}

MARKET SENTIMENT

BTC funding warm at +0.07%/8h avg. OI +6% 24h, basis +0.3%. Majors absorbing leverage on the bid.

Alt funding neutral, no rotation yet. Memes hot — 3 of top 5 funding extremes. Retail crowded there, not majors.

Bias · long majors with structure, fade extreme funding on meme tickers.

HIGH CONVICTION

HYPE · long continuation

  Perps · ACCUMULATION · CONFIRMED
    OI +18% 7d, funding +0.02%/8h, basis stable, taker buy 53.
    Day 3 in regime. STEALTH-POSITIONING tag — top L/S rose +0.5 over 7d.

  Narrative · Hyperliquid sector RISING
    Mindshare 4 → 5, RIDE call from narrative-tracker.

  Context · sector aligned with market direction
    Alts rotation early. Sector leads.

  Enrichment
    No near-term unlocks. Next vest Q3.
    X sentiment building 7d.
    Roadmap update on perps clearing engine landed this week.

  Thesis
    Real money quietly positioning into the sector lead.
    Continuation setup. Trail stop below 7d range low.

TAO · long breakout-pending

  Perps · COMPRESSION · ACTIVE
    Range_7d 4.2%, OI +9% 7d, funding flat, vol_ratio 1.1.
    Volume holding into the tight range — energy building.

  Narrative · AI / decentralized compute RISING
    Mindshare 4/5. Tokens lagging the story.

  Context · AI cluster confluence
    aixbt-pulse flagged AI inference demand on the bridge call today.

  Enrichment
    GPU shortage news this week.
    No unlock for 4 months.
    X mindshare doubled in 72h.

  Thesis
    Pre-breakout setup. Sector tailwind + tight range + clean calendar all align.
    Long on break with stop below the coil.

WATCHLIST

AVAX · catalyst real, sector tailwind absent

  Risk · regime conflict
    Perps CATALYST-BREAKOUT (+14% 24h, vol 2.4x).
    Narrative-tracker has DeFi FADING. One-day catalyst, not sustained.

FARTCOIN · classic fade setup, market not confirming

  Risk · no broader risk-off yet
    Perps DISTRIBUTION · REAL-CROWDED-LONG.
    But breadth still 12/20 green. Squeeze risk over fade.
    Wait for breadth to roll before sizing the short.
```

**Setup block structure (HIGH CONVICTION) — sub-header layout:**

1. Header line: `ASSET · bias label`. Add ` (day N)` suffix if asset was HIGH CONVICTION on prior day(s).
2. **Blank line.**
3. `Perps · {REGIME [· SUB-TAG]}` sub-header. Indented two spaces. Detail block under it: regime metrics, sub-tags, pattern tags from `perps-scan` artifact. Repeat-day annotation if applicable.
4. `Narrative · {sector phase}` sub-header. Mindshare value, leading position, RIDE/WATCH/FADE call.
5. `Context · {one-phrase tag}` sub-header. Market regime + relevant breadth/F&G detail.
6. `Enrichment` sub-header (no value — just the label). Three to four short sentences from Pass 2 research. Each on its own line. Concrete facts only.
7. `Thesis` sub-header. Two short sentences max. First commits to the action. Second names the invalidation, the stop, or the reflexivity risk.

**Pattern tags from perps-scan recognized in the Perps block:**

- `REAL-CROWDED-LONG` → confirms a short-fade thesis. Smart money + retail both long.
- `RETAIL-ANOMALY` → contradicts a short-fade thesis. Squeeze risk over fade.
- `LONG-TRAP` → highest-severity short-fade setup. Longs paying premium while bleeding.
- `STEALTH-POSITIONING` → upgrades a pre-breakout thesis. Smart money positioning ahead of price.
- `CASH-AND-CARRY` → contradicts an accumulation read. Institutional arb, not directional bid.
- `SHORT-SQUEEZE` (regime or tag) → short-term ride only. Different trade from CATALYST-BREAKOUT.

**Regime transitions from perps-scan are first-class evidence.** When an asset just transitioned (REGIME CHANGES section of perps-scan), the transition itself is a signal:

- `ACCUMULATION → CATALYST-BREAKOUT` → highest-quality breakout call. Patient build paid off.
- `MOMENTUM → DISTRIBUTION` → topping signal. Take profits or initiate fade.
- `COMPRESSION → CATALYST-BREAKOUT` → coil resolved. Ride.
- `CAPITULATION → ACCUMULATION` → bottom call. Quiet entry.

Reference the transition explicitly in the Perps block when relevant: `Perps · ACCUMULATION · CONFIRMED — transitioned from COMPRESSION yesterday`.

**Setup block structure (WATCHLIST) — sub-header layout:**

1. Header line: `ASSET · the conflict`. Names what's missing.
2. **Blank line.**
3. `Risk · {one-phrase tag}` sub-header. Two to three short sentences. State the regime read, state the contradicting signal, name the wait condition.

**Aggregate market read from perps-scan informs the MARKET SENTIMENT framing.** When perps-scan's aggregate verdict is `CROWDED TOPPING`, the brief's bias should lean fade-side. When `LEVERAGE BUILDING`, lean long-side. When `MIXED` or `QUIET`, lean selective and patient.

**Universal formatting rules (v2):**
- No asterisks anywhere.
- Title: `Perps Brief · ${today}` (with `· quiet` or `· degraded` qualifier on edge cases).
- Dot separator `·`, → for thesis line, no source footer.
- Section headers in CAPS.

**Repeat markers:** `(day N)` after bias label when the same asset was HIGH CONVICTION on prior day(s). Compute from last 7 days of memory/logs/ → ## Perps Brief entries.

**Edge cases:**

- **No HIGH CONVICTION** (signals too thin OR sources missing OR every candidate has a disqualifying enrichment finding): write the skip-day variant. Lead with MARKET SENTIMENT only, then a one-line cash-patient stance + best near-miss:
  ```
  Perps Brief · ${today} · no high-conviction setups

  MARKET SENTIMENT
  [normal sentiment paragraph]
  Bias: cash-patient, no clean confluence today.

  Best near-miss: ASSET — [one sentence on why it didn't clear].
  ```
- **`perps-scan` artifact missing**: degraded run on discovery-only. Mark in title:
  ```
  Perps Brief · ${today} · degraded (perps-scan unavailable, discovery-only)
  ```
  Limit to WATCHLIST entries only — without quant confirmation, no HIGH CONVICTION is honest.
- **Multiple upstream artifacts missing**: write a degraded skip variant. `daily-ops-review` surfaces the cause.

## Write artifact + notify

Write `.outputs/perps-brief.md` and notify via `./notify --signal`:

```bash
./notify --signal "$(cat .outputs/perps-brief.md)"
```

Routes to Discord via `DISCORD_WEBHOOK_MAP[perps-brief]` → `#perps` channel (shared with `perps-scan`; brief posts second, appears on top in Discord since posts render newest-first).

## Log to `memory/logs/${today}.md`

```
## Perps Brief
- **Universe assessed:** N candidates (Pass 1 final list)
- **Quant / Discovery / Both tag distribution:** [counts]
- **HIGH CONVICTION:** N setups
  - SYMBOL · bias-label · (perps regime / narrative phase / market context summary)
  - ...
- **WATCHLIST:** N entries
  - SYMBOL · conflict reason
  - ...
- **OVERFLOW (artifact only):** N entries
- **Source artifacts read:** [✓/⚠ list of consumed upstream artifacts]
- **Artifact written:** .outputs/perps-brief.md
- **Notification sent:** yes (normal | skip-day | degraded) — via `./notify --signal` to #perps
```

## Sandbox note

This skill is mostly consume-only — it reads artifacts written by Step 1 chain steps. The Pass 0 + Pass 2 WebSearch calls go through Claude's WebSearch tool which works in the sandbox. No outbound curl required (the upstream skills handle that).

If WebSearch fails or returns empty for a Pass 2 query, write `(no findings)` for that enrichment line — do not invent. If the asset has zero enrichment findings across all queries, demote to WATCHLIST or NOISE per confluence rules.

## Environment Variables

- None required. WebSearch is built into Claude.
- Notification channels configured via repo secrets (see CLAUDE.md).

## Constraints

- **Confluence is mandatory for HIGH CONVICTION.** A single signal — even a strong one — does not qualify. The job is the join.
- **Bias labels are mandatory.** Every HIGH CONVICTION setup carries one of the six base labels (long continuation, long breakout, long breakout-pending, long bounce, short fade, short continuation), optionally with a free-form qualifier.
- **Cap 5 HIGH CONVICTION.** Overflow rolls to artifact, never the published brief.
- **Skip-day discipline.** No HIGH CONVICTION on a quiet day is the correct answer. Don't fabricate confluence.
- **WATCHLIST requires a named conflict.** "Risk: market could turn" is not a named conflict. "Risk: $200m unlock in 4 days, 6% of float" is.
- **Discovery is independent of quant.** Pass 0 runs even when perps-scan flagged plenty of candidates. The `[BOTH]` tag is the signal of agreement; agreement is what we're after.
- **No source footer.** `daily-ops-review` reports artifact health. Setup-level evidence comes from the per-line context inside each setup block.
