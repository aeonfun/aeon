---
name: LiquidPad Launch
description: Emit a LiquidPad token deploy payload through the prefetch/postprocess shim pair. Routes 80% fees to deployer, 15% to LPAD burn, 5% to LIQ buyback, contract-enforced.
var: ""
tags: [defi, base, launchpad, token-launch]
requires: [LIQUIDPAD_API_KEY]
capabilities: [external_api, writes_external_host, onchain_writes, sends_notifications]
---

> **${var}** — Token concept (free-form vibe ≥ 6 chars, or a JSON object with `{name, symbol, theme}`). If empty, the skill derives a vibe from `memory/MEMORY.md` and `memory/topics/`.
> Env (read by the shims, **not** by the skill): `LIQUIDPAD_API_KEY`, `LIQUIDPAD_DRY_RUN=1`. The skill body itself never sees the key.

Emit a payload that, when picked up by `scripts/postprocess-liquidpad.sh`, deploys a token on Base through LiquidPad's public API. The skill body runs in the sandbox and decides *whether* to deploy (running the safety policy below); the actual authed network call happens outside the sandbox via the postprocess shim.

The skill exists because every aeon agent that wants to ship a token shouldn't have to re-derive the deploy flow — LiquidPad's contract-enforced fee split (80/15/5) plus ERC-8004 stamping are the parts most agents reinvent badly.

Read `memory/MEMORY.md` and `memory/topics/` to ground the concept in the agent's current context.
Read the last 7 days of `memory/logs/` to avoid duplicate launches (same name or ticker).

## How the shim split works

1. **Before the skill runs** — `scripts/prefetch-liquidpad.sh liquidpad-launch <var>` runs in the workflow with `LIQUIDPAD_API_KEY` available. If `${var}` is a vibe string ≥ 6 chars, it calls `POST /agent/concept` and writes `.liquidpad-cache/concept.json`. It also writes `.liquidpad-cache/agent-status.json` for context.
2. **The skill body** reads cached files, runs the safety policy, and — if everything checks out — writes a deploy payload to `.pending-liquidpad/<id>.json`. The skill body never curls anything.
3. **After the skill runs** — `scripts/postprocess-liquidpad.sh` reads each pending payload, calls `POST /agent/run-once` outside the sandbox, writes the result to `.liquidpad-cache/<id>.result.json`, and removes the pending file. Failed calls move to `.pending-liquidpad/.failed/`.

A skill invocation that emits a payload is *not* a guarantee of deploy — the postprocess shim has its own sanity gates (valid 0x address, required fields). The skill is the policy layer; the shim is the I/O layer.

## Safety policy (skill side)

A payload is emitted only when every one of the following holds:

- **Concept fields valid**: `name` (1–32 chars), `symbol` (2–10 alphanumeric, uppercased), `theme` (1 sentence, ≤ 200 chars). Reject empty / placeholder values.
- **No same-day duplicate**: search `memory/logs/` for an entry with the same `symbol` in the last 24h. Found → log `SKIP:duplicate-symbol:<TICKER>` and stop.
- **No banned-list match**: refuse if `name` or `symbol` matches any line in `memory/topics/liquidpad-banlist.md` (operator-curated list).
- **Owner wallet present**: `OWNER_WALLET` env, OR a single `0x[a-fA-F0-9]{40}` under a labeled `## Owner Wallet` section in `memory/watched-repos.md`. The deployed token's creator fees route to this address. The skill MUST NOT pick the first `0x` address it finds elsewhere in the file — only the `OWNER_WALLET` env or the `## Owner Wallet` section is honored. No wallet → log `SKIP:no-owner-wallet` and stop. Never emit a payload with a placeholder.
- **Daily cap**: `MAX_LAUNCHES_PER_DAY` (default 1). Count emitted payloads in `memory/topics/liquidpad-state.json` for today. Cap reached → log `SKIP:daily-cap` and stop.

## Steps

