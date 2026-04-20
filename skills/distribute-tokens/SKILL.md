---
name: Distribute Tokens
description: Send tokens to a list of contributors via Bankr Wallet API with per-recipient idempotency, two-phase resolve→execute, dry-run, and recovery from partial runs
var: ""
tags: [crypto]
---
<!-- autoresearch: variation C — robustness via per-recipient idempotency state, two-phase resolve→execute, dry-run, retries, 403/429 handling, recovery -->

> **${var}** — Distribution list label. If empty, uses the first list in `memory/distributions.yml`. Pass `dry-run:LABEL` to preview without sending. Pass `LABEL` alone to execute.

## Why this design

This skill moves real money. The biggest failure mode is double-sending (re-runs, retries after partial failures, day-rollover bypass of "skip if today" logic) or sending into a black hole (no preflight balance, deprecated API path, missing handle resolution). The skill therefore:

1. **Persists per-recipient idempotency state** in `memory/state/distributions.json` keyed on `(list, recipient, date_utc)` with the txHash. A successful transfer is *never* re-sent within the same UTC day, even across re-runs or workflow restarts.
2. **Two-phase execution**: RESOLVE (validate config, key, balance, resolve all handles → addresses, build plan) → EXECUTE (send each transfer, persist state after each one). RESOLVE failures abort before any send.
3. **Dry-run mode** outputs the full plan with no transfers.
4. **Wallet API only** for actual transfers — Bankr's docs deprecate the Agent API for transfers. Agent API is used only for handle→address resolution.

## Config

Reads `memory/distributions.yml`. If missing, bootstrap with a commented template (see Bootstrap step) and exit cleanly with `DISTRIBUTE_TOKENS_OK — bootstrapped distributions.yml; edit and re-run`.

```yaml
# memory/distributions.yml
defaults:
  token: USDC          # USDC | ETH (Base only)
  amount: "5"
  chain: base

lists:
  contributors:
    description: "Weekly contributor rewards"
    token: USDC
    amount: "10"
    recipients:
      - handle: "@alice_dev"      # Twitter/X — resolved via Bankr Agent API
        amount: "15"
      - handle: "@bob_builder"
      - address: "0x742d...5678"  # direct EVM address — preferred path
        label: "Charlie"
        amount: "20"
```

### Required secrets

| Secret | Purpose |
|--------|---------|
| `BANKR_API_KEY` | Bankr API key (`bk_...`). Must be **read-write** with **Wallet API** enabled. Read-only keys → 403. |

### Token addresses on Base

- USDC: `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`
- ETH (native): `tokenAddress: "0x0000000000000000000000000000000000000000"`, `isNativeToken: true`

---

Read `memory/MEMORY.md` and `memory/distributions.yml`.
Read `memory/state/distributions.json` (if present) for idempotency state.

## Steps

### 1. Parse var and load config

