# ICP-MCP-VERIFICATION.md

**Scope:** Live verification of the official ICP MCP endpoint `https://mcp.internetcomputer.org/mcp`.
**Method:** On-the-wire probes (DNS, TLS, MCP `initialize` handshake, OAuth metadata discovery) + official docs.
**Date:** 2026-11-03. **Posture:** read-only probes only; no state-changing calls attempted.

---

## Verdict (one line)

**Case 3 — the endpoint EXISTS and is a real, operational MCP server, but REQUIRES interactive OAuth authentication** (`authorization_code` + PKCE via Internet Identity). It is **structurally incompatible with Aeon's headless runner.** `Confidence: Confirmed.`

This is not Case 1 (does not exist), not Case 2 (unreachable), not Case 4 (responds but lacks expected functionality). The server responded correctly to the MCP protocol with a spec-compliant OAuth challenge.

---

## Evidence

### 1. DNS resolves — `Confirmed`
```
dig +short mcp.internetcomputer.org A  → 195.5.171.241
host …                                 → + IPv6 2602:fb2b:110:1:bced:b7ff:fe2f:a862
```

### 2. Reachable over TLS — `Confirmed`
```
GET https://mcp.internetcomputer.org/mcp  → connect=0.18s ttfb=0.69s http=401 ssl_verify=0 (valid cert)
GET https://mcp.internetcomputer.org/     → 308 → https://internetcomputer.org/icp-mcp/   (official docs path)
```

### 3. Speaks MCP streamable-HTTP + returns a spec OAuth challenge — `Confirmed`
`POST /mcp` with a JSON-RPC `initialize` (protocol `2025-06-18`):
```
HTTP/2 401
content-type: application/json
www-authenticate: Bearer resource_metadata="https://mcp.internetcomputer.org/.well-known/oauth-protected-resource/mcp"
access-control-expose-headers: www-authenticate,mcp-session-id
{"error":"invalid_token"}
```
The `www-authenticate: Bearer resource_metadata=…` header is exactly the MCP 2025-06-18 authorization discovery mechanism (RFC 9728, OAuth 2.0 Protected Resource Metadata). An `initialize` **handshake could not be completed**, and `tools/list` could not be reached, **because no bearer token was presented** — not because the server is absent or broken.

### 4. OAuth metadata — the decisive detail — `Confirmed`
`GET /.well-known/oauth-protected-resource/mcp`:
```json
{ "authorization_servers": ["https://mcp.internetcomputer.org/mcp"],
  "resource": "https://mcp.internetcomputer.org/mcp" }
```
`GET /.well-known/oauth-authorization-server`:
```json
{
  "issuer": "https://mcp.internetcomputer.org/mcp",
  "authorization_endpoint": "https://mcp.internetcomputer.org/mcp/oauth/authorize",
  "token_endpoint":         "https://mcp.internetcomputer.org/mcp/oauth/token",
  "registration_endpoint":  "https://mcp.internetcomputer.org/mcp/oauth/register",
  "grant_types_supported":        ["authorization_code"],
  "response_types_supported":     ["code"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none"],
  "client_id_metadata_document_supported": true
}
```

**Reading of the metadata:**
- `grant_types_supported: ["authorization_code"]` — **the ONLY grant.** No `client_credentials` (no machine-to-machine grant). **No `refresh_token`** (no non-interactive renewal).
- `code_challenge_methods_supported: ["S256"]` + `token_endpoint_auth_methods_supported: ["none"]` — a **public client secured by PKCE**; there is no client secret to configure.
- `authorization_endpoint: …/oauth/authorize` — obtaining a code requires driving a **browser redirect** that logs in with **Internet Identity** (per the docs below).
- `registration_endpoint` + `client_id_metadata_document_supported: true` — Dynamic Client Registration (RFC 7591) is supported, but DCR only registers a client; the client **still must complete the interactive `authorization_code` + PKCE flow** to obtain a token. DCR does not create a headless path.

### 5. Official DFINITY documentation — `Confirmed`
`https://internetcomputer.org/icp-mcp/` (reached via the `308` redirect from the endpoint root):
- States it is the **"Official MCP connector by DFINITY"**, **"Hosted by DFINITY"**.
- **Auth:** "Sign in with Internet Identity and allow access." The user chooses the identity and **how long the connection lasts**; **grants expire by design**; revoke by removing the connector.
- **Two access modes:** **"Actions & questions"** (AI may act = write) vs **"Questions only"** (lookups = read).
- **No mention** of OAuth client credentials, API keys, refresh tokens, service accounts, or any programmatic/headless access.
- **Source code** listed as `github.com/dfinity/ic`. *(A separate open-source MCP implementation under the DFINITY org was identified in prior research; today's docs page points to `dfinity/ic`. Treat the exact repo path as `Confidence: Medium` pending a direct repo read; it does not change the auth finding.)*

### 6. Tool inventory & read/write split (from the official docs) — `Confidence: High` (docs, not a live `tools/list` which auth-gated out)
| Tool | Class |
|---|---|
| `get_canister_candid`, `get_canister_api_doc`, `get_canister_oql_schema`, `canister_query`, `icp_oql_guide`, `candid_syntax_guide` | **Read-only** (lookups / on-network reads) |
| `list_app_accounts`, `get_app_principal` | Identity reads (read) |
| `open_app` | Navigation (not classified by docs) |
| **`canister_update_call`** | **State-changing** — docs: makes "state-changing calls as your identity." This is the only write tool. |

---

## Why this is incompatible with Aeon (cross-reference)

Aeon's headless client OAuth path (`scripts/mcp-oauth-refresh.sh`) is built **entirely on the `refresh_token` grant** (`grant_type=refresh_token`; skips any server with no `refresh_token`). The ICP server **does not issue refresh tokens** and offers **no machine grant** — so:
1. There is no refresh token for the dashboard to capture in the first place (II grants are `authorization_code` + PKCE, expire, no refresh).
2. Even if an access token were captured manually, it expires with **no non-interactive renewal**, and the next scheduled run would fail with no way to recover without a human completing the II browser flow again.

Full mechanism in **ICP-AEON-MCP-ARCHITECTURE.md**. The practical consequence: **do not integrate the official ICP MCP connector into autonomous skills.** For any skill that must touch IC at runtime, use a **direct-to-IC** path (agent-js / `icp-cli` with a PEM/seed identity stored as a repo secret) instead of the MCP connector. For the security-audit project specifically, **no runtime IC access is needed at all** — a source audit reads the repo.

---

## Confidence summary
| Claim | Confidence | Basis |
|---|---|---|
| Endpoint exists & is operational | Confirmed | DNS + TLS + MCP 401 challenge |
| Requires interactive auth (II) | Confirmed | AS metadata + docs |
| No refresh / no client-credentials grant | Confirmed | `oauth-authorization-server` metadata |
| Incompatible with Aeon headless | Confirmed | metadata ∩ `mcp-oauth-refresh.sh` |
| Tool list & read/write split | High | official docs (live `tools/list` is auth-gated) |
| Exact source repo | Medium | docs say `dfinity/ic`; not read directly |
