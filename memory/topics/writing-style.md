# Aeon Writing Style v2 — Layout First
*Locked: 2026-05-19*
*Supersedes: previous `writing-style.md` (v1)*
*Source of truth for all prose output across Aeon skills.*

This is the operator-facing style guide for every signal Aeon produces. v1 emphasized prose mechanics (verbs, hedging, sentence rhythm). It was right on those rules but wrong on the load-bearing question. In production, the wall-of-text problem turned out to be **structural, not prosaic**.

v2 inverts the priority. Layout rules are the load-bearing rules. Prose rules are secondary — they govern the sentences inside the structure, not the structure itself.

When v2 conflicts with v1, v2 wins.

---

## Philosophy

The reader is an operator who reads a daily brief in 90 seconds and needs the signal to land in 20. Every signal is dense by necessity. The job of the writing is to make density navigable, not to compress further.

Two failure modes:

1. **Wall-of-text** — dense paragraphs with no visual structure. The eye can't find the next idea.
2. **Worded data dump** — facts listed without commitment. The reader does interpretation work the writer should have done.

v2 fixes the first via layout. v2 fixes the second via mandatory closing lines on every independent unit.

**The core insight:** the structure of the document is the most important writing decision. A well-laid-out wall of bullet points reads faster than well-prosed paragraphs without structure. Once the structure is right, the prose rules from v1 still apply to the sentences within — but they're not the problem the operator is reacting to.

---

## Structural Rules

These are the primary rules. They govern the shape of every output.

### Rule 1 — Visual hierarchy is built from three levels

Every signal output uses exactly three structural elements:

1. **Horizontal dividers (`─────`)** — separate major content shifts. A divider says: "different kind of content is coming."
2. **CAPS sub-headers** — label aspects within the same content type. A CAPS header says: "different angle on the same thing."
3. **Indentation (2 spaces)** — group detail lines under their parent header.

These three elements do all the structural work. No bold, no italics, no asterisks, no other markdown.

### Rule 2 — When to use dividers vs CAPS sub-headers

**Divider** — between sections that answer different questions. In Perps Brief: the sentiment block (about the market), the near-miss (about one asset), the watchlist (about multiple assets) are three different lenses on three different questions. Dividers earn space here.

**CAPS sub-header** — between sub-aspects of one analysis. In Token Call: SIGNALS, CATALYST, RISK, DEDUP all answer one question: "should I take this trade and why." Same content, different angles. CAPS sub-headers carry the separation; dividers would over-segment.

**The test:** if the sections could each stand alone as a complete sub-document, use dividers. If they only make sense together as facets of one larger answer, use CAPS sub-headers.

### Rule 3 — Divider format

```
─────────  LABEL  ─────────
```

Label embedded mid-divider, surrounded by `─` characters. Approximately 9 dashes on each side, fewer if the label is long. Aim for total visual width around 50-60 characters.

The exception is the very first divider directly under the title bar. That one carries no label — it just signals "the document body starts here":

```
Perps Brief · 19 May · No high-conviction setups
─────────────────────────────────────────────────
```

The under-title divider matches the visual width of the title above it (approximate is fine).

### Rule 4 — Indentation conventions

Two-space indent for every level.

- Top-level content (the body of a section): flush left.
- Sub-section content (under a CAPS sub-header): indented 2 spaces.
- Details below an asset header in a list (e.g. inside a watchlist item): indented 2 spaces.

Three levels of indentation maximum. If a structure requires four levels, it's too nested — flatten via dividers or split into separate sections.

### Rule 5 — One sentence per line

Every line within a structured section contains one thought. The line break replaces commas, em-dashes-as-connectors, and "and" / "but" linkages between independent thoughts.

The exception is the closing line of a section (next rule). Closing lines can flow.

```
✗ "OI +42.4% 7d on calm funding, top traders cut their long ratio 0.26 over 7d, and funding flipped negative to -0.029%/8h."

✓ "OI +42.4% 7d on calm funding.
    Top traders cut their long ratio 0.26 over 7d.
    Funding flipped negative to -0.029%/8h."
```

