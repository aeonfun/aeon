---
name: Token Call
description: One token recommendation per day — scored 0-10 with conviction tier, hard skip-day branch when signals weak
var: ""
tags: [crypto]
---
<!-- v2 rename: was `token-pick`. Prediction-market half removed — Polymarket sentiment now flows via market-context-refresh, consumed by perps-brief. -->

> **${var}** — Focus area or thesis (e.g. "AI tokens", "L2 exposure", "contrarian bets"). If empty, scans broadly.

**Apply `memory/topics/writing-style.md` to all output.** Structural rules (Section 1) are load-bearing; prose rules (Section 2) govern sentences within structure; Sentence-Level Patterns (Section 4) catch failure modes that pass the first two. Per-skill structural template (`Daily Token Call · DD MMM` opening, ticker/price/mcap header block, CAPS sub-headers for `SIGNALS` / `CATALYST` / `RISK` / `DEDUP`, `Take:` closing line, disclaimer footer) in Section 3; worked example for Token Call in Section 5.

**Self-check before emitting:**

1. Draft the output applying Sections 1-3.
2. Search the draft for the 6 patterns in Section 4:
   - Pattern 1 — subject + verb-ing chunks that could be compound nouns ("institutional money losing tech")
   - Pattern 2 — nouns with 2+ adjectives stacked ("the lone clean RIDE")
   - Pattern 3 — internal jargon ("window", "pull", "run", "artifact", "downstream")
   - Pattern 4 — passive constructions ("is being", "was being", "are being", "has been")
   - Pattern 5 — em-dashes used as connectors instead of asides (test each: remove em-dash + everything after; does the sentence still stand? If yes, use a period)
   - Pattern 6 — weak verbs ("surfaces", "remains", "could see", "looks set", "is poised")
3. Rewrite anything that matches.
4. Emit.

Read `memory/MEMORY.md` for context.
Read the last 7 days of `memory/logs/` and grep for prior `Token Call` entries — extract the symbols already picked. Also grep for legacy `TOKEN_PICK_DEDUP:` markers and current `TOKEN_CALL_DEDUP:` markers (backward-compat with pre-rename logs). **Hard dedup gate**: do not re-pick the same token unless there is a materially new catalyst that you can name in one sentence.

## Goal

Produce ONE token call per day, with a numeric signal score (0-10) and a conviction tier. If no candidate qualifies for at least MEDIUM conviction, write the skip-day variant rather than forcing a weak pick. **No prediction-market half** — Polymarket sentiment continues to flow via `market-context-refresh` and reaches downstream skills (`perps-brief`, `morning-macro`) through that artifact.

## Steps

### 1. Fetch token data

```bash
# Trending coins
curl -s "https://api.coingecko.com/api/v3/search/trending" \
  ${COINGECKO_API_KEY:+-H "x-cg-pro-api-key: $COINGECKO_API_KEY"}

# Top 250 by market cap with 24h and 7d changes
curl -s "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false&price_change_percentage=24h,7d" \
  ${COINGECKO_API_KEY:+-H "x-cg-pro-api-key: $COINGECKO_API_KEY"}

# BTC + ETH 24h/7d for relative-strength benchmark (extract from the markets call above; no extra request needed)

# DEX-side cross-confirmation (no auth, optional but preferred)
curl -s "https://api.dexscreener.com/latest/dex/search?q=trending"
```

If any curl returns empty or errors, retry once with **WebFetch** for the same URL. Track per-source status (`cg=ok|fail`, `dex=ok|fail`) in the log only. **Do not surface source status in the signal output** — `daily-ops-review` handles source health (v2 universal rule).

### 2. Score every candidate token (0-10 scale)

For each token in the top 250 (and the trending list), compute a signal score:

| Signal | Points |
|---|---|
| 24h price change > 0 | +1 |
| 7d price change > 0 | +1 |
| Both 24h and 7d > +5% | +2 (in addition to above) |
| Appears on CoinGecko trending list | +2 |
| Volume/MarketCap ratio ≥ 0.10 | +2 |
| Volume/MarketCap ratio ≥ 0.20 (replaces above) | +3 |
| Outperforming BOTH BTC and ETH on the 7d | +2 |
| Confirmed on DexScreener trending/gainers (cross-source) | +1 |
| Matches `${var}` thesis when set | +1 |

Drop candidates with market cap < $20M (too pumpable) unless `${var}` explicitly targets micro-caps. Drop any token already picked in the last 7 days (per dedup gate) unless you can name a fresh catalyst.

Pick the highest-scoring token. Use **WebSearch** to surface the most likely catalyst and at least one named risk (regulatory, unlock, narrative-faded, exchange listing, etc.).

