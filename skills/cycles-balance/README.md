# cycles-balance

Alerts when an Internet Computer canister's **cycles balance** drops below a
configurable threshold — the runway before it freezes.

**Identity-gated (verified):** there is no public cycles endpoint. The balance comes
from the management-canister `canister_status`, callable only by a **controller**, so
this skill needs `ICP_IDENTITY_PEM` (a controller identity). It **fails open** — with
no identity configured it logs a skip and exits clean. `mode: read-only`. See
`docs/icp/ICP-CONNECTIVITY.md`.

## Run

```bash
gh workflow run aeon.yml --ref main -f skill=cycles-balance -f var="ryjl3-tyaaa-aaaaa-aaaba-cai:2T"
```

Empty `var` reads a `## Cycles` list (`id threshold` rows) from
`memory/topics/icp-canisters.md`.

## Verified constraint

```bash
# The public dashboard payload has controllers + module_hash but NO cycles field:
curl -s "https://ic-api.internetcomputer.org/api/v3/canisters/ryjl3-tyaaa-aaaaa-aaaba-cai" | jq 'keys'
```

(confirmed 2026-11-04) — which is why the balance read requires a controller identity.