### Rule 6 — Mandatory closing line on every independent unit

Every independent unit ends with a closing line that commits to a position. The convention:

| Closing label | Used in | Format |
|---|---|---|
| `Stance:` | Sentiment/regime blocks | "Stance: cash-patient. [one-line rationale]" |
| `Take:` | Whole-document synthesis (token-call, brief overall) | "Take: [synthesizing read]. [sizing or action context]" |
| `→` | Thesis line on HIGH CONVICTION setups | "→ [committed interpretation]. [trade structure note]" |
| Bare imperative | Watchlist items | "Pass." / "Wait." / "Watch for X." / "Fade on Y." |

Independent units that need closing lines:
- The sentiment/regime block of a brief
- Each HIGH CONVICTION setup
- Each watchlist item
- The whole document (final Take line, optional but recommended)

The closing line is on its own line, preceded by a blank line. It is never indented under its content — it's flush with the asset header above it. The blank line + flush-left position is the visual cue that the close-out is coming.

```
HYPE · OI build not smart-money-confirmed

  Perps WATCH — OI +42.4% 7d, funding flat 7d-avg.
  Top traders cut their long ratio 0.26 over 7d.
  Funding flipped negative to -0.029%/8h.

  Wait for top L/S to turn up before the long.
```

The closing line sits inside the indent of its parent asset block, but it does not get further indented under any sub-header. It belongs to the asset, not to a sub-section.

### Rule 7 — Asset header format

For any list of assets (watchlist, near-miss, runners, regime members):

```
TICKER · qualifier sentence
```

- Ticker first, no asterisks, no special formatting.
- Dot separator (`·`) between ticker and qualifier.
- Qualifier is a one-liner that says what makes this asset interesting (or where it falls short). For HIGH CONVICTION: the bias label. For watchlist: the named conflict. For neutral inclusions: the regime tag.

Examples:
- HIGH CONVICTION: `HYPE · long continuation, trail tight`
- Watchlist: `HYPE · OI build not smart-money-confirmed`
- Near-miss: `HYPE · perp-DEX leader, quant not confirmed`

The qualifier carries the conviction signal so the asset header is self-contained — the reader knows what this row means before reading any details.

### Rule 8 — Data lines: split when comma-separated reads as a wall

Multi-metric data lines that read fine inline:

```
$1.65 · +11.1% 24h · +6.0% 7d
```

Three metrics, dot-separated, reads instantly.

Multi-metric data lines that should split into two lines:

```
$1.65 · +11.1% 24h · +6.0% 7d
mcap $2.13b · vol $283m · vol/mcap 0.13
```

Six metrics in one line is too much. Split into price/performance (one line) and structural (one line).

Rule of thumb: 3 dot-separated items on a line is comfortable; 4 is the upper limit; 5+ split.

---

## Prose Rules (carried from v1, refined)

These govern the sentences inside structured sections. They are secondary to the structural rules — when in conflict, the structure wins. They are not banned, but they are no longer the load-bearing rules.

### Punctuation

- **Em-dash (`—`)** — for genuine asides only. The test: remove the em-dash and what follows; does the sentence stand? If yes, keep the em-dash. If no, it was a connector — use a period and start a new sentence.
- **Semicolons** — banned in body text. If two thoughts belong together, write them as two sentences.
- **Parentheses** — one level deep, one per sentence max. For optional context (quantification, source citation). Not for nested commentary.

### Sentence rules

- **One conclusion per sentence.** Multiple ideas → multiple sentences (and usually multiple lines).
- **Lead with the interpretive verb.** "Bled," "absorbed," "crowded," "positioning," "failed" — verbs that say what the data means, not what it is.
- **Active voice.** Subject does something to object.

### Hedging

- No "could," "may," "might," "appears to," "seems to," "potentially," "perhaps."
- If uncertainty is genuine, use explicit confidence language: "low conviction," "mixed signals — X is positive but Y contradicts," "watching for confirmation."

### Closing lines are allowed rhythm

The rule "one conclusion per sentence" applies inside structured sections. Closing lines (Stance / Take / →) are the place where flowing prose is allowed and welcome — an interpretive sentence can run longer and contain a genuine aside.

