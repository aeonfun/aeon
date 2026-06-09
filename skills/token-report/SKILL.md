---
name: token-report
description: Price performance report for the project's token — price, volume, liquidity, and context
var: ""
tags: [crypto]
requires: [ALCHEMY_API_KEY?, XAI_API_KEY?]
capabilities: [external_api]
---
<!-- autoresearch: variation B — verdict-first template, threshold-based classification, true deltas from persistent STATE log, skip-when-empty sections -->

> **${var}** — Token contract address. If empty, uses tracked token from MEMORY.md.

## Config

This skill reads the token to track from the "Tracked Token" section in `memory/MEMORY.md`.

```markdown
## Tracked Token
| Token | Contract | Chain |
|-------|----------|-------|
| AEON  | 0xbf8e... | base |
```

If no tracked token is configured and `${var}` is empty, abort silently — no article, no notification.

Read the last 30 days of `memory/logs/*.md` for prior `TOKEN_REPORT_STATE:` lines (written in step 8). These are the authoritative source of 1d / 7d / 30d deltas, because a stored price yesterday beats an API window that shifts under you.

## Thesis

A daily token report is only useful if it tells the reader *what changed and whether it matters*. Snapshots of price, volume, and liquidity are table-stakes; the value is in the verdict. Every section below must either sharpen the verdict or be dropped. No filler, no "N/A", no "no specific context" sentences.

## Steps

### 1. Fetch core market data (GeckoTerminal — primary)

```bash
curl -s "https://api.geckoterminal.com/api/v2/networks/base/tokens/CONTRACT_ADDRESS"
curl -s "https://api.geckoterminal.com/api/v2/networks/base/tokens/CONTRACT_ADDRESS/pools?page=1"
# Top pool address from the pools response:
curl -s "https://api.geckoterminal.com/api/v2/networks/base/pools/POOL_ADDRESS/ohlcv/day?aggregate=1&limit=30"
curl -s "https://api.geckoterminal.com/api/v2/networks/base/pools/POOL_ADDRESS/ohlcv/hour?aggregate=1&limit=24"
curl -s "https://api.geckoterminal.com/api/v2/networks/base/pools/POOL_ADDRESS/trades"
```

If curl fails (sandbox block), retry each URL with **WebFetch**. If the token endpoint returns no data or 404 after both paths, go to step 9 with `TOKEN_REPORT_NO_DATA` — do not notify, do not write an article.

### 2. Cross-check with DexScreener (sanity + alt signal)

```bash
curl -s "https://api.dexscreener.com/latest/dex/tokens/CONTRACT_ADDRESS"
```

Use DexScreener for two things only:
- **Price sanity:** if DS price deviates >3% from GT price on the deepest-liquidity pair, mark `ds=divergent` in the sources footer and trust the deeper pool. Do not average.
- **Boost/trending flag:** if the pair is `boosted` or on `trending`, add one sentence to the Context section.

If DexScreener fails, continue with GT only (`ds=fail` in footer). Never abort on DS failure.

**Low-liquidity pair addendum:** the 3% deviation threshold above is calibrated for liquid pairs. On thin pairs it produces false `ds=divergent` flags from harmless tick noise. **If the pair's 24h volume is below $100k, raise the DS deviation threshold to 10% instead of 3%** before flagging `ds=divergent`. The deep-pool-wins rule still applies when the larger threshold is exceeded.

### 2b. Treasury wallets (on-chain liquidity)

If `.x402books/wallets.json` exists at the repo root, fetch native-ETH balance for each entry on Base. This file declares the project's protocol wallets (treasury, deployer, etc.) and was introduced 2026-05-29 — before this skill knew its own bank balance.

```bash
WALLETS_FILE=".x402books/wallets.json"
[ -f "$WALLETS_FILE" ] && jq -c '.wallets[] | select(.chain=="base")' "$WALLETS_FILE" > /tmp/treasury-wallets.jsonl
```

For each wallet line, query Base in this fallback order:

