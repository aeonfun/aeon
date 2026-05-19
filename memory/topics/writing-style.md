# Aeon Writing Style
*Source of truth for prose output across all Aeon skills.*
*Lives at: `memory/topics/writing-style.md`*

This document defines the voice and format rules every prose-producing skill applies. The market data engine produces signal; this guide makes sure the signal lands when written.

When in doubt, follow the rules in this document literally. Each rule exists because output without it pattern-matched to a wall of text in production.

---

## Philosophy

We are writing for an operator who reads a daily brief in 2 minutes and needs the signal to land in 20 seconds. The content is dense by necessity — five skills' worth of analysis condensed into one read. Compression is non-negotiable; so is scannability.

Two failure modes are equally bad:

1. **Wall-of-text** — dense paragraphs the eye can't navigate. Signal gets buried in connective tissue.
2. **Data dump** — facts listed without interpretation. Reader does parsing work the writer should have done.

We optimize against both. The goal is **dense but scannable, interpreted but specific.** Every sentence should do at least one of: state a fact with a precise number, deliver an interpretation, or commit to an action.

---

## Rule 1 — Punctuation discipline

Punctuation overload is the single biggest reason output reads as a wall. Each mark gets one job.

### Em-dash (—)

**One allowed job: a genuine aside that interrupts the main thought of the sentence.**

The test: remove the em-dash and everything after it (until the next em-dash or period). Does the sentence still complete? If yes, the em-dash was an aside — keep it. If no, it was a connector — break into two sentences.

```
✓ "BTC bled 2.2% — the kind of move that breaks support."
   (Remove "— the kind of move that breaks support." → "BTC bled 2.2%." Still complete.)

✗ "BTC bled 2.2% — risk-off conditions intensified."
   (Remove the aside → "BTC bled 2.2%." Still complete, BUT the second half was a separate thought, not an aside. Should be two sentences.)
```

**Banned em-dash uses:**
- As "and also" → use period
- As "which means" → use period or "—" with a real aside structure
- As "supporting evidence" → use period; let the next sentence do the support
- As a soft connector between two complete thoughts → use period

**One em-dash per sentence maximum.** Multiple em-dashes in a sentence indicate the sentence is doing too much.

### Semicolon (;)

**Banned in body prose.** No exceptions.

If two thoughts are related enough for a semicolon, they should be two sentences. If they're unrelated enough to need separation, they belong on separate lines or in separate paragraphs.

```
✗ "thin float plus leveraged perps make sell-the-bounce squeezes sharp; reversals come both ways"

✓ "Thin float plus leveraged perps. Sell-the-bounce squeezes go sharp both ways."
```

The only place semicolons survive: inside parenthetical lists where commas would be ambiguous (e.g. "vest schedule (Mar 4 cliff; Sept treasury cliff; quarterly thereafter)"). Rare.

### Parentheses

**One level deep, maximum.** No nested parens.

**One parenthetical per sentence, maximum.** If a sentence has two parentheticals, it's two sentences.

Parentheticals are for context that's optional to the main read — quantification, source citation, brief clarification. If the content inside the parens is essential, take it out of the parens and make it part of the main sentence.

```
✗ "BTC at $76.4K (-2.2% 24h, -6.1% 7d, failing to hold the $77K level (which was support since May 12))"

✓ "BTC at $76.4K. -2.2% 24h, -6.1% 7d. Failed to hold $77K support."
```

---

## Rule 2 — Sentence rules

### One conclusion per sentence

If a sentence has "and X" or "but Y," check whether X or Y deserves its own sentence. Almost always: yes.

```
✗ "Funding is near-flat across majors and OI is not building on the bid."

✓ "Funding near-flat across majors. OI not building on the bid."
```

The "and" was lying about the relationship. These are two independent observations.

### Lead with the interpretive verb

The first verb of the sentence tells the reader what the data means, not what the data is. Strong interpretive verbs do most of the work.