```
✓ "Take: high signal across price, narrative, and institutional flow. The catch is rollout execution — sized accordingly, this is a position-for-Q2 trade not a chase."
```

That's two sentences with a genuine em-dash aside. Permitted because it's the synthesizing close-out, not a body line.

### Banned phrases (Claude-tells)

Strike on sight if produced:
- "It's worth noting that..."
- "Looking at the data..."
- "From what we can see..."
- "There appears to be..."
- "Could potentially..."
- "Seems to suggest..."
- "Let me / I should..."
- "On one hand X, on the other hand Y" (when there IS a clear take)

---

## Per-Skill Structural Templates

Below are the locked layouts for every signal output. Skills should produce output matching these templates exactly.

### `morning-macro`

```
Market Morning · DD MMM · regime tagline

[Regime opening — 2-4 lines describing market state. Closes with stance line.]

[Where the bid lives or doesn't — 2-4 lines describing flow and leadership.]

[Stance: cash-patient. (or equivalent closing line)]


─────────  CROSS-DOMAIN  ─────────

[Cross-domain thread 1 — 2-4 lines.]

[Cross-domain thread 2 — 2-4 lines.]

[Cross-domain thread 3 — 2-4 lines.]


─────────  TODAY  ─────────

[Pointer to sector briefs and headline setups — 2-4 lines.]

[Final Take: cash-patient. Better day tomorrow. (or equivalent)]
```

### `token-call`

```
Daily Token Call · DD MMM
──────────────────────────

TICKER · CONVICTION · X/10
price · +X% 24h · +X% 7d
mcap $X · vol $X · vol/mcap X


SIGNALS
  [4-6 short factual lines]

CATALYST
  [3-5 short factual lines, narrative + event-driven evidence]

RISK
  [2-4 short factual lines, named downside risks]

DEDUP
  [1-3 lines, dedup history]


Take: [synthesizing read]. [sizing or action context]


not financial advice — pattern-matching only
```

Skip-day variant:

```
Daily Token Call · DD MMM · no pick
─────────────────────────────────────

Token signals weak today.
Best near-miss: TICKER at X/10 — below threshold.

Tomorrow.
```

### `perps-brief`

Multi-section: sentiment + (optional near-miss) + watchlist + HIGH CONVICTION (when present).

```
Perps Brief · DD MMM · verdict tagline
─────────────────────────────────────────

[Market sentiment opening — 3-5 lines.]

[Perps-specific read — 3-5 lines.]

[Risk/regime context — 2-3 lines.]

Stance: [overall bias]. [one-line rationale]


─────────  BEST NEAR-MISS  ─────────
[Only on skip-days when there's a noteworthy near-miss]

TICKER · qualifier

  [3-5 indented fact lines]

  [Closing imperative line]


─────────  HIGH CONVICTION  ─────────
[When setups exist]

TICKER · bias label

  PERPS
    [3-5 lines of perps quant data]

  NARRATIVE
    [2-4 lines of narrative context]

  CONTEXT
    [2-4 lines of market context]

  ENRICHMENT
    [2-5 lines of Pass-2 research findings]

  → [Thesis line, committed interpretation, trade structure note]


─────────  WATCHLIST  ─────────

TICKER · qualifier

  [3-6 indented fact lines]

  [Closing imperative line]

[Repeat for each watchlist item]
```

Notes on Perps Brief HIGH CONVICTION blocks:
- CAPS sub-headers (PERPS / NARRATIVE / CONTEXT / ENRICHMENT) sit at the indent level of the asset block's content (2 spaces in from flush left).
- Detail lines beneath each CAPS sub-header are indented a further 2 spaces (4 from flush left).
- The thesis line (→) returns to the asset block indent level (2 spaces) — same as the CAPS sub-headers above it. It's the asset's conclusion, not a sub-section.

### `narrative-tracker`

Existing structure (phase-grouped with arrows) is close to clean. Apply v2 only for:
- Title format: `Narratives · DD MMM · N tracked, M NEW`
- Dividers between phase groups when there are 4+ narratives total
- Closing stance line at the bottom: "Stance: [where to focus today]."

