# Aeon Writing Style v2.1 — Layout First, Prose Second
*Locked: 2026-05-19*
*Supersedes: writing-style v2 (structural rules unchanged; adds Sentence-Level Patterns section)*
*Source of truth for all prose output across Aeon skills.*

This is the operator-facing style guide for every signal Aeon produces.

**v1** (deprecated) emphasized prose mechanics. Correct on the rules, wrong on the priority — the wall-of-text problem turned out to be structural.

**v2** inverted the priority. Layout rules became load-bearing; prose rules became secondary.

**v2.1** keeps the v2 structural foundation and adds a Sentence-Level Patterns section. After v2 shipped to production, structural problems resolved but sentence-level prose patterns emerged that pass every existing rule and still read poorly. Section 4 names them.

When versions conflict, v2.1 wins.

---

## Philosophy

The reader is an operator who reads a daily brief in 90 seconds and needs the signal to land in 20. Every signal is dense by necessity. The job of the writing is to make density navigable, not to compress further.

Three failure modes (added one in v2.1):

1. **Wall-of-text** — dense paragraphs with no visual structure. The eye can't find the next idea. *Fixed by Structural Rules.*
2. **Worded data dump** — facts listed without commitment. The reader does interpretation work the writer should have done. *Fixed by Mandatory Closing Lines.*
3. **Sentence-level reading friction** — sentences that pass structural and prose rules but still read poorly. Parse ambiguities, modifier stacking, jargon leaks, passive constructions. *Fixed by Sentence-Level Patterns section (new in v2.1).*

The core insight remains from v2: structure is the most important writing decision. v2.1 adds: once structure is right, the sentences inside it need sharp execution. Sentences are the last 10% — but in production, that's the 10% the operator actually feels.

---

## Section 1 — Structural Rules

Unchanged from v2. Primary rules. Govern the shape of every output.

### Rule 1 — Visual hierarchy from three levels

Every output uses exactly three structural elements:

1. **Horizontal dividers (`─────`)** — separate major content shifts. "Different kind of content is coming."
2. **CAPS sub-headers** — label aspects within the same content type. "Different angle on the same thing."
3. **Indentation (2 spaces)** — group detail lines under their parent header.

No bold, no italics, no asterisks, no other markdown.

### Rule 2 — When to use dividers vs CAPS sub-headers

**Divider** — between sections answering different questions. In Perps Brief: sentiment (about the market), near-miss (about one asset), watchlist (about multiple assets) are three lenses on three questions. Dividers earn space.

**CAPS sub-header** — between sub-aspects of one analysis. In Token Call: SIGNALS, CATALYST, RISK, DEDUP all answer one question. Same content, different angles. CAPS sub-headers carry the separation; dividers would over-segment.

**Test:** if the sections could each stand alone as a complete sub-document, use dividers. If they only make sense together, use CAPS sub-headers.

### Rule 3 — Divider format

```
─────────  LABEL  ─────────
```

Label embedded mid-divider, surrounded by `─`. Approximately 9 dashes each side; fewer if the label is long. Total visual width 50–60 characters.

The exception is the very first divider under the title bar — no label, just signals "the document body starts here":

```
Perps Brief · 19 May · No high-conviction setups
─────────────────────────────────────────────────
```

### Rule 4 — Indentation

Two-space indent per level. Three levels maximum.

- Top-level content: flush left.
- Sub-section content (under a CAPS sub-header): indented 2 spaces.
- Details below an asset header in a list: indented 2 spaces.

### Rule 5 — One sentence per line

Every line within a structured section contains one thought. The line break replaces commas, em-dashes-as-connectors, and "and"/"but" linkages between independent thoughts.

Exception: closing lines (Rule 6) can flow.

### Rule 6 — Mandatory closing line per independent unit

Every independent unit ends with a closing line that commits to a position.

| Closing label | Used in | Format |
|---|---|---|
| `Stance:` | Sentiment/regime blocks | "Stance: cash-patient. [one-line rationale]" |
| `Take:` | Whole-document synthesis | "Take: [synthesizing read]. [sizing or action context]" |
| `→` | Thesis line on HIGH CONVICTION setups | "→ [committed interpretation]. [trade structure]" |
| Bare imperative | Watchlist items | "Pass." / "Wait." / "Watch for X." / "Fade on Y." |

