---
name: Price Alert
category: crypto
description: Fire when the tracked token does something — new ATH, sharp 1h move, or operator-set target crossed. Silent on normal days.
var: ""
tags: [crypto]
---
> **${var}** — Optional. Pass one or more `target_price` levels (comma-separated USD numbers, scientific notation allowed) to fire a one-time alert when the price crosses any of them. Empty = only ATH and sharp-move gates run. Pass `dry-run` to skip notify (state still updates).

Today is ${today}. `repo-pulse` reports star/fork deltas once a day, and the other scheduled digests run at fixed hours. None of them tell the operator "the price just hit a new high" or "the token moved 28% in the last hour" — both are events that warrant attention the moment they happen, not 14 hours later in a daily digest. This skill closes that window.

## Why this exists

Scheduled daily digests are calm summaries. Real moves need real-time signal. Three classes of move are worth a same-day ping:
- **New all-time high.** The single most narrative-shaping price event a token can have. Worth marking on the timeline regardless of size.
- **Sharp 1h moves (±20%).** Either a buyer wave or a liquidation cascade — both change what the operator does next (post about it, watch for follow-through, check the chart).
- **Operator-set target crossings.** The operator may want to know when price clears $X (often a personal stretch goal or a level tied to a tweet/launch). One alert per target per direction.

Everything else is noise not worth a same-day ping.

## Config

Reads:
- `memory/MEMORY.md` "Tracked Token" section — the tracked token's contract/chain. If absent, exit silently.
- `memory/topics/price-alert-state.json` — last-known ATH, last-alert timestamps per event type, target-crossing history. Created with defaults on first run.

Writes:
- `memory/topics/price-alert-state.json` — updated state every run.
- `memory/logs/${today}.md` — one log block per run, even on `OK`.
- Notification via `./notify` — only when a gate fires.

No new secrets. Uses keyless DexScreener; falls back to WebFetch when curl is sandbox-blocked.

## State schema

```json
{
  "contract": "0xbf8e8f0e8866a7052f948c16508644347c57aba3",
  "chain": "base",
  "ath": {
    "price_usd": 0.000003757,
    "observed_at": "2026-05-10T19:00:00Z",
    "announced_at": "2026-05-10T19:30:00Z"
  },
  "last_alerts": {
    "ath": "2026-05-10T19:30:00Z",
    "sharp_move": null,
    "target_hit": null
  },
  "targets": {
    "0.000005": {
      "side": "above",
      "first_seen_below_at": "2026-05-11T08:00:00Z",
      "hit_at": null,
      "announced_at": null
    }
  }
}
```

Key invariants:
- `ath.price_usd` only ever monotonically increases. If a run sees a lower price than the stored ATH, leave the ATH alone.
- `last_alerts.*` powers the 4h dedup window. Each gate has its own clock.
- `targets.${price}.side` is `above` if `current_price < target` when the target was first observed (operator is waiting for the price to climb to it), and `below` otherwise. Set once, never flipped.
- `targets.${price}.hit_at` is set the run the cross happens. `announced_at` is set the run the notification fires. They differ only if the run lands inside a dedup window — but target alerts never re-fire, so `hit_at == announced_at` in practice.

## Steps

### 1. Parse var

- If `${var}` matches `^dry-run` → `MODE=dry-run`. Strip the prefix; remainder (if any) is treated as targets.
- Otherwise `MODE=execute`.
- Split the remainder on `,` (commas) and strip whitespace.
- For each token: if it parses as a positive float (scientific notation OK, e.g. `5e-6`), include it. Reject zero / negative / non-numeric tokens and log `PRICE_ALERT_BAD_TARGET: ${token}` — continue with the surviving targets.
- If after filtering the remainder was non-empty but yielded zero valid targets → log `PRICE_ALERT_BAD_VAR: ${var}` and exit (no notify).
- If the remainder was empty, `TARGETS=()` is fine — ATH and sharp-move gates still run.

