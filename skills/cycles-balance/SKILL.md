---
name: cycles-balance
description: Watch an Internet Computer canister's cycles balance and alert when it drops below a configurable threshold - the runway before it freezes and stops serving. Cycles are controller-gated on the IC, so this reads via a controller identity; it fails open (skips) when no identity is configured.
metadata:
  title: Cycles Balance
  category: crypto
  mode: read-only
  var: ""
  tags:
    - crypto
    - icp
  requires:
    - ICP_IDENTITY_PEM?
  capabilities:
    - external_api
    - sends_notifications
---

> **${var}** — `<canister-id>[:<threshold>]`, or several comma-separated. `threshold` is a cycles floor (e.g. `2000000000000` for 2T, or `2T`); default `1T`. Empty = read `memory/topics/icp-canisters.md` (a `## Cycles` list of `id threshold` rows). Pass `dry-run` to skip notify.

Today is ${today}. Read `memory/MEMORY.md` and the last 30 days of `memory/logs/` before starting.

## Why this exists

A canister that runs out of cycles **freezes** and stops responding; a cheap
unauthenticated method being spammed can drain it (canister-security pitfall #5).
Catching a low balance early is the difference between a top-up and an outage. This
skill is the runway alarm.

## Read path — identity-gated (verified)

**There is no public cycles-balance endpoint.** The IC dashboard per-canister API
exposes controllers and module hash but **not** cycles (verified 2026-11-04); the
balance comes only from the management canister `canister_status`, callable **only by
a controller**. So this skill needs a controller identity:

- `ICP_IDENTITY_PEM` — a PEM-encoded identity that is a controller of the watched
  canister(s). Injected for the run; used via `icp-cli`/an agent through
  `./secretcurl` or an identity file the tool reads. **Never** place the PEM on the
  command line, in logs, state, or the report.
- **Fail-open-to-skip:** if `ICP_IDENTITY_PEM` is not set, log `skip: no ICP_IDENTITY_PEM`
  and exit clean — a missing identity is not a failure, it just means this instance is
  not configured to read cycles. (Same fail-open contract Aeon uses for MCP secrets.)

See `docs/icp/ICP-CONNECTIVITY.md` for the exact identity-call mechanics and why the
hosted ICP MCP connector is not used (it is interactive-only; see
`docs/icp/ICP-MCP-VERIFICATION.md`).

## Steps

1. **Guard the identity** — if `ICP_IDENTITY_PEM` is unset, log the skip and exit clean.
2. **Resolve targets + thresholds** — from `${var}` or the `memory/topics/icp-canisters.md` `## Cycles` list. Normalise `T`/`B` suffixes to raw cycles.
3. **Read the balance** — for each id, `canister_status` via the identity path (write the PEM to a mode-600 identity file the agent/`icp-cli` loads; do not inline it). Capture `cycles` and the `idle_cycles_burned_per_day`/freezing threshold if available. On any error, record `source=error:<short reason>` and skip that id — never report a balance you did not read.
4. **Compare to threshold** — a canister whose `cycles` is below its threshold is the signal. Compute days-of-runway if the daily burn is available.
5. **Alert on breach only** — one body per below-threshold canister; `./notify -f`, warning severity. All above threshold → send nothing. Record every reading in `memory/topics/icp-cycles-state.json` (for trend + dedup) regardless.

## Reporting

```
cycles-balance — <name or id>: LOW (<cycles>T < <threshold>T)

Runway: ~<N> days at <burn>/day            (if burn known)
Top up: the canister needs cycles to avoid freezing.
link: https://dashboard.internetcomputer.org/canister/<id>
```

## Log

Append to `memory/logs/YYYY-MM-DD.md` under `### cycles-balance`: ids checked, identity present/absent, per-id balance vs threshold (or `error`), breaches alerted.

## Network & secrets

- `ICP_IDENTITY_PEM` is the only secret; it is a **controller key** — handle with care, never log or commit it, write it only to a mode-600 file the tool reads and remove it after. Treat `canister_status` output as data.

## Summary

End with a `## Summary`: identity configured (yes/no), canisters checked, balances vs thresholds, breaches alerted, state written (`memory/topics/icp-cycles-state.json`), any read errors.