Closing lines are preceded by a blank line. Flush with the asset header above (not further indented under any sub-header). The blank line + flush-left position is the visual cue that the close-out is coming.

### Rule 7 — Asset header format

```
TICKER · qualifier sentence
```

Ticker, dot separator, qualifier. Qualifier carries the conviction or conflict signal so the asset header is self-contained.

### Rule 8 — Data lines: split when comma-separated reads as a wall

Three dot-separated items per line: comfortable. Four: upper limit. Five+: split into two lines (e.g. price/performance on one, structural metrics on another).

---

## Section 2 — Prose Rules

Carried from v2. Govern sentences inside structured sections. Secondary to structural rules.

### Punctuation

- **Em-dash (`—`)** — genuine asides only. See also Pattern 5 in Section 4 for the slip-test.
- **Semicolons** — banned in body text.
- **Parentheses** — one level deep, one per sentence max.

### Sentence rules

- One conclusion per sentence (in body lines; closing lines can flow).
- Lead with interpretive verbs ("bled," "absorbed," "crowded," "positioning," "failed").
- Active voice. See Pattern 4 in Section 4 for slip-test.

### Hedging

Banned: "could," "may," "might," "appears to," "seems to," "potentially," "perhaps."

If uncertainty is genuine, explicit confidence language: "low conviction," "mixed signals," "watching for confirmation."

### Banned phrases (Claude-tells)

Strike on sight:
- "It's worth noting that..."
- "Looking at the data..."
- "From what we can see..."
- "There appears to be..."
- "Could potentially..."
- "Seems to suggest..."
- "Let me / I should..."
- "On one hand X, on the other hand Y" (when there IS a clear take)

---

## Section 3 — Per-Skill Structural Templates

Unchanged from v2. Skills should produce output matching the templates exactly.

### `morning-macro`

```
Market Morning · DD MMM · regime tagline

[Regime opening — 2-4 lines.]

[Where the bid lives or doesn't — 2-4 lines.]

Stance: [bias]. [one-line rationale]


─────────  CROSS-DOMAIN  ─────────

[Thread 1 — 2-4 lines.]

[Thread 2 — 2-4 lines.]


─────────  TODAY  ─────────

[Pointer to sector briefs and headline setups — 2-4 lines.]

Take: [synthesizing read]. [action context]
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
  [3-5 short factual lines]

RISK
  [2-4 short factual lines]

DEDUP
  [1-3 lines]


Take: [synthesizing read]. [sizing or action context]


not financial advice — pattern-matching only
```

### `perps-brief` (v4.1 — card layout, multi-message Discord delivery)

The brief is split into per-section messages. NEW POSITIONS and WATCHLIST are split further into per-signal messages so each card has its own monospace border. Layout per message:

**Market context message (1):**

```
Perps Brief · DD MMM

─────────  MARKET SENTIMENT  ─────────

  [Paragraph 1 — macro frame, 3-5 lines]

  [Paragraph 2 — perps-specific read, 3-5 lines]

  [Paragraph 3 — risk/regime context, 2-3 lines]

  Bias · [stance]. [rationale]
```

**Current positions message (1, as a table + per-row prose):**

```
─────────  CURRENT POSITIONS (N)  ─────────

  TICKER  DIR    ENTRY      NOW         PNL      MAE / MFE       CALL
  ──────  ────   ─────────  ─────────  ───────  ──────────────  ──────────
  ASSET   LONG   $price     $price     ±X%      −X.X / +X.X     RIDE
  ASSET   SHORT  $price     $price     ±X%      −X.X / +X.X     CLOSE  OUTCOME

  ASSET  ▸ [2-3 sentence note in plain prose, no buzzword shorthand]
  ASSET  ▸ [2-3 sentence note]
```

**Per new-position message (1 per signal, capped 5):**

```
─────────  NEW POSITION · TICKER DIR  ─────────

  ticker      TICKER
  direction   DIR
  horizon     24h | 3d | 7d | multi-week
  entry       price level OR "market"
  stop        invalidation condition


  thesis      · [observation 1: price action, 1-2 sentences]
              · [observation 2: narrative, 1-2 sentences]
              · [observation 3: regime/positioning, 1-2 sentences]
              · [observation 4: cross-domain/catalyst, 1-2 sentences]


  risks       · [risk 1: 1-2 sentences]
              · [risk 2]
              · [risk 3]
```