**Preferred verbs** (use specific ones from this list whenever possible):

- *Positioning verbs:* absorbing, building, positioning, crowding, accumulating, distributing, coiling, compressing
- *Action verbs:* failing, holding, breaking, squeezing, capitulating, flushing, bouncing, ripping, bleeding
- *Flow verbs:* rotating, draining, lifting, bidding, offering, fading, riding
- *Structural verbs:* cascading, threading, manufacturing, reinforcing, breaking down

```
✗ "BTC was down 2.2% on the day."
   (No interpretation. Reader has to decide if -2.2% is meaningful.)

✓ "BTC bled 2.2% on the day."
   (The verb tells you this is a meaningful red day, not a wiggle.)

✓ "BTC failed to hold $77K — Strategy's $2B bid couldn't catch it."
   (The verb tells you support broke; the aside tells you why it matters.)
```

**Banned generic verbs** (replace with specifics):
- `is` / `was` (when used as the main verb describing market data)
- `moved` / `moving`
- `went up` / `went down`
- `did X` (where X is a behavior)
- `is trading at` → just state the price

### Stand-alone sentence test

Cover the previous sentence with your thumb. Can the current sentence be understood?

If the current sentence starts with "this," "that," "those," "the move," "the bid," "the setup" referring to the prior sentence — restructure. Each sentence should read complete in isolation.

```
✗ "BTC failed $77K. The bid couldn't catch it — Strategy's $2B disappeared into the offer."
   (Second sentence requires the first. "The bid" needs context.)

✓ "BTC failed $77K. Strategy's $2B bid couldn't catch it."
   (Each sentence stands alone.)
```

### Quantification leads, interpretation follows (in lists)

When listing data points, the number comes first. The interpretation comes after the number, not before it.

```
✗ "high turnover at vol/mcap 0.27"

✓ "vol/mcap 0.27 — high turnover"
   (Number visible at start of line; interpretation as aside.)
```

This is reversed when the *interpretation* is the main read and the number is supporting (typical for thesis lines):

```
✓ "Real money positioning into the sector lead. OI +18% 7d, basis stable, top L/S rising."
   (Interpretation is the main read; numbers support.)
```

---

## Rule 3 — Paragraph rules

### Maximum 3 sentences per paragraph

Hard cap. If a paragraph has 4+ sentences, it has 2+ ideas. Split it.

### One idea per paragraph

A paragraph is a single thought, supported. If you're switching from price action to market structure to narrative, that's three paragraphs.

```
✗ "BTC at $76.4K, -2.2% 24h, -6.1% 7d. Failed to hold $77K and Strategy's $2B bid couldn't catch it. Breadth 3-4/20 green and F&G at 28 means risk-off conditions are entrenched. RWA narrative still rated RIDE."

✓ "BTC at $76.4K. -2.2% 24h, -6.1% 7d. Failed to hold $77K — Strategy's $2B bid couldn't catch it.

Breadth 3-4/20 green. F&G at 28. Risk-off entrenched.

RWA narrative still rated RIDE — the one live read on a red board."
```

Three paragraphs, three ideas: price action, market structure, narrative read. Each holds together; visual rhythm separates them.

### Blank lines between paragraphs

The blank line IS the structural marker. Without it, paragraphs blur. With it, the reader's eye finds the next idea instantly.

Every paragraph break = blank line. Non-negotiable.

---

## Rule 4 — Layout

### Section sub-headers

Within a setup block or detail section, use sub-headers like `Perps · CATALYST-BREAKOUT` or `Catalyst` to introduce each block. The sub-header is on its own line, no colon at the end.

```
✗ "perps: CATALYST-BREAKOUT, OI +18%, funding +0.02%, basis stable"

✓ "Perps · CATALYST-BREAKOUT
    OI +18% 7d, funding +0.02%/8h, basis stable."
```

The `·` (middle dot) separates the label from the value/tag in headers.

### Indentation for detail blocks