```
Narratives · DD MMM · 5 tracked, 1 NEW

↑ RISING
• Narrative name [TKR1, TKR2, TKR3] · X/5 · POSITION
  Reasoning line.
  Second reasoning line if needed.

[Repeat for each rising narrative]


→ PEAK
[Same pattern]


↓ FADING
[Same pattern]


Changes since yesterday:
+ NEW: [narrative]
- GONE: [narrative]

Stance: [where to focus today].
```

### `monitor-runners`

Existing structure (tag-grouped with → reads) is also close to clean. Apply v2 for:
- Title: `Yesterday's Runners · DD MMM · verdict (parenthetical reason)`
- Section dividers between tag groups (DEEP-LIQ / CONTINUATION / BREAKOUT / etc.) — only when there are 3+ different tag groups populated
- Closing vibe line at the bottom

```
Yesterday's Runners · DD MMM · STRONG (2 DEEP-LIQ across solana, ethereum)

DEEP-LIQ
★ TICKER (chain) +X% 24h
  $X vol, $X liq, h1 +X%, buys X%
  → [interpretation]

CONTINUATION
• [items]

BREAKOUT
• [items]

vibe: [one-line tape read]
```

### `perps-scan`

The data-dense regime classification. Apply v2 for:
- Title format
- The aggregate market read block (3 indented lines under verdict)
- Section dividers between major sections (Market read / REGIME CHANGES / each regime / WATCH / Neutral)
- Sub-headers in regime sections without dividers (regime name in CAPS as section label)

Structure documented fully in `Perps_Engine_v3.md`. v2 writing style applies to all prose lines.

### `daily-ops-review`

Status report. Apply v2 for:
- Title with timing in subtitle
- Dividers between steps
- One line per skill, status marker leading
- Trailing summary block

```
Ops Review · DD MMM · X min

─────────  STEP 1 — DATA  ─────────

  ✓ skill-name · [headline output]
  ✓ skill-name · [headline output]
  ⚠ skill-name · [headline output + degradation note]

─────────  STEP 2 — BRIEFS  ─────────

  ✓ perps-brief · [output count]

─────────  STEP 3 — MACRO  ─────────

  ✓ morning-macro · published


Chain ran complete. X ✓, Y ⚠, Z ✗.

[Issues filed block when applicable]
```

---

## Worked Examples

Full output samples for the most-affected signals. These are the locked references — when CC implements the new style, these are what it should produce.

### Worked Example 1 — Token Call

```
Daily Token Call · 19 May
──────────────────────────

NEAR · HIGH · 10/10
$1.65 · +11.1% 24h · +6.0% 7d
mcap $2.13b · vol $283m · vol/mcap 0.13


SIGNALS
  High turnover at vol/mcap 0.13.
  On the CoinGecko trending list.
  Both 24h and 7d positive, 24h well above +5%.
  Outpacing a red BTC and ETH on the 7d.

CATALYST
  NEAR confirmed post-quantum Chain Signatures (FIPS-204 / ML-DSA).
  Q2 rollout timeline from co-founder Polosukhin.
  Extending to 35+ external chains.
  Grayscale and Bitwise spot-ETF filings add an institutional angle.

RISK
  Quantum upgrade is still a Q2 promise, not shipped.
  A rollout slip unwinds the narrative bid.
  Active emission/unlock schedule caps upside.

DEDUP
  First time in 7d.
  Recent picks: INJ, BSB, TRAC, KAIA all excluded.


Take: high signal across price, narrative, and institutional flow.
The catch is rollout execution — sized accordingly, this is a position-for-Q2 trade not a chase.


not financial advice — pattern-matching only
```

### Worked Example 2 — Morning Macro

