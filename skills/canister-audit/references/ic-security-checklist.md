---
type: Reference
title: IC canister security checklist (Rust)
description: The 12 Internet Computer canister-security pitfalls, adapted to Rust (ic-cdk 0.19 / candid 0.10), with the static signal and the agentic reasoning each needs. Embedded knowledge from dfinity/icskills canister-security - the knowledge, not the runnable skill.
---

# IC canister security checklist (Rust)

The agentic audit pass (SKILL.md §C5) reads this the way `sc-audit` reads
`references/hook-checklist.md`. Each item says **what** breaks, the **Rust
signal**, whether it is caught **statically** (the Semgrep ruleset
`ic-semgrep-rust.yml`) or needs **agentic** data-flow reasoning, and **how to
confirm**. Knowledge adapted from the official `dfinity/icskills` `canister-security`
skill; it is embedded here as reference, not installed as a runnable skill.

IC model in one paragraph: every ingress message has a **caller principal**; the
unauthenticated one is `Principal::anonymous()` (`2vxsx-fae`). Update calls can
`await` inter-canister calls, and **state is not rolled back at an await point** -
it is committed up to the await and the continuation runs later, which is the root
of most IC-specific logic bugs. Controllers can upgrade/stop the canister;
`pre_upgrade`/`post_upgrade` move state across a code change.

## The 12 pitfalls

### 1. Relying on `canister_inspect_message` for access control - *agentic*
`inspect_message` runs on a **single replica without full consensus**, so a malicious
replica can skip the check and execute the update anyway; it is also **never called for
inter-canister calls, query calls, or management-canister calls**. Use it only as a
cycle-saving optimization, never as a security boundary, and always duplicate the access
check inside every update method. **Signal:** an `#[ic_cdk::inspect_message]` present
while update methods have no in-body caller check. **Confirm:** trace whether any
privileged `#[update]` relies solely on inspect_message.

### 2. Anonymous principal accepted - *static + agentic*
A state-changing method that does not reject `Principal::anonymous()` lets an
unauthenticated caller act. **Signal (static):** `ic-update-missing-caller-auth`
flags an `#[update]` (including `#[ic_cdk::update(name = ...)]`) with no recognized
caller guard; a bare `== Principal::anonymous()` or a mention in a comment does not
count as a guard.
**Confirm:** is the method privileged (moves value/authority)? A read-only or
deliberately-public method is fine - triage, don't auto-report.

### 3. TOCTOU across `await` / `CallerGuard` reentrancy - *agentic (+ static footgun)*
State read before an inter-canister `await` and reused after is stale: another
message can interleave and mutate it. The `CallerGuard` pattern serializes a caller
through a critical section - but `let _ = CallerGuard::new(caller)` drops the guard
immediately and does nothing. **Signal (static):** `ic-callerguard-immediate-drop`
(`let _ = CallerGuard::new(...)`). **Agentic:** find a `check → await → act` where
`act` trusts the pre-`await` check. **Confirm:** can a second call land between the
check and the act?

### 4. `pre_upgrade` trap - *agentic*
If `pre_upgrade` traps (e.g. serializing a large heap that exceeds the instruction
limit), the upgrade is impossible and the canister is stuck on old code. **Signal:**
a `#[pre_upgrade]` that serializes unbounded state. **Confirm:** can state grow
large enough that serialization traps? Prefer stable structures that need no
`pre_upgrade` copy.

### 5. Not monitoring cycles balance / cycle-drain DoS - *agentic*
Anyone on the internet can burn a canister's cycles with update calls. The default
`freezing_threshold` is 2,592,000 seconds (~30 days): when cycles drop below the
threshold reserve the canister **freezes** (rejects all update calls), and at zero it is
**uninstalled** (code and memory removed, though the canister ID and controllers
survive). A cheap, unauthenticated `#[update]` that does expensive work or inter-canister
calls makes this an attacker-triggerable DoS. **Signal:** unauthenticated update doing
heavy compute / calls / allocation. **Confirm:** cost per call x feasible call rate vs
the cycle balance and freezing threshold; for valuable canisters, raise the threshold and
monitor + top up.

### 6. Single controller / no backup - *operational (report, don't block)*
A canister with one controller principal (especially a plaintext dev key) is one
lost key from being unrecoverable, and a compromised controller can replace the
code. **Signal:** controller set documented as a single principal. **Confirm:**
recommend a multisig/threshold or a backup controller. Interactive deploy-time
advice - note it, never gate a finding on it.

### 7. `fetch_root_key` on a non-local path - *static*
`fetch_root_key()` turns off replica-signature verification; on mainnet it enables
response forgery. **Signal (static):** `ic-fetch-root-key-in-canister`. **Confirm:**
is it reachable on any non-local build/path? It must be gated behind an explicit
local-replica-only flag.

### 8. Unguarded state-changing admin method - *static + agentic*
A mint / migrate / config / `set_*` update with no owner/controller guard lets
anyone perform a privileged action. **Signal (static):** `ic-update-missing-caller-auth`
(and name heuristics for mint/admin/migrate). **Confirm:** does the method change
privileged state, and is every caller path actually guarded (not just one)?

### 9. Storing secrets in canister state - *static (verified) + agentic*
Canister memory on standard application subnets is **readable by node operators**, so
private keys, API secrets, or passwords in `thread_local!` state or constants are
exposed. Never store secrets in canister state; for on-chain secret management use
**vetKD** (threshold key derivation). **Signal:** TruffleHog `--only-verified` catches
live credentials; high-entropy constants / keys in state are an agentic read.
**Confirm:** is the secret real and privileged?

### 10. Unbounded user-controlled storage - *agentic*
An update that appends to a heap/stable collection keyed or sized by caller input,
with no quota, lets an attacker fill memory and brick the canister. **Signal:** a
write path whose size is attacker-controlled with no cap. **Confirm:** is there any
per-caller or global bound? Model the worst-case growth.

### 11. Callback-trap-after-mutation - *agentic*
State mutated **before** an `await` persists even if the callback later traps (the
trap only rolls back the continuation, not the already-committed pre-`await`
writes). This leaves half-applied state. **Signal:** mutate-then-`await`-then-maybe-trap.
**Confirm:** if the callback traps, is the pre-`await` mutation safe to have
committed alone?

### 12. Unbounded-wait inter-canister calls blocking upgrade - *agentic*
An inter-canister call with unbounded wait (vs a bounded-wait call) to an untrusted
or slow callee can hang the calling method and complicate upgrades. **Signal:**
`Call::...` unbounded wait to a callee the canister does not control. **Confirm:**
is the callee trusted and responsive; does a hung call block stop/upgrade?

## Triage bar (same as sc-audit §S6)

A static hit is a **candidate, not a finding**. For each: open the code, write one
sentence of *what the attacker controls and what they gain*, confirm reachability
from an external caller in production code, assign severity, then adversarially try
to refute it (find the guard/bound/unreachable path you missed). Only a candidate
that survives refutation is CONFIRMED and eligible for the PoC gate (§C6.5).
