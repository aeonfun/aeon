# ICP Connectivity (Workstream A)

How Aeon's headless, scheduled skills read Internet Computer data. Companion to
`ICP-MCP-VERIFICATION.md` (why the hosted MCP connector is not used) and the
`ICP-INTEGRATION-PRD.md` Workstream-A section.

## Decision

The hosted ICP MCP connector (`mcp.internetcomputer.org/mcp`) is **interactive-only**
(`authorization_code` + PKCE + Internet Identity; no refresh-token grant, no machine
grant) and is therefore incompatible with Aeon's headless `refresh_token`-only OAuth
(`scripts/mcp-oauth-refresh.sh`). Verified in `ICP-MCP-VERIFICATION.md`. So Aeon reads
the IC **directly** over public HTTP where possible, and via a controller **identity**
only where the IC itself requires one.

## Two read tiers (verified 2026-11-04)

### Tier 1 — public, no secret

Keyless HTTP GETs over `curl`/WebFetch. Used by `canister-status` (control plane) and
`sns-digest` (governance).

| Data | Endpoint | Notes |
|---|---|---|
| Canister control plane | `GET https://ic-api.internetcomputer.org/api/v3/canisters/<id>` | `controllers`, `module_hash`, `canister_type`, `subnet_id`, `upgrades[]`. Indexed canisters only (404 = unindexed). **No cycles, no running-state.** |
| NNS proposals | `GET https://ic-api.internetcomputer.org/api/v3/proposals?limit=<n>` | `id`, `action`, `latest_tally`, `deadline_timestamp_seconds`; filter `&include_topic=<TOPIC_*>`. |
| SNS list | `GET https://sns-api.internetcomputer.org/api/v1/snses?limit=<n>&offset=<o>` | `root_canister_id`, `name`, `swap_lifecycle`; per-SNS proposals under the same host. |

Example (no key):

```bash
curl -s "https://ic-api.internetcomputer.org/api/v3/canisters/ryjl3-tyaaa-aaaaa-aaaba-cai" \
  | jq '{controllers, module_hash, canister_type}'
```

### Tier 2 — controller-identity-gated

Cycles balance and live running-state (`Running`/`Stopping`/`Stopped`, `memory_size`)
come from the management canister `canister_status`, which **only a controller** may
call. There is **no public cycles endpoint** (the Tier-1 canister payload has no
cycles field — verified). Used by `cycles-balance` and the optional path in
`canister-status`.

- Secret: `ICP_IDENTITY_PEM` — a PEM identity that is a controller of the target
  canister(s), declared optional (`ICP_IDENTITY_PEM?`) in the skill's `requires:`.
- Mechanics: the skill writes the PEM to a mode-600 identity file that `icp-cli` / an
  `ic-agent` process loads, or passes it through `./secretcurl` as a `{ICP_IDENTITY_PEM}`
  placeholder — **never** on the command line, in logs, state, or reports.
- **Fail-open-to-skip:** no `ICP_IDENTITY_PEM` ⇒ the skill logs a skip and exits clean
  (the same contract Aeon uses for unset MCP secrets). A missing identity is a
  not-configured state, not a failure.

## Boundaries (explicit, recorded)

- **No write path is in scope for this delivery.** No mainnet transaction, no
  cycles top-up, no identity-signed state change is performed. A future write path
  would use `ic-agent`/`icp-cli` + `ICP_IDENTITY_PEM` executed in-run via `./secretcurl`
  as a skill's final fail-closed action — not built here.
- `canister-audit` (the security offering) needs **no** IC connectivity at all — it
  audits source.
- Toolchain (`icp-cli`/`ic-agent`) for Tier 2 is staged the same way other skill
  toolchains are (a `scripts/stage-*.sh` workflow step) when a cycles/running-state
  read is actually configured; the public Tier-1 skills need nothing beyond `curl`.
