---
name: canister-status-monitoring
description: Monitor an Internet Computer canister's control plane - its controllers, module hash (upgrades), and whether it is still indexed - and detect the moment any of them changes.
metadata:
  title: Canister Status Monitoring
  category: Infrastructure
---

# Canister status monitoring

Watch a canister's control plane and catch an unexpected controller change, an
upgrade (module-hash change), or a de-indexing before it becomes an incident.

## What is public vs identity-gated

- **Public, keyless** — per-canister metadata from the IC dashboard API:
  `https://ic-api.internetcomputer.org/api/v3/canisters/<canister-id>` returns the
  controllers, the current `module_hash`, and the upgrade history. No identity
  required. This is enough to detect a controller set change, an upgrade, or the
  canister disappearing from the index.
- **Controller-gated** — the live running state (`Running`/`Stopping`/`Stopped`)
  and settings come from the management canister `canister_status`, callable **only
  by a controller**. There is no public endpoint for it. Reach it with
  `dfx canister status <id>` or an `ic-agent` call signed by a controller identity.

## How to monitor

1. Fetch the dashboard metadata for each watched canister id.
2. Diff `controllers` and `module_hash` against the last-seen values.
3. Alert on: a new or removed controller, a `module_hash` change (upgrade), or a
   404 / missing record (de-indexed or deleted).
4. For canisters you control, add `canister_status` via a controller identity to
   confirm the live running state.

## Why it matters

An unexpected controller is a takeover signal; an unannounced `module_hash` change
is an unreviewed upgrade; a canister vanishing from the index can mean it was
stopped or deleted. Each is worth a human's attention the moment it happens.
