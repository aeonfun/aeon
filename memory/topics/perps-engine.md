# Perps Engine — Current State Map
*Phase 1 of the perps-engine review. Drafted 2026-05-20.*

> Audit of the live perps engine (Aeon Market Stack v2 + perps-scan v3) on branch `claude/fix-iss-006-recurrence`. Goal: establish ground truth of what runs today before deciding what to change.

---

## TL;DR

1. **The engine is a real perps engine.** Coinglass v4 powers 8 per-coin endpoints (price, OI, funding, split-direction liquidations, top-trader L/S, basis, taker buy/sell). CoinGecko `/derivatives` ranks the universe across Binance/OKX/Bybit.
2. **It runs as one chain, not six crons.** The `morning-review` chain fires once daily at 04:00 UTC and runs 4 sequential steps with explicit `consume:` passing between them. Step 2 (`perps-brief`) consumes every Step 1 artifact.
3. **The integration layer is the decision surface.** `perps-brief` does discovery → enrich → judge → compose. HIGH CONVICTION is Claude's judgement call, not a point threshold. Cap 5 setups per day. Skip-day discipline if nothing aligns.
4. **`perps-scan` is the context layer, not the call.** It classifies the universe into 7 regimes with sub-tags and cross-signal pattern tags. It's internal-only — no Discord posting — because the synthesis happens at the brief.
5. **The largest remaining gap is outcome tracking.** Nothing in the chain reads back prior calls, pulls forward prices, and scores hit-rate. Self-improvement is unmeasured. This is the missing keystone for a learning loop.

---

## 1. The Chain (live, on `claude/fix-iss-006-recurrence`)

`aeon.yml` defines a single `chains.morning-review`. Cron schedule is owned by `.github/workflows/chain-runner.yml` (`0 4 * * *`). `on_error: continue` — one skill failure doesn't kill the brief; downstream marks partial-input.

| Step | Skills | Type | Notify? |
|---|---|---|---|
| 1 (parallel) | `market-context-refresh`, `aixbt-pulse`, `monitor-runners`, `token-movers`, `perps-scan`, `narrative-tracker`, `token-call` | Data + classification | Mixed: scan/context/movers/pulse are internal; runners/narrative/token-call post to their channels |
| 2 | `perps-brief` (consumes all 7 of Step 1) | Sector synthesis | Yes → `#perps` |
| 3 | `morning-macro` (consumes `perps-brief` + 3 context) | Cross-sector synth | Yes → `#morning-macro` |
| 4 | `daily-ops-review` (consumes everything) | Chain-health audit | Yes → `#aeon-ops` (operator-only) |

The chain runner injects upstream artifacts into the downstream skill's context via `.outputs/.chain-context-<skill>.md`. Skills with `consume:` get the raw markdown of every consumed artifact in-context.

Estimated total chain duration: 20–30 min. Briefs land 04:20–04:30 UTC.

---

## 2. The Data Layer

### `perps-scan` v3 — the foundation
- **Universe:** CoinGecko `/derivatives` top 25 by aggregated 24h perp volume across Binance/OKX/Bybit, plus always-include BTC/ETH/SOL.
- **Tier system:**
  - Tier 1: BTC/ETH/SOL — tighter thresholds (a -6% BTC day is a flush in market-structure terms).
  - Tier 2: every other assessed asset.
  - Tier 3 (memes/micros): intentionally excluded. Discovery picks them up at the brief layer via Pass 0.
- **Pre-fetch architecture:** `scripts/prefetch-coinglass.sh` runs *before* Claude, outside the sandbox, with full env access. Writes 8 endpoint files per coin + a `manifest.json` to `.coinglass-cache/`. The skill reads cache only — no live network from inside Claude.

**8 Coinglass v4 endpoints per coin:**
| Endpoint | Used for |
|---|---|
| Price (daily OHLC, 8d) | `pct_24h`, `pct_7d`, `vol_ratio`, `range_7d_pct` |
| Price (hourly, 8h) | `pct_4h` (powers FRESH/STALE sub-tag) |
| OI history (8d) | `oi_24h_pct`, `oi_7d_pct` |
| OI-weighted funding (21 × 8h) | `funding_now`, `funding_7d_avg`, `funding_delta` |
| Liquidations (long + short split, 8d) | `long_liqs_24h`, `short_liqs_24h`, `liq_7d_p75` |
| Top-trader L/S ratio (8d) | `top_ls_now`, `top_ls_7d_avg`, `top_ls_delta_7d` |
| Basis (8d) | `basis_now`, `basis_7d_avg` |
| Taker buy/sell volume (8d) | `taker_buy_pct_24h` |

