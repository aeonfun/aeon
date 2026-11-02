---
name: flovia
description: Live lookups through the Flovia MCP - Nansen smart money and token flows, CoinGecko markets, direct chain reads, Zerion wallets, Exa web search and Firecrawl page reads - on a free shared allowance. OAuth Connect or an flv_ key in the dashboard MCP panel.
metadata:
  title: Flovia
  mode: read-only
  category: crypto
  var: ""
  tags:
    - crypto
    - onchain
    - research
    - mcp
  mcp:
    - flovia
  capabilities:
    - external_api
    - sends_notifications
---

# Flovia

> **${var}** - the lookup question, e.g. `is token 0x... on Base being accumulated by smart money` or `what does wallet 0x... hold across chains`. Empty = a short status report (free allowance, services, recent changes). Prefer plain language; don't name endpoints.

Answer one question with **live data** through the Flovia MCP (`api.flovia.dev/mcp`): Nansen smart money / holders / token flows / wallet profiles, CoinGecko prices and DEX pools, direct chain reads, Zerion wallets, Exa public web search and Firecrawl public-page reads, plus optional OpenAI text generation. Every metered call draws from the operator's free allowance (or purchased balance), so calls are deliberate.

## Detection & auth

The server is wired from the dashboard MCP panel: one-click **Connect** (OAuth) or an `flv_` API key pasted as `MCP_FLOVIA_TOKEN`. Its tools surface as `mcp__flovia__*` - discover them from the server; tool descriptions are the source of truth. Flovia is in alpha: call `flovia_status` first and read `recent_updates` - tools, limits and prices may have changed since this file was written.

- **No `mcp__flovia__*` tool callable** → the server isn't connected. Log `FLOVIA_NOT_CONNECTED`, notify once pointing the operator at the dashboard → MCP → Connect Flovia, and exit.
- **401 / invalid token** → the OAuth refresh failed (see `docs/mcp-oauth.md`) or the key was revoked. Log `FLOVIA_AUTH_STALE`, notify the operator to reconnect once, and exit.
- **A refusal reply** carries `explanation` (`by`, `code`, `executed`, `meaning`, `next_step`). Follow `next_step`; `FLOVIA_WINDOW_FULL` when a free window is exhausted (the reply says when it resets).

## Aeon runs (scheduled or dispatched)

An Aeon run has no user to talk to:

- **Ask nothing.** No consent question, no "pick a next step" prompt - `next_options` in a reply are listed in the notify as suggestions, never executed.
- **Read-only.** Flovia can prepare unsigned swaps and Hyperliquid actions; never call those tools. Read tools only (`flovia_nansen`, `flovia_coingecko`, `flovia_quicknode`, `flovia_zerion`, `flovia_exa`, `flovia_firecrawl`, `flovia_status`, `flovia_usage_today`, `flovia_lookup`, `flovia_services` list). `flovia_openai`/`flovia_minimax`/`flovia_fal`/`flovia_runway` are generation tools - off by default; use only if `${var}` explicitly asks.
- **Stable operation ids.** Pass one `operation_id` per question (`flovia-<date>-<short-slug>`). If a reply is lost or `executed` is `unknown`, resend with the **same** id - it is never charged twice. Never retry under a new id, and never auto-retry a pending/unknown result.
- **Never put secrets in lookups.** Request text and purposes are kept by Flovia for up to 2 years during the alpha, and Nansen lookups are shared with Nansen. Keep request text to public facts; no keys, seeds, credentials, or the operator's private info. This is the data-use terms the operator accepted when registering - mention it once in the notify when Nansen data is used.

## Steps

### 1. Plan

Start with `flovia_status` (allowance %, resets, service states, `recent_updates`). Then map `${var}` to sources:

- **Prices, market caps, charts, DEX pools** → `flovia_coingecko`
- **A public wallet's portfolio, positions, PnL, transactions** → `flovia_zerion`
- **A transaction's status/gas, a balance, a contract read, event logs** → `flovia_quicknode` (`chain: "list"` for the configured chains)
- **Smart money, holders, token flows, wallet labels** → `flovia_endpoints` to pick the Nansen endpoint, then `flovia_nansen`
- **Public web research / cited sources** → `flovia_exa`; **one public page or PDF** → `flovia_firecrawl`

**Spend discipline:** CoinGecko, Quicknode, Firecrawl and Zerion are flat-rate (separate daily limits, don't touch the free allowance). Nansen, Exa, context.dev and generation are metered at a much higher cost. Prefer flat-rate sources; use Nansen only when the question needs smart-money data - at most 2 Nansen calls per run, ≤ 8 tool calls total. When a free window is past 75%, stop at the flat-rate answer and say so.

### 2. Fetch

Run the planned calls, one question at a time. For a repeated check (`${var}` like `watch: <question>`), compare against the previous run at `output/.chains/flovia.md` and report what changed. Reopening an earlier answer via `flovia_lookup` is free - use it instead of re-asking.

### 3. Answer

Trace every figure to a tool response; cite source URLs for Exa results. Distinguish observed fact from inference; keep units, dates and gaps.

### 4. Notify

Deliver via `./notify -f <file>`: the answer, the evidence, allowance state if a window crossed 75%, and `next_options` as text suggestions. Exactly one `./notify` call per run - it overwrites `$AEON_PENDING_DIR/.pending-flovia.md` which becomes the chain artifact `output/.chains/flovia.md`.

### 5. Result record

This skill is `read-only`, so the workflow's read-only guard writes its `### flovia` log entry from your captured output; a self-written entry would be a duplicate. Put this record in your **final output**:

```
### flovia
- Query: <${var}, truncated>
- Result: FLOVIA_OK | FLOVIA_EMPTY_VAR | FLOVIA_NOT_CONNECTED | FLOVIA_AUTH_STALE | FLOVIA_WINDOW_FULL | FLOVIA_ERROR
- Sources: <tool names used> | Calls: <N>/<budget>
```
