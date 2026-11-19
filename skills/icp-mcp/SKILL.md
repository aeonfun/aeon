---
name: icp-mcp
description: Read an Internet Computer app as you through the hosted ICP MCP (mcp.internetcomputer.org) - open an app, read its canister interfaces and docs, and answer a question with live query calls. Read-only; works on apps that opted in with an ic-architecture manifest. OAuth Connect with Internet Identity in the dashboard MCP panel (sessions up to 30 days).
metadata:
  title: ICP MCP
  mode: read-only
  category: crypto
  var: ""
  tags:
    - icp
    - crypto
    - onchain
    - mcp
  mcp:
    - icp
  capabilities:
    - external_api
    - sends_notifications
---

# ICP MCP

> **${var}** - `<app> :: <question>`. `<app>` is an app name or its URL (e.g. `your-app.caffeine.ai`); `<question>` is what to find out, in plain language (e.g. `your-app.caffeine.ai :: how many bookings are open for next week`). A bare `<app>` = describe the app: its canisters, what each one answers, and which holds the data. Empty = a connection check (session alive, identity, apps reachable).

Answer one question about an Internet Computer app with **live data**, through DFINITY's hosted ICP MCP (`mcp.internetcomputer.org/mcp`). The server acts as the operator's Internet Identity at that app: it discovers the app's canisters, reads their Candid interfaces and API docs, and runs query calls on them.

## Detection & auth

The server is wired from the dashboard MCP panel: one-click **Connect** opens Internet Identity, where the operator picks an identity, the session length (up to 30 days) and the access level. Choose **Questions only** for this skill. Its tools surface as `mcp__icp__*`; tool descriptions on the server are the source of truth.

There is no refresh token: the access token captured at Connect (`MCP_ICP_TOKEN`) is used until the session ends, then the operator reconnects (see `docs/mcp-oauth.md`).

- **No `mcp__icp__*` tool callable** → the server isn't connected. Log `ICP_MCP_NOT_CONNECTED`, notify once pointing the operator at dashboard → MCP → Connect Internet Computer, and exit.
- **401 / invalid token** → the session expired or was revoked. Log `ICP_MCP_SESSION_EXPIRED`, notify the operator to reconnect (and to pick a session length that covers the schedule), and exit.
- **App not found or not discoverable** → the app has not published `/.well-known/ic-architecture`. The ICP MCP only reaches apps that opted in to AI traffic ([service discoverability](https://docs.internetcomputer.org/guides/frontends/service-discoverability/)). Log `ICP_MCP_APP_NOT_DISCOVERABLE`, say so in the notify, and exit. Never try to reach the app's canisters another way.

## Aeon runs (scheduled or dispatched)

An Aeon run has no user to talk to:

- **Ask nothing.** No consent question, no follow-up prompt.
- **Read-only.** Use only `open_app`, `list_app_accounts`, `get_app_principal`, `get_canister_candid`, `get_canister_api_doc`, `get_canister_oql_schema`, `canister_query`, `icp_oql_guide` and `candid_syntax_guide`. **Never call `canister_update_call`**: it changes state as the operator's identity, even if `${var}` asks for it. Say in the notify that writes are out of scope for this skill. The run also blocks it: `canister_update_call` is in `catalog/mcp-denied-tools.json`, so every Aeon run (this skill or any other) gets it as a disallowed tool and a call is refused.
- **Only the app named in `${var}`.** Reads work on the canisters an app declares as its own; stay inside them.
- **Keep secrets out.** Never put keys, seeds or the operator's private info in a query argument. Report principals and account ids only if `${var}` asks for them.

## Steps

### 1. Parse

Split `${var}` on ` :: ` into `<app>` and `<question>`. Empty `${var}` → go to step 4 with a connection check: one cheap call (`list_app_accounts` or `icp_oql_guide`) to confirm the session, then report `ICP_MCP_OK` or the auth state.

### 2. Open the app

`open_app` with `<app>`. Read what comes back: the canisters, what each one answers, and which holds the data. A bare `<app>` with no question → summarize that and go to step 4.

### 3. Answer

Pick the canister that holds the data for `<question>`. Read its interface first (`get_canister_api_doc`, then `get_canister_candid` or `get_canister_oql_schema` when needed), then make the query calls that answer the question. Budget: at most 8 tool calls per run. For a repeated check (`<question>` starting with `watch:`), compare against the previous run at `output/.chains/icp-mcp.md` and report what changed.

Trace every figure to a query response; name the canister and method it came from. Distinguish what the canister returned from your inference.

### 4. Notify

Deliver via `./notify -f <file>`: the answer, the canisters and methods used, and any limits hit (app not discoverable, budget reached, a write that was skipped). Exactly one `./notify` call per run - it overwrites `$AEON_PENDING_DIR/.pending-icp-mcp.md`, which becomes the chain artifact `output/.chains/icp-mcp.md`.

### 5. Result record

This skill is `read-only`, so the workflow's read-only guard writes its `### icp-mcp` log entry from your captured output; a self-written entry would be a duplicate. Put this record in your **final output**:

```
### icp-mcp
- App: <app or "-"> | Question: <question, truncated>
- Result: ICP_MCP_OK | ICP_MCP_NOT_CONNECTED | ICP_MCP_SESSION_EXPIRED | ICP_MCP_APP_NOT_DISCOVERABLE | ICP_MCP_ERROR
- Canisters: <ids used> | Calls: <N>/8
```
