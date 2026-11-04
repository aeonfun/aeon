# ICP (Internet Computer) in Aeon

How Aeon reaches the Internet Computer, what it ships for IC work, and the limits that
shape those choices. Reference material - not a changelog.

## Why the hosted ICP MCP connector is not used

The official endpoint, `https://mcp.internetcomputer.org/mcp`, is a real, spec-compliant
MCP server, but it authenticates with **interactive OAuth only**. Its published metadata
(`/.well-known/oauth-authorization-server`) advertises exactly one grant:

- `grant_types_supported: ["authorization_code"]` - no `client_credentials`, so there is
  no machine-to-machine grant.
- no `refresh_token` - a token cannot be renewed without a human.
- a PKCE public client (`code_challenge_methods_supported: ["S256"]`,
  `token_endpoint_auth_methods_supported: ["none"]`); obtaining a code means driving a
  browser redirect that signs in with Internet Identity.
- Dynamic Client Registration is supported, but DCR only registers a client; the client
  still has to complete the interactive `authorization_code` + PKCE flow to get a token.

Aeon runs headless on GitHub Actions, with no browser and no human in the loop, so it
cannot complete that flow or keep a session alive. This is a limit of the *hosted
connector*, not of the IC: a headless MCP on the IC is a documented pattern - a
canister-based MCP server built with [`ic-rmcp`](https://github.com/ByteSmithLabs/ic-rmcp)
authenticates a machine caller with an `x-api-key` header (or OAuth), so an agent can
reach it on a schedule. Aeon uses the direct-read path below for reads, and the direct
agent (or such a canister MCP) for calls. The hosted connector's one row in the OAuth
provider table is in [`docs/mcp-oauth.md`](../mcp-oauth.md).

## The read path Aeon does use

IC state that Aeon needs is read **directly over HTTPS, keyless**, from the public
dashboard and SNS aggregator APIs:

- `ic-api.internetcomputer.org` - canister control-plane facts (controllers, module hash,
  upgrade history) and NNS proposals.
- `sns-api.internetcomputer.org` - the SNS DAO list and per-DAO proposals.

These need no identity and no cycles. A controller-gated read (a canister's live running
state via the management canister `canister_status`) is the one exception: it requires a
controller identity, supplied as an `ICP_IDENTITY_PEM` secret and used through
`./secretcurl` so the key never touches a command line. The skills degrade cleanly when
that secret is absent, reporting control-plane facts only. No skill needs runtime IC
access to do its core job.

## Why the dfinity/icskills skills are reference, not installed

dfinity publishes an `icskills` set authored to its own skill schema. Aeon's loader
expects Aeon's `SKILL.md` shape, and several of those skills assume an interactive
authoring context, so they are not installed into the fleet. Instead the useful
**knowledge** is embedded in Aeon-native skills - for example the 12 canister-security
pitfalls live in `skills/canister-audit/references/ic-security-checklist.md`, adapted from
the icskills `canister-security` material. Reuse the knowledge; do not run the upstream
skills as-is.

## Security limits

- **Source, not bytecode.** `canister-audit` audits a canister's Rust source. A canister's
  logic is not recoverable from its deployed wasm the way verified EVM source is, so there
  is no on-chain-by-address mode for IC.
- **Rust only.** ic-cdk / candid canisters (ic-cdk is at 0.20.3). Motoko is out of scope.
- **`fetch_root_key` is an agent/frontend concern, not canister code.** It is called by
  the client talking to the IC (`@dfinity/agent` in JS/TS, or `ic-agent` in a Rust
  client), never inside the canister, so `icp-deploy-check` looks for it in a repo's
  frontend/client, not its canister Rust.
- **The PocketIC proof arm is best-effort.** A confirmed high/critical finding is proven
  by building the canister to wasm32 and reproducing the exploit in PocketIC through the
  shared PoC gate; when the toolchain or server binary is absent, the arm is skipped and
  the agentic source reasoning stands on its own.
- **Reads can be stale or unindexed.** A non-indexed canister returns 404 (recorded as
  `unindexed`, not an error); a failed read is recorded by its HTTP status and never
  reported as a change.

## Known gaps

- **The hosted MCP connector is interactive-only.** It offers no machine grant (client
  credentials) and no refresh token, so an autonomous agent cannot use the hosted server
  directly. That is the one real coordination point with dfinity - a machine grant would
  let agents use it. It is not a blocker for the IC itself: a headless MCP is available
  today via a canister server (`ic-rmcp`, `x-api-key`/OAuth), and canisters are reachable
  directly with an agent + key.
- **No off-the-shelf IC Semgrep ruleset.** `canister-audit` ships a small hand-authored
  one (`references/ic-semgrep-rust.yml`); the agentic source pass is the reliable core and
  the ruleset is a high-recall first pass.
- **Cycles balances are controller-gated.** There is no keyless public read for a
  canister's cycle balance, so Aeon does not ship a cycles monitor.

## What ships (file index)

**Security audit (`canister-audit`)**
- `skills/canister-audit/SKILL.md`, `README.md`
- `skills/canister-audit/references/ic-security-checklist.md`, `ic-semgrep-rust.yml`
- `skills/canister-audit/fixtures/token_vault/` - a planted-flaw fixture (anonymous
  principal mints a free balance) with its PocketIC reproduction
- `scripts/stage-canister-audit.sh` - stages the wasm32 target, cargo-audit, and the
  pinned PocketIC server
- `.github/workflows/ci-canister-audit-fixture.yml` - runs the reproduction end to end

**Read + monitor skills**
- `skills/canister-status/` - control-plane monitor (controllers, module hash, upgrades);
  alerts on change
- `skills/sns-digest/` - NNS + SNS governance proposal digest
- `skills/icp-deploy-check/` - static pre-deploy checklist for an IC Rust canister repo

Aeon is an open framework; project home is [www.aeon.fun](https://www.aeon.fun).

# Citations

- ICP MCP endpoint metadata and docs: `https://mcp.internetcomputer.org/mcp`,
  `https://internetcomputer.org/icp-mcp/` (probed 2026-11-03).
- IC dashboard + SNS APIs: `https://ic-api.internetcomputer.org`,
  `https://sns-api.internetcomputer.org`.
