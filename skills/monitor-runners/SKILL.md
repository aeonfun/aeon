---
name: Monitor Runners
description: Find the top 5 tokens that ran hardest in the past 24h across major chains using GeckoTerminal
var: ""
tags: [crypto]
---
<!-- autoresearch: variation B — sharper output via composite Runner Score, actionable tags, session verdict, repeat-runner delta -->

> **${var}** — Filter by chain (e.g. "solana", "eth", "base", "bsc", "arbitrum"). If empty, scans all major networks.

Read `memory/MEMORY.md` for context.
Read the last 2 days of `memory/logs/` to find any tokens previously flagged as runners — **repeat runners across days are the real signal**.

## Why this skill exists

A flat "top 5 by 24h %" list is dominated by micro-cap meme coins with <$50k liquidity. That output trains the operator to ignore it. The biggest lever is **ranking by a composite Runner Score and tagging each pick with an actionable category** — so the operator can tell at a glance which picks are serious (deep-liq, sustained momentum) vs speculative (micro-cap, brand-new pool).

## Data Source

GeckoTerminal API (free, no API key). Docs: https://apiguide.geckoterminal.com

Endpoints used:
- `GET /networks/trending_pools?page=1` — trending pools across all networks (the % movers)
- `GET /networks/{network}/trending_pools?page=1` — per-network trending
- `GET /networks/{network}/pools?page=1&sort=h24_volume_usd_desc` — volume leaders (catches runners that aren't on the trending list yet)
- `GET /networks/new_pools?page=1` — newly created pools (brand-new breakouts)

Each pool object includes:
- `attributes.name` — pool name (e.g. "TOKEN / SOL")
- `attributes.price_change_percentage.{m5,m15,m30,h1,h6,h24}` — price changes
- `attributes.volume_usd.{m5,m15,m30,h1,h6,h24}` — volume
- `attributes.market_cap_usd` / `attributes.fdv_usd` — market cap
- `attributes.transactions.h24.{buys,sells,buyers,sellers}` — activity
- `attributes.pool_created_at` — pool creation timestamp
- `attributes.reserve_in_usd` — liquidity
- `relationships.network.data.id` — chain name
- `relationships.base_token.data.id` — base token address (for dedup)

## Steps

### 1. Fetch data (sequential, rate-limit aware)

```bash
TMPDIR=$(mktemp -d)
TODAY=$(date -u +%Y-%m-%d)

# Networks to scan. If ${var} is set, restrict to that one.
if [ -n "${var}" ]; then
  NETWORKS="${var}"
else
  NETWORKS="solana eth base bsc arbitrum"
fi

fetch_with_backoff() {
  local url="$1" out="$2"
  for delay in 0 2 4; do
    [ $delay -gt 0 ] && sleep $delay
    curl -s --max-time 15 "$url" > "$out"
    if ! grep -q '"status":"429"' "$out" 2>/dev/null && [ -s "$out" ]; then
      return 0
    fi
  done
  return 1
}

# Global trending
fetch_with_backoff "https://api.geckoterminal.com/api/v2/networks/trending_pools?page=1" "$TMPDIR/global.json" \
  && GLOBAL_OK=1 || GLOBAL_OK=0
sleep 1

# Per-network trending + volume leaders
for N in $NETWORKS; do
  fetch_with_backoff "https://api.geckoterminal.com/api/v2/networks/${N}/trending_pools?page=1" "$TMPDIR/${N}-trend.json" \
    && eval "${N}_TREND_OK=1" || eval "${N}_TREND_OK=0"
  sleep 1
  fetch_with_backoff "https://api.geckoterminal.com/api/v2/networks/${N}/pools?page=1&sort=h24_volume_usd_desc" "$TMPDIR/${N}-vol.json" \
    && eval "${N}_VOL_OK=1" || eval "${N}_VOL_OK=0"
  sleep 1
done

# New pools (for BREAKOUT tagging)
fetch_with_backoff "https://api.geckoterminal.com/api/v2/networks/new_pools?page=1" "$TMPDIR/new.json" \
  && NEW_OK=1 || NEW_OK=0
```

**Sandbox fallback:** if `curl` fails for any URL (file is empty or has `"status":"429"` after retries), retry that URL with **WebFetch** using the same URL. Parse the JSON response body.

### 2. Merge, dedupe, gate

From every fetched file, extract all pool objects. Then:

1. **Dedupe** by `relationships.base_token.data.id` — keep the highest-volume pool per token (same token may have multiple pools across DEXes).
2. **Gate on quality** — drop a pool if ANY of:
   - `volume_usd.h24 < 50000` (too thin to be a real runner)
   - `price_change_percentage.h24 <= 0` (we want runners, not dumps)
   - `reserve_in_usd < 10000` (liquidity floor)
   - `transactions.h24.sells / transactions.h24.buys > 10` (dumping pattern)
   - `transactions.h24.buys / transactions.h24.sells > 50` (honeypot pattern — nobody can sell)
   - pool_created < 1h ago AND `volume_usd.h24 < 100000` (too new to judge)
   - `price_change_percentage.h24 > 10000` (>100x — almost certainly a rug-in-progress)

Record the count of pre-gate and post-gate pools for the log.

### 3. Score each surviving pool

Compute a **Runner Score** (0-100) per pool. Use simple normalized components so the math is transparent:

```
pct_pts  = clamp(price_change_percentage.h24 / 500, 0, 1)        # 500% maps to full
vol_pts  = clamp(log10(volume_usd.h24 + 1) / 7, 0, 1)             # $10m vol = full
liq_pts  = clamp(log10(reserve_in_usd + 1) / 6, 0, 1)             # $1m liq = full
mom_pts  = clamp((price_change_percentage.h1 + 50) / 100, 0, 1)   # +50% h1 = full, -50% = 0
skew_pts = clamp(buys / (buys + sells), 0, 1)                     # 0.5 = neutral

runner_score = 40*pct_pts + 25*vol_pts + 15*liq_pts + 10*mom_pts + 10*skew_pts
```

This weights absolute move (40%) + liquidity-adjusted volume (25%) + liquidity depth (15%) + live momentum (10%) + buy pressure (10%). Pct_pts is clamped to avoid meme-coin moonshots flooding the ranking.

### 4. Tag each pool (exactly one tag)

Apply tags in priority order — first match wins:

| Tag | Condition |
|-----|-----------|
| **DEEP-LIQ** | `reserve_in_usd >= 1_000_000` AND `volume_usd.h24 >= 1_000_000` |
| **BREAKOUT** | `pool_created_at` within last 48h AND `volume_usd.h24 >= 250_000` |
| **CONTINUATION** | `price_change_percentage.h1 > 2` AND `price_change_percentage.h24 > 50` |
| **REVERSAL** | `price_change_percentage.h1 < -5` AND `price_change_percentage.h24 > 0` (fading) |
| **MICRO-SPEC** | everything else (default — small-cap speculation) |

### 5. Select the top 5 + session verdict

Rank by Runner Score descending, take top 5.

Compute a session verdict from the tag distribution among the top 5:

- **STRONG** — ≥2 DEEP-LIQ picks (real money moving)
- **MIXED** — 1 DEEP-LIQ OR ≥2 CONTINUATION (signal but speculative)
- **SPECULATIVE** — majority MICRO-SPEC/BREAKOUT (retail casino)
- **SLEEPY** — fewer than 5 pools survived the quality gate

### 6. Cross-reference prior days

From the last 2 days of `memory/logs/`, extract any token names flagged under `## Monitor Runners`. For each of today's top 5, mark **★ repeat** if the token name appears in either prior day's log. Sustained runners across multiple days deserve extra attention.

### 7. Notify

Send via `./notify` (under 4000 chars, no leading spaces). Format:

```
*runners — ${TODAY}* — verdict: STRONG

1. [TAG] TOKEN (chain) +X% 24h ★ repeat
vol $X.Xm | liq $X.Xm | fdv $Xm | h1 +X% | buys:sells X:Y
— [one-line actionable take: e.g. "sustained multi-day momentum with deep liquidity — watch for continuation"]

2. [TAG] TOKEN (chain) +X% 24h
vol $Xm | liq $Xk | fdv $Xm | h1 -X% | buys:sells X:Y
— [one-line take]

3. ...
4. ...
5. ...

sources: gt-global=ok gt-{networks}=ok/fail
vibe: [one-line read on overall tape mood]
```

**Formatting rules:**
- Format dollar values human-readable: `$2.3m`, `$450k`, `$75k`. Never show raw dollar amounts with comma separators.
- Format percentages: `+347%` (no decimals unless <10%, then `+4.2%`).
- If `market_cap_usd` is null, show `fdv $Xm (no mcap)`.
- Include the ★ repeat marker only for tokens appearing in prior days' logs.
- The one-line take MUST say something the operator can act on — not a restatement of the numbers. Good: "clean breakout, pool <24h old but already $500k liq locked". Bad: "price went up a lot with high volume".

**Edge cases:**
- If verdict is **SLEEPY** (<5 pools passed): send a short note instead — `*runners — ${TODAY}* — sleepy session, only N pools cleared quality gate. Skipping top-5.` Include the 1-2 survivors if any.
- If ALL sources failed (every `*_OK=0`): send `*runners — ${TODAY}* — MONITOR_RUNNERS_ERROR, all GeckoTerminal endpoints failed. Check sandbox/rate-limits.` and skip the rest.

### 8. Log

Append to `memory/logs/${TODAY}.md`:

```
## Monitor Runners
- **Networks scanned:** N (list)
- **Source status:** gt-global=ok|fail, per-network: ...
- **Pools pre-gate:** N / **post-gate:** N
- **Verdict:** STRONG|MIXED|SPECULATIVE|SLEEPY
- **Top 5:**
  1. [TAG] TOKEN (chain) +X% — score XX, vol $Xm, liq $Xk — [one-line take]
  2. ...
- **Repeat runners (seen in prior 2 days):** [list or "none"]
- **Gate rejections breakdown:** thin-vol=N, dumping=N, honeypot=N, too-new=N, rug-like=N
- **Notification sent:** yes|no (reason if no)
```

If a token appears as a runner on **3 days in a row**, flag it in `memory/MEMORY.md` under "Active topics" — sustained multi-day runners are worth a deeper look.

## Sandbox note

The sandbox may block outbound curl. Use **WebFetch** as a fallback for any URL fetch — for each URL that `curl` fails, call WebFetch on the same URL and parse the JSON body. GeckoTerminal requires no auth so no pre-fetch pattern needed.

## Constraints

- Never recommend trades. This is pure observation — "watch", "monitor", "interesting" are fine; "buy", "ape", "enter" are not.
- Don't inflate the list. If only 3 pools pass the gate, publish 3 — don't backfill with low-quality picks.
- The Runner Score math is deterministic — if two runs on the same data produce different top-5s, something is wrong.