When a setup or item has multiple detail sections (perps / narrative / context / enrichment / thesis), each detail block is indented two spaces below its sub-header. The sub-header itself is flush left within its parent context.

```
HIGH CONVICTION

BSB · long breakout, trail tight

  Perps · CATALYST-BREAKOUT
    +20.8% 24h, vol 3.9x average, OI +11.6%, taker buy 51%.
    Only non-NEUTRAL print in the scan today.

  Narrative · RWA / tokenized capital markets
    Mindshare 5/5, RIDE call from narrative-tracker.

  ...
```

### Blank lines between detail blocks

Within a setup block, blank lines between detail sections. Within a detail section, sentences run on the same indentation level but each starts a new line.

### Lists for 3+ parallel items

When listing 3 or more items of the same kind (watchlist tickers, narrative phases, sector members), use a bulleted or dashed list. Each item on its own line.

```
✗ "Watchlist: HYPE (BHYP ETF catalyst), BCH (capitulation watch), TAO (compute narrative RISING)"

✓ "Watchlist (no quant confirmation)
    HYPE — BHYP ETF catalyst
    BCH — capitulation watch
    TAO — compute narrative RISING"
```

For 2 items, inline is fine. For 3+, list them.

### Locked global format rules (carried over from spec)

- **No asterisks anywhere.** Plain text only. No `*bold*` or `**bold**`.
- **Dot separator (`·`)** for inline metadata in titles and asset lines.
- **CAPS section headers** for major divisions (HIGH CONVICTION, MARKET SENTIMENT, WATCHLIST).
- **`→` arrow** prefixes the actionable thesis line at the bottom of a setup. Used sparingly — never as a connector inside prose.
- **`★`** marks repeat appearances (e.g. asset in same regime ≥3 days).
- **Status markers (`✓ ✗ ⚠`)** used only in `daily-ops-review`.

---

## Rule 5 — Voice

### Active voice default

Subject does something to object. Passive voice ("was bid," "is being absorbed") gets rewritten as active.

```
✗ "Leverage is being absorbed by majors."

✓ "Majors absorbing leverage."
```

### Confidence without hedging

If the signal is high-conviction, say so directly. If the signal is genuinely uncertain, say *that* directly. Banned: weasel language that hedges without honesty.

```
✗ "BTC could potentially be entering a distribution phase."
✗ "There appears to be some indication of crowding."
✗ "The data may suggest that longs are positioning."

✓ "BTC distributing. Funding extreme, OI peaked, breadth rolling."
✓ "Crowding signal mixed — funding extreme but top L/S not following. Low conviction."
✓ "Longs positioning. Top L/S up 0.4 over 7d, basis turning positive."
```

When uncertainty is genuine, use specific confidence language:
- "Low conviction" / "Medium conviction" / "High conviction"
- "Mixed signals — X is positive but Y is contradicting"
- "Watching for confirmation"
- "Pre-positioning visible, not yet confirmed by price"

Never use generic hedges: "could," "may," "might," "appears," "seems," "suggests."

### Commit to the action

Thesis lines and bias statements take a position. They don't summarize what the data showed; they tell the reader what to do.

```
✗ "Mixed signals on the BSB setup, worth monitoring."

✓ "BSB · long breakout, trail tight."
✓ "Fade BSB on the next failure. Thin float makes the reversal sharp."
✓ "Pass. Confluence weak, watch for next print."
```

---

## Rule 6 — Vocabulary

### Prefer specific over generic

When describing market behavior, choose the most specific verb available.

| Generic | Specific options |
|---|---|
| moved up | ripped, lifted, broke out, squeezed, ground higher |
| moved down | bled, flushed, capitulated, faded, drained |
| is trading | (just state the price) |
| is positioned | crowding, positioning, building, accumulating |
| went sideways | coiling, compressing, ranging, basing |
| had a big day | ripped X%, bled X%, flushed X% |

### Domain-precise terminology

