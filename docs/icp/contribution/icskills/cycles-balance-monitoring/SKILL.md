---
name: cycles-balance-monitoring
description: Watch an Internet Computer canister's cycles balance and alert before it drops below the runway needed to avoid freezing and halting.
metadata:
  title: Cycles Balance Monitoring
  category: Infrastructure
---

# Cycles balance monitoring

A canister that runs out of cycles freezes and stops serving. Monitor the balance
and alert while there is still runway to top up.

## Reading the balance (controller-gated)

Cycles balance is **not public**. It comes from the management canister
`canister_status`, which only a **controller** of the canister may call:

```
dfx canister status <canister-id>        # prints Balance: <n> Cycles
```

or, headless, an `ic-agent` call to `aaaaa-aa` `canister_status` signed by a
controller identity (a PEM you hold). There is no keyless dashboard field for
cycles, so any automated monitor needs a controller identity configured; without
one, it cannot read the balance and should skip rather than guess.

## How to monitor

1. For each watched canister, call `canister_status` as a controller.
2. Compare the balance to a configurable threshold (set it above the freezing
   threshold plus a safety margin sized to the canister's burn rate).
3. Alert when `balance < threshold`, reporting the balance, the threshold, and an
   estimate of the remaining runway.

## Cycle-drain awareness

An unauthenticated, cheap update method that does expensive work lets anyone burn
your cycles toward the freezing threshold (a denial-of-service vector). If the
balance drops faster than your top-up cadence, audit for a drain path, not just a
budget shortfall.
