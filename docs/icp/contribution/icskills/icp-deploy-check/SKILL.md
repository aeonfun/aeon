---
name: icp-deploy-check
description: A pre-deploy safety checklist for an Internet Computer Rust canister - verify the deploy-time footguns from the canister-security guidance before shipping to mainnet.
metadata:
  title: ICP Deploy Check
  category: Security
---

# ICP deploy check

Run this static, read-only checklist over a canister repo **before** a mainnet
deploy. No network, no mainnet action - it reads source and settings and reports.

## Checklist

1. **Controller backup (recoverability).** The canister should not be controlled by
   a single plaintext dev key. Confirm a multisig / threshold controller or a
   documented backup controller principal, so one lost or compromised key is not
   terminal.
2. **Anonymous-principal rejection.** Every state-changing `#[update]` that is
   privileged must reject `Principal::anonymous()` (or sit behind a guard). An
   update that moves value or authority with no caller check is exploitable by
   anyone.
3. **No mainnet `fetch_root_key`.** `fetch_root_key()` disables replica-signature
   verification and is for a local replica only. It must not be reachable on a
   mainnet build path.
4. **Upgrade safety.** `pre_upgrade` must not trap on a large heap (it would brick
   the upgrade); prefer stable structures. Verify `post_upgrade` restores all
   invariants and that state migrations are forward-safe.
5. **Unguarded admin methods.** Mint / migrate / config / `set_*` updates must be
   guarded to the controller/owner, not left callable by any principal.

## How to run it

Point the check at a local or cloned canister repo, enumerate the `#[update]` /
`#[query]` entrypoints and the `init`/`pre_upgrade`/`post_upgrade` hooks, and report
each item as pass / fail / needs-review with the file:line evidence. Treat a missing
guard or an unsafe pattern as a candidate to confirm by reading the code, not as
proof on its own.

## Relationship to a full audit

This is a fast pre-deploy gate, not a security audit. For a deep review (static
rules + agentic reasoning + a reproduction), a dedicated canister-audit workflow
drives each finding to a verified proof-of-concept before disclosure.