Use the most precise term available from the trading domain. Generic terms read as outsider language.

| Generic | Precise |
|---|---|
| big sell pressure | offer-heavy, distribution, taker sell dominant |
| big buy pressure | bid-heavy, accumulation, taker buy dominant |
| no momentum | flat, NEUTRAL, no flow, range-bound |
| trend continuation | MOMENTUM, continuation setup, trend intact |
| reversal | mean-reversion, fade setup, squeeze, capitulation |
| support broke | failed support, rejected, broke down |

### Numbers are part of vocabulary

Quantify whenever you can. "Bleeding" is good; "bleeding 2.2%" is better. "Crowding" is good; "crowding at funding +0.14%/8h" is better.

When a precise number isn't available, use a comparative ("3.9x average volume") or a band ("funding in the +0.08-0.12% range"). Never settle for vague ("elevated funding").

---

## Worked Rewrites

These are the real outputs from production, rewritten against this style guide. Use them as patterns.

### Daily Token Call

**Before:**

```
Daily Token Call · 2026-05-18
BSB · HIGH · 9/10
$0.6954 (+18.2% 24h, +36.0% 7d), mcap $155m, vol $42m, vol/mcap 0.27
Signals: high turnover (vol/mcap 0.27), both 24h and 7d up double digits, strongly outpacing a red BTC/ETH 7d tape — no trending-list or DEX cross-confirm
Catalyst: RWA / tokenized-capital-markets narrative drawing bids; post-airdrop accumulation since the May 4 claim-window close, with Binance and Aster perp listings deepening the book
Risk: young token — TGE was only ~10 weeks ago (Mar 4) and it sits well below its May 4 ATH; thin float plus leveraged perps make sell-the-bounce squeezes sharp in both directions
Dedup check: first time in 7d (yesterday TRAC, prior KAIA)
not financial advice — pattern-matching only
```

**After:**

```
Daily Token Call · 2026-05-18

BSB · HIGH · 9/10

$0.6954. +18.2% 24h, +36.0% 7d.
Mcap $155m, vol $42m, vol/mcap 0.27.

Signals
  Vol/mcap 0.27 — high turnover.
  Both 24h and 7d up double digits.
  Outpacing a red BTC/ETH 7d tape.
  No trending-list or DEX cross-confirm.

Catalyst
  RWA / tokenized-capital-markets narrative drawing bids.
  Post-airdrop accumulation since the May-4 claim-window close.
  Binance and Aster perp listings deepening the book.

Risk
  Young token. TGE only ~10 weeks ago (Mar 4).
  Sitting well below the May-4 ATH.
  Thin float plus leveraged perps. Sell-the-bounce squeezes go sharp both ways.

Dedup check · first time in 7d (yesterday TRAC, prior KAIA).

not financial advice — pattern-matching only
```

### Morning Macro

**Before:**

```
Market Morning · 2026-05-18
risk-off, conviction high. BTC $76.4K, -2.2% 24h and -6.1% 7d, failing to hold $77K — Strategy's $2B bid couldn't catch it and ~$600M got liquidated. Breadth is 3-4/20 green, F&G 28 (Fear, flat from 27), DEX vol $3.97B and -30% on the week. BTC dominance 58.2% — no rotation into alts, just a broad bleed. RWA / perp-DEX is the one narrative still rated RIDE through the red tape.

Cross-domain: AIXBT threads it Iran → oil → 10Y at 4.6% → BTC below $77K. The tell is Strategy's $2B buy failing to hold the line — the reflexivity engine that defended every prior dip is broken at this price. Goldman rotating out of SOL/XRP ETFs into HYPE is manufactured institutional legitimacy cascading through the allocator stack, and RWA rails keep building counter-cyclically against all of it.

Today: action is in #perps-brief — 1 HIGH CONVICTION setup, BSB long breakout (+20.8% 24h, vol 3.9x, OI +11.6%). Clean RWA confluence: perps quant flag + narrative-tracker RWA RIDE + AIXBT's counter-cyclical RWA-rails call all point the same way — the only live trade against a quiet, risk-off board. Watchlist, no quant confirmation: HYPE (BHYP ETF catalyst), BCH (capitulation watch), TAO (compute narrative RISING).
```

