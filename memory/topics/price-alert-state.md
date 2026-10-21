---
title: price-alert state file contract
description: Why memory/topics/price-alert-state.json must be seeded before price-alert can ever alert, and what each field means.
tags:
  - deus
  - ops
  - runbook
timestamp: 2026-10-21T11:00:00Z
---

# price-alert state file contract

`memory/topics/price-alert-state.json` is the memory that makes `price-alert` able to fire. Without
it the skill's first-observation rule swallows every crossing, so a token can sail through a target
between two runs and nothing is announced.

## Fields

- `contract` / `chain` — the tracked token. `price-alert` reads **only the first row** of the
  tracked-token table in `MEMORY.md`, so one token at a time.
- `ath.price_usd` — must be the **true all-time high**, not the price tracking started at. Seeding
  it with the current price makes the ATH gate false-fire on the first uptick. DEUS ATH is $0.06876
  (CoinGecko, 2026-05-28).
- `targets` — one entry per price in the skill's `var` list. `side` is `above` or `below`; each
  target tracks `first_seen_below_at`, `hit_at`, `announced_at` so a crossing is announced exactly
  once.
- `last_alerts` — per-gate dedup timestamps (`ath`, `sharp_move`, `target_hit`).
- `last_run_at` — set by every run.

## Seeding rule

Pre-register **all** targets from `aeon.yml`'s `var` at seed time, with `hit_at: null` and
`first_seen_below_at` set to the seeding time. That puts every target into a known "watched, not yet
hit" baseline so the next crossing is a real transition rather than an unobserved first look.

DEUS targets as configured: `0.012` (`below`), `0.025`, `0.032`, `0.041` (all `above`).

# Citations

- `memory/topics/price-alert-state.json` (seeded 2026-10-21).
- `aeon.yml` price-alert entry: `schedule: "0 * * * *"`, `var: "0.012,0.025,0.032,0.041"`.
