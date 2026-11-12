# canister-status

Monitors Internet Computer canisters for **control-plane changes** — a new/removed
controller, a module-hash change (upgrade), or a canister dropping out of the public
index — and alerts the moment one happens.

- **Public path (no secret):** the IC dashboard API
  `GET https://ic-api.internetcomputer.org/api/v3/canisters/<id>` — `controllers`,
  `module_hash`, `canister_type`, `subnet_id`, `upgrades[]`.

The skill is limited to verified public fields and does not claim running state or
memory size.

`mode: write`.

## Run

```bash
gh workflow run aeon.yml --ref main -f skill=canister-status -f var=ryjl3-tyaaa-aaaaa-aaaba-cai
```

Empty `var` reads a `## Watch` list from `memory/topics/icp-canisters.md`.

## Dry-run evidence

The public read is verifiable with no secret:

```bash
curl -sS -o /tmp/canister.json -w 'http=%{http_code}\n' "https://ic-api.internetcomputer.org/api/v3/canisters/ryjl3-tyaaa-aaaaa-aaaba-cai"
jq '{controllers, module_hash, canister_type, latest_upgrade:.upgrades[0]}' /tmp/canister.json
```

returns HTTP 200 and the ICP Ledger's public control-plane snapshot. The reconciler
at `reconcile.mjs` validates responses, writes snapshots atomically, and deduplicates
controller, upgrade, missing, and reappearance alerts.
