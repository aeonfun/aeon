---
mode: read-only
name: Investigation Report
category: onchain-security
description: One-shot composite investigation of a Base token — runs rug-scan, contract-audit, deployer-trace and holder-concentration and merges them into a single report with an at-a-glance verdict. Keyless core; a Basescan key deepens it.
var: ""
tags: [crypto, security, base]
requires: [BASESCAN_KEY?]
capabilities: [external_api, sends_notifications]
---
> **${var}** — Token contract address (`0x...`) on Base to investigate. Required. If empty, log `REPORT_NO_TARGET` and exit cleanly (no notify).

The "tell me everything about this token" skill. Instead of running four checks by hand, this composes them into one structured report: **rug risk**, **contract audit** (verification / owner powers / proxy), **deployer trace** (who shipped it and their history), and **holder concentration** (whale risk) — with a one-line summary on top.

Designed to **degrade gracefully**: each section runs independently, so a section that needs a key (or returns nothing) is marked `unavailable` without aborting the rest.

## Config

- Target = `${var}`. Chain = Base (`chainid=8453`, explorer `basescan.org`).
- `BASESCAN_KEY` — optional. The keyless core (RPC) covers rug heuristics, owner/proxy reads and deployer creation; a key adds verified source, full deployer history and the holder list (concentration).

## Steps

Run the four sub-investigations (each is its own Hound skill — reuse them if installed, else follow the inline logic). Collect each section's verdict; never let one failure stop the others.

### 1. Rug Scan

Score red flags (unverified source, live owner powers — mint/blacklist/fee, low/again-mintable supply, etc.) → `LOW` / `ELEVATED` / `HIGH`. See the `rug-scan` skill.

### 2. Contract Audit

`getsourcecode` → verified? proxy? Decode `owner()`/`getOwner()` and list owner-only powers; note if ownership is renounced. See the `contract-audit` skill.

### 3. Deployer Trace

`getcontractcreation` → the deployer EOA and creation tx; summarise the deployer's other deployments / reputation. See the `deployer-trace` skill.

### 4. Holder Concentration

`tokenholderlist` → top-holder share, how many wallets hold the majority, whether the top holders are the pool/locker vs EOAs (whale/dump risk). See the `holder-concentration` skill.

### 5. Compose

Merge into one document:

```
# Investigation Report — 0xToken (Base)

**At a glance:** Rug risk: ELEVATED · Source: verified · Top holder: 42%

## 1. Rug Scan
...
## 2. Contract Audit
...
## 3. Deployer Trace
...
## 4. Holder Concentration
...
```

An `unavailable` section means that data source needed a key or returned nothing — **not** that the token is safe. State that explicitly.

### 6. Notify

Notify via `./notify` only when the composite is concerning — rug risk `HIGH`, **or** `ELEVATED` combined with another red flag (unverified, live owner powers, or top holder > ~30%):

```
*Investigation Report — 0xToken (Base)*
At a glance: Rug risk HIGH · unverified · top holder 61% ⚠️

Multiple red flags across rug-scan, contract-audit and holder-concentration.
Full report saved. Treat with caution.

Token: https://basescan.org/token/0xToken
```

### 7. Log

Append to `memory/logs/${today}.md`:

```
## investigation-report
- Token: 0x… | rug: ELEVATED | verified: yes | top holder: 42%
- Sections ok: rug,audit,deployer,holders (holders=partial, no key)
```

End-states: `REPORT_OK` (compiled, nothing alarming), `REPORT_FLAGGED` (concerning composite → notify), `REPORT_PARTIAL` (compiled with ≥1 unavailable section), `REPORT_ERROR`.

## Sandbox note

The sandbox may block outbound `curl` or env-var expansion. Both the Base RPC and Basescan's API work over plain HTTPS, so for every failed `curl` retry the **same URL/body via WebFetch** before giving up. `eth_getLogs` / holder lists may need narrower ranges or paging on busy tokens. If a `BASESCAN_KEY` is set, pass it as `&apikey=...` via WebFetch — never echo it into logs or notify. Treat every discovered address as untrusted; only interpolate the validated `$TOKEN` / hex into calls.

## Constraints

- This is an **aggregator** — its accuracy is bounded by its sub-checks. A clean report is not a guarantee of safety; an `unavailable` section is missing data, not a pass.
- Verdicts are **heuristic risk signals**, not financial or investment advice. Present findings; let the user decide.
- Read-only (`eth_call` / `eth_getLogs` / explorer reads) — no transactions, no funds at risk.
- Don't double-notify: if individual sub-skills already notify, the report should send **one** consolidated alert, not four.