0. **Bootstrap state** — per-day launch counter lives in `memory/topics/liquidpad-state.json`:
   ```bash
   mkdir -p memory/topics
   [ -f memory/topics/liquidpad-state.json ] || echo '{"launches":[]}' > memory/topics/liquidpad-state.json
   ```
   Schema:
   ```json
   {
     "launches": [
       {
         "ts": "2026-05-25T14:00:00Z",
         "symbol": "GMTC",
         "name": "Ghost Matcha",
         "req_id": "20260525T140000Z-GMTC",
         "owner": "0xWallet..."
       }
     ]
   }
   ```
   Cap to 100 most-recent entries (LRU by `ts`). Validate with `jq empty` after every write; restore from `.bak` on failure.

1. **Resolve concept** — three paths, in priority order:

   a. `${var}` is a JSON object with `{name, symbol, theme}` → use it directly.

   b. The prefetch shim already wrote a draft. Read it:
      ```bash
      if [ -f .liquidpad-cache/concept.json ]; then
        NAME=$(jq -r '.name // empty' .liquidpad-cache/concept.json)
        SYMBOL=$(jq -r '.symbol // empty' .liquidpad-cache/concept.json)
        THEME=$(jq -r '.theme // empty' .liquidpad-cache/concept.json)
      fi
      ```
      If any field is empty, fall through to (c).

   c. `${var}` is empty AND the cache is empty → derive name/symbol/theme deterministically from `memory/MEMORY.md` and `memory/topics/`. The skill must NOT call the network; if no concept can be derived, log `SKIP:no-concept-source` and stop.

2. **Validate concept** against the safety policy. Each rejection records a verdict with a specific reason — `SKIP:invalid-symbol:gmtc-too-short`, `SKIP:duplicate-symbol:GMTC` — never vague.

3. **Resolve owner wallet** (env wins; otherwise read ONLY the labeled `## Owner Wallet` section, never elsewhere in the file):
   ```bash
   if [[ -n "${OWNER_WALLET:-}" ]]; then
     OWNER="$OWNER_WALLET"
   else
     # Extract the section delimited by "## Owner Wallet" to the next "## " header,
     # then take the first 0x address inside that range. This pins fee routing to
     # the maintainer-pinned address — not any 0x that happens to appear above.
     OWNER=$(awk "/^## Owner Wallet[[:space:]]*$/{flag=1; next} /^## /{flag=0} flag" memory/watched-repos.md 2>/dev/null | grep -oE "0x[a-fA-F0-9]{40}" | head -1)
   fi
   if [[ -z "${OWNER:-}" ]]; then
     echo "SKIP:no-owner-wallet"; exit 0
   fi
   if ! [[ "$OWNER" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
     echo "SKIP:invalid-owner-wallet"; exit 0
   fi
   ```

4. **Build the deploy payload** as a structured request file. The postprocess shim consumes this:
   ```bash
   mkdir -p .pending-liquidpad
   REQ_ID="$(date -u +%Y%m%dT%H%M%SZ)-${SYMBOL}"
   jq -n \
     --arg endpoint "/agent/run-once" \
     --arg name "$NAME" \
     --arg symbol "$SYMBOL" \
     --arg theme "$THEME" \
     --arg owner "$OWNER" \
     --argjson mc "${MC_ETH:-5}" \
     '{
        endpoint: $endpoint,
        payload: {
          ownerAddress: $owner,
          name: $name,
          symbol: $symbol,
          theme: $theme,
          mcEth: $mc,
          withImage: true,
          runImmediately: false
        }
      }' > ".pending-liquidpad/${REQ_ID}.json"
   ```
   The skill is done at this point. It does NOT call the API.

5. **Persist state** — append the launch entry to `memory/topics/liquidpad-state.json`:
   ```json
   {
     "ts": "2026-05-25T14:30:00Z",
     "symbol": "GMTC",
     "name": "Ghost Matcha",
     "req_id": "20260525T143000Z-GMTC",
     "owner": "0xWallet..."
   }
   ```
   Validate with `jq empty`; restore `.bak` on failure.