### Surrounding context skills (also in Step 1)
- `market-context-refresh` — BTC/ETH/SOL prices, breadth, F&G, DeFiLlama TVL flows, Polymarket top markets, regime label + conviction
- `aixbt-pulse` — cross-domain pulse (crypto/macro/geo/tradfi) with explicit bridge call
- `narrative-tracker` — phase-grouped narratives (Emerging/Rising/Peak/Fading), mindshare + velocity, position calls (FRONT-RUN/RIDE/FADE/WATCH/IGNORE)
- `monitor-runners` — DEX runners via GeckoTerminal (Solana/ETH/Base/BSC/Arbitrum)
- `token-movers` — CoinGecko top 250 winners/losers/trending with anti-pump filters
- `token-call` — single token recommendation per day (point-scored, 0–10, HIGH/MEDIUM/SKIP)

---

## 3. Regime Classification — How the Universe is Read

`perps-scan` assigns exactly one regime per asset, first-match-priority order:

| Order | Regime | Condition (paraphrased) |
|---|---|---|
| 1 | **CAPITULATION** | Big drawdown + negative funding + OI dropping + elevated liquidations |
| 2 | **SHORT-SQUEEZE** | Big up move BUT OI dropping + short-side liquidations + weak taker buy |
| 3 | **DISTRIBUTION** | Funding extreme + gains slowing + OI rising (longs paying to ride a stalling tape) |
| 4 | **CATALYST-BREAKOUT** | Big up move + 2x+ volume + OI building + taker buy > 52% |
| 5 | **ACCUMULATION** | OI building 7d + funding neutral + price quiet positive + range tight |
| 6 | **MOMENTUM** | Sustained 7d up + OI stable/up + funding warm (0.03–0.07%) |
| 7 | **COMPRESSION** | Tight range + OI quietly building + flat funding |
| 8 | **NEUTRAL** | Catch-all |

**Sub-tags refine the read within a regime:**
- CATALYST-BREAKOUT · FRESH (4h delivered most of 24h) / STALE (move ran earlier)
- ACCUMULATION · CONFIRMED (real taker buying) / DIVERGENT (passive OI build, likely arb)
- COMPRESSION · ACTIVE (volume holding, move imminent) / QUIET (true coil)
- CAPITULATION · IN-PROGRESS (cascade active) / CLEARED (flush done, structure stabilizing)
- DISTRIBUTION · REAL-CROWDED-LONG / RETAIL-ANOMALY / LONG-TRAP

**Cross-signal pattern tags** apply independently of regime — these are the highest-signal flags:
- **REAL-CROWDED-LONG** — funding extreme + top L/S > 2.0 + basis positive → real top risk
- **RETAIL-ANOMALY** — funding extreme but top L/S < 1.5 → squeeze risk over fade
- **LONG-TRAP** — funding > extreme threshold + price down + OI still up → highest-severity short setup
- **STEALTH-POSITIONING** — top L/S rising +0.4 over 7d in a tight range with low OI build → smart money ahead of signals
- **CASH-AND-CARRY** — basis positive + funding flat + neutral taker → arb flow, not directional

**Day-over-day regime transitions** are first-class output. Named transitions carry pre-encoded reads (e.g. ACCUMULATION → CATALYST-BREAKOUT = "patient buyers paid off, high-quality breakout"; MOMENTUM → DISTRIBUTION = "trend topping").

**Aggregate market read** picks one verdict word from the regime distribution: LEVERAGE BUILDING / CROWDED LONG / CROWDED TOPPING / DELEVERAGING / BREAKOUTS ACTIVE / TRENDING / COILING / MIXED / QUIET.

This is the answer to "how is market data turned into context prior to Claude's judgement": **classification is rules-based; the rules are tier-adjusted; the output is a structured artifact, not a verdict.**

