---
type: Reference
title: sc-audit fixtures
description: Bundled deliberately-vulnerable Foundry fixtures for regression-testing the sc-audit pipeline (including the Echidna/Medusa fuzz arm) with no external repo.
---

# sc-audit fixtures

Self-contained, intentionally-vulnerable Foundry projects used to regression-test the
`sc-audit` pipeline end to end — Slither, the agentic source pass, and the Echidna/Medusa
fuzz arm — without needing an external GitHub repo.

## How to run

Dispatch `sc-audit` with `var=fixture:<name>`:

```
gh workflow run aeon.yml --ref main -f skill=sc-audit -f var=fixture:vault
```

`fixture:*` mode (see `SKILL.md` §S1/§S2) copies the fixture into gitignored `.scan/`,
audits the copy, and **skips dedup and disclosure** — fixtures are re-runnable and never
disclosed.

## Fixtures

| Name | Bug | Expected result |
|---|---|---|
| `vault` | `Vault.claimBonus` credits balance with no deposit | Slither finds nothing; the fuzz arm falsifies the accounting invariant (`sum(balanceOf) <= totalDeposited`) and a no-free-ETH property, proving fund theft |

The `vault` fixture is the controlled true-negative-for-Slither / true-positive-for-fuzz
case: it demonstrates the skill's premise (a fuzzer catches what static analysis cannot).