6. **Log to memory/logs/${today}.md** under a `### liquidpad-launch` heading:
   - `Mode`: live | dry-run (read `LIQUIDPAD_DRY_RUN` env)
   - `Concept source`: var | cache | derived
   - `Result`: emitted `<req_id>` | skipped:`<reason>`
   - `Owner`: 0xWallet... (last 4 chars only)
   - `Symbol`: GMTC
   - `Note`: postprocess shim will execute the deploy and write `.liquidpad-cache/<req_id>.result.json`

## Reading the deploy result on the next run

The postprocess shim writes a result file at `.liquidpad-cache/<req_id>.result.json`. The next time the skill runs, it should pick up any new result files and:

```bash
for r in .liquidpad-cache/*.result.json; do
  [ -f "$r" ] || continue
  HTTP=$(jq -r '.http_code' "$r")
  REQ=$(jq -r '.req_id' "$r")
  if [ "$HTTP" = "200" ]; then
    ADDR=$(jq -r '.body.token.address // .body.address // empty' "$r")
    TX=$(jq -r '.body.txHash // .body.tx // empty' "$r")
    # Notify success — but only once per req_id
    # ...
  else
    # Notify failure with HTTP code
    # ...
  fi
  # Move to memory archive so we don't re-notify
  mkdir -p memory/topics/liquidpad-results
  mv "$r" memory/topics/liquidpad-results/
done
```

This keeps the success/failure notification idempotent across runs — the skill notifies exactly once per req_id, then archives.

## Constraints

- **Never** emit a payload with `ownerAddress` set to a placeholder, the LiquidPad operator address, or any wallet not explicitly resolved from env or memory.
- **Never** call `api.liquidpad.site` directly from the skill body — the sandbox blocks it and the shim split is the only correct path.
- **Never** re-emit the same `symbol` within 24h, even if the previous attempt failed — duplicate symbols on Uniswap V4 cause user confusion.
- **Never** emit more than `MAX_LAUNCHES_PER_DAY` payloads per skill invocation.
- **Never** persist `LIQUIDPAD_API_KEY` to memory or logs. The skill body never sees it.

## Running this as part of the agent loop

To make autonomous-launch part of the agent's daily routine, add a `## Daily Routine` entry that invokes this skill conditionally — e.g. only on Mondays, only when `memory/topics/concept-queue.md` has unshipped entries. The daily cap (default 1) protects against runaway behavior; raise it via `MAX_LAUNCHES_PER_DAY` only after observing safe behavior.

## Workflow integration

Add to the agent's workflow YAML:

```yaml
- name: Prefetch LiquidPad context
  run: ./scripts/prefetch-liquidpad.sh liquidpad-launch "${{ inputs.var }}"
  env:
    LIQUIDPAD_API_KEY: ${{ secrets.LIQUIDPAD_API_KEY }}

- name: Run agent (skill executes here, in sandbox)
  # ... your usual agent step ...

- name: Postprocess LiquidPad deploys
  run: ./scripts/postprocess-liquidpad.sh
  env:
    LIQUIDPAD_API_KEY: ${{ secrets.LIQUIDPAD_API_KEY }}
    # LIQUIDPAD_DRY_RUN: "1"  # uncomment to test without deploying
```

## Reference

- LiquidPad public API: `https://api.liquidpad.site` (health, agent/status, agent/run-once, verify, agent/concept)
- Skill manifest (LLM-readable): `https://www.liquidpad.site/agent-owner-launch-skill.md`
- ERC-8004 agent record: `https://8004agents.ai/base/agent/50962`
- Ecosystem attribution + live contributions: `https://www.liquidpad.site/ecosystem`
- Telegram operator interface: `@liquidpadbot` (`/setaddress`, `/apikey`, `/fast Name SYMBOL`, `/ai <prompt>`)
