---
name: icp-deploy-check
description: Pre-deploy safety gate for an Internet Computer Rust canister (ic-cdk). Statically detect the five deploy-time footguns that brick a canister or let anyone drain it - anonymous-principal access, mainnet fetch_root_key, unguarded admin methods, pre_upgrade traps, single-controller - with exact grep patterns and a pass/fail/needs-review report. Use before `dfx deploy`/`icp canister install` to mainnet, in CI, or when reviewing a canister PR.
license: Apache-2.0
compatibility: "a local Rust canister repo (ic-cdk >= 0.13); no network, no mainnet action"
metadata:
  title: ICP Deploy Check
  category: Security
---

# ICP deploy check

Run this static, read-only gate over a Rust canister **before** a mainnet deploy.
It reads source and reports; it never deploys, never calls mainnet, never needs a
key. Each check gives an exact detection signal so the result is reproducible.

Scope: `#[ic_cdk::update]` / `#[ic_cdk::query]` entrypoints and the
`init`/`pre_upgrade`/`post_upgrade` hooks in a Rust `ic-cdk` canister. Produce one
row per check: `PASS` / `FAIL` / `REVIEW` with the `file:line` evidence.

## The five checks (with detection signals)

### 1. Anonymous principal reaches a state change — FAIL if unguarded
Every state-changing `#[ic_cdk::update]` must reject the anonymous principal or
sit behind a caller check.

- **Detect:** for each function annotated `#[ic_cdk::update]` (or `#[update]`),
  FAIL when its body contains **neither**
  `ic_cdk::api::msg_caller() == Principal::anonymous()` (an explicit reject)
  **nor** a guard — `ic_cdk::api::is_controller(...)`, a `guard = "..."` attribute,
  or a project `CallerGuard`/`require_caller`/`require_owner` call.
- **Grep:** list update fns — `rg -n '#\[(ic_cdk::)?update\]' -A1`; for each, check
  the body for `Principal::anonymous` or a guard token. An update that moves a
  balance, mints, or sets config with no such check is the finding.
- Note: `ic_cdk::caller()` is deprecated (ic-cdk ≥ 0.18); `msg_caller()` is current.
  A file still using `caller()` usually predates the guard conventions — REVIEW.

### 2. `fetch_root_key` on a mainnet path — FAIL if present
`fetch_root_key()` turns off replica-signature verification. It is for a **local
replica only**; reaching it against mainnet lets a man-in-the-middle forge replies.

- **Detect:** FAIL on any literal `fetch_root_key(` not gated behind an explicit
  local-only flag (e.g. `if network == "local"` / `#[cfg(feature = "local")]`).
- **Grep:** `rg -n 'fetch_root_key'`.

### 3. Unguarded admin / privileged method — FAIL if unguarded
Mint / migrate / config / `set_*` updates must be restricted to the controller or
owner, not callable by any principal.

- **Detect:** an `#[ic_cdk::update]` whose name matches
  `(?i)(mint|burn|admin|migrate|upgrade|config|set_|withdraw|transfer_from)` and
  whose body has no `is_controller` / owner-equality / `guard =` check → FAIL.
- **Grep:** `rg -n '#\[(ic_cdk::)?update\]' -A3 | rg -i 'fn (mint|admin|migrate|set_|config|withdraw)'`
  then confirm a guard is present in each.

### 4. `pre_upgrade` trap risk — REVIEW
A `#[pre_upgrade]` that serializes a large or unbounded heap can exceed the
instruction limit and **trap**, making the canister permanently un-upgradeable.

- **Detect:** REVIEW any `#[ic_cdk::pre_upgrade]` that serializes a growable
  collection (`Vec`/`HashMap`/`BTreeMap`) whose size is user-controlled. PASS/N-A
  when state lives in `ic-stable-structures` (no manual `pre_upgrade` copy needed).
- **Grep:** `rg -n 'pre_upgrade'`; inspect what it serializes.

### 5. Single controller / no backup — REVIEW (deploy-time, operator)
A canister controlled by one principal — especially a plaintext dev key — is one
lost or compromised key from being unrecoverable or silently re-coded.

- **Detect:** REVIEW the controller set at deploy time
  (`dfx canister info <id>` / `icp canister status <id>`). Require a multisig /
  threshold controller or a documented backup controller principal.

## Report format

```
Target: <crate> (Rust ic-cdk canister) — N update methods
[FAIL  ] #1/#3 <fn>:<line> — anonymous/unguarded privileged update: <one line>
[PASS  ] #2 no mainnet fetch_root_key
[N/A   ] #4 pre_upgrade — state in stable structures
[REVIEW] #5 controller backup — operator confirms multisig at deploy
```

A grep hit is a **candidate**: open the `file:line`, confirm the method is
privileged and reachable, and only then mark `FAIL`. A deliberately-public,
read-only method is not a finding.

## Boundaries

This is a fast pre-deploy gate, not a full audit. It does not model TOCTOU across
`await`, callback-trap ordering, cycle-drain economics, or unbounded storage — a
deeper canister-audit workflow (static rules + agentic review + a PocketIC
proof-of-concept) covers those and drives each finding to a verified reproduction
before disclosure. This skill performs **no** network or mainnet action.