**After:**

```
Market Morning · 2026-05-18

Risk-off, high conviction.

BTC at $76.4K. -2.2% 24h, -6.1% 7d. Failed to hold $77K — Strategy's $2B bid couldn't catch it, ~$600M liquidated.

Breadth 3-4/20 green. F&G at 28 (Fear, flat from 27). DEX vol -30% on the week. BTC dominance 58.2% — no rotation into alts, just a broad bleed.

RWA and perp-DEX still RIDE through the red tape. The one live narrative.

Cross-domain

AIXBT threads it: Iran → oil → 10Y at 4.6% → BTC below $77K.

The tell is Strategy's $2B buy failing to hold the line. The reflexivity engine that defended every prior dip is broken at this price.

Goldman rotating out of SOL/XRP ETFs into HYPE — manufactured institutional legitimacy cascading through the allocator stack.

RWA rails keep building counter-cyclically against all of it.

Today

Action is in #perps-brief — 1 HIGH CONVICTION setup.

BSB · long breakout. +20.8% 24h, vol 3.9x, OI +11.6%.
Clean RWA confluence: perps quant flag + narrative-tracker RWA RIDE + AIXBT's counter-cyclical RWA-rails call all point the same way.
The only live trade against a quiet, risk-off board.

Watchlist (no quant confirmation)
  HYPE — BHYP ETF catalyst
  BCH — capitulation watch
  TAO — compute narrative RISING
```

### Perps Brief HIGH CONVICTION block

**Before:**

```
BSB · long breakout w/ trailing stop
  perps: CATALYST-BREAKOUT (+20.8% 24h, vol 3.9x, OI +11.6% 24h, taker buy 51%) — only non-NEUTRAL print in the scan
  narrative: RWA / tokenized capital markets RISING, narrative-tracker 5/5 RIDE
  context: risk-off board (3/20 green) but BSB +36% 7d — idiosyncratic relative strength, not beta
  enrichment: exchange-listings catalyst (Binance Alpha + Aster perps deepening the book); no near-term unlock — multi-year cliffs off the Mar-4 TGE, treasury cliff ~Sept; 65% below the May-4 ATH so room overhead; token-call HIGH 9/10 cross-confirm
  → RWA sector RIDE + quant breakout flag + clean unlock calendar align — ride it but trail tight; thin float makes the reversal sharp
```

**After:**

```
BSB · long breakout, trail tight

  Perps · CATALYST-BREAKOUT
    +20.8% 24h, vol 3.9x average, OI +11.6%, taker buy 51%.
    Only non-NEUTRAL print in the scan today.

  Narrative · RWA / tokenized capital markets
    Mindshare 5/5, RIDE call from narrative-tracker.

  Context · idiosyncratic strength
    +36% 7d against a 3/20-green tape. Its own catalyst, its own bid. Not beta.

  Enrichment
    Binance Alpha and Aster perps both listing — book deepening.
    No near-term unlock. Multi-year cliffs off the Mar-4 TGE, treasury cliff September.
    Sitting 65% below the May-4 ATH, so room overhead.
    Token-call cross-confirms at 9/10.

  Thesis
    RWA RIDE + quant breakout + clean unlock calendar all align.
    Trail tight. Thin float makes reversals sharp both ways.
```

### Perps Brief WATCHLIST block

**Before:**

```
HYPE · narrative + ETF catalyst, but no quant read this snapshot
  risk: perp-DEX RISING and Bitwise BHYP ETF live May 15, but perps-scan dropped HYPE for missing OI/funding history — structure unconfirmed, and the +16% ETF-day move is already extended
```

**After:**

