# canister-status

Monitors Internet Computer canisters for **control-plane changes** — a new/removed
controller, a module-hash change (upgrade), or a canister dropping out of the public
index — and alerts the moment one happens.

- **Public path (default, no secret):** the IC dashboard API
  `GET https://ic-api.internetcomputer.org/api/v3/canisters/<id>` — `controllers`,
  `module_hash`, `canister_type`, `subnet_id`, `upgrades[]`.
- **Identity path (optional):** live running-state via the management-canister
  `canister_status` (controller-gated) when `ICP_IDENTITY_PEM` is configured.

`mode: read-only`.

## Run

```bash
gh workflow run aeon.yml --ref main -f skill=canister-status -f var=ryjl3-tyaaa-aaaaa-aaaba-cai
```

Empty `var` reads a `## Watch` list from `memory/topics/icp-canisters.md`.

## Dry-run evidence

The public read is verifiable with no secret:

```bash
curl -s "https://ic-api.internetcomputer.org/api/v3/canisters/ryjl3-tyaaa-aaaaa-aaaba-cai" | jq '{controllers, module_hash, canister_type}'
```

returns the ICP Ledger's controllers + module hash (confirmed 2026-11-04).