**Per watchlist message (1 per signal, capped 5):**

```
─────────  WATCHLIST · TICKER DIR · day N  ─────────

  ticker      TICKER
  direction   DIR
  horizon     24h | 3d | 7d | multi-week
  trigger     condition that would promote to NEW POSITION
  stop        invalidation before the trigger fires


  thesis      · [observation 1]
              · [observation 2]
              · [observation 3]
```

**Rules specific to v4.1 cards:**

1. **Bullet writing** — every bullet is a complete observation (subject + verb + object), self-contained, plain language. Apply Pattern 7 strictly.
2. **Bullet count** — 3-4 thesis bullets per card. 2-3 risks per new position. Don't pad to hit a count; if there are only two real observations, write two.
3. **Bullet length** — target ~120 characters per bullet. Hard cap 180. Tighter than v4.1's first release after operator confirmed Discord mobile renders unrecoverably when bullets wrap to 3+ lines.
4. **Blank-line separation** — two blank lines between the metadata block and `thesis`, and two between `thesis` and `risks`. Visual section breaks.
5. **Field labels** — `ticker`, `direction`, `horizon`, `entry`/`trigger`, `stop`, `thesis`, `risks`. Lowercase, left-aligned, value indented to column 14.
6. **Direction tags** — LONG / SHORT uppercase. Outcome tags on CLOSE rows (WIN, LOSS, NEUTRAL, WIN-WITH-SCARE) appended to CALL column.
7. **No confluence list in the rendered output** — confluence criteria live in the ledger for track-record analysis; they're not surfaced in the operator-facing card.

### `narrative-tracker`

```
Narratives · DD MMM · N tracked, M NEW

↑ RISING
• Narrative [TKR1, TKR2, TKR3] · X/5 · POSITION
  Reasoning line.

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

```
Yesterday's Runners · DD MMM · verdict (parenthetical reason)

DEEP-LIQ
★ TICKER (chain) +X% 24h
  [data line]
  → [interpretation]

CONTINUATION
• [items]

BREAKOUT
• [items]

vibe: [one-line tape read]
```

### `perps-scan`

Documented fully in `Perps_Engine_v3.md`. v2.1 writing style applies.

### `daily-ops-review`

```
Ops Review · DD MMM · X min

─────────  STEP 1 — DATA  ─────────

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

## Section 4 — Sentence-Level Patterns to Avoid

**New in v2.1.** These are sentence-level patterns that pass structural and prose rules but still read poorly. Each has a test (how to detect it) and a fix template. All examples are pulled from real production output.

### Pattern 1 — Participle-phrase ambiguity

A subject-noun followed by a verb-ing form can be parsed two ways: as a noun-with-action (*"institutional money [that is] losing tech conviction"*) or as a compound noun (*"institutional money-losing tech"*). English readers default to the compound-noun reading because they chunk noun+verb-ing automatically. When the rest of the sentence breaks that parse, the reader has to back up and re-read.

**Test:** Find every subject-noun + verb-ing construction. Read the noun + verb-ing chunk in isolation. Does it form a plausible compound noun? If yes, restructure.

**Examples:**

```
✗ "Institutional money losing tech conviction is being handed an on-chain entry point."
   ("institutional money-losing tech" reads as a compound noun before "conviction is being handed" breaks the parse.)

✓ "Institutional money is rotating out of tech, with on-chain as the entry point."

✓ "The same capital that's losing tech conviction now has an on-chain entry point."
```

**Fix templates:**
- Split into two sentences: "X is doing Y. Z is the result."
- Use "[noun] that's [verb-ing]" to lock the participle reading
- Reorder so the verb-ing precedes the noun: "X is [verb-ing] toward Y" rather than "Y [verb-ing] X..."

### Pattern 2 — Adjective stacking

Two or more adjectives modifying the same noun in different semantic dimensions creates clutter. The reader doesn't know which to prioritize.

**Test:** Find every noun with two or more adjectives preceding it. Ask whether the adjectives nest naturally (one modifies the next, then both modify the noun) or stack independently (both modify the noun in different ways).

**Examples:**