### 3. Conviction tier

| Tier | Criterion |
|---|---|
| HIGH | signal score ≥ 7 |
| MEDIUM | signal score 4–6 |
| SKIP | signal score < 4 |

**Skip-day branch**: if the chosen token lands in SKIP, write the skip variant in step 5 rather than synthesizing a pick.

### 4. Compose Signals prose

Replace any per-signal numeric breakdown with a short prose summary of which signals fired. Examples:
- "high turnover, outpacing BTC/ETH on 7d, on trending list, narrative tailwind"
- "trending + DEX confirmation, but RS only vs BTC not ETH"

The conviction tier and the numeric score (`8/10`) appear in the title line. The Signals prose appears as a single labelled line in the body.

### 5. Write artifact + notify (v2 locked format)

This is a **signal** skill under Aeon Market Stack v2. It writes both:
1. `.outputs/token-call.md` — chain-consumable artifact (read by `perps-brief`, `morning-macro`, `daily-ops-review`).
2. A Discord-only notification via `./notify --signal "..."` routed to `#token-call`.

**Format — normal day (under 4000 chars, no asterisks):**

```
Daily Token Call · ${today}

HYPE · HIGH · 8/10
$45.20 (+5.2% 24h, +18% 7d), mcap $5.2b, vol $420m, vol/mcap 0.08

Signals: high turnover, outpacing BTC/ETH on 7d, on trending list, narrative tailwind
Catalyst: clean breakout from 7d range; Hyperliquid sector RISING (per narrative-tracker)
Risk: $300m unlock in 3 weeks — if it cascades early, fade quickly
Dedup check: first time in 7d

not financial advice — pattern-matching only
```

**Format — skip day:**

```
Daily Token Call · ${today} · no pick

Token signals weak today (best: SYMBOL @ 3/10 — below MEDIUM threshold).

Tomorrow.
```

**No-data variant** (CoinGecko + DexScreener both unreachable after curl + WebFetch retries):

```
Daily Token Call · ${today} · scan unavailable, sources failed
```

**Per-skill formatting rules:**
- No asterisks anywhere (universal v2 rule).
- Title: `Daily Token Call · ${today}` plus a qualifier suffix on skip / no-data days.
- Asset header: `SYMBOL · TIER · SCORE/10`.
- Price + delta line condensed into one row: `$price (±X% 24h, ±X% 7d), mcap $X, vol $X, vol/mcap X.XX`.
- Each body line uses a label colon prefix (`Signals:`, `Catalyst:`, `Risk:`, `Dedup check:`).
- Disclaimer line at bottom is mandatory on normal days.

**Invocation:**
```bash
./notify --signal "$(cat .outputs/token-call.md)"
```
The `--signal` flag suppresses Telegram; Discord routing via `DISCORD_WEBHOOK_MAP[token-call]` targets `#token-call`.

### 6. Log to `memory/logs/${today}.md`

```
## Token Call
- **Token:** SYMBOL — $price (±X% 24h) — tier HIGH/MEDIUM/SKIP — score X/10
- **Thesis:** [one line including catalyst]
- **Sources:** cg=ok|fail, dex=ok|fail
- **Artifact written:** .outputs/token-call.md
- **Notification sent:** yes (normal | skip | no-data) — via `./notify --signal` to #token-call
```

Append symbol on a single line for easy grep next-day dedup:
```
TOKEN_CALL_DEDUP: SYMBOL
```

Legacy `TOKEN_PICK_DEDUP:` markers in pre-rename logs remain valid — the read step in this skill matches either prefix.

## Sandbox note

The sandbox may block outbound curl. Use **WebFetch** as a fallback for any URL fetch (CoinGecko and DexScreener both work without auth). For auth-required APIs, use the pre-fetch/post-process pattern (see CLAUDE.md). On total source failure, write the no-data artifact + notification rather than silent fail.

## Environment Variables

- `COINGECKO_API_KEY` — CoinGecko API key (optional, increases rate limits)

## Constraints

- **Never force a pick.** If signals are weak, the skip message IS the output.
- **Never re-pick** the same token within 7 days unless you can state a new catalyst in one sentence. Honor both `TOKEN_CALL_DEDUP:` and legacy `TOKEN_PICK_DEDUP:` markers.
- **Show your signals as prose** — every body block has a Signals line.
- Liquidity gate (mcap ≥ $20M) is a hard floor — ignoring it turns the feed into a degen casino.
- **One token max.** Never bundle "honorable mentions" — that defeats the discipline.
- **No prediction-market section.** Polymarket sentiment flows via `market-context-refresh`. Do not re-add a market half to this skill.