```
HYPE · narrative + ETF catalyst, no quant read

  Risk · structure unconfirmed
    Perp-DEX RISING. Bitwise BHYP ETF live May 15.
    Perps-scan dropped HYPE for missing OI/funding history.
    +16% ETF-day move already extended.
```

### Ops Review

**Before:**

```
Ops Review · 2026-05-18 · duration n/a
Step 1 — Data
✓ market-context-refresh · regime risk-off (high), 5/5 sources ok
✓ aixbt-pulse · bridge call generated (Iran→oil→10Y→BTC), 6 NEW items
✓ narrative-tracker · 5 narratives (1 NEW: Privacy/ZK)
⚠ perps-scan · ran clean — QUIET, 1 CATALYST-BREAKOUT (BSB) — but artifact is the Summary blob, not the v2 locked format
✓ monitor-runners · MIXED verdict, 1 DEEP-LIQ (PITCH +1009%)
✓ token-movers · 197 assets post-filter, TRAC/BSB breakout-tagged
✓ token-call · BSB · HIGH 9/10
Step 2 — Briefs
✓ perps-brief · 1 HIGH CONVICTION (BSB), 3 WATCHLIST
Step 3 — Macro
✓ morning-macro · published
Chain ran complete — all 9 artifacts fresh (2026-05-18). 8 ✓, 1 ⚠, 0 ✗.
All data sources ok — no source failed this run.
Issue filed: ISS-003 (medium, output-format) — perps-scan wrote its assistant Summary blob into .outputs/perps-scan.md instead of the v2 locked format. Same bug narrative-tracker hit earlier today (fixed via re-run); now recurred in perps-scan. Downstream perps-brief still consumed the verdict, so impact is contained.
```

**After:**

```
Ops Review · 2026-05-18 · duration n/a

Step 1 — Data
  ✓ market-context-refresh · regime risk-off (high), 5/5 sources ok
  ✓ aixbt-pulse · bridge call generated (Iran → oil → 10Y → BTC), 6 NEW items
  ✓ narrative-tracker · 5 narratives, 1 NEW (Privacy/ZK)
  ⚠ perps-scan · ran clean, QUIET verdict, 1 CATALYST-BREAKOUT (BSB)
       Artifact wrote in Summary-blob format instead of v2 locked format.
  ✓ monitor-runners · MIXED verdict, 1 DEEP-LIQ (PITCH +1009%)
  ✓ token-movers · 197 assets post-filter, TRAC/BSB breakout-tagged
  ✓ token-call · BSB · HIGH 9/10

Step 2 — Briefs
  ✓ perps-brief · 1 HIGH CONVICTION (BSB), 3 WATCHLIST

Step 3 — Macro
  ✓ morning-macro · published

Chain ran complete — all 9 artifacts fresh (2026-05-18). 8 ✓, 1 ⚠, 0 ✗.
All data sources ok.

Issues filed
  ISS-003 (medium, output-format)
    perps-scan wrote its assistant Summary blob into .outputs/perps-scan.md
    instead of the v2 locked format.
    Same bug narrative-tracker hit earlier today, fixed via re-run, now recurred in perps-scan.
    Downstream perps-brief still consumed the verdict — impact contained.
```

---

## How to apply this

Every SKILL.md that produces prose output adds this line near the top of its prompt:

> Apply `memory/topics/writing-style.md` voice and format rules to all prose output. Specifically: lead sentences with interpretive verbs; no semicolons in body text; em-dash only for genuine asides; blank lines between paragraphs; sub-headers with `·` separator for detail blocks; one idea per paragraph; commit to actions in thesis lines.

The rules above apply uniformly. Skill-specific format anchors (regime headers, status markers, etc.) live in each SKILL.md, but the *prose voice* is governed by this file.

When the style produces awkward output for a specific skill, revise the worked rewrite for that skill in this document — not the skill itself. This file is the single source of truth.

---

*End of writing-style.md*