```
✗ "the lone clean RIDE"
   ("lone" = only one. "clean" = uncomplicated. Both modify RIDE in different dimensions.)

✓ "the only RIDE call"
   ("only" carries the lone-ness; clean-ness is implied by surviving to a RIDE.)

✓ "fresh institutional bid"
   (Fine — "fresh" modifies "institutional bid" as a unit. Natural nesting.)

✗ "extreme crowded long positioning"
   (Three modifiers stacked. Pick one — "extreme long positioning" or "crowded long positioning.")
```

**Fix templates:**
- Pick the load-bearing modifier; drop the others. The dropped meaning is usually implied by context.
- If both feel essential, the noun is wrong — find a more specific noun that contains one meaning intrinsically.

### Pattern 3 — Internal jargon in operator-facing prose

Engine-internal terminology has no meaning to the reader. The operator reads the brief without the engine spec in hand; vocabulary that requires that context is illegible.

**Test:** Read the output as someone who hasn't seen the engine spec or any SKILL.md. Do they understand every phrase?

**Internal terms that leak (replace with operator-facing equivalent):**

| Internal | Operator-facing |
|---|---|
| "next pull" / "next run" / "next window" | "next 48 hours" / "next two days" / "tomorrow's scan" |
| "this run" | "today's scan" / "today's tape" |
| "downstream consumption" | name the consuming skill or drop |
| "the artifact" | "today's data" / "the scan output" |
| "skip-day branch" | "skip-day" or "quiet day" |
| "the prior chain" | "yesterday's scan" |
| "two windows" | "48 hours" / "two days" |

**Note:** trader/market jargon is welcome — "tape," "bid," "offer," "front-running," "fade," "RIDE call," "ACCUMULATION print," "thin float," "vol/mcap." That language is *operator-native*. Engine/infrastructure jargon is not.

**Examples:**

```
✗ "A use-case bid worth watching over the next two windows."
   ("two windows" is internal — two chain runs.)

✓ "A use-case bid worth watching over the next 48 hours."
```

### Pattern 4 — Passive voice slipping back in

"Is being [past-participle]" constructions read as filler. v2 says active voice; in practice it slips back.

**Test:** Search for "is being," "was being," "are being," "has been." Each is a candidate for active rewrite.

**Examples:**

```
✗ "Institutional money is being handed an on-chain entry point."

✓ "Institutional money is rotating into on-chain."
   (Make the subject do the action.)

✓ "On-chain is the entry point being handed to institutional money."
   (If the receiving party must be the subject, at least make the verb's subject explicit.)

✗ "The narrative is being absorbed into the consensus."

✓ "The narrative is absorbing into the consensus."
   (Reflexive active voice works for processes.)
```

### Pattern 5 — Em-dash slipping back as a connector

Reinforcement of the v2 punctuation rule. Em-dash slippage is the most common rule-break in production.

**Test:** For every em-dash, remove the em-dash and everything after it until the next mark (period or end-of-sentence). Does the sentence still stand? If yes, the em-dash was an aside — keep it. If no, it was connecting two independent thoughts — use a period.

**Examples:**

```
✗ "Trending rotated — ZEST and RON microcaps displaced the defensive trio."
   (Test: remove "— ZEST and RON microcaps displaced the defensive trio." → "Trending rotated." Stands. So the em-dash was connecting, not interrupting.)

✓ "Trending rotated. ZEST and RON microcaps displaced the defensive trio."

✗ "BTC bled -2.2% — Strategy's $2B bid couldn't catch it."
   (Same test: "BTC bled -2.2%." stands alone. The post-dash content is independent.)

✓ "BTC bled -2.2%. Strategy's $2B bid couldn't catch it."

✓ "BTC bled -2.2% — the kind of day that breaks structural support."
   (Genuine aside: "the kind of day that breaks structural support" doesn't have its own subject and verb. It interrupts the main sentence with a parenthetical interpretation.)
```

The pattern: post-dash content with its own subject and verb is independent. Use a period.

### Pattern 6 — Verb weakness

Some verbs are technically correct but commit less than alternatives. Where stronger verbs exist, use them.

**Test:** Find every verb. Ask: is there a more specific, more committed verb that says the same thing? Common slip-verbs to upgrade:

| Weak | Stronger options |
|---|---|
| "surfaces as" | "emerges as," "named as," "shows up as" |
| "is positioned" | "positioning," "crowding," "building," "accumulating" |
| "could see" | (delete or replace with explicit confidence: "low-conviction risk") |
| "looks set to" | (delete) |
| "is poised to" | (delete) |
| "remains" | "holds," "stays," "sits at" |

**Examples:**

```
✗ "ZEC surfaces as a named rotation destination..."

✓ "ZEC named as a rotation destination..."

✓ "ZEC emerging as a rotation destination..."
```

### Pattern 7 — Internal references and engine-private vocabulary

The brief is a public-facing artifact. The reader is a qualified trader who understands the market — funding rates, open interest, long/short ratios, basis, taker-buy flow, accumulation/distribution structure — but does **not** know the names of our internal skills, our internal scoring scales, our internal tags, or our engine's state machine.

Anything that requires reading the codebase to understand is illegible. Replace every internal reference with the underlying trader-native meaning.

**The test:** Show the bullet to a perps trader who has never seen this repo. Can they action it without asking "what's that?"

#### Replacement table — INTERNAL → TRADER-NATIVE

| Category | NEVER WRITE | INSTEAD WRITE |
|---|---|---|
| **Skill names** | `per narrative-tracker`, `narrative-tracker shows`, `perps-scan flagged`, `aixbt-pulse named`, `token-movers QUIET`, `token-call rated HIGH 10/10`, `morning-macro shows` | Describe the underlying observation directly. `"Hyperliquid narrative is in peak phase"`, `"funding flipped to +0.08%/8h with OI rising 12%"`, `"a high-conviction discovery call"`. The reader doesn't need to know which engine module produced it. |
| **Internal scoring** | `5/5 narrative`, `4/5 RIDE`, `HIGH 10/10`, `score 8/10`, `confidence 4 of 5` | Translate to qualitative trader language. `"high conviction"`, `"strong setup"`, `"moderate conviction with a soft edge"`. Numbers on a scale the reader doesn't have are noise. |
| **Internal tags** | `[BOTH]`, `[QUANT]`, `[DISCOVERY]`, `[NARRATIVE]`, `DIVERGENT sub-tag`, `LONG-TRAP pattern fired` | Describe what the tag *means* structurally. `"showing up on both quantitative and narrative screens"`, `"passive build with funding rising while price drops — a long-trap structure"`. |
| **Process references** | `absent from token-movers today`, `dropped from perps-scan`, `re-engages tomorrow's scan`, `picked up in this morning's run` | Drop the process reference; restate the market observation. `"flow has cooled — no longer a momentum candidate"`, `"volume contracted out of the breakout candidates"`. If timing matters, name a market window: `"if it holds above $2.05 into US open"`. |
| **Engine state names** | `Fading → Peak`, `moved to ACCUMULATION`, `state DISTRIBUTION`, `regime QUIET → ACTIVE` | Use the structural meaning of the state. `Peak` → `"narrative is at full extension — late entries get punished"`. `Fading` → `"narrative losing steam, flows rotating elsewhere"`. `Accumulation` → `"absorption pattern — passive bids stacking under price"`. `Distribution` → `"supply being unloaded into strength"`. Lock the state vocabulary on the market structure, not on our enum value. |
| **Score deltas with no scale** | `Smart money L/S +0.14 7d`, `narrative score +2 WoW` | Restate with unit and direction. `"top-trader long/short ratio rose from 1.26 to 1.40 over 7 days — net long bias building"`. |
| **Compound shorthand** | `AIXBT #1`, `Pick of the day RIDE`, `Hold above re-engages` | Always close the shorthand with a complete observation. `"AIXBT flagged HYPE as their top lead today"`, `"holding above $2.05 keeps the long thesis intact; below it the setup is invalid"`. |

#### Vocabulary that DOES belong in the brief (KEEP)

These are trader-native — the reader knows them, indicators carry their own scale and unit, and they describe market structure rather than engine state.