```
Market Morning · 19 May · Chop, low conviction

BTC at $76,744. Down 0.19% on the day, down 5.09% on the week.
The morning alt bounce faded by lunch.

Breadth halved to 8/20 green.
F&G dropped to 25 — Extreme Fear, three points lower than yesterday.
BTC, ETH and SOL re-entered the top 3 trending slots.
Defensive rotation, not appetite.

Compute and AI infra holds the lone clean RIDE.
ZEC and HYPE the only large-caps still bid against the red tape.


─────────  CROSS-DOMAIN  ─────────

AIXBT flags Iran both ways inside the same 12h window.
A de-escalation proposal priced alongside live escalation risk.
The resolution is the next directional catalyst.

Polymarket has permanent US-Iran peace by May 31 at 11.5%.
The market leans toward the tail staying open.

HYPE/BTC printing an all-time high with TradFi execs onboarding Hypercore.
Institutional reflexivity in real-time.
BTC's 200DMA is the stress test that could break it.


─────────  TODAY  ─────────

Sector briefs all skip-day.
#perps-brief ran zero HIGH CONVICTION — no quant signal overlapping a rising narrative.

Watchlist carries five near-misses: ZEC, HYPE, NEAR, TAO, CL.
Each named with a conflict; none confirmed.

Take: cash-patient. Better day tomorrow.
```

### Worked Example 3 — Perps Brief (skip-day with watchlist)

```
Perps Brief · 19 May · No high-conviction setups
─────────────────────────────────────────────────

BTC funding flat at +0.006%/8h.
Open interest unmoved on 24h.
The three majors all printed under 1% on the day.
Leverage building on neither side.

Perps-scan reads QUIET.
One ACCUMULATION across 25 assessed, 24 NEUTRAL.
Funding near-flat universe-wide.
No crowded-long extreme, no capitulation flush, no pattern tags firing.

Breadth halved to 8/20 green as the morning alt bounce faded.
F&G pinned at 25, Extreme Fear.
Chop regime, no directional signal dominates.

Stance: cash-patient. QUIET perps tape, chop regime, no quant signal overlapping a rising narrative.


─────────  BEST NEAR-MISS  ─────────

HYPE · perp-DEX leader, quant not confirmed

  OI +42% 7d on calm funding.
  Top traders cut their long ratio over the week.
  Price +20% 7d into a HYPE/BTC all-time high.

  The OI build is not smart-money-confirmed.


─────────  WATCHLIST  ─────────

HYPE · OI build not smart-money-confirmed

  Perps WATCH — OI +42.4% 7d, funding flat 7d-avg.
  One tight range-day from an ACCUMULATION print.
  Top traders cut their long ratio 0.26 over 7d.
  Funding flipped negative to -0.029%/8h.
  Price +20.25% 7d into a HYPE/BTC all-time high.

  Wait for top L/S to turn up before the long.


ZEC · narrative leader, no quant join

  Privacy/ZK rising — ZEC +6.37% 24h, in CoinGecko trending a second day.
  Perps NEUTRAL — 7d range 21.8%, funding flat, top L/S 0.79 and falling.
  Narrative-tracker rates Privacy/ZK WATCH, not RIDE.

  No quant signal to join. Watch the perps print.


NEAR · token-call HIGH, no perps read

  Token-call HIGH 10/10 — NEAR +11.1% 24h, on the trending list.
  Perps NEUTRAL — OI -2.58% 7d, funding flat, 7d range 15.6%.
  Post-quantum Chain Signatures is a Q2 promise, not shipped.

  Rollout slip unwinds the bid. Pass without a quant signal to join.


EDEN · leverage blow-off, not demand

  Perps WATCH — +30.8% 24h, OI exploding +67.6% 24h.
  Short liqs $323k against $73k long, volume only 1.21x average.
  The rip reads leverage-fueled, not demand-fueled.
  Funding negative at -0.066%/8h.

  A sharp reversal weighs as heavily as follow-through. Wait.


CL · lone ACCUMULATION, no narrative tailwind

  Perps ACCUMULATION — OI +12.95% 7d on a tight 10.4% range, price +4.24% 7d.
  Top traders sit net short at 0.45 L/S.
  Taker buy 50.3% — passive build.
  No rising narrative attaches.

  The only quant print on the board, but nothing to join it to. Pass.
```

### Worked Example 4 — Perps Brief HIGH CONVICTION block

