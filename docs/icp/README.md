# ICP (Internet Computer) in Aeon

How Aeon reaches the Internet Computer, what it ships for IC work, and the limits that
shape those choices. Reference material - not a changelog.

## The hosted ICP MCP (connected)

DFINITY's hosted ICP MCP, `https://mcp.internetcomputer.org/mcp`, is in the dashboard
MCP catalog as `icp`, with the companion skill `icp-mcp`. It lets a run act as the
operator's Internet Identity at an IC app: open the app, read its canisters' Candid and
API docs, and make query calls. The server also has `canister_update_call`, which
changes state. Aeon blocks it at run time for every skill and message run (catalog
`deniedTools`, `catalog/mcp-denied-tools.json`; see
[docs/mcp-oauth.md](../mcp-oauth.md)), so no prompt can make a run call it.

**Auth.** The server is a spec-compliant OAuth MCP (probed live 2026-11-18): PRM at
`/.well-known/oauth-protected-resource/mcp`, self-issuing AS, `authorization_code` +
PKCE S256, Dynamic Client Registration, public client. It offers **no refresh token and
no machine grant** by design. Instead the operator signs in with Internet Identity once
and picks the session length (**up to 30 days**) and the access level (**Questions
only** or **Actions & questions**). That fits Aeon's existing dashboard OAuth flow:

1. Dashboard → MCP → **Connect Internet Computer** runs the browser flow and stores the
   access token as `MCP_ICP_TOKEN`. No `MCP_ICP_OAUTH` is written, so
   `scripts/mcp-oauth-refresh.sh` skips it.
2. Every headless run sends that token until the session ends.
3. When it ends, `icp-mcp` logs `ICP_MCP_SESSION_EXPIRED` and notifies; reconnect from
   the panel. For a daily or weekly schedule that is about one reconnect a month.

**Reach.** Sending AI traffic to arbitrary third-party APIs is against AI vendors' terms,
so the ICP MCP only reaches apps that **opted in** by publishing a
`/.well-known/ic-architecture` manifest that declares their canisters
([service discoverability](https://docs.internetcomputer.org/guides/frontends/service-discoverability/)).
Reads and writes stay on the canisters an app declares as its own. That makes it the
right tool for working *inside* an app (for example a Caffeine app) as the operator, and
the wrong tool for watching arbitrary canisters, which is why the monitor skills below
keep the keyless public read path.

## The keyless read path (monitor skills)

IC state that Aeon needs is read **directly over HTTPS, keyless**, from the public
dashboard and SNS aggregator APIs:

- `ic-api.internetcomputer.org` - canister control-plane facts (controllers, module hash,
  upgrade history) and NNS proposals.
- `sns-api.internetcomputer.org` - the SNS DAO list and per-DAO proposals.

These need no identity and no cycles. The read skills are deliberately limited to
verified public control-plane facts; live management-canister state and cycles balances
are out of scope. No skill needs runtime IC access to do its core job.

## Why the dfinity/icskills skills are reference, not installed

dfinity publishes an `icskills` set of dev-time coding guides for writing IC code, not
scheduled tasks, and several assume an interactive authoring context, so they are not
installed into the fleet. Instead the useful **knowledge** is embedded in Aeon-native
skills - for example the 12 canister-security pitfalls live in
`skills/canister-audit/references/ic-security-checklist.md`, adapted from the icskills
`canister-security` material. Reuse the knowledge; do not run the upstream
skills as-is.

## Security limits

- **Source, not bytecode.** `canister-audit` audits a canister's Rust source. The IC has
  no verified-source registry; the module hash only proves which wasm runs, so there is
  no on-chain-by-address mode for IC.
- **Rust only.** ic-cdk / candid canisters; latest ic-cdk 0.20.3 (2026-11), the fixture
  pins 0.19. Motoko is out of scope.
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

- **The hosted MCP session is fixed-length** (up to 30 days, no refresh token): reconnect
  from the dashboard when it ends. It reaches opted-in apps only.
- **No off-the-shelf IC Semgrep ruleset.** `canister-audit` ships a small hand-authored
  one (`references/ic-semgrep-rust.yml`); the agentic source pass is the reliable core and
  the ruleset is a high-recall first pass.
- **No cycles monitor.** There is no verified keyless public read for a canister's cycle
  balance, so Aeon does not ship one.

## What ships (file index)

**Security audit (`canister-audit`)**
- `skills/canister-audit/SKILL.md`, `README.md`
- `skills/canister-audit/references/ic-security-checklist.md`, `ic-semgrep-rust.yml`
- `skills/canister-audit/fixtures/token_vault/` - a planted-flaw fixture (anonymous
  principal mints a free balance) with its PocketIC reproduction
- `scripts/stage-canister-audit.sh` - stages the wasm32 target, cargo-audit, and the
  pinned PocketIC server
- `.github/workflows/ci-canister-audit-fixture.yml` - runs the reproduction end to end

**Read + monitor skills** ([#1330](https://github.com/aeonfun/aeon/pull/1330))
- `canister-status` - control-plane monitor (controllers, module hash, upgrades);
  alerts on change
- `sns-digest` - NNS + SNS governance proposal digest
- `icp-deploy-check` - static pre-deploy checklist for an IC Rust canister repo

**Hosted ICP MCP (`icp-mcp`)**
- `apps/dashboard/lib/mcp-catalog.ts` - the `icp` catalog entry (OAuth Connect, `oauthSession` note)
- `skills/icp-mcp/SKILL.md` - read-only app lookups through the ICP MCP
- `docs/mcp-oauth.md` - the fixed-session provider notes

**Upstreamed to [dfinity/icskills](https://github.com/dfinity/icskills)**
- `icp-deploy-check` ([dfinity/icskills#447](https://github.com/dfinity/icskills/pull/447)) and
  `canister-audit` ([dfinity/icskills#450](https://github.com/dfinity/icskills/pull/450)), both merged 2026-11-13

## Citations

- ICP MCP endpoint metadata and docs: `https://mcp.internetcomputer.org/mcp`,
  `https://internetcomputer.org/icp-mcp/` (probed 2026-11-03, re-probed 2026-11-18).
- Session length (up to 30 days) and the opt-in rule: DFINITY, 2026-11-18;
  `https://docs.internetcomputer.org/guides/frontends/service-discoverability/`.
- IC dashboard + SNS APIs: `https://ic-api.internetcomputer.org`,
  `https://sns-api.internetcomputer.org`.