- **Indicator values with units:** `funding +0.05%/8h`, `OI up 18% in 24h`, `LSR 1.4`, `taker buy 52% of flow`, `basis -0.3%`, `volume 2.4× 30d avg`
- **Structural TA vocabulary:** `accumulation`, `distribution`, `compression`, `expansion`, `breakout`, `breakdown`, `momentum`, `capitulation`, `absorption`, `rotation`, `mean reversion`, `divergence`, `squeeze`
- **Narrative descriptions in trader language:** `"the narrative is ripping"`, `"the narrative is fading — flows rotating to AI"`, `"ride the move while OI builds"`, `"narrative is cooked — wait for re-accumulation"`
- **Phase descriptions when stated structurally:** `"early stage — funding still neutral, OI just starting to build"`, `"late stage — funding overheated, exits getting crowded"`
- **Sector and narrative names:** `AI`, `DePIN`, `RWA`, `ZK`, `memecoins`, `Solana ecosystem`, `Hyperliquid ecosystem`, `restaking`, `L2s` — these are public-facing labels
- **Market structure terms:** `support`, `resistance`, `liquidation cluster`, `funding flush`, `open-interest unwind`, `delta-neutral build`

#### Two failure modes specific to v4.1 cards

1. **Bullet-as-citation** — bullets that read like a citation list rather than a thesis. (`"AIXBT names it · narrative RIDE · vol breakout."`) Each bullet must be a complete observation, not a label.

2. **Telegraphic sentence fragments** — dropping subjects, articles, and verbs to compress. (`"Funding flushed."`) Write complete sentences with subject + verb + object.

#### Worked examples

```
✗ AIXBT #1, Fading→Peak, $1.8M buybacks.

✓ Hyperliquid is being called out as a top lead today. The narrative
  has shifted from fading back to full extension, and the protocol is
  buying back $1.8M in tokens daily — supply pressure easing while
  attention builds.
```

```
✗ 5/5 narrative, absent from token-movers, re-engages tomorrow.

✓ High-conviction narrative setup, but flow has not confirmed yet —
  volume hasn't picked up. Re-evaluating tomorrow if a breakout candle
  prints.
```

```
✗ DIVERGENT sub-tag — passive build.

✓ Open interest is climbing while price drifts sideways — passive
  positioning, possibly arbitrage rather than directional. Wait for
  price to commit before taking a side.
```

```
✗ Funding past +0.03%/8h fires MOMENTUM.

✓ If funding pushes past +0.03%/8h with price holding the breakout,
  the move is confirmed — add into strength.
```

```
✗ Hold above re-engages.

✓ If price holds above $2.05 into US open with OI rebuilding, the
  long thesis stays intact. Below $2.05 the setup is invalid.
```

**Rule of thumb:** Read every sentence as if the operator is a trader on a Bloomberg terminal, not a developer reading our codebase. If a word, tag, or number only makes sense after you've opened a `.py` file or a SKILL.md, it doesn't belong in the brief.

---

## Section 5 — Worked Examples

Full output samples for the most-affected signals. Locked references — when CC implements the style, these are what it should produce.

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

### Worked Example 2 — Morning Macro (corrected for v2.1)

This is the May 19 production output, rewritten against v2.1 to fix the patterns flagged in Section 4.

**Original (v2 output with prose issues):**

```
Trending rotated — ZEST and RON microcaps displaced the defensive BTC/ETH/SOL trio.
Attention drifting to alts with no tape behind it.
Decentralized compute holds the lone clean RIDE at 5/5.
RWA rides with a trail. Privacy/ZK sits at WATCH.
...
Institutional money losing tech conviction is being handed an on-chain entry point.
...
ZEC surfaces as a named rotation destination in the same window as sanctions escalation.
A use-case bid worth watching over the next two windows.
```

**Corrected (v2.1 applied):**

```
Market Morning · 19 May · Chop, low conviction

BTC at $76,769. Flat on the day, down 4.62% on the week.
The morning alt bounce faded by lunch.
Breadth holds at 10/20 green.
F&G pinned at 25 — Extreme Fear, unmoved all day.

Trending rotated.
ZEST and RON microcaps displaced the defensive BTC/ETH/SOL trio.
Attention drifting to alts with no tape behind it.

Decentralized compute holds the only RIDE call at 5/5.
RWA stays RIDE, with a trail.
Privacy/ZK sits at WATCH.

Stance: chop, low conviction. NVIDIA earnings tomorrow is the next regime test.


─────────  CROSS-DOMAIN  ─────────

The RWA regulatory exemption and the hedge-fund semiconductor rotation are one capital-pool story.
Institutional money is rotating out of tech, with on-chain as the entry point.

The Iran de-escalation proposal is dead.
The US is building a multilateral sanctions coalition.
The conflict premium is institutionalizing, not fading.

ZEC named as a rotation destination alongside the sanctions escalation.
A use-case bid worth watching over the next 48 hours.


─────────  TODAY  ─────────

Sector briefs all quiet.
#perps-brief ran zero HIGH CONVICTION — no quant signal overlapping a rising narrative.

Watchlist carries five near-misses: HYPE, ZEC, EDEN, BILL, XAU.
HYPE the best near-miss — near-ACCUMULATION, but the OI build is not smart-money-confirmed.

Take: cash-patient. Better day tomorrow.
```

