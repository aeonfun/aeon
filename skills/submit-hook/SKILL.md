---
name: submit-hook
description: "Submit a deployed Uniswap v4 hook to the public univ4-hooks registry - format the listing, open a PR (issue fallback) so it lists on the hook marketplace."
metadata:
  title: Submit Hook
  category: crypto
  var: "a deployed hook address to submit; empty = the most recent live deploy in the ledger"
  tags:
    - crypto
    - dev
  requires: []
  capabilities:
    - writes_external_host
---

> **${var}** - a hook address (`0x...`) to submit. Empty means the most recent **live mainnet** deploy in `memory/state/hook-deploys.json`.

Today is ${today}. This skill takes a hook this instance already deployed and lists it on the public registry `aeonfun/univ4-hooks` (the source behind the aeon hook marketplace). It does the formatting the registry expects, then opens a PR. The flags and callbacks are decoded from the address by the registry, so this skill only supplies the address, the chain, and the human-readable listing.

The mechanics (clone, write the entry, regenerate the registry, open the PR, fall back to an issue when there is no push access) live in `skills/submit-hook/submit-univ4.py`, so all GitHub egress stays inside that helper.

## What lists, and what does not

- **Only live mainnet deploys.** A dry-run or a testnet deploy is never submitted (the registry lists real, verifiable hooks). Skip with `SUBMIT_HOOK_SKIP`.
- **Only registry-supported chains.** The registry's `chains.json` covers `ethereum base robinhood monad bnb arbitrum unichain`. A deploy on any other chain is skipped (`SUBMIT_HOOK_UNSUPPORTED_CHAIN`); note it and stop.
- **Idempotent.** The helper skips if the address (any chain) or the slug is already listed, so re-running is safe.

## Steps

1. **Pick the deploy.** Read `memory/state/hook-deploys.json` (a list of deploy records). If `${var}` is a `0x...` address, select the record whose `hookAddress` matches it; else select the most recent record with `network: "mainnet"`. No matching record means notify and exit `SUBMIT_HOOK_NONE`.

2. **Gate it.** If the record's `network` is not `mainnet`, exit `SUBMIT_HOOK_SKIP`. If its `chain` is not one of `ethereum base robinhood monad bnb arbitrum unichain`, exit `SUBMIT_HOOK_UNSUPPORTED_CHAIN` (the registry cannot list it yet). Confirm `int(hookAddress,16) & 0x3FFF == int(flags,16)`; if not, the record is inconsistent, so notify and exit `SUBMIT_HOOK_BAD_RECORD`.

3. **Name it.** Derive a PascalCase contract-style `name` from the record's `brief`/feature (a market-hours gate becomes `MarketHoursGate`). This is the marketplace title and the `hooks/<slug>.json` filename.

4. **Classify it.** From the `brief` and `flagNames`, choose:
   - `category`: one of `Fees Rewards Access Games Orders Launch`. A gate/allowlist is `Access`; a fee/volatility hook is `Fees`; a tribute/buyback/leaderboard is `Rewards`; a block/price/volume game is `Games`; limit/async/MEV ordering is `Orders`; launch/anti-bot/anti-rug is `Launch`.
   - `klass`: `VALUE` if the hook returns a delta or moves tokens (a `*ReturnDelta` flag), `FEE` if it sets a dynamic LP fee, else `GATE`.
   - `template`: map the record's template. `dynamic` stays `dynamic`, `noop` stays `noop`, anything else (`freeform`/`skim`) becomes `freeform`.

5. **Write the listing prose** from the brief:
   - `mechanic`: one punchy line for the tile.
   - `plain`: 2-4 plain-language sentences a non-dev follows, for the modal.
   - `rules`: the exact rules the hook enforces, one per line (2-4).

6. **Submit.** Run the helper (a live mainnet deploy that cleared this instance's deploy gates lists as an aeon, verified hook):
   ```bash
   python3 skills/submit-hook/submit-univ4.py \
     --address "$HOOK_ADDRESS" --chain "$CHAIN" \
     --name "$NAME" --category "$CATEGORY" --klass "$KLASS" \
     --template "$TEMPLATE" --stage deployed --source aeon --verified \
     --date "$(echo "$TIMESTAMP" | cut -c1-10)" \
     --mechanic "$MECHANIC" --plain "$PLAIN" \
     --rule "$RULE1" --rule "$RULE2" [--rule "$RULE3"]
   ```
   Add `--dry-run` first to print the entry and the intended action without touching the registry, then drop it to actually open the PR. The helper prints the PR URL (or the issue URL on a fallback, or `already listed`).

7. **Notify + exit.** Send a short note (hook name, chain, PR/issue URL). Exit `SUBMIT_HOOK_OK` (PR/issue opened or already listed).

## Degrade rules

- No ledger or no matching record: `SUBMIT_HOOK_NONE` (notify, never fail hard).
- Testnet or dry-run deploy: `SUBMIT_HOOK_SKIP`.
- Chain not in the registry: `SUBMIT_HOOK_UNSUPPORTED_CHAIN`.
- `flags != address & 0x3FFF` in the record: `SUBMIT_HOOK_BAD_RECORD`.
- No push access to the registry: the helper files the structured submission issue instead and still exits `SUBMIT_HOOK_OK`.

## Notes

- The registry validates every PR: flags/callbacks are recomputed from the address, the schema is enforced, and the aggregated `hooklist.json` is checked. The helper regenerates `hooklist.json` + `HOOKS.md` before pushing so that check passes.
- `deploy-uni-hook` calls this same helper on a successful live deploy, so a hook usually lists itself the moment it lands. Run this skill by hand to resubmit an older deploy or one that failed to auto-list.
- The helper never puts a token on a command line. It uses the `gh` CLI, which reads `GH_TOKEN` from the environment.