---

## 4. The Decision Surface — `perps-brief`

This is where Claude actually decides. Four passes:

### Pass 0 — Discovery (independent of quant)
Generate ~10 candidates by **attention**, not signal: narrative-tracker leaders, aixbt-pulse projects, token-movers trending, plus targeted WebSearch (e.g. `"[narrative] tokens [today]"`). Filter to Bybit-listed perps only.

### Pass 1 — Combine, dedupe, tag
Merge quant candidates (perps-scan non-NEUTRAL hits) with discovery candidates. Tag each `[QUANT]`, `[DISCOVERY]`, or `[BOTH]`. Cap 15 unique assets. `[BOTH]` is the natural HIGH CONVICTION candidate — signal + attention agreeing.

### Pass 2 — Targeted enrichment
For each candidate, run 3–5 WebSearch queries chosen by profile:
- Always: token unlock schedule, recent 24h news catalyst, X sentiment proxy.
- Conditional by regime: CAPITULATION → reason for drop; DISTRIBUTION → resistance level, insider selling; CATALYST-BREAKOUT → what event drove this; ACCUMULATION/COMPRESSION → upcoming announcement.
- When narrative-tagged: regulatory / SEC angle.

Build a per-asset enrichment dossier of 3–6 concrete-facts lines. Speculation is not allowed.

### Pass 3 — Confluence judgement + composition
**Confluence judgement is Claude judgement, not hard thresholds.** The skill prompt explicitly enumerates what counts:
- Perps regime + narrative phase + clean catalyst calendar
- Sector tailwind + ACCUMULATION/COMPRESSION setup
- Market context regime aligned with bias direction + perps-scan flag
- `[BOTH]` tag + market regime aligned
- Repeat appearance (multi-day same regime + same narrative)

And what does NOT count:
- Just trending (attention without signal)
- Just CATALYST-BREAKOUT (24h move ≠ a setup)
- Hot narrative without quant confirmation
- Strong signal in conflict with market regime ("long majors" while breadth rolls risk-off)

**Bias labels are mandatory** on every HIGH CONVICTION setup, drawn from a fixed vocabulary:
- `long continuation` / `long breakout` / `long breakout-pending` / `long bounce` / `short fade` / `short continuation`
- Free-form qualifier allowed ("short fade — small", "long continuation w/ trailing stop"). Base term must come from the six.

**Cap 5 HIGH CONVICTION** in the published brief. Overflow rolls to artifact only.

**WATCHLIST** requires a *named* conflict — "market could turn" is rejected; "$200m unlock in 4 days, 6% of float" is accepted.

**Pattern-tag-aware reasoning is encoded into the prompt.** The skill explicitly knows that:
- REAL-CROWDED-LONG confirms a short-fade thesis
- RETAIL-ANOMALY contradicts a short-fade thesis (squeeze risk over fade)
- LONG-TRAP is the highest-severity short-fade setup
- STEALTH-POSITIONING upgrades a pre-breakout thesis
- CASH-AND-CARRY contradicts an accumulation read

**Regime transitions are first-class evidence** — they get cited in the Perps block when relevant.

---

## 5. Front-Page Synthesis — `morning-macro`

Cross-sector strategist read, under 1500 chars, three paragraphs:
1. **Regime read** (unlabeled) — Take + 2–3 concrete numbers + one-sentence dominant narrative.
2. **Cross-domain** (prefix `Cross-domain:`) — bridges from `aixbt-pulse`, especially macro/geo/tradfi with crypto transmission. Skipped entirely when nothing material.
3. **Today** (prefix `Today:`) — which sector brief has the action + named ticker setups. Discord channel mention is clickable.

Highest-value synthesis is **cross-sector confluence** — same theme in perps-brief AND narrative-tracker AND aixbt-pulse. v1 (current) only has perps as a sector; v2/v3 will add `on-chain-brief` and `stocks-brief`.

Skip-day discipline cascades: if `perps-brief` is in skip-day state, `morning-macro` writes the quiet variant with cash-patient stance.

---

## 6. Answering the Open Questions