**Changes applied:**
- Pattern 5 (em-dash slip): *"Trending rotated — ZEST and RON..."* → split into two sentences.
- Pattern 2 (adjective stacking): *"lone clean RIDE"* → *"only RIDE call."*
- Pattern 1 (participle ambiguity) + Pattern 4 (passive): *"Institutional money losing tech conviction is being handed..."* → *"Institutional money is rotating out of tech, with on-chain as the entry point."*
- Pattern 6 (weak verb): *"ZEC surfaces as a named rotation destination..."* → *"ZEC named as a rotation destination..."*
- Pattern 3 (internal jargon): *"next two windows"* → *"next 48 hours."*
- Pattern 5 (em-dash slip): *"...sanctions coalition — the conflict premium is institutionalizing..."* → split into two sentences.

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

---

## Section 6 — Implementation Notes

### Application across skills

Every prose-producing skill SKILL.md should add this line near the top of its prompt:

> Apply `memory/topics/writing-style.md` to all output. Structural rules (Section 1) are primary. Prose rules (Section 2) govern sentences within structure. Sentence-Level Patterns (Section 4) catch specific failure modes that pass structural rules — review against each pattern before emitting. Per-skill structural template lives in Section 3. Worked examples in Section 5.

### Character choices

- Divider: `─` (U+2500 BOX DRAWINGS LIGHT HORIZONTAL)
- Bullet: `•` for primary list items, `★` for repeat/notable markers
- Arrow: `→` for thesis lines; `↑` `↓` `→` for phase markers in narrative-tracker
- Dot separator: `·` (U+00B7 MIDDLE DOT)

If any character renders poorly in Discord, fall back to ASCII (`-----`, `*`, `->`).

### Migration order

When applying v2.1 to existing skills (after v2 structural fixes are in):

1. **Re-review every prose-producing skill against Section 4 patterns.**
2. Token Call, Perps Brief, Morning Macro — apply Section 4 checks per-sentence.
3. Narrative Tracker, Yesterday's Runners — minor pass.
4. Perps Scan — apply Section 4 to all prose lines (aggregate read, transition reads, per-asset reads).
5. Daily Ops Review — apply Section 4 to the prose lines in the issues block.

### Self-check before emit

Every skill that produces prose runs an internal review before emitting. Concretely, the SKILL.md should instruct Claude to:

1. Draft the output applying Sections 1-3.
2. Before emitting, search the draft for the 6 patterns in Section 4:
   - Pattern 1: subject + verb-ing chunks that could be compound nouns
   - Pattern 2: nouns with 2+ adjectives stacked
   - Pattern 3: internal jargon ("window," "pull," "run," "artifact")
   - Pattern 4: "is being," "was being," "are being," "has been"
   - Pattern 5: em-dashes (test each one)
   - Pattern 6: weak verbs ("surfaces," "remains," "could see," "looks set," "is poised")
3. Rewrite anything that matches a pattern.
4. Emit.

The internal review is fast (LLM-internal) and catches most slips before they reach the operator.

### Things v2.1 still deliberately doesn't do

- No SOUL.md content. v2.1 governs *how* Claude writes. *Whose perspective* remains deferred.
- No tone calibration for different audiences. Single voice.
- No interpretive section titles. Section labels stay functional.
- No length compression beyond what structure demands.

### When v2.1 produces awkward output

If a specific skill's output still reads poorly after applying v2.1, the fix lives here:
- If it's a new sentence-level pattern not in Section 4, add a Pattern 7.
- If it's a structural issue, revise the Section 3 template for that skill.
- If it's a worked-example deviation, revise Section 5.

Single source of truth. Don't fork style guidance into individual SKILL.md files.

---

*End of writing-style v2.1.*