### 2. Resolve tracked token

```bash
mkdir -p memory/topics
[ -f memory/topics/price-alert-state.json ] || cat > memory/topics/price-alert-state.json <<'EOF'
{"contract":null,"chain":null,"ath":null,"last_alerts":{"ath":null,"sharp_move":null,"target_hit":null},"targets":{}}
EOF
```

Parse the "Tracked Token" table in `memory/MEMORY.md`. Pull `CONTRACT` (column 2 of the first data row) and `CHAIN` (column 3, lowercased). If the section is missing, the table is empty, or the contract field doesn't match `^0x[0-9a-fA-F]{40}$` → log `PRICE_ALERT_NO_TOKEN` and exit (no notify, no state write).

If the state file's `contract` is set and differs from the resolved contract → log `PRICE_ALERT_TOKEN_CHANGED` and reset the state file to defaults with the new contract/chain. ATH starts over with the new token.

### 3. Fetch current price (DexScreener primary)

```bash
RESP=$(curl -fsS "https://api.dexscreener.com/latest/dex/tokens/${CONTRACT}" 2>/dev/null || echo "")
```

If the response is empty, falsy, or `jq` can't parse it → fall back to **WebFetch** on the same URL with prompt `"Return the raw JSON body verbatim."` and try again. If both paths fail → log `PRICE_ALERT_FETCH_FAIL` and exit with status `ERROR` (no notify, no state mutation beyond touching `last_run_at`).

From the parsed JSON:
- Filter `.pairs[]` to entries where `.chainId == "${CHAIN}"`.
- Of those, pick the entry with the **highest `.liquidity.usd`** — call this the deepest pool. If no pair matches the chain, fall back to the highest-liquidity pair across all chains and mark `chain=fallback` in the log.
- Extract: `CURRENT_PRICE=.priceUsd` (float), `H1_CHANGE_PCT=.priceChange.h1` (float, may be missing → treat as 0), `H24_CHANGE_PCT=.priceChange.h24` (float, may be missing → treat as 0), `POOL_URL=.url`.

If `CURRENT_PRICE` is missing, zero, or non-numeric → log `PRICE_ALERT_BAD_PRICE` and exit `ERROR`.

### 4. Evaluate ATH gate

```
prior_ath = state.ath.price_usd  (null on first run)
new_ath   = (prior_ath is null) OR (CURRENT_PRICE > prior_ath)
```