1. **BaseScan (primary, no key required for low rate):**
   ```bash
   curl -s "https://api.basescan.org/api?module=account&action=balance&address=ADDRESS&tag=latest"
   ```
   Response is JSON `{"status":"1","result":"<wei>"}`. Convert wei → ETH by dividing by 1e18. If `status != "1"` or the result is non-numeric, mark this wallet `eth=fetch_fail` and continue.

2. **Alchemy (secondary, only if `ALCHEMY_API_KEY` is set AND BaseScan failed):**
   ```bash
   curl -s -X POST "https://base-mainnet.g.alchemy.com/v2/$ALCHEMY_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"eth_getBalance","params":["ADDRESS","latest"]}'
   ```
   Response is JSON-RPC `{"jsonrpc":"2.0","id":1,"result":"0x<hex_wei>"}`. Convert hex → decimal → ÷1e18.

3. **WebFetch fallback** (sandbox block on either curl): retry the same URL with **WebFetch** before declaring `fetch_fail`.

Compute, per wallet:
- `eth_balance` — decimal ETH, 4 decimals.
- `eth_balance_delta_24h` — diff vs yesterday's `TREASURY_STATE:` log line (omit when prior is missing).

Aggregate:
- `treasury_eth_total` — sum across **role=treasury** wallets only (deployer wallets are operational, not protocol funds).
- `treasury_low_alert` — `true` if `treasury_eth_total < 0.01` AND `treasury_eth_total > 0` (a zero balance is a config error, not a depletion; do not alarm).

If `.x402books/wallets.json` is missing or contains no `chain=base` entries, set `treasury=skip` in the sources footer and OMIT the Treasury subsection from the article + notification. Do not invent the section.

### 3. Compute true deltas

