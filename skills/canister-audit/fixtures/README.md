---
type: Reference
title: canister-audit fixtures
description: Bundled deliberately-vulnerable Rust IC canister fixtures for regression-testing the canister-audit pipeline (static ruleset + agentic pass + PocketIC proof arm) with no external repo.
---

# canister-audit fixtures

Self-contained, intentionally-vulnerable Rust IC canisters used to regression-test
the `canister-audit` pipeline end to end - the Semgrep IC ruleset, the agentic
source pass, and the PocketIC proof arm - without needing an external GitHub repo.

## How to run

Dispatch `canister-audit` with `var=fixture:<name>`:

```
gh workflow run aeon.yml --ref main -f skill=canister-audit -f var=fixture:token_vault
```

`fixture:*` mode (see `SKILL.md` §C1/§C2) copies the fixture into gitignored
`.scan/`, audits the copy, and **skips dedup and disclosure** - fixtures are
re-runnable and never disclosed.

## Fixtures

| Name | Bug | Expected result |
|---|---|---|
| `token_vault` | `claim_bonus` credits the caller's balance with no deposit, no anonymous-principal rejection, and no owner guard (pitfalls #2, #8) | Semgrep `ic-update-missing-caller-auth` flags `claim_bonus`, `withdraw` and `deposit` (a bare `== Principal::anonymous()` check is deliberately not treated as a guard, so `deposit` is a candidate for C6 triage to refute) while clearing only the owner-guarded `admin_set_total`; the agentic pass confirms the accounting-invariant break; the PocketIC repro proves the anonymous principal mints a free, withdrawable balance (`sum(balances) > total_deposited`) |

`token_vault` is the controlled true-positive case: a guarded ledger with one
unguarded mint path. It demonstrates the skill's premise - a static pass plus
agentic reasoning plus a PocketIC counterexample catch an IC access-control flaw
that no EVM-oriented tool models - and its `admin_set_total` method is the negative
control proving the static rule discriminates a guarded admin method from an
unguarded one.

## Proving the fixture locally

```
cd skills/canister-audit/fixtures/token_vault
bash repro/repro.sh          # builds wasm32, runs the PocketIC reproduction
```

`repro.sh` builds the crate in `$PWD` (so `cd` into it first, as above) and looks
for the PocketIC server at `POCKET_IC_BIN`, defaulting to `/tmp/bin/pocket-ic`
(where `scripts/stage-canister-audit.sh` installs it) - override the env var to
point elsewhere. These defaults are what let the shared PoC gate run it under a
scrubbed `env -i`.

The static layer needs no build - `semgrep --config ../../references/ic-semgrep-rust.yml src/lib.rs`
flags the flaw directly.