```
─────────  HIGH CONVICTION  ─────────

BSB · long breakout, trail tight

  PERPS
    CATALYST-BREAKOUT print on Bybit.
    +20.8% 24h, vol 3.9x average, OI +11.6%, taker buy 51%.
    Only non-NEUTRAL flag in the scan today.

  NARRATIVE
    RWA / tokenized capital markets at 5/5 mindshare.
    Narrative-tracker calls it RIDE.

  CONTEXT
    Tape is 3/20 green and BSB still printed +36% 7d.
    Idiosyncratic strength — its own catalyst, its own bid. Not beta.

  ENRICHMENT
    Binance Alpha and Aster perps both listing this week.
    Book deepening.
    No near-term unlock — multi-year cliffs off the Mar-4 TGE.
    Treasury cliff September.
    Sitting 65% below the May-4 ATH. Room overhead.
    Token-call cross-confirms at 9/10.

  → RWA RIDE + quant breakout + clean unlock calendar all align.
     Trail tight. Thin float makes reversals sharp both ways.
```

Note on the thesis line indentation: the → arrow is flush with the asset's content indent level (2 spaces from flush left, same as the CAPS sub-headers above it). When the thesis continues to a second line, the continuation is indented further (5 spaces — past the `→ `) to visually align with the first character of the thesis prose.

---

## Implementation Notes for Claude Code

### Application across skills

Every prose-producing skill SKILL.md should add this line near the top of its prompt:

> Apply `memory/topics/writing-style.md` to all output. Structural rules (dividers, CAPS sub-headers, indentation, closing lines per unit) are primary. Prose rules (punctuation discipline, banned hedges, active voice, interpretive verbs) apply to sentences within the structure. Per-skill structural template lives in this file under "Per-Skill Structural Templates."

### Character choices

- Divider character: `─` (U+2500 BOX DRAWINGS LIGHT HORIZONTAL).
- Bullet character: `•` for primary list items, `★` for repeat/notable markers.
- Arrow character: `→` for thesis lines, `↑` `↓` `→` for phase markers in narrative-tracker.
- Dot separator: `·` (U+00B7 MIDDLE DOT).

If any character renders poorly in Discord, fall back to ASCII equivalents (`-----` for divider, `*` for bullet, `->` for arrow). Test in production; revise if needed.

### Migration order

When applying v2 to existing skills:

1. **Token Call** — full restructure to template above. Most prose-affected.
2. **Perps Brief** — full restructure. Replace the labeled-sub-block pattern with CAPS sub-headers + dividers between content types.
3. **Morning Macro** — apply Rewrite A structure (dividers + one-sentence-per-line). Already drafted.
4. **Narrative Tracker** — minor pass. Existing phase-arrow structure works; just standardize title format and add closing stance line.
5. **Yesterday's Runners** — minor pass. Existing tag-group structure works; standardize title and section dividers when 3+ groups populated.
6. **Perps Scan** — apply structural rules to the v3 output format already documented in `Perps_Engine_v3.md`.
7. **Daily Ops Review** — apply step-divider structure.

### Things v2 deliberately does not do

- **No SOUL.md content.** v2 governs *how* Claude writes. It doesn't govern *whose perspective* Claude writes from. Soul/perspective remains deferred until structural style has shipped and stabilized.
- **No tone calibration for different audiences.** Every signal is for the operator, in the same context (morning brief read). Single voice.
- **No interpretive section titles.** "Where we are" / "Where the bid lives" — tested in production, read as twee. Section labels stay functional (MARKET SENTIMENT, CROSS-DOMAIN, TODAY, WATCHLIST). Personality lives in the closing lines, not the headers.
- **No length compression beyond what structure demands.** v1 over-corrected toward fragments by enforcing "one conclusion per sentence" universally. v2 allows flowing prose inside closing lines — sometimes a single committal sentence with a genuine aside reads sharpest. Don't strip rhythm in the wrong places.

### When v2 produces awkward output

If a specific skill's output reads poorly after applying v2, the fix lives here, not in the skill. Add or revise the worked example for that skill in this document. The skill's SKILL.md references this file as the source of truth. Single source of truth means single place to iterate.

---

*End of writing-style v2.*
