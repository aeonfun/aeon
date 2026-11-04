# Aeon × ICP — Demo & dry-run evidence

Real outputs from executing each skill's core logic against **live** Internet
Computer data on 2026-11-04. This is **dry-run evidence** (the skill's documented
read/analysis logic, run against live public endpoints) — it satisfies FR-A ("a
skill performs a live read and reports real data") and FR-B ("dry-run evidence").
A *scheduled harness run* on a configured Aeon instance is the next step and is
gated on the PRs merging (see the ledger).

## `sns-digest` — live (public, keyless)

**NNS — open proposals** (`ic-api.internetcomputer.org/api/v3/proposals`):

```
#144702 [TOPIC_IC_OS_VERSION_DEPLOYMENT]        OPEN — Update 1 API boundary node to replica 83f29e0
#144685 [TOPIC_APPLICATION_CANISTER_MANAGEMENT] OPEN — Upgrade Internet Identity Frontend Canister to 84f611de8
#144684 [TOPIC_APPLICATION_CANISTER_MANAGEMENT] OPEN — Upgrade Internet Identity Backend Canister to 84f611de8
```

**SNS — DAO list** (`sns-api.internetcomputer.org/api/v1/snses`): ALICE, CANI DAO,
CHAI, Catalyze, Cecil The Lion DAO, … The digest diffs against a seen-set and
reports only new/newly-open proposals.

## `canister-status` — live (public, keyless)

Internet Identity canister `rdmx6-jaaaa-aaaaa-aaadq-cai`
(`ic-api.../v3/canisters/<id>`):

```
name:         NNS Internet Identity
controllers:  [r7inp-6aaaa-aaaaa-aaabq-cai]   (NNS root)
module_hash:  b09b4ddac9db91b78a931edf…
upgrades:     241 recorded                     ← the skill diffs this to detect a new upgrade
cycles:       not present in the public payload (controller-gated)
```

The skill alerts when `controllers` or `module_hash` changes vs last-seen, or the
record disappears.

## `icp-deploy-check` — executed against a real Rust canister

Run over the `token_vault` fixture (`src/lib.rs`, 4 update methods) — it correctly
**caught the planted flaw** and passed the rest:

```
[FAIL  ] #2/#8 anonymous/unguarded privileged update
         fn claim_bonus: credits state with no caller auth
[PASS  ] #7 no mainnet fetch_root_key — none found
[N/A   ] #4 pre_upgrade upgrade-safety — no pre_upgrade (stable structures)
[REVIEW] #6 controller backup — operator confirms multisig/backup at deploy
```

## `cycles-balance` — identity-gated (honest limitation)

Cycles balance has **no public endpoint** (management-canister `canister_status`,
controller-only). A live read needs `ICP_IDENTITY_PEM`, which is not configured
here. Dry-run not possible without a controller identity; the skill fails open
(skips) when the identity is absent. This is the only one of the four that cannot
be exercised against public data.

## `canister-audit` — proven in CI (not a dry-run)

The PocketIC reproduction ran end-to-end on GitHub Actions
(`ci-canister-audit-fixture`): `test anonymous_principal_mints_free_balance ... ok`
— the anonymous principal mints a free, withdrawable balance via `claim_bonus`,
breaking `sum(balances) <= total_deposited`. See PR #1328.

## Scheduled-harness demo (after merge, on a configured instance)

```
gh workflow run aeon.yml -f skill=canister-audit -f var=fixture:token_vault
gh workflow run aeon.yml -f skill=sns-digest
gh workflow run aeon.yml -f skill=canister-status   -f var=<canister-id>
gh workflow run aeon.yml -f skill=icp-deploy-check  -f var=<rust-canister-repo>
gh workflow run aeon.yml -f skill=cycles-balance    -f var=<canister-id>   # needs ICP_IDENTITY_PEM
```
