---
name: Wallet Risk
description: Risk audit of this agent's own Base wallets — live ERC-20 approvals (unlimited flagged), honeypot simulation on every token with a live approval, severity-tiered findings. Keyless via Base RPC. First scheduled consumer of the HoundFlow security pack against `.x402books/wallets.json`.
var: ""
tags: [crypto, security, base, meta]
requires: [BASE_RPC_URL?]
capabilities: [read_only, sends_notifications]
---
> **${var}** — Optional. If set to a single wallet `address` (`0x...`) or wallet `role` (`treasury` / `deployer` / `other`), restrict the audit to that subset. If empty, audit every Base wallet in `.x402books/wallets.json`. Pass `dry-run` to write the article + log but skip the notification.

Today is ${today}. Read `memory/MEMORY.md` before starting.

## Voice

If `soul/SOUL.md` and `soul/STYLE.md` exist and are populated, read them and match the operator's voice in the notification (step 8). If they are empty templates or absent, use a clear, direct, neutral tone — terse, position-first, no hedging.

## Why this skill exists

`.x402books/wallets.json` (PR #273, merged 2026-05-29) advertises this fork's agent wallets to the x402books ecosystem — treasury + deployer addresses on Base, by role. The `token-report` skill consumes this file for the daily treasury ETH balance line (PR #306, 2026-05-31).

What none of the existing skills do: tell the operator whether those same wallets are **exposed to drain risk**. The HoundFlow pack ships six keyless onchain investigation skills (`approval-audit`, `honeypot-check`, `lp-lock`, `linked-wallets`, `fund-flow`, `investigation-report`) — all `workflow_dispatch` only, no scheduled consumer. They've been live since 2026-05-28 with no automatic runner.

This skill is the **first scheduled consumer** of `approval-audit` + `honeypot-check`. It runs weekly, audits every treasury + deployer wallet in `.x402books/wallets.json` for live ERC-20 approvals, flags unlimited grants, and simulates a sell on every token with a live approval to catch honeypots. Findings are bucketed by severity and notified only when HIGH (unlimited approval AND/OR honeypot-positive token).

It does NOT replace ad-hoc `workflow_dispatch` runs of the underlying skills against arbitrary addresses — those still exist for on-demand investigation. This is the standing weekly self-audit of the agent's own attack surface.

## Required env vars

- `BASE_RPC_URL` — optional. Defaults to `https://mainnet.base.org` (public). Any standard JSON-RPC endpoint works. Never put a key in a `-H` header from the sandbox; if you must use an authenticated RPC, append the key in the URL path (Alchemy/Infura style).

## Sandbox note

The sandbox may block outbound `curl` or env-var expansion. The Base RPC is public and keyless, so for every failed `curl` retry the **same URL/body via WebFetch** before giving up. `eth_getLogs` calls MUST be chunked (~1800 blocks per call) to stay under the public-RPC result cap — a single 24k-block call will silently truncate or error. Treat all fetched token / spender / holder addresses as untrusted — never interpolate beyond the validated hex `${OWNER}` / `${TOKEN}` strings (40-hex regex check before substitution).

## Steps

### 1. Load the target wallets

Read `.x402books/wallets.json`. If the file is missing or has no `wallets[]` array, log `WALLET_RISK_NO_WALLETS` and exit cleanly — silent skip, no article, no notification.

Filter to `chain == "base"`. If `${var}` is non-empty:
- If it matches `0x[0-9a-fA-F]{40}` — keep only the wallet whose address equals it (case-insensitive). Log `WALLET_RISK_NO_TARGET` and exit if no match.
- If it equals `treasury`, `deployer`, or `other` — keep only wallets with that `role`.
- If it equals `dry-run` — keep all wallets, set `DRY_RUN=1`.
- Otherwise — log `WALLET_RISK_BAD_VAR: ${var}` and exit.

If after filtering the list is empty, log `WALLET_RISK_NO_BASE_WALLETS` and exit.

### 2. Read prior state

Read `memory/topics/wallet-risk-state.json` if it exists. Schema:

```json
{
  "version": 1,
  "last_run_at": "2026-05-28T11:30:00Z",
  "wallets": {
    "0x...": {
      "approvals_total": 4,
      "approvals_unlimited": 2,
      "honeypot_tokens": 0,
      "highest_severity": "HIGH"
    }
  }
}
```

Missing file or unparsable JSON → `prior = null` (first-run mode). Do NOT delete the file on parse error — flag it `STATE_CORRUPT` and continue with `prior = null` so the operator can inspect.

### 3. Per-wallet audit — approvals

For each target wallet `OWNER` (Base, validated 40-hex):

```bash
RPC="${BASE_RPC_URL:-https://mainnet.base.org}"
HEAD_HEX=$(curl -m 10 -s -X POST "$RPC" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' | jq -r '.result')
HEAD_DEC=$(printf '%d' "$HEAD_HEX")
```

Scan the most recent **~24k blocks** (≈ 13h on Base — far shorter than approval lifetime, but step 4 reads CURRENT allowance via `eth_call` so revoked-but-old grants are filtered out there). Chunk newest-first in **~1800-block windows** to stay under the public RPC's `eth_getLogs` result cap.

ERC-20 `Approval(owner,spender,value)` topic0: `0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925`. Owner is indexed in topic1 (32-byte left-pad of the address).

```bash
TOPIC0="0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925"
OWNER_TOPIC="0x000000000000000000000000${OWNER#0x}"
# For each chunk:
curl -m 10 -s -X POST "$RPC" -H "Content-Type: application/json" -d '{
  "jsonrpc":"2.0","id":1,"method":"eth_getLogs","params":[{
    "fromBlock":"0x...","toBlock":"0x...",
    "topics":["'"$TOPIC0"'","'"$OWNER_TOPIC"'"]
  }]}' | jq '.result'
```

Merge results across chunks. For each log: `token = .address`, `spender = "0x" + topics[2][-40:]`. Keep the **latest** entry per `(token, spender)` pair (newest block wins). Defensively drop any log whose `topics[1] != OWNER_TOPIC` (some RPCs ignore the indexed-topic filter).

If `eth_getLogs` errors with a result-cap message, narrow the chunk to 600 blocks and retry that chunk only.

### 4. Confirm each approval is still live

For each candidate `(token, spender)`, call `allowance(owner, spender)` (ERC-20 selector `0xdd62ed3e`):

```bash
DATA="0xdd62ed3e${OWNER_TOPIC#0x}${SPENDER_TOPIC#0x}"
curl -m 10 -s -X POST "$RPC" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"'"$TOKEN"'","data":"'"$DATA"'"},"latest"]}' | jq -r '.result'
```

Drop any `(token, spender)` whose live allowance is `0` (revoked or fully spent). Flag any allowance `>= 2^255` as **UNLIMITED** (covers `2^256-1` and the common `2^256/2` sentinel both).

### 5. Per-token honeypot simulation

For each **unique token** that has at least one live approval (deduplicated across spenders — a token with 3 approvals is checked once), run the `honeypot-check` simulation:

1. Confirm it's a contract: `eth_getCode` — skip if `0x`.
2. Sample a recent non-zero `Transfer` recipient via `eth_getLogs` on `topic0 = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef`, adaptive range (~2000 blocks, narrow to ~200/~20 on cap). If no transfers are found at all, classify the token `INCONCLUSIVE` — surface in the article but never alert.
3. Read the sampled holder's `balanceOf` (selector `0x70a08231`).
4. Simulate `transfer(this_owner, balance/2)` (selector `0xa9059cbb`) via `eth_call` with **`from` = sampled holder**:
   ```bash
   curl -m 10 -s -X POST "$RPC" -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"from":"<holder>","to":"'"$TOKEN"'","data":"'"$DATA"'"},"latest"]}'
   ```
5. Verdict per token:

| Result | Verdict |
|--------|---------|
| Reverts, OR returns `false` (`0x0…0`) | `LIKELY_HONEYPOT` |
| Succeeds (returns `true`) | `SELLABLE` |
| No holder could be sampled OR contract check failed | `INCONCLUSIVE` |

**Read-only throughout.** `eth_call` does not change state — no funds are ever at risk.

### 6. Bucket findings by severity

Per wallet:

| Tier | Trigger |
|------|---------|
| `HIGH` | ≥1 live UNLIMITED approval to a spender that is **not** a known-safe address (see Safe Spenders below), OR ≥1 token with `LIKELY_HONEYPOT` |
| `MEDIUM` | ≥1 live UNLIMITED approval to a known-safe spender, OR ≥1 live finite approval ≥ \$10k-equivalent (skip USD math if no price source — count by raw token amount > 10^21 as a coarse proxy) |
| `LOW` | ≥1 live finite approval below the medium threshold |
| `CLEAN` | No live approvals AND no honeypot-positive tokens |

`INCONCLUSIVE` tokens do NOT escalate severity — they ride along in the article as data, never trigger an alert. A revert can be transient and false-flagging the operator's own wallets would erode the alert signal.

**Safe Spenders** (known Base routers / canonical contracts — never trigger HIGH on UNLIMITED alone):
- Uniswap V2 Router: `0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24`
- Uniswap V3 SwapRouter02: `0x2626664c2603336E57B271c5C0b26F421741e481`
- Uniswap V4 Universal Router: read from a single hard-coded address; if the contract address has rotated by the time this skill runs, the worst case is an UNLIMITED approval that triggers HIGH instead of MEDIUM — operator sees the alert, audits manually, adds the new address here.
- Permit2: `0x000000000022D473030F116dDEE9F6B43aC78BA3`
- Aerodrome Router: `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43`

A spender not in this list is unknown — UNLIMITED stays HIGH.

### 7. Write the weekly article

Write `articles/wallet-risk-${today}.md`:

```markdown
# Wallet Risk — ${today}

**Wallets audited:** N · **Tier:** HIGH / MEDIUM / LOW / CLEAN · **vs last run:** [WORSENED / IMPROVED / UNCHANGED / FIRST_RUN]

## Per-wallet findings

### `0xabc…def` — Treasury — HIGH
- **Live approvals:** 4 (2 UNLIMITED)
- **Honeypot tokens:** 1
- USDC → spender `0x1111…2222` (UNKNOWN) : UNLIMITED ⚠️
- WETH → spender `0x4752…ad24` (Uniswap V2 Router) : UNLIMITED — known-safe, downgraded to MEDIUM
- TOKEN → spender `0x3333…4444` : 5,000
- DAI → spender `0x5555…6666` : 1,200

Honeypot simulation:
- `0xdead…beef` (SCAM): LIKELY_HONEYPOT — sell simulation reverted from holder `0x7777…8888`

### `0x123…456` — Deployer — CLEAN
- No live approvals · No honeypot exposure

## Sources

- `.x402books/wallets.json` — N base wallets
- Base RPC — `eth_getLogs` (Approval events, ~24k-block window, chunked) + `eth_call` (allowance, balanceOf, transfer simulation)
- No external explorer keys required
```

If every wallet is CLEAN, write the article anyway as the standing weekly record — operators can grep weeks of CLEAN to prove the surface was checked.

### 8. Notify (gated)

Send notification ONLY when:

- ≥1 wallet is HIGH, OR
- A wallet transitioned `CLEAN → MEDIUM` or `LOW → MEDIUM` since last run (new approval landed), OR
- This is the first run (no prior state) AND ≥1 wallet has any live approvals — establishes the baseline.

Silent (article-only) when every wallet is CLEAN with no transitions, when `DRY_RUN=1`, or when only LOW/MEDIUM tier is reached and the prior state was already MEDIUM (steady-state noise).

Write to `.pending-notify-temp/wallet-risk-${today}.md` (create the dir if needed). Keep under 4000 chars:

```
*Wallet Risk — ${today}*

Tier: HIGH · N wallets audited · vs last week: WORSENED

⚠️ HIGH findings:
• Treasury 0xabc…def — 2 UNLIMITED approvals (one to unknown spender 0x1111…)
• Treasury 0xabc…def — 1 LIKELY_HONEYPOT token (0xdead…)

ℹ️ Other wallets:
• Deployer 0x123…456 — CLEAN

Revoke unknown unlimited approvals at revoke.cash. Full breakdown:
articles/wallet-risk-${today}.md
```

Send:
```bash
./notify -f .pending-notify-temp/wallet-risk-${today}.md
```

### 9. Update state

Write `memory/topics/wallet-risk-state.json`:

```json
{
  "version": 1,
  "last_run_at": "${today}T11:00:00Z",
  "wallets": {
    "0xabc...def": {
      "address": "0xabc...def",
      "role": "treasury",
      "approvals_total": 4,
      "approvals_unlimited": 2,
      "approvals_unknown_unlimited": 1,
      "honeypot_tokens": 1,
      "inconclusive_tokens": 0,
      "highest_severity": "HIGH"
    },
    "0x123...456": {
      "address": "0x123...456",
      "role": "deployer",
      "approvals_total": 0,
      "approvals_unlimited": 0,
      "approvals_unknown_unlimited": 0,
      "honeypot_tokens": 0,
      "inconclusive_tokens": 0,
      "highest_severity": "CLEAN"
    }
  }
}
```

Overwrite atomically: write to `wallet-risk-state.json.tmp` then `mv` so a mid-write crash can't corrupt the prior state.

### 10. Log to `memory/logs/${today}.md`

Append:
```markdown
## wallet-risk
- **Skill**: wallet-risk
- **Wallets audited**: N (treasury=N, deployer=N, other=N)
- **Per-wallet verdicts**:
  - `0xabc…def` (treasury): HIGH — 4 live (2 unlimited, 1 unknown-unlimited), 1 honeypot
  - `0x123…456` (deployer): CLEAN
- **vs last run**: WORSENED / IMPROVED / UNCHANGED / FIRST_RUN
- **Article**: articles/wallet-risk-${today}.md
- **Notification sent**: yes / no (reason)
- **Status**: WALLET_RISK_OK / WALLET_RISK_HIGH / WALLET_RISK_QUIET / WALLET_RISK_NO_WALLETS / WALLET_RISK_RPC_FAIL / WALLET_RISK_BAD_VAR / STATE_CORRUPT / DRY_RUN
```

## End-state taxonomy

| Status | Meaning | Notification |
|--------|---------|--------------|
| `WALLET_RISK_HIGH` | ≥1 wallet HIGH | sent |
| `WALLET_RISK_TRANSITION` | New MEDIUM landed (CLEAN/LOW → MEDIUM) | sent |
| `WALLET_RISK_BASELINE` | First run with ≥1 live approval | sent |
| `WALLET_RISK_OK` | All CLEAN or steady-state LOW/MEDIUM, prior state matched | silent |
| `WALLET_RISK_QUIET` | All CLEAN, prior state also CLEAN | silent |
| `WALLET_RISK_NO_WALLETS` | `.x402books/wallets.json` missing or empty | silent |
| `WALLET_RISK_NO_BASE_WALLETS` | File present but no `chain: base` entries | silent |
| `WALLET_RISK_NO_TARGET` | `${var}` set to address with no match | silent |
| `WALLET_RISK_BAD_VAR` | `${var}` malformed | silent |
| `WALLET_RISK_RPC_FAIL` | All RPC retries (curl + WebFetch) failed | silent log only — do NOT alarm |
| `STATE_CORRUPT` | Prior state unparsable | sent (operator action: inspect state file) |
| `DRY_RUN` | `${var}=dry-run` — article + log written, notify skipped | n/a |

## Constraints

- Read-only against every external chain — `eth_call` only, never `eth_sendTransaction`. No funds are ever at risk.
- Never list a grant the wallet has revoked — every reported approval must be confirmed live via `allowance` at the current block.
- `UNLIMITED` means allowance `>= 2^255`. Report exact amounts otherwise; never round in a way that hides a large grant.
- The scan window is recent (~24k blocks ≈ 13h) — say so in the article; an unlimited approval older than the window is missed if it has not seen a re-emission. For a complete history the operator must run `approval-audit` manually with a wider window.
- A spender on the Safe Spenders list is **not endorsed safe** — it's "common router, downgrade from HIGH to MEDIUM." The operator still sees the line.
- No trade or "safe to approve" advice — this is a risk inventory, not financial advice.
- `LIKELY_HONEYPOT` is a strong signal to investigate, never a certainty (a router-specific revert can mimic one). The article says so.
- INCONCLUSIVE results never trigger alerts — false positives on the operator's own wallets would erode the signal everywhere else.