If `new_ath`:
- Always update `state.ath.price_usd = CURRENT_PRICE`, `state.ath.observed_at = NOW`.
- Notify only if the last `ath` alert was >4h ago (or never). On the first run after token initialisation, suppress the notification (we don't know if this is genuinely an ATH or just the starting baseline) — set `state.ath.announced_at = NOW` so subsequent strict-higher prices alert correctly.
- If suppressed because `prior_ath is null` (first run), record verdict `ATH_BASELINE` for the log; no notify.
- Otherwise verdict for this gate is `ATH`.

### 5. Evaluate sharp-move gate

```
sharp = abs(H1_CHANGE_PCT) >= 20.0
```

If `sharp`:
- If `state.last_alerts.sharp_move` is within the last 4h → verdict `SHARP_MOVE_DEDUPED`, no notify.
- Otherwise verdict `SHARP_MOVE`, notify, set `state.last_alerts.sharp_move = NOW`.

Sign of `H1_CHANGE_PCT` decides the direction word in the message (`up` for ≥0, `down` for <0).

### 6. Evaluate target-crossing gate

For each target in `TARGETS`:
- If the target isn't yet in `state.targets`: this is the first time the operator has set it. Record `side` (`above` if `CURRENT_PRICE < target`, else `below`), `first_seen_below_at=NOW`, `hit_at=null`, `announced_at=null`. **Do not notify on first observation.** This avoids "the price was already there when you set the target" noise.
- If the target is in `state.targets` and `hit_at` is already set → skip; target-hit alerts are one-shot per side.
- Otherwise check the cross:
  - `side=above` & `CURRENT_PRICE >= target` → crossed.
  - `side=below` & `CURRENT_PRICE <= target` → crossed.
- On cross: set `hit_at=NOW`, `announced_at=NOW`, verdict `TARGET_HIT` for this target, notify (subject to 4h dedup on `last_alerts.target_hit`).

Targets that crossed in prior runs stay in the state file with `hit_at` set so they don't refire if the price wobbles back.

### 7. Combine verdicts and notify

Run-level verdict precedence (used for the log status line and the notification ordering):
1. `ATH` — strict new high after baseline.
2. `TARGET_HIT` — operator-set level crossed.
3. `SHARP_MOVE` — ±20% in 1h.
4. `OK` — no gate fired.

If multiple gates fired in the same run, send one notification per gate. Each gate independently respects its own dedup clock — an ATH and a TARGET_HIT in the same run produce two messages; an ATH and a SHARP_MOVE_DEDUPED produce one.

#### Notification templates

**ATH:**

```
*$TOKEN — New ATH — ${today}*

$TOKEN just printed a new all-time high at $X.XXXXe-N.
Previous ATH: $Y.YYYYe-N (set ${prior_ath_age} ago).
24h move: ±Z.Z% · 1h move: ±W.W%

Chart: ${POOL_URL}
```

**SHARP_MOVE:**

```
*$TOKEN — Sharp 1h Move — ${today}*

$TOKEN ${up|down} ${abs(h1):.1f}% in the last hour — now $X.XXXXe-N.
24h: ±Z.Z%
${one of: "Buyer wave — watch for follow-through." | "Selling pressure — watch the next hour for stabilisation." }

Chart: ${POOL_URL}
```

(Direction phrase is hard-coded by sign: positive = buyer wave; negative = selling pressure. No freelance commentary.)

**TARGET_HIT:**

```
*$TOKEN — Target Hit — ${today}*

$TOKEN just crossed $${target} (now $X.XXXXe-N).
Direction: ${above|below}
24h: ±Z.Z% · 1h: ±W.W%

Chart: ${POOL_URL}
```

If `MODE == dry-run`: build the messages, log the planned notifications, but skip `./notify`. State still updates so dedup clocks advance correctly.

Cap each message at ~2500 chars; price-alert messages are short by nature and shouldn't approach this.

### 8. Persist state

Rewrite `memory/topics/price-alert-state.json` atomically:

```bash
TMP=$(mktemp)
jq --arg ts "$(date -u +%FT%TZ)" '
  .last_run_at = $ts |
  .contract = $contract |
  .chain = $chain |
  .ath = $ath_obj |
  .last_alerts = $last_alerts_obj |
  .targets = $targets_obj
' memory/topics/price-alert-state.json > "$TMP"
mv "$TMP" memory/topics/price-alert-state.json
```

Validate with `jq empty memory/topics/price-alert-state.json` after writing; if it fails, restore from a `.bak` copy and log `PRICE_ALERT_STATE_CORRUPT`. Keep one `.bak` rolling.

Cap `state.targets` to 20 most-recent entries (LRU by `first_seen_below_at`) so a long-running fork doesn't accumulate stale operator targets.

### 9. Log

Append to `memory/logs/${today}.md`:

```
## Price Threshold Alert
- **Skill**: price-alert
- **Token**: ${SYMBOL} (${CONTRACT})
- **Current**: $X.XXXXe-N | 1h: ±W.W% | 24h: ±Z.Z%
- **ATH**: $Y.YYYYe-N (set ${YYYY-MM-DD HH:MM} UTC) [${UNCHANGED|NEW}]
- **Sharp-move gate**: ${FIRED|QUIET|DEDUPED}
- **Targets evaluated**: ${comma-list of target prices} → ${comma-list of per-target verdicts}
- **Verdicts fired**: ${comma-list, or NONE}
- **Notifications sent**: ${N}
- **Status**: ${PRICE_ALERT_OK | PRICE_ALERT_ATH | PRICE_ALERT_SHARP_MOVE | PRICE_ALERT_TARGET_HIT | PRICE_ALERT_DRY_RUN | PRICE_ALERT_NO_TOKEN | PRICE_ALERT_TOKEN_CHANGED | PRICE_ALERT_FETCH_FAIL | PRICE_ALERT_BAD_PRICE | PRICE_ALERT_BAD_VAR | PRICE_ALERT_STATE_CORRUPT}
```

The status field carries the *highest-priority* gate fired this run, or the most relevant error. `OK` means the run completed cleanly and no gate fired.

## Exit taxonomy

| Status | Meaning | Notify? |
|--------|---------|---------|
| `PRICE_ALERT_OK` | Run completed, no gate fired | No |
| `PRICE_ALERT_ATH` | New strict all-time high (post-baseline) | Yes |
| `PRICE_ALERT_SHARP_MOVE` | ±20% in 1h, outside dedup window | Yes |
| `PRICE_ALERT_TARGET_HIT` | Operator target crossed for the first time | Yes |
| `PRICE_ALERT_DRY_RUN` | `var=dry-run` mode | No (state still updates) |
| `PRICE_ALERT_NO_TOKEN` | No tracked token configured in MEMORY.md | No |
| `PRICE_ALERT_TOKEN_CHANGED` | Tracked contract changed since last run; state reset | No |
| `PRICE_ALERT_FETCH_FAIL` | Both curl and WebFetch failed | No |
| `PRICE_ALERT_BAD_PRICE` | API returned malformed/zero price | No |
| `PRICE_ALERT_BAD_VAR` | `${var}` had non-empty, non-`dry-run` text but yielded zero valid targets | No |
| `PRICE_ALERT_STATE_CORRUPT` | jq validation failed after write; restored from `.bak` | No |

## Sandbox note

DexScreener is keyless and public — curl works in unrestricted runners. The sandbox may block outbound curl on GitHub Actions; in that case the **WebFetch fallback** kicks in (built-in Claude tool, sandbox-safe, prompt: `"Return the raw JSON body verbatim."`). No prefetch script needed: there's no env-var-in-headers, and the URL doesn't change between runs. Notify uses the postprocess-notify pattern already wired up via `./notify`.

## Constraints

- **One alert per event per 4h window.** The state file's `last_alerts.*` map is the only authority on whether to suppress.
- **Target alerts are one-shot per side.** Once `hit_at` is set, the target never re-fires — even if the price wobbles back through the level. Operators add new targets if they want continued signal.
- **No baseline alert.** The first run after a fresh state file or token change must NOT send an ATH notification — the stored price is the baseline, not a "new high." Subsequent strict-higher prices alert.
- **No freelance interpretation.** The sharp-move direction phrase is hard-coded by sign. Do not embellish with TA opinions ("looks like distribution", "could test support"). The verdict tells the operator *what* happened; the operator decides *what it means*.
- **Liquid-pool selection only.** The deepest-liquidity pair on the configured chain wins. Don't compute prices from blended pool averages — the deepest pool's `priceUsd` is the canonical mark.
- **State writes are atomic + validated.** Every state write goes through a tmpfile + `jq empty` validation step. Corrupt writes restore from `.bak`.
- **Read-only across `memory/logs/`.** This skill never modifies past log files. It only appends to today's.
- **Targets are absolute USD, not percentages.** This avoids ambiguity ("20% from where?"). If operators want move-from-now alerts they have the sharp-move gate.
- **Idempotent under same-minute reruns.** Same-minute reruns with identical price input produce identical state and zero new notifications (every gate dedup-suppressed).