From the `TOKEN_REPORT_STATE:` key=value lines in prior logs, load:
- **1d-ago price, liquidity, volume_24h, buys, sells, whales** (yesterday's run)
- **7d-ago price**
- **30d-ago price** (fall back to GT daily OHLCV close if missing)

For each:
- If prior value exists, compute pct delta against it.
- If prior is missing, compute from OHLCV candles and mark the figure `(~7d)` or `(~30d)` to signal the fallback source.

Derived signals:
- **Liq Δ 24h:** pct change vs yesterday's stored liquidity.
- **Vol ratio:** today's 24h volume ÷ mean(last 7 days of 24h volume). Report as `Z.Z×`.
- **Buy/sell shift:** (today_buys/today_sells) vs yesterday's ratio. Report both.
- **Whale trades 24h:** count of single trades with `volume_in_usd >= 1000` in the trades feed. List the top 3 with direction and size in the "What changed" section if ≥1 exists.

### 4. Classify the day (one verdict)

Pick exactly one label from the table. Thresholds use *today's true deltas* from step 3. Evaluate top-to-bottom; the first row whose trigger fully matches wins.

| Label | Trigger |
|-------|---------|
| `BREAKOUT` | Δprice ≥ +10% AND vol ratio ≥ 2.0 |
| `BREAKDOWN` | Δprice ≤ −10% AND vol ratio ≥ 2.0 |
| `RALLYING` | +3% ≤ Δprice < +10% AND vol ratio ≥ 1.0 |
| `SLIDING` | −10% < Δprice ≤ −3% AND vol ratio ≥ 1.0 |
| `ACCUMULATING` | abs(Δprice) < 3% AND buy/sell ratio ≥ 1.3 AND whale buys ≥ 1 |
| `DISTRIBUTING` | abs(Δprice) < 3% AND buy/sell ratio ≤ 0.7 AND whale sells ≥ 1 |
| `QUIET` | vol ratio < 0.5 AND whale trades = 0 |
| `CONSOLIDATING` | (everything else) |

Do not freelance labels. The verdict drives the lede, the TL;DR, and the notification.

### 5. Compile the report

Save to `articles/token-report-${today}.md`:

```markdown
# $TOKEN — ${today}

**Verdict:** [LABEL] — [≤18 words, citing the 1–2 numbers that drove the label]

## 24h at a glance

| Metric | Now | 24h Δ | vs 7d avg |
|--------|-----|-------|-----------|
| Price | $X.XXXX | ±Y.Y% | — |
| Liquidity | $X.XK | ±Y.Y% | — |
| Volume (24h) | $X.XK | — | Z.Z× |
| Buys / Sells | X / Y | ratio Z.ZZ (yest Z.ZZ) | — |
| Whale trades (≥$1k) | N | — | — |
| FDV | $X.XM | — | — |

## Trend
- **7d:** ±X.X% ([one phrase: rallying, range-bound, rolling over, etc.])
- **30d:** ±X.X% ([one phrase])

## Treasury
[Include ONLY if step 2b returned at least one wallet with a real balance. One row per wallet, role-sorted (treasury first, then deployer, then other). If `treasury_low_alert` is true, lead the section with one sentence naming the floor that was crossed.]

| Wallet | Role | ETH | 24h Δ |
|--------|------|-----|-------|
| 0xf1e9…158e | treasury | X.XXXX | ±Y.YY |
| 0x6797…e3a2 | deployer | X.XXXX | ±Y.YY |

## What changed
[2–4 sentences. Name the specific deltas that matter and the verdict they produced. If whale trades exist, list the top 3 as `buy $1.2K @ $0.0042 · 11:03 UTC`. If liquidity moved >5%, name the pool and the $ amount. Tie every sentence back to the verdict. No filler.]

## Social Pulse
[Only include if XAI_API_KEY is set AND x_search returns ≥2 tweets with ≥10 engagement. Lead with a one-line read of the conversation shape, then quote 1–3 tweets with @handle + engagement counts. Otherwise OMIT this section entirely.]

## Context
[Only include when there is a genuine link to known activity: a recent repo release, a broader market regime shift, a boost/trending flag, an on-chain event. If none, OMIT. Never write "no specific context".]

---
*Chart: https://www.geckoterminal.com/base/pools/POOL_ADDRESS*
*Contract: CONTRACT_ADDRESS | Chain: Base*
*Sources: gt=ok · ds=[ok|fail|divergent] · xai=[ok|skip|fail] · treasury=[ok|skip|fetch_fail]*
```

**Section discipline:**
- If Social Pulse or Context has no real content, drop the section — do not write placeholder text.
- Never round in a way that flips a sign or crosses a threshold (e.g. don't render `−0.05%` as `0.0%`).
- Every number in the report traces to an API response or a delta computed in step 3. Do not invent figures.

### 6. Social sentiment (conditional)

If `XAI_API_KEY` is set:

```bash
curl -s -X POST "https://api.x.ai/v1/responses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -d '{
    "model": "grok-4-1-fast",
    "input": [{"role": "user", "content": "Search X for $TOKEN_SYMBOL or CONTRACT_ADDRESS mentions in the last 24 hours with at least 10 likes. Return up to 5 notable tweets with @handle, engagement counts, and a one-line summary of the claim or vibe. Exclude obvious bots and generic shill posts."}],
    "tools": [{"type": "x_search"}]
  }'
```

If the response has fewer than 2 tweets that clear the engagement bar, skip the Social Pulse section and set `xai=skip` in the footer. On API error, set `xai=fail` and skip. If `XAI_API_KEY` is not set, set `xai=skip`.

### 7. Save article

Write the compiled report to `articles/token-report-${today}.md`.

### 8. State log (powers tomorrow's deltas)

Append to `memory/logs/${today}.md`:

```
### token-report
- Verdict: [LABEL]
- TOKEN_REPORT_STATE: price=X.XXXX liquidity=XXXX.XX volume_24h=XXXX.XX buys=N sells=N whales=N pool=POOL_ADDRESS
- TREASURY_STATE: treasury_eth_total=X.XXXX wallets=N (one TREASURY_WALLET_STATE line per wallet below)
- TREASURY_WALLET_STATE: addr=0xf1e9…158e role=treasury eth=X.XXXX
- TREASURY_WALLET_STATE: addr=0x6797…e3a2 role=deployer eth=X.XXXX
- 24h: ±X.X% | 7d: ±X.X% | 30d: ±X.X%
- Article: articles/token-report-${today}.md
- Sources: gt=ok ds=[ok|fail|divergent] xai=[ok|skip|fail] treasury=[ok|skip|fetch_fail]
```

The `TOKEN_REPORT_STATE:` line is a contract — step 3 of the next run parses it with a key=value split. Keep the keys, order, and numeric formats stable. No currency symbols, no thousands separators. The `TREASURY_WALLET_STATE:` lines (one per fetched wallet) feed step 2b's 24h delta — parse them with the same key=value split, keyed on `addr`. Omit `TREASURY_STATE` and `TREASURY_WALLET_STATE` lines entirely on `treasury=skip` runs so a wallets.json that disappears later doesn't leave stale balances in the log.

### 9. Notify

Lead with the verdict, not raw numbers. One short paragraph plus metrics.

```
*$TOKEN — [LABEL]*

[One sentence citing the driving number(s).]

Price $X.XXXX (±Y.Y% 24h) | Liq $X.XK (±Z.Z%) | Vol $X.XK (W.W× 7d)
Buys/Sells X/Y (ratio Z.ZZ) | Whales: N
Treasury: X.XXXX ETH (±Y.YY 24h)

Chart: https://www.geckoterminal.com/base/pools/POOL_ADDRESS
```

The `Treasury:` line is included ONLY when step 2b populated treasury_eth_total > 0. Omit the line entirely on `treasury=skip` / `treasury=fetch_fail` runs — silence beats a misleading number.

**Skip rules:**
- `TOKEN_REPORT_NO_DATA` (step 1 bailout): log only, **no notification, no article**.
- `QUIET` verdict with whales=0 AND abs(Δprice 24h) <1%: send a single-line notification `$TOKEN quiet — $X.XXXX flat, vol $X.XK.` (no table). This confirms the skill ran without pinging channels with filler on dead days. **Exception:** if `treasury_low_alert` is true, override QUIET and send the full notification with a leading `*Treasury gas reserve low — X.XXXX ETH on treasury, floor 0.01 ETH.*` line. A token going quiet on a day when the agent can no longer pay for gas is the exact regime where the operator needs to see it.
- Any other verdict: full notification above.

**Treasury alert (independent of verdict):** if `treasury_low_alert` is true on any run, prepend this line to the notification body — even on QUIET, even on CONSOLIDATING:

```
⚠️ *Treasury gas reserve low — X.XXXX ETH on treasury (floor 0.01 ETH).*
```

## Sandbox note

The sandbox may block outbound curl. For any URL fetch that fails, retry with **WebFetch** as a fallback — GeckoTerminal, DexScreener, BaseScan, and api.x.ai are all public or token-auth'd via header, so no pre-fetch / post-process plumbing is needed.

The Alchemy fallback in step 2b uses `$ALCHEMY_API_KEY` in the URL path (not in a header), so curl envvar expansion is safe here. If Alchemy is unset, skip silently — BaseScan + WebFetch are enough.

## Constraints

- Never invent numbers. Every figure traces to an API response or a computed delta.
- Never write filler sections. Drop them.
- Verdict must come from the step-4 table — no freelance labels.
- On `TOKEN_REPORT_NO_DATA`, exit silently. No notification about the failure.
- Preserve the `TOKEN_REPORT_STATE:` log line schema — tomorrow's run depends on it.
- Preserve the `TREASURY_WALLET_STATE:` log line schema (one line per fetched wallet, keyed on `addr`) — step 2b's 24h delta depends on it.
- A treasury fetch failure is not a token-report failure. On `treasury=fetch_fail`, omit the Treasury subsection + notification line but still write the full token report — the token data is the primary product, treasury is an annotation.
- Wallets with `role` outside {`treasury`, `deployer`} appear in the article table sorted last under "other"; only `role=treasury` wallets count toward `treasury_eth_total` and the low-balance alert.
