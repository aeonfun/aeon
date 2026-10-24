---
name: onchain-monitor
description: Monitor blockchain addresses and contracts for notable activity
metadata:
  title: Onchain Monitor
  category: crypto
  var: ""
  tags:
    - crypto
  requires:
    - ALCHEMY_API_KEY?
    - COINGECKO_API_KEY?
    - ETHERSCAN_API_KEY?
  capabilities:
    - external_api
    - sends_notifications
---
<!-- autoresearch: variation B — sharper output (decoded transfers + counterparty labels + ranked USD-denominated one-liners + TL;DR lede); folds in A's Alchemy+Etherscan-v2 input path and C's persistent state + source-status footer + dedup. -->

> **${var}** — Watch label or chain to check. Empty = all watches. `add-address:<0x… [chain]>` is the shape the Telegram force-reply sends — it appends a new watch and exits (see step 0).

If `${var}` is set, only monitor the watch with that label or watches on that chain.

## Config

Reads `memory/on-chain-watches.yml`. If the file is missing or `watches: []`, offer to add the first watch via a Telegram force-reply (only if no `add-address` prompt was offered in the last 2 days of `memory/logs/` — dedup so an unconfigured fork isn't nagged every run), then log `ON_CHAIN_NO_CONFIG` and exit cleanly (do **not** send an alert — empty config is not an error):

```bash
./notify "No addresses on watch yet. Paste one to monitor — a 0x… wallet, optionally its chain." \
  --force-reply --placeholder "0x… base" \
  --context "onchain-monitor::add-address"
```

The reply routes back as `var=add-address:<0x… [chain]>`, handled by the config-capture branch in step 0. Record `FORCE_REPLY_OFFERED: add-address` in the log when you send it.

```yaml
# memory/on-chain-watches.yml
watches:
  - label: My Wallet
    address: "0x1234...abcd"
    chain: ethereum          # ethereum | base | arbitrum | optimism | polygon | robinhood
    type: wallet             # wallet | contract
    threshold_usd: 1000      # alert on transfers ≥ this USD value (default 1000)
  - label: Uniswap Pool
    address: "0xabcd...5678"
    chain: ethereum
    type: contract
    event_topics:            # optional — only alert on these topic0 hashes
      - "0xddf252ad..."      # ERC20 Transfer
```

Optional `memory/known-addresses.yml` — counterparty label dictionary used to humanize alerts. Lowercase keys, free-text values:
```yaml
labels:
  "0x28c6c06298d514db089934071355e5743bf21d60": "Binance 14"
  "0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43": "Coinbase 10"
  "0xe592427a0aece92de3edee1f18e0157c05861564": "Uniswap V3 Router"
  "0x0000000000000000000000000000000000000000": "Zero (mint/burn)"
```

## State

`memory/on-chain-state.json` — per-watch state, persisted atomically after each successful run:

```json
{
  "My Wallet": {
    "last_block": 19345678,
    "last_run": "2026-04-20T12:00:00Z",
    "last_block_hash": "0x…",
    "alerted_tx": [
      {"hash": "0xabc...", "block_number": 19345690, "first_seen": "2026-04-20T12:00:00Z"},
      {"hash": "0xdef...", "block_number": 19345702, "first_seen": "2026-04-20T12:00:00Z"}
    ],
    "median_usd_30d": 8500
  }
}
```

- `last_block` — start block for the next run's fetch. Initialise to `current_block − 2400` (≈ 8h ETH) on first run; on `robinhood` (~0.1s blocks) use `current_block − 280000` for the same ≈ 8h window. On `robinhood`, also cap every later run at that span: if `current_block − last_block` is more than 280000 (a delayed or caught-up run; 12h late is ~420k blocks, 15 windows per direction per watch), start from `current_block − 280000` and log `CLAMPED: skipped <n> blocks` for that watch, so a late run degrades to "last ~8h" instead of walking the whole gap.
- `last_block_hash` — the canonical hash observed for `last_block` on the previous successful run. Before fetching new events, read that block again. If the hash differs, log `REORG: block <n> changed <old> → <new>`, rewind the watch to `max(0, last_block − 12)` (or the chain's documented finality depth), and replay the range. Do not send an alert until the replay completes. Keep normal transaction-hash dedup during the replay: a reorg can re-mine the same transaction in a new block, and that must not alert twice. Legacy string entries from earlier state are hashes and dedup the same way.
- `alerted_tx` — objects `{hash, block_number, first_seen}` for txs alerted in the last 7 days, capped at 200. Used for cross-run dedup by `hash`; purge by `first_seen`. `block_number` is the block the alert was seen in, kept for the audit trail.
- `median_usd_30d` — rolling median USD size of transfers at this watch; powers the `WHALE-TRANSFER` tag.

Write the file via `mv` from a tempfile so a mid-run failure cannot corrupt state.

## Steps

Read `memory/MEMORY.md`, `memory/on-chain-watches.yml`, `memory/on-chain-state.json`, and the last 2 days of `memory/logs/` (for visibility only — state lives in the JSON file).

### 0. Config capture (Telegram force-reply)

Before the per-watch loop, intercept the add-a-watch reply. When `${var}` starts with `add-address:`, the operator replied to the force-reply prompt (offered in the Config section on an empty config) — append a watch and **exit** (no monitoring this invocation). The remainder is `<address> [chain]`:

```bash
case "${var}" in
  add-address:*)
    REST="$(printf '%s' "${var#add-address:}" | sed 's/^[[:space:]]*//')"
    ADDR="$(printf '%s' "$REST" | awk '{print $1}')"
    CHAIN="$(printf '%s' "$REST" | awk '{print tolower($2)}')"; CHAIN="${CHAIN:-ethereum}"
    case "$CHAIN" in ethereum|base|arbitrum|optimism|polygon|robinhood) ;; *) CHAIN=ethereum ;; esac
    if ! printf '%s' "$ADDR" | grep -qiE '^0x[0-9a-f]{40}$'; then
      ./notify "Couldn't read \"$ADDR\" as an address. Reply with a 0x… wallet, optionally a chain."
      exit 0
    fi
    mkdir -p memory; touch memory/on-chain-watches.yml
    # Normalize an empty inline list so we can append block items, and ensure a watches: key exists.
    sed -i.bak -E 's/^watches:[[:space:]]*\[\][[:space:]]*$/watches:/' memory/on-chain-watches.yml && rm -f memory/on-chain-watches.yml.bak
    grep -q '^watches:' memory/on-chain-watches.yml || printf 'watches:\n' >> memory/on-chain-watches.yml
    if grep -qi "$ADDR" memory/on-chain-watches.yml; then
      ./notify "Already watching ${ADDR}."
    else
      SHORT="$(printf '%s' "$ADDR" | sed -E 's/^(0x.{4}).*(.{4})$/\1…\2/')"
      cat >> memory/on-chain-watches.yml <<EOF
  - label: "$SHORT"
    address: "$ADDR"
    chain: $CHAIN
    type: wallet
    threshold_usd: 1000
EOF
      ./notify "Now watching ${SHORT} on ${CHAIN} (wallet, moves ≥\$1000). Edit memory/on-chain-watches.yml to tune."
    fi
    # log under ### onchain-monitor: - view: add-address (var="${var}") → $ADDR on $CHAIN
    exit 0 ;;
esac
```

Defaults for a captured watch: `type: wallet`, `threshold_usd: 1000`, `label` = the shortened address. The operator refines chain/type/threshold by editing `memory/on-chain-watches.yml` directly. (This appends to the end of the file, which is correct because `watches:` is the only top-level key — if a future config grows more keys, insert under `watches:` instead of at EOF.)

For each watch (filtered by `${var}`):

### 1. Fetch raw activity from `last_block` → the pinned `to_block`

Once per chain at the start of the run, resolve `current_block` and its hash. That
number is the chain's `to_block`: every watch on that chain, and every source
(Alchemy, Etherscan, RPC), queries up to it and no further. Never send `latest`,
`endblock=99999999` or an open-ended range. Each watch keeps its own `from_block`
(its `last_block`, after the clamp and any reorg rewind). For a watch with
`last_block_hash`, perform the reorg check above before constructing any query
windows.

**Path A — Alchemy** (preferred, if `ALCHEMY_API_KEY` set).

Wallets use `alchemy_getAssetTransfers` — one call returns categorized in/out history with `value`, `asset`, `category`, `hash`, `from`, `to`, `metadata.blockTimestamp`. Run it twice per watch (once with `toAddress`, once with `fromAddress`) and merge.

```bash
./secretcurl -m 10 -s -X POST "https://${network}.g.alchemy.com/v2/{ALCHEMY_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"alchemy_getAssetTransfers","params":[{
    "fromBlock":"0x'${from_block_hex}'",
    "toBlock":"0x'${to_block_hex}'",
    "toAddress":"'${address}'",
    "category":["external","internal","erc20","erc721","erc1155"],
    "withMetadata":true,"excludeZeroValue":true,"maxCount":"0x32"
  }]}'
```

Contracts use `eth_getLogs` against the same Alchemy URL, with numeric hex `fromBlock` / `toBlock` set to the watch's `from_block` / the chain's `to_block`. Alchemy allows any block range while the response stays under 10,000 logs, and unlimited results for ranges of 5,000 blocks or fewer; on `Log response size exceeded`, re-query in 5,000-block windows (a busy `robinhood` contract hits this within minutes of ~0.1s blocks).

Chain → network slug: `ethereum=eth-mainnet`, `base=base-mainnet`, `arbitrum=arb-mainnet`, `optimism=opt-mainnet`, `polygon=polygon-mainnet`, `robinhood=robinhood-mainnet`. On `robinhood`, drop `"internal"` from the wallet `category` list: Alchemy rejects it there ("The 'internal' category is not supported for this network").

**Path B — Etherscan v2 unified** (fallback, if Alchemy path fails or key unset).

Single endpoint, all 50+ chains via `chainid`. Works keyless at lower rate limit.
```bash
# Append the key only when set, via ./secretcurl's {ETHERSCAN_API_KEY} placeholder —
# a bare $ETHERSCAN_API_KEY is refused by the Bash permission analyzer; keyless works.
KEYQ=""; [ -n "${ETHERSCAN_API_KEY:+x}" ] && KEYQ="&apikey={ETHERSCAN_API_KEY}"
# wallet
./secretcurl -m 10 -s "https://api.etherscan.io/v2/api?chainid=${chainid}&module=account&action=tokentx&address=${address}&startblock=${from_block}&endblock=${to_block}&sort=desc${KEYQ}"
./secretcurl -m 10 -s "https://api.etherscan.io/v2/api?chainid=${chainid}&module=account&action=txlist&address=${address}&startblock=${from_block}&endblock=${to_block}&sort=desc${KEYQ}"
# contract
./secretcurl -m 10 -s "https://api.etherscan.io/v2/api?chainid=${chainid}&module=logs&action=getLogs&address=${address}&fromBlock=${from_block}&toBlock=${to_block}${KEYQ}"
```

Chain → chainid: `ethereum=1`, `base=8453`, `arbitrum=42161`, `optimism=10`, `polygon=137`, `robinhood=4663`. Etherscan's free tier refuses `chainid=4663` ("Free API access is not supported for this chain"), so a keyless `robinhood` watch skips Path B and uses Path C.

**Path C — Robinhood Chain public RPC** (`robinhood` only; keyless fallback when Path A is unavailable and Path B is refused).

Wallets: ERC-20 `Transfer` logs with the watch address as recipient, then as sender. The public RPC caps a query without an `address` filter at **30,000 blocks**, so walk `from_block → to_block` (the chain's pinned block) in 30,000-block windows (≈ 10 windows per direction per 8h, ≈ 28 per day). Contracts: `eth_getLogs` with `address` set (no 30,000 cap). For **both** wallets and contracts, if a window answers `logs matched by query exceeds limit of 10000`, halve it and query both halves, repeating until each piece fits; a busy address hits this inside one 30,000-block window (the v4 PoolManager returns ~29.7k logs there, which takes 3 splits and 7 calls).
```bash
T=0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef   # ERC-20 Transfer
W=0x000000000000000000000000${address#0x}                               # 32-byte topic
# per window [lo, hi] (hi - lo < 30000) as 0x-hex, e.g. lo=$(printf 0x%x "$n"); the RPC rejects decimal
# incoming, then outgoing
curl -m 15 -s -X POST https://rpc.mainnet.chain.robinhood.com -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getLogs","params":[{"fromBlock":"'$lo'","toBlock":"'$hi'","topics":["'$T'",null,"'$W'"]}]}'
curl -m 15 -s -X POST https://rpc.mainnet.chain.robinhood.com -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getLogs","params":[{"fromBlock":"'$lo'","toBlock":"'$hi'","topics":["'$T'","'$W'"]}]}'
```
ERC-721 `Transfer` has the same topic0 and also matches these filters. Tell them apart by topic count: **3 topics** = ERC-20 (amount in `data`); **4 topics** = ERC-721 (`data` is empty, the token id is `topics[3]`). Keep 3-topic logs as `erc20`; tag 4-topic logs `erc721` and never call `decimals()` on them (NFT contracts revert). Read `symbol()` / `decimals()` per distinct ERC-20 token with `eth_call` (`0x95d89b41` / `0x313ce567`) on the same RPC. Path C sees token transfers only, not native ETH transfers; note `path=rpc (tokens only)` in the source footer. On HTTP 429, back off and retry the window; if it still fails, mark the watch `fail` as below.

**Fetch fallback.** Both Alchemy and Etherscan carry their key in the URL via `./secretcurl` (`{ALCHEMY_API_KEY}` / `{ETHERSCAN_API_KEY}` placeholders), so if a call fails, retry the exact same URL via **WebFetch**. For POSTs, WebFetch accepts the JSON body. Path C needs no key; on a non-429 failure, retry the same RPC POST through WebFetch the same way before marking the watch `fail`.

If every path for a watch fails, mark the watch `fail` in the source footer and continue to the next — never abort the whole run.

### 2. Decode every transfer

Required fields per event (normalised across Alchemy / Etherscan payloads):

| Field | Source |
|-------|--------|
| `tx_hash` | `hash` / `txHash` |
| `block_number`, `timestamp` | `blockNum` / `metadata.blockTimestamp` |
| `category` | `external_eth` \| `erc20` \| `erc721` \| `erc1155` \| `internal` \| `log` |
| `direction` | `in` if `to == watch`, else `out` |
| `token.symbol`, `token.decimals` | Alchemy returns inline; for Etherscan, use `tokenSymbol`/`tokenDecimal` fields |
| `value_token` | human amount, e.g. `1,234,567.89 USDC` |
| `value_usd` | `value_token × price_usd` (see step 3) |
| `counterparty` | the non-watch address on the transfer |
| `counterparty_label` | lookup in `known-addresses.yml`, else `null` |

### 3. USD-enrich in one bulk call

Collect distinct `(chain, token_contract)` pairs from decoded transfers. Bulk price via CoinGecko:

```bash
CGQ=""; [ -n "${COINGECKO_API_KEY:+x}" ] && CGQ="&x_cg_demo_api_key={COINGECKO_API_KEY}"
./secretcurl -m 10 -s "https://api.coingecko.com/api/v3/simple/token_price/${chain}?contract_addresses=${joined}&vs_currencies=usd${CGQ}"
```

Native ETH/MATIC/etc. use `simple/price?ids=ethereum,matic-network,...`. If CoinGecko is unreachable or returns no price for a token, set `value_usd = null` and tag the event `UNPRICED` — keep it in the log, drop it from the notification (can't meaningfully threshold without USD).

### 4. Filter

Drop an individual event if any of:
- `value_usd < threshold_usd` (watch config, default $1000)
- `value_usd < $0.10` (hard dust floor — prevents airdrop / phishing spam)
- `tx_hash` matches the `hash` field (or, for legacy entries, the string itself) of an entry in this watch's `alerted_tx` (cross-run dedup, also during a reorg replay)
- `category == "log"` and watch has `event_topics:` and the topic0 is not in the list

### 5. Categorize surviving events

Tag each event with one short label so the alert says *what kind of move it was*:

| Tag | Condition |
|-----|-----------|
| `CEX-IN` / `CEX-OUT` | counterparty label contains an exchange name (`Binance`, `Coinbase`, `Kraken`, `OKX`, `Bybit`, `Bitfinex`) |
| `DEX-SWAP` | counterparty label contains a router (`Uniswap`, `1inch`, `Curve`, `Sushi`, `Aerodrome`, `CoWSwap`) |
| `BRIDGE` | counterparty label contains a bridge (`Across`, `Stargate`, `Hop`, `Synapse`, `Wormhole`, `Celer`) |
| `MINT` / `BURN` | counterparty is `0x000…000` or the token contract itself |
| `WHALE-TRANSFER` | `value_usd > 10 × median_usd_30d` for this watch |
| `UNKNOWN-IN` / `UNKNOWN-OUT` | fallback — based on direction |

A single event can only carry one tag; pick by priority CEX > DEX > BRIDGE > MINT/BURN > WHALE > UNKNOWN.

### 6. Format the alert

One notification per run. Sort all surviving events globally by `value_usd` desc; group the output by watch label (watches with zero surviving events are omitted entirely). Lead with a one-sentence TL;DR naming the single biggest move.

```
*On-Chain Alert — ${today}*
TL;DR: My Wallet sent $1.2M USDC to Binance 14 (biggest move on any watch in 30d).

*My Wallet* (ethereum)
• CEX-OUT $1.2M USDC → Binance 14 — [tx](https://etherscan.io/tx/0x...)
• DEX-SWAP $42k WETH → USDC via Uniswap V3 Router — [tx](https://etherscan.io/tx/0x...)

*Uniswap Pool* (ethereum)
• WHALE-TRANSFER $850k WETH out → 0x9f...a1 — [tx](https://etherscan.io/tx/0x...)

3 events on 2 watches | sources: alchemy=ok, coingecko=ok, etherscan=skipped | last_block→${block}
```

Cap the notification body at 10 events; if more survived, append `+N more — see memory/logs/${today}.md`. The `./notify` call should use the explorer URL for each chain (`etherscan.io`, `basescan.org`, `arbiscan.io`, `optimistic.etherscan.io`, `polygonscan.com`, `robinhoodchain.blockscout.com`).

Send the alert with `./notify -f alert.md`.

### 6.1 Evidence mode — make every alert replayable

When at least one watch completes, write a compact evidence receipt to
`memory/evidence/${today}-${run_id}.json` before sending the notification. This is
an audit trail, not a safety verdict: it records what was queried and which source
answered, but it does not prove that an external RPC is honest.

`run_id` is the UTC start timestamp with `:` replaced by `-`. The receipt must contain:

```json
{
  "schema": "aeon.onchain-monitor.evidence.v1",
  "run_id": "2026-04-20T12-00-00Z",
  "chains": [{
    "chain": "robinhood",
    "chain_id": 4663,
    "from_block": 92300000,
    "to_block": 92347891,
    "block_hash": "0x…",
    "sources": {"rpc": "ok", "alchemy": "skipped", "coingecko": "ok"},
    "query_windows": 12,
    "watches": 2,
    "raw_events": 16,
    "kept_events": 2,
    "dropped_events": 14,
    "unpriced_events": 0,
    "tx_hashes": ["0x…"]
  }],
  "sha256": "<digest of this object without sha256>"
}
```

Rules:

- Emit one entry in `chains` for every chain represented by the completed watches;
  never merge ranges, block hashes, source statuses, counters, or tx hashes across
  chains. A run may span multiple chains.
- Pin each chain entry's `from_block` and `to_block` to its actual request range. Do
  not use `latest` in the receipt; resolve it to a number first.
- Fetch each chain entry's `block_hash` for `to_block` from the same source when
  possible. If the source cannot provide it, use `null` and mark that source
  `degraded`.
- Record every split query in each chain entry's `query_windows`; this makes the
  Robinhood 10,000-log fallback visible instead of silently changing the sample.
- Lowercase each chain entry's `tx_hashes` and `block_hash`, sort the hashes
  lexicographically and remove duplicates. Never
  include API keys, full RPC URLs containing credentials, or raw response bodies.
- Canonicalise the JSON with sorted keys, compact separators and UTF-8 text with
  no `\u` escapes (in Python: `json.dumps(obj, sort_keys=True,
  separators=(",", ":"), ensure_ascii=False).encode()`), compute SHA-256 using a
  standard-library implementation, then add the `sha256` field and write
  atomically via a temporary file and `mv`. Python's default `ensure_ascii=True`
  produces a different digest as soon as a label contains non-ASCII text.
- Before writing, create `memory/evidence/` if needed and prune receipts older than
  30 days by the date in the filename, not by mtime (every Actions run is a fresh
  checkout, so mtime is always today). Files that do not start with a
  `YYYY-MM-DD-` date are left alone:
  ```bash
  cutoff=$(date -u -d '30 days ago' +%Y-%m-%d)
  for f in memory/evidence/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]-*.json; do
    [ -f "$f" ] || continue
    d=$(basename "$f")
    if [[ "${d:0:10}" < "$cutoff" ]]; then rm -f -- "$f"; fi
  done
  ```
  A pruning failure is non-fatal but must make the source footer `evidence=fail`.
- Include the receipt path and digest in the alert footer before calling `./notify`:
  `evidence: memory/evidence/<file> · sha256:<first 12 hex chars>`.
- If receipt writing fails, continue the monitor run but mark the source footer
  `evidence=fail`; never claim that the alert is independently verified.

### 6.2 Verify a receipt offline (optional)

Operators can verify a receipt written by step 6.1 without contacting a chain,
RPC, price API, or GitHub:

```bash
node scripts/verify-onchain-evidence.mjs memory/evidence/<file>.json
```

The verifier accepts only `aeon.onchain-monitor.evidence.v1`. It recomputes the
SHA-256 over the receipt with `sha256` removed, recursively sorts object keys,
uses compact UTF-8 JSON, and checks chain-local ranges, counters, block hashes,
source degradation, and sorted unique transaction hashes. It also rejects
credential-bearing URLs, secret-like fields, and raw response-body fields.

Exit code `0` means the file is internally consistent. Exit code `1` identifies
the failed field or invariant; exit code `2` means the input path was omitted.
This checks internal checksum and schema consistency only. Anyone able to replace
the receipt can also recompute its digest, so this is not a signature or proof of
authorship. It does not prove that an RPC was honest, that the chain was final, or
that the receipt describes external reality. Secret detection is best-effort,
not a guarantee that all sensitive content is absent. The verifier performs no
network access.

### 7. Persist state and log

For each watch whose fetch **succeeded** (success ≠ "events found"):
- `last_block ← to_block` (the chain's pinned `current_block`)
  - `last_block_hash ← hash(to_block)` from that same pinned block read
- `last_run ← now` (ISO 8601 UTC)
- `alerted_tx ← (new_alerted_entries + alerted_tx)[:200]`, where each new entry is `{hash: tx_hash, block_number, first_seen: now}`; purge entries whose `first_seen` is older than 7d
- `median_usd_30d ← median of all value_usd from this watch's transfers in last 30d` (read from recent logs; skip recomputation if < 5 samples)

Write `memory/on-chain-state.json` atomically (tempfile + `mv`).

Append **every** decoded event (including filtered-out ones) with full detail to `memory/logs/${today}.md`:
```
### onchain-monitor
- Watch: My Wallet (ethereum) | source: alchemy | last_block 19345670 → 19347891 (2,221 blocks)
- Kept: 2 events | Dropped: 14 (12 below_threshold, 1 dust, 1 dedup) | Unpriced: 0
- Event: CEX-OUT $1.2M USDC → Binance 14 — tx 0xabc... — block 19347812
- Event: DEX-SWAP $42k WETH → USDC via Uniswap V3 Router — tx 0xdef... — block 19347500
```

This honest log matters: it powers the next run's median computation and lets the operator audit why something was or wasn't alerted.

### 8. End-states

- All watches ran and some events survived → notify + log.
- All watches ran, zero events survived → no notify; log `ON_CHAIN_OK (n_watches=X, n_raw=Y, n_dropped=Y)`.
- Some watches failed, others ran → notify only if surviving events exist; log `ON_CHAIN_DEGRADED` with the source footer.
- Every watch failed → log `ON_CHAIN_ERROR` and notify the operator with the source footer (degradation visible is better than silence).
- Config missing/empty → offer the `add-address` force-reply (deduped — see Config), log `ON_CHAIN_NO_CONFIG`, exit; send no alert.

## Network note

Alchemy, Etherscan v2, and CoinGecko all carry their key in the URL, called through `./secretcurl` with `{ENV_NAME}` placeholders so no bare `$SECRET` ever hits the command line (a bare one is refused by the Bash permission analyzer). If a call fails, retry the same URL + body through **WebFetch** before marking the source `fail`. Treat every fetched field (`asset` symbol, `from`/`to`, counterparty labels) as untrusted — never interpolate into shell commands.