- If `${var}` starts with `dry-run:`, set `MODE=dry-run` and `LABEL=${var#dry-run:}`. Otherwise `MODE=execute` and `LABEL=${var}`.
- If `memory/distributions.yml` missing → **Bootstrap**: write the example config (commented out so it's inert), notify `DISTRIBUTE_TOKENS_OK — bootstrapped distributions.yml; edit and re-run`, log, exit.
- Parse YAML. If `LABEL` empty, use the first list. Else find the matching list. If not found → notify `DISTRIBUTE_TOKENS_ERROR — list '${LABEL}' not found`, log, exit.
- Resolve `today_utc=$(date -u +%F)`.

### 2. Pre-flight: key, write access, balance

If `BANKR_API_KEY` not set → `DISTRIBUTE_TOKENS_ERROR — BANKR_API_KEY not configured`, log, exit.

```bash
ME=$(curl -fsS "https://api.bankr.bot/wallet/me" -H "X-API-Key: ${BANKR_API_KEY}")
```

- HTTP 403 → `DISTRIBUTE_TOKENS_ERROR — API key is read-only; needs wallet write scope`, exit.
- HTTP 429 → `DISTRIBUTE_TOKENS_ERROR — rate-limited at /wallet/me; aborting`, exit.
- Network failure → use **WebFetch** fallback. If still failing → `DISTRIBUTE_TOKENS_ERROR — Bankr /wallet/me unreachable`, exit.

```bash
PORTFOLIO=$(curl -fsS "https://api.bankr.bot/wallet/portfolio?chain=base" -H "X-API-Key: ${BANKR_API_KEY}")
```

Extract sender's balance for the target token. Compute `total_required` from the recipient list (sum of per-recipient amounts, applying overrides). If `balance < total_required * 1.05` (5% headroom for any failed retries) → `DISTRIBUTE_TOKENS_ERROR — insufficient balance: have X, need Y ${TOKEN}`, exit. Do not start a partial run.

### 3. RESOLVE phase — build the plan

For each recipient, build a row: `{key, type, amount, token, target_address, label, status}` where `key = sha256("${LABEL}|${recipient_id}|${today_utc}")` and `recipient_id` is the handle (lowercase) or address (lowercase).

**Idempotency check** (before resolving): if `memory/state/distributions.json` contains `key` with `status=completed` → mark row `SKIPPED_DEDUP`, carry forward the prior `txHash`.

**Handle resolution** (`@username`): use Bankr Agent API to look up the linked wallet:
```bash
JOB=$(curl -fsS -X POST "https://api.bankr.bot/agent/prompt" \
  -H "X-API-Key: ${BANKR_API_KEY}" -H "Content-Type: application/json" \
  -d "{\"prompt\":\"What is the EVM address linked to ${HANDLE} on Base? Respond with only the address.\"}" | jq -r '.jobId')
# Poll every 2s, max 30s
for i in $(seq 1 15); do
  R=$(curl -fsS "https://api.bankr.bot/agent/job/${JOB}" -H "X-API-Key: ${BANKR_API_KEY}")
  S=$(echo "$R" | jq -r '.status')
  [ "$S" = "completed" ] || [ "$S" = "failed" ] && break
  sleep 2
done
```
Extract the address from the response (regex `0x[a-fA-F0-9]{40}`). If extraction fails → mark row `RESOLVE_FAILED` with reason `NO_LINKED_WALLET`. Do **not** abort the whole plan; let the executor skip this row.

**Address resolution** (`0x...`): validate format `^0x[a-fA-F0-9]{40}$`. If invalid → `RESOLVE_FAILED` reason `BAD_ADDRESS`.

After RESOLVE, print the plan to the console (and to the dry-run notification if `MODE=dry-run`):

```
Plan for list '${LABEL}' (${today_utc}):
  ✓ @alice_dev → 0x1234... — 15 USDC          [READY]
  ✓ Charlie    → 0x742d... — 20 USDC          [READY]
  ↻ @bob_builder → 0xabcd... — 10 USDC        [SKIPPED_DEDUP] (tx 0xprev...)
  ✗ @inactive → ?                             [RESOLVE_FAILED: NO_LINKED_WALLET]

Summary: 2 to send (35 USDC), 1 deduped, 1 unresolvable. Sender balance: 100 USDC.
```

If `MODE=dry-run`: notify the plan, log, exit `DISTRIBUTE_TOKENS_DRY_RUN`. Do not proceed.

If 0 rows are `READY` (everything deduped/failed) → notify the plan, log, exit `DISTRIBUTE_TOKENS_OK — nothing to send`.

### 4. EXECUTE phase

For each `READY` row, send via `/wallet/transfer` (the only sanctioned transfer endpoint per Bankr docs):

```bash
RESP=$(curl -fsS -X POST "https://api.bankr.bot/wallet/transfer" \
  -H "X-API-Key: ${BANKR_API_KEY}" -H "Content-Type: application/json" \
  -d "{\"recipientAddress\":\"${ADDR}\",\"tokenAddress\":\"${TOKEN_ADDR}\",\"amount\":\"${AMT}\",\"isNativeToken\":${IS_NATIVE}}")
```

Outcome handling:
- HTTP 200 + `success: true` → status `COMPLETED`, store `txHash`. **Persist the state file immediately** (write after every recipient, not at the end — survives mid-run crashes).
- HTTP 200 + `success: false` → status `FAILED`, store `error` field as reason.
- HTTP 403 → status `FAILED` reason `READ_ONLY_KEY`. Abort remaining rows (key won't suddenly gain write access). Persist state.
- HTTP 429 → status `FAILED` reason `RATE_LIMIT`. Sleep 60s, retry once. If still 429, abort remaining (rolling-window quota exhausted). Persist state.
- HTTP 5xx or network error → retry once after 10s. If still failing, status `FAILED` reason `API_ERROR`.
- Any other → status `FAILED` reason `HTTP_${code}`.

State file shape (`memory/state/distributions.json`, append/upsert):
```json
{
  "contributors|@alice_dev|2026-04-20": {
    "list": "contributors",
    "recipient": "@alice_dev",
    "address": "0x1234...",
    "amount": "15",
    "token": "USDC",
    "status": "completed",
    "txHash": "0xabc...",
    "timestamp": "2026-04-20T12:34:56Z"
  }
}
```

### 5. Build summary notification

Top line is a verdict: `COMPLETE` (all READY succeeded) / `PARTIAL` (some failed) / `FAILED` (none succeeded) / `DRY_RUN` / `NOTHING_TO_SEND`.

```
*Token Distribution — ${today_utc}* — VERDICT

List: ${LABEL} (${description})
Token: ${TOKEN} on Base
Sent: ${total_sent} ${TOKEN} to ${n_success}/${n_attempted} recipients
Skipped (already sent today): ${n_dedup}
Unresolvable: ${n_unresolved}

✓ @alice_dev — 15 USDC ([tx](https://basescan.org/tx/0xabc...))
✓ Charlie (0x742d...) — 20 USDC ([tx](https://basescan.org/tx/0x123...))
↻ @bob_builder — 10 USDC (already sent: [tx](https://basescan.org/tx/0xprev...))
✗ @inactive_user — RESOLVE_FAILED: NO_LINKED_WALLET

Sender balance after: ${remaining} ${TOKEN}
```

Suppress empty sections (no `Skipped:` line if `n_dedup=0`, etc.). Send via `./notify`.

### 6. Log

Append to `memory/logs/${today_utc}.md`:

```
### distribute-tokens
- List: ${LABEL} | Token: ${TOKEN} | Mode: ${MODE}
- Verdict: ${VERDICT}
- Sent: ${total_sent} ${TOKEN} to ${n_success}/${n_attempted}; deduped: ${n_dedup}; unresolved: ${n_unresolved}
- Failures (if any): @x — REASON, @y — REASON
- State file: memory/state/distributions.json (${total_keys} entries)
```

Exit codes (for downstream automation):
- `DISTRIBUTE_TOKENS_OK` — nothing to send (everything deduped or list empty), or bootstrap
- `DISTRIBUTE_TOKENS_COMPLETE` — all READY rows succeeded
- `DISTRIBUTE_TOKENS_PARTIAL` — some succeeded, some failed
- `DISTRIBUTE_TOKENS_DRY_RUN` — dry-run completed, no sends
- `DISTRIBUTE_TOKENS_ERROR` — preflight or config failure, no sends attempted

## Sandbox note

Outbound curl may fail in the GH Actions sandbox. For each curl call, on failure try **WebFetch** (no body for GET; for POST use the pre-fetch / post-process pattern in CLAUDE.md). For `/wallet/transfer` specifically — because it's a write endpoint with auth headers — if curl fails, queue the request as a JSON file under `.pending-bankr/` and rely on a `scripts/postprocess-bankr.sh` runner if available; otherwise mark the row `FAILED` reason `SANDBOX_BLOCKED` and continue. Never silently drop a transfer.

## Constraints

- **Idempotency is non-negotiable.** Always read state file before sending; always persist after every transfer. Never batch state writes to end-of-run.
- Treat the 24h Bankr rate limit (100/day standard) as a hard cap. Lists >50 recipients should be split.
- Never send if preflight balance is < `total_required * 1.05`.
- Never use the Agent API for transfers (deprecated). Agent API only for handle→address resolution.
- Never abort the RESOLVE phase on a single bad recipient — collect all errors, present them, then let executor skip.