### How is the perps universe selected?
CoinGecko `/derivatives` ranks the top 25 by aggregated 24h perp volume across Binance/OKX/Bybit, plus always-include BTC/ETH/SOL. Tier 1 = BTC/ETH/SOL (tighter classification thresholds). Tier 2 = the rest. Tier 3 (memes/micros) is excluded from quant scan but can enter the brief via Pass 0 discovery if the operator's attention sources surface them. The brief then Bybit-filters to ensure the final set is tradable as a perp.

### Are hard rules or Claude's judgement the right approach for context?
The live system uses **both, layered correctly**:
- **Hard rules in the data layer** (`perps-scan`). Tier-adjusted regime classification, deterministic sub-tags, deterministic pattern tags, deterministic aggregate verdict. The rules are visible, testable, and reproducible. This is the right place for them — Claude shouldn't be re-classifying 25 assets from raw numbers every day.
- **Judgement at the integration layer** (`perps-brief`). Confluence is explicitly Claude judgement. The prompt enumerates "what counts" and "what doesn't" as guidance, not gates. Claude chooses which assets clear HIGH CONVICTION.

This is the correct decomposition. The remaining question is whether judgement quality is being measured (it isn't — see Gap 1 below).

### Does market data affect Claude's view of narrative, regime, or catalysts? Priority?
Yes, by design. In `perps-brief` Pass 3, Claude integrates:
- Perps regime + sub-tags + pattern tags (from `perps-scan`)
- Narrative phase + leading tokens + position call (from `narrative-tracker`)
- Market regime + breadth + F&G + Polymarket (from `market-context-refresh`)
- Cross-domain bridge (from `aixbt-pulse`)
- Enrichment findings (Pass 2 WebSearch)

Priority is not absolute; the prompt frames it as confluence-detection. The strongest single example: a `[BOTH]`-tagged asset (signal + attention agree), in a regime aligned with market direction, with a clean catalyst calendar, is the canonical HIGH CONVICTION setup.

What does NOT happen: blind weighting. Claude is asked to *recognize* when signals align, not to *compute* alignment from a formula.

### What causes conviction? What causes fade?
**Conviction** in the live system is a *judgement*, not a tier from a point sum. The criteria (paraphrased from the prompt):
- Quant regime aligns with narrative phase aligns with market context aligns with positive enrichment.
- Single-signal aren't sufficient — even strong ones.
- `[BOTH]` tag is the highest-quality natural starting point.
- Repeat appearance across multiple days is a quality multiplier.

**Fade** is mechanized through specific named conditions:
- DISTRIBUTION regime + REAL-CROWDED-LONG pattern tag → real top risk
- LONG-TRAP pattern tag → highest-severity short-fade
- MOMENTUM → DISTRIBUTION transition → "trend topping, take profits or initiate fade"
- narrative-tracker FADE call confirming reflexivity flip
- Aggregate market read of CROWDED TOPPING — biases the whole brief fade-side

Token-call's mechanical HIGH/MEDIUM/SKIP from a point sum still exists as a feeder, but it's *one input to* perps-brief — no longer the headline decision.

### Are setups judged against other risks (BTC strength when reviewing alts)?
Yes, in several places:
- **Derived fields:** `pct_24h_vs_btc` and `pct_7d_vs_btc` are computed per asset in `perps-scan`. Outperformance and underperformance vs BTC are explicit numbers in every metric line.
- **Tier-adjusted thresholds:** BTC at -6% is treated as a meaningful flush; an alt at the same -6% is just normal noise (Tier 2 needs -10%). This means majors get classified more sensitively than they would on absolute thresholds.
- **Confluence rule:** the perps-brief prompt explicitly rules out "long majors while breadth flipping risk-off" as a non-confluence case.
- **Aggregate market read:** when `CROWDED TOPPING` or `DELEVERAGING`, the brief leans fade-side; when `LEVERAGE BUILDING`, it leans long-side.

What is *not* explicit: a hard "if BTC down N% in 5 days, demote all long alts one tier" rule. That gating is judgement, not threshold.

---

## 7. Remaining Gaps (the honest list)

In rough priority, lowest-effort highest-leverage first:

### Gap 1 — No outcome tracking / hit-rate measurement
The largest gap. The chain runs daily. Picks are logged. Whether they worked is never measured. There is no skill that:
- Reads back `perps-brief` HIGH CONVICTION setups from prior days
- Pulls current prices and computes returns vs entry, vs BTC, vs ETH at defined horizons (24h / 3d / 7d)
- Tags each pick "worked" / "didn't" / "neutral"
- Bins outcomes by bias label, by regime, by `[BOTH]` vs `[QUANT]` vs `[DISCOVERY]`, by pattern tag, by sub-tag
- Tracks calibration (did "long breakout-pending" calls actually break? at what rate?)
- Persists a track record file the chain can read

This is the keystone for self-improvement. Until it exists, every other prompt tweak is open-loop.

### Gap 2 — Confluence judgement is unobservable
The brief prompt enumerates what counts as confluence, but each HIGH CONVICTION setup is composed without writing down *which* of those criteria were met. The Perps/Narrative/Context/Enrichment sub-blocks show the inputs, but the integrative step ("I judge this clears HIGH CONVICTION because X + Y + Z, despite W") is implicit in the thesis line.

Making confluence-judgement *structured* (named criteria that fired, named criteria that were missing) would make Gap 1 actually useful — you could measure not just hit-rate but hit-rate-by-confluence-pattern.

### Gap 3 — Token-call's mechanical conviction tier is legacy noise
`token-call` still uses HIGH/MEDIUM/SKIP from a point sum. Its job in the v2 stack is to feed `perps-brief` Pass 1 as one signal among many. The mechanical tier was meaningful when token-call was the headline decision (v1). It now adds nothing the brief doesn't override.

Two options: (a) demote it to scoring + raw-feature output without a tier verdict, or (b) keep the tier but only use it as a feature input to the brief, never publish.

### Gap 4 — Per-venue funding skew not surfaced
Coinglass-aggregated OI-weighted funding is one number per asset. The actual signal often lives in **divergence between venues** — e.g. Hyperliquid alt funding at +0.3%/8h while Binance is at +0.05% means concentrated retail crowding on one venue. The scan layer flattens that.

Adding per-venue funding deltas as a derived field would surface this; pattern tag candidate: VENUE-CROWDING.

### Gap 5 — No options data
Deribit BTC/ETH 25-delta skew, term structure, gamma exposure — none of this is in the engine. For a perps regime classifier this is the biggest single-asset-class gap. Options skew often leads spot/perp by hours.

### Gap 6 — FAILED-MOVE pattern is deferred
Already noted in the v3 spec. Needs intraday high tracking the current data layer doesn't expose. Real signal — failed breakouts in DISTRIBUTION are some of the highest-quality short setups.

### Gap 7 — No exit logic / no position-sizing layer
The bias label says `long continuation w/ trailing stop` but no entry/stop/horizon discipline is encoded. "Trail stop below 7d range low" appears in worked examples but isn't required output. For a system that wants to be tracked against forward outcomes, every HIGH CONVICTION setup probably needs:
- Entry zone (or "current")
- Invalidation (price level OR signal-state change)
- Horizon (24h / 3d / 7d / multi-week)
- Size category (full / half / starter)

Without these the outcome tracker in Gap 1 has to guess at "did this work" framing.

### Gap 8 — Tier 3 (memes/micros) discovery is fragile
By design, perps-scan excludes Tier 3. Discovery in Pass 0 picks them up. But the Bybit-perps filter in Pass 1 is a hard gate. A meme that's listed only on Hyperliquid or Drift would silently drop. If the operator wants meme perps in scope, the venue universe needs to broaden — and that means importing additional funding/OI sources.

### Gap 9 — Aggregate market read is unidirectional
`perps-scan`'s verdict word (CROWDED TOPPING, LEVERAGE BUILDING, etc.) is computed daily but the brief uses it as ambient framing. Day-over-day verdict transitions (e.g. yesterday LEVERAGE BUILDING → today CROWDED LONG) aren't surfaced as a first-class signal. They probably should be — the *change in regime* across the whole universe is at least as predictive as individual asset regime changes.

---

## 8. What's Already Working (the honest list)

Worth naming, because most of these are non-trivial:
- Pre-fetch architecture solves the sandbox env-var-expansion problem cleanly. Same pattern works for Replicate, Etherscan, Coinglass.
- Tier-adjusted thresholds for majors fix the v1 problem where BTC at -6% never satisfied CAPITULATION.
- SHORT-SQUEEZE split from CATALYST-BREAKOUT — same price action, opposite mechanism, different trade.
- Pattern tags are independent of regime — a single asset can carry STEALTH-POSITIONING + ACCUMULATION + (regime sub-tag), each adding information.
- Regime transitions are first-class output — the highest-signal frame.
- JSON-intermediate + render-script pattern fixes ISS-003 / ISS-004 (Claude writing `## Summary` blobs into locked-format artifacts). LLM output is the data model; format is deterministic.
- `consume:` chain semantics are explicit and verifiable in `daily-ops-review`.
- Skip-day discipline is enforced at every layer (token-call, perps-brief, morning-macro) — no manufactured confluence.
- `[BOTH]` tag (quant + attention agreeing) is the right way to seed the brief — combines two independent universes without weighting one against the other.

---

## 9. Open Questions for the Operator (Phase 2 input)

Before designing changes, decisions that scope the work:

1. **Horizon discipline.** Are HIGH CONVICTION setups intended as 24h / 3d / 7d / multi-week ideas? Outcome tracking is meaningless without a defined horizon per setup.
2. **Self-improvement loop endpoint.** Does Claude get to *propose* prompt changes from track-record evidence (`autoresearch` style), or is the loop human-in-loop with Claude only producing the analysis?
3. **Venue scope.** Bybit-only filter is current. Adding Hyperliquid changes the universe substantially (alt funding skew, meme perps, but more rug risk). Worth it?
4. **What does "fade" mean operationally?** A short position, or a stand-aside / take-profit on existing longs? The bias labels are ambiguous on this — `short fade` reads as short-entry but in practice could mean exit a long.
5. **Position sizing or pure idea?** Should perps-brief output suggest position sizing (starter / half / full), or stay at "here are the setups; size them yourself"?
6. **Cross-sector v2/v3.** `on-chain-brief` and `stocks-brief` are referenced in `morning-macro` as future inputs. Real cross-sector confluence (AI in perps + AI in on-chain spot + AI in narratives) is the highest-value signal. What's the timeline?

---

## 10. Mistakes in My First Pass (correcting the record)

For honesty, my first draft was wrong because I audited the wrong branch (`elastic-thompson`, a v1 config from 2026-05-18). Specific claims I made that are false against the live engine:

| Claim | Reality |
|---|---|
| "No perps data, no funding/OI" | False. 8 Coinglass v4 endpoints per coin. |
| "Six monologues, no chain" | False. `morning-review` chain with 4 steps + `consume:` passing. |
| "No synthesis skill" | False. `perps-brief` is the dedicated synthesis layer. |
| "Decision fires before context" | False. Step 1 parallel, Step 2 consumes all of Step 1. |
| "Conviction is mechanical (point sum)" | Partial: `token-call` is, `perps-brief` HIGH CONVICTION is judgement. |
| "BTC strength is soft-only, never a gate" | False. `pct_24h_vs_btc` and tier-adjusted thresholds; aggregate verdict biases the brief. |
| "No regime gating" | False. 7 regimes + sub-tags + pattern tags + transitions, all surfaced to brief. |
| "Token-pick is the daily call" | False. `token-call` (renamed) is a feeder; `perps-brief` is the call. |

The genuinely-still-open critiques: outcome tracking, confluence-judgement observability, options data, per-venue funding skew, exit/horizon discipline.

---

## Sources

- `aeon.yml` (live branch) — `chains.morning-review` definition + skill schedules
- `skills/perps-scan/SKILL.md` (v3) — 7-regime classifier spec
- `skills/perps-brief/SKILL.md` — 4-pass synthesis spec
- `skills/token-call/SKILL.md` — successor to token-pick
- `skills/morning-macro/SKILL.md` — front-page read spec
- `skills/market-context-refresh/SKILL.md` — macro layer
- `skills/narrative-tracker/SKILL.md` — narrative layer
- `skills/aixbt-pulse/SKILL.md` — cross-domain layer
- Branch: `claude/fix-iss-006-recurrence` (worktree `angry-keller`)
