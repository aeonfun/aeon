---
name: compute-resell
description: Autonomous compute-reselling agent on Surplus Intelligence - resells free or low-cost provider compute across Bankr, AWS Bedrock, and Google Vertex (GCP) as one skill. Reads the live market + your cost + your usage, auto-lists your models per enabled provider, and reactively prices each offer to win routing within a cost floor, cap, and health guardrails.
metadata:
  title: Compute Resell
  category: crypto
  var: ""
  tags:
    - crypto
    - onchain
  cron: "15 6,14,18 * * *"
  mode: write
  requires:
    - SURPLUS_SELLER_KEY?
    - SURPLUS_SELLER_AWS_KEY?
    - SURPLUS_SELLER_VERTEX_KEY?
    - BANKR_LLM_KEY?
    - BEDROCK_API_KEY?
    - VERTEX_SERVICE_ACCOUNT_JSON?
    - VERTEX_API_KEY?
    - COMPUTE_RESELL_CONFIG?
    - AWS_COMPUTE_RESELL_CONFIG?
    - VERTEX_COMPUTE_RESELL_CONFIG?
  capabilities:
    - external_api
    - writes_external_host
    - sends_notifications
---
<!-- Sources: Surplus Intelligence seller API reference (getting-started/seller-quickstart, api-reference/seller-endpoints, host https://api.surplusintelligence.ai). Bankr LLM Gateway (https://docs.bankr.bot/llm-gateway/overview/, base https://llm.bankr.bot/v1). -->

> **${var}** - `[<provider>:]<mode>`. The optional `<provider>` prefix (`bankr` | `aws` | `vertex`) restricts the run to **one** provider; omit it to run **every enabled provider** (see *Providers*). `<mode>` selects the run mode - first match wins:
> - **empty** → **the reactive run** (the scheduled default): validate the wallet, read the live market + your cost + your usage, **auto-list any missing models**, reprice every offer against the current market, notify on signal. No separate setup step.
> - `monitor` → read-only market + offers + usage digest, **no** writes.
> - `reprice` → same as empty (kept as an explicit alias).
> - `pause` → soft-delete every offer (stop serving); state retained.
> - `resume` → re-create offers from state at the current reactive price.
>
> Examples: empty = all enabled providers, reactive. `aws` = only AWS, reactive. `vertex:pause` = pause only Vertex. `monitor` = read-only digest across all enabled providers.
>
> *(There's no `setup` mode - the empty run bootstraps itself: if a provider has no offers yet and its credential is set, it lists that provider's models on the first run.)*
> *(You rarely need `pause`/`resume` by hand: the reactive run **auto-reaps** dead and orphaned offers and **auto-relists** healthy models - so removing a provider's credential secret already delists it cleanly, and adding a funded one back restores the lineup on the next run. Reach for `pause`/`resume` only for a deliberate manual hold.)*

## Providers

This skill is a **single reselling engine run once per compute provider**. All three providers sell on the **same** Surplus marketplace with the **same** create shape (`POST /v1/seller/offers` with `{model, api_key, seller_base_url, ...}`); they differ only in the **compute source** behind the offer - its credential, endpoint, cost basis, and per-account denylist. Everything downstream (market read, scoring, pricing, caps, adaptive discount, reaping, modes, notify) is **provider-agnostic** and identical for all three.

**Provider adapter table** - the only per-provider inputs:

| dim | `bankr` | `aws` | `vertex` |
|---|---|---|---|
| Surplus seller wallet (secret) | `SURPLUS_SELLER_KEY` | `SURPLUS_SELLER_AWS_KEY` | `SURPLUS_SELLER_VERTEX_KEY` |
| provider credential → `api_key` (secret) | `BANKR_LLM_KEY` (+ `_2`/`_3`) | `BEDROCK_API_KEY` | `VERTEX_SERVICE_ACCOUNT_JSON` (or `VERTEX_API_KEY`) |
| `seller_base_url` | `https://llm.bankr.bot/v1` | `BEDROCK_BASE_URL` (repo var) | built from `VERTEX_PROJECT_ID` + `VERTEX_LOCATION` (repo vars) |
| cost basis `C` (floor mode) | `/v1/prices` bankr entry | config `bedrock_prices` | config `vertex_prices` |
| config secret | `COMPUTE_RESELL_CONFIG` | `AWS_COMPUTE_RESELL_CONFIG` | `VERTEX_COMPUTE_RESELL_CONFIG` |
| state file | `memory/state/compute-resell.json` | `memory/state/aws-compute-resell.json` | `memory/state/vertex-compute-resell.json` |
| preflight auth | `X-API-Key` (Bankr gateway) | `Authorization: Bearer` (proxy) | SA→access-token, or `AIza` key |

**A provider is "enabled" for a run** iff its Surplus seller wallet secret **and** its provider credential secret are both set. Skip (don't error on) any provider missing either - a Bankr-only instance just sets `SURPLUS_SELLER_KEY` + `BANKR_LLM_KEY` and never touches AWS/Vertex.

**The run loop.** Resolve the provider set: `[<provider>]` from `${var}` if it carries a prefix, else every enabled provider. **Fetch the shared market reads once** - `GET /api/markets` (roster) and `GET /v1/prices` (Surplus model catalog) are provider-agnostic, so read them a single time and reuse across providers. Then **for each provider in the set**, export `RESELL_PROVIDER=<provider>` (the helper scripts key their config secret + state file off it) and run the full engine below against that provider's adapter row - its own wallet, credential, `seller_base_url`, cost basis, config, and state file. Providers are independent: one provider failing (bad key, exhausted funds) never aborts the others; log its exit reason and continue. Aggregate one notify at the end (per-provider TLDR lines).

**Never self-undercut across your own providers.** Because all providers list on one order book, two of your own providers listing the same market id would undercut *each other* and drag your family's clearing price toward zero. The **Cross-skill claim ledger** (below) already prevents this: it globs `memory/state/*compute-resell.json` - which now includes all three provider state files - so each provider claims its models and a later provider in the loop skips any market id an earlier one already claimed this run. See *Cross-skill claim ledger*. The provider-specific credential, endpoint, cost basis, and denylist are detailed per adapter in *Provider adapters* at the end of this file; read that provider's row before its reactive run.

## Why this design

Surplus routes each buyer to the **cheapest healthy seller** for a model, settling per-request in **USDC on Base** to the seller's wallet. Public endpoints make the market observable, so pricing is **reactive, not blind**: `GET /api/markets/{model}` is the live order book - every rival's real price, health, trust flag and remaining cap - and `GET /v1/prices` gives the per-provider cost basis (what Bankr charges you). The engine prices each offer against the *reduced* book (see **Who actually competes**) - undercutting to win routing when someone who can actually serve is cheaper, and probing upward only when you're already the cheapest.

**The economics - free credit, so every sale is pure profit.** In the default (undercut) mode the compute source is **free** - Bankr credit (token-launch fees / promo credits), free AWS credits, or free Google Cloud credits - so `your_provider_cost ≈ $0` and **profit per request = the whole buyer price**. There is no cost to defend, no such thing as selling "below cost," and no "burn," "bleed," or "negative edge" - that framing does not apply to free inventory. The **only** axis is **revenue = Σ (volume × price)**. Winning routing means being cheapest, which trades price for volume: a deeper discount wins more books but keeps fewer USDC per token; a shallower one keeps more per token but wins fewer books. The engine's whole job is to sit at the **revenue-maximizing** point of that curve. (`floor` still exists for the rare operator funding a *real* per-token cost - an out-of-credit Bedrock/Vertex account - who wants a hard price floor; unset by default, because free credit needs none. In floor mode the cost basis `C` comes from that provider's adapter row: `/v1/prices` for bankr, config `bedrock_prices`/`vertex_prices` for aws/vertex.)

**Guardrails are load-bearing** because every write is real money in two directions (buyers pay you, you owe the provider):
- **Cost floor** (`floor`) - never list below your true cost.
- **`cap_daily_usd`** on every offer - provider-spend protection against runaway routing.
- **Idempotency** - offer IDs live in state; the engine `GET /offers` first and never creates a duplicate offer for a model it already lists.
- **Fail-closed** - offer writes are the final in-run action; a non-2xx aborts the run and reports the true reason.

## Auth model

Runtime is **Bearer-only**. Each provider has its **own** `si_seller_...` seller-wallet key - minted once via SIWE and stored as a distinct repo secret (`SURPLUS_SELLER_KEY` for bankr, `SURPLUS_SELLER_AWS_KEY` for aws, `SURPLUS_SELLER_VERTEX_KEY` for vertex). Separate wallets are **mandatory**: two providers sharing one wallet would clobber each other's offers on the same Surplus account. No private key ever enters CI. Below, `{SURPLUS_SELLER_<P>_KEY}` denotes the running provider's wallet secret from the adapter table.

**Mint it - the dashboard (recommended).** Settings → Secrets → the provider's wallet secret → **Connect wallet**. Your browser wallet (MetaMask / Rabby / Coinbase) signs the SIWE challenge; the key is minted and written to the secret server-side - your private key never leaves the wallet and the key is never shown in the browser. **Reconnect** rotates it. (Routes: `GET /api/surplus/challenge` → wallet `personal_sign` → `POST /api/surplus/mint` → `setSecret`.)

**Fallback - headless / no browser wallet.** Run locally, never in Actions (pass the target wallet secret's label):

```bash
npm i viem
SELLER_WALLET_PRIVATE_KEY=0x... node skills/compute-resell/bootstrap-siwe.mjs compute-resell
# paste the printed si_seller_... into the dashboard as the provider's SURPLUS_SELLER_*_KEY
```

All API calls below use `./secretcurl` so the Bearer key stays off the command line (the running provider's wallet secret):

```bash
./secretcurl -sS -w '\nhttp=%{http_code}\n' --max-time 30 \
  -H "Authorization: Bearer {SURPLUS_SELLER_KEY}" \
  "https://api.surplusintelligence.ai/v1/seller/offers"
```

Host: `https://api.surplusintelligence.ai` (call directly; don't follow redirects). **Print `http=<code>` and decide from it** - only degrade on a real non-2xx, `--max-time` timeout, or a 200 with empty body, and log the true reason (`http-<code>` / `timeout` / `empty`). Never write "sandbox"/"expansion blocked".

## Config

> **Provider-name convention (read once).** The engine body below is written with the **bankr** adapter's names as the canonical stand-in: wherever it says `COMPUTE_RESELL_CONFIG`, `memory/state/compute-resell.json`, or `SURPLUS_SELLER_KEY`, read **the running provider's** equivalent from the *Providers* adapter table - i.e. `AWS_COMPUTE_RESELL_CONFIG` + `memory/state/aws-compute-resell.json` + `SURPLUS_SELLER_AWS_KEY` when `RESELL_PROVIDER=aws`, the `VERTEX_`/`vertex-` forms when `RESELL_PROVIDER=vertex`. The helper scripts already resolve this off `RESELL_PROVIDER`; you resolve it the same way when you run a command by hand. Two more per-provider paths follow the same rule: the topic file `memory/topics/compute-resell.md` → `aws-compute-resell.md` / `vertex-compute-resell.md`, and the earnings ledger `memory/compute-earnings.csv` → `aws-compute-earnings.csv` / `vertex-compute-earnings.csv` (bankr keeps the unprefixed names). The knobs, defaults, and mechanics are identical across providers - only the secret/file **names** and the provider wiring (endpoint, credential, cost basis, denylist in *Provider adapters*) change.

**Zero config to start** - each provider runs on safe defaults. To tune a provider, set its optional config secret (`COMPUTE_RESELL_CONFIG` / `AWS_COMPUTE_RESELL_CONFIG` / `VERTEX_COMPUTE_RESELL_CONFIG`) in the dashboard (Skill Keys) to a tiny JSON:

| Knob | Default | What it does |
|------|---------|--------------|
| `daily_budget_usd` | `10` | Total free credit to deploy per day across all this provider's offers. Split **evenly** across the listed models (`n` offers x `budget/n`). Lower it to concentrate on fewer models. Free credit, so it just bounds daily inventory, not loss. |
| `floor` | *(unset -> undercut)* | Unset (default) -> **undercut mode**: list just below the cheapest competitor to win routing (pure profit on free credit). Set it only if you fund a real per-token cost: the lowest price you'll list as a multiple of the cost basis `C` - `1.0` = never below cost, `0.6` = down to 60% of it. |
| `max_discount` | *(unset -> no cap)* | Discount-rate guardrail: the deepest discount off the direct sticker this provider will list at. `0.80` = never deeper than 80% off (`d_in <= 0.80` **and** `d_out <= 0.80`), and **skip** any model whose market already clears deeper (unwinnable at your rate). Unset -> uncapped. See *Maximum-discount cap*. |
| `discount_adaptive` | `false` | Self-tune `max_discount` for revenue. `true` -> treat `max_discount` as a starting point and nudge the effective cap <= `discount_step` per run toward the revenue-max point, within `[discount_min, discount_max]`: a **sold-out** offer -> tighten one step (shallower, more USDC/token); a **cold** run (revenue ~0 or <= 1 winnable book) -> loosen one step (deeper, open more books); else hold. Persists in state (`adaptive_discount`). Guarded so a tighten never prices out a live earner. See *Adaptive discount*. |
| `discount_min` / `discount_max` / `discount_step` | `0.30` / `0.90` / `0.05` | Bounds and per-run step for `discount_adaptive` (ignored when off). `discount_max` is a real rate wall (never lists deeper). |
| `min_market_volume_usd` | `1.0` | The selection liquidity gate (the only one): minimum 24h marketplace **$-volume** (`volume_24h / 1e6`) a model needs to be listed. Drops dead markets that trade ~$0 before scoring, so the budget concentrates on real liquidity. `0` disables it. |
| `cap_daily_usd` | *(derived)* | Optional hard per-offer ceiling. Unset -> each offer's cap = the even split `max(1, daily_budget_usd / n)`. Set it to cap any single offer below that share. Allocation is always even. |
| `min_credit_days` | `3` | Low-credit **warning** (bankr only): when a real credit balance is read, warn if it is under this many days of runway. Warn-only - never throttles spend. `0` disables. |
| `payout_address` | *(unset)* | Base address that receives USDC settlement for offers this provider creates. Unset -> the seller wallet. Point bankr at a Bankr wallet and earnings auto-top-up the credits that fund the next sales. Applied at create time only. |
| `denied_models` | *(unset)* | Hard denylist - never list these (matched by Surplus market id **or** mapped provider id). Also auto-learned from create/probe access errors. Seed with models the provider account can't serve (see *Provider adapters*). |
| `model_map` | *(unset)* | **aws/vertex only:** map the Surplus market id -> the provider's serve id (and, for vertex, a per-model region). Unmapped models fall back to a one-probe test-list. See *Provider adapters*. |
| `bedrock_prices` / `vertex_prices` | *(unset)* | **aws/vertex only, floor mode only:** your per-token cost basis `C` for the model, `$/1M` tokens. Not read in the default undercut mode. See *Provider adapters*. |

Example secret value: `{"daily_budget_usd":50,"max_discount":0.80}` - or leave the whole secret unset to take defaults ($10 budget, undercut mode, uncapped discount). Concentrate credit on fewer models by lowering the budget: `{"daily_budget_usd":20}`. Point earnings back at your credit wallet: `{"payout_address":"0xYourBankrWallet"}`.

Everything else is automatic: **models are discovered from the live market** (`/v1/prices`), ranked by live demand (`/api/markets`) and listed most-active-first up to the auto-derived offer count, and the engine prices each offer against the current market price - down toward `floor` to win routing, up toward the reference to capture margin.

**Reading `COMPUTE_RESELL_CONFIG` - read it by name, NEVER via `$`-expansion.** It's injected as a secret, and the Bash permission layer **blocks any command whose text contains `$COMPUTE_RESELL_CONFIG` / `${COMPUTE_RESELL_CONFIG}`** - so `jq <<< "$COMPUTE_RESELL_CONFIG"` or `echo "$COMPUTE_RESELL_CONFIG"` is **refused**, and the skill then silently falls back to defaults (this is exactly the bug that made a set config look unset). Read it by **name through `os.environ`** instead - the command line carries only the literal name, no `$`-expansion, so it's allowed:
```bash
python3 -c "import os,json
c=json.loads((os.environ.get('COMPUTE_RESELL_CONFIG') or '').strip() or '{}')
print(json.dumps({k:c.get(k) for k in ('floor','max_discount','discount_adaptive','discount_min','discount_max','discount_step','daily_budget_usd','min_market_volume_usd','cap_daily_usd','min_credit_days','payout_address','denied_models','model_map','bedrock_prices','vertex_prices')}))"
```
Take `max_discount`, `daily_budget_usd`, `floor`, etc. from the parsed object; empty/unreadable/invalid JSON → use defaults. **Always log the resolved config** so a run makes plain whether the override took effect - `config: max_discount=0.80 daily_budget=5` vs `config: defaults (unset)`. (`printenv COMPUTE_RESELL_CONFIG` also works - same no-`$` principle - but the Python parse above is the reference.)

**State:** `memory/state/compute-resell.json` - auto-written by the skill each run (you never edit this; it's how the pricing loop remembers across runs). Schema:
```json
{
  "version": 8,
  "adaptive_discount": null,
  "earnings_cursor": { "total_earned_usdc": 0, "paid_usdc": 0, "tokens": 0, "at": "<ISO>" },
  "offers": {
    "<offer_id>": {
      "model": "claude-haiku-4.5",
      "cost_in": 1.0, "cost_out": 5.0,
      "market_in": 1.0, "market_out": 5.0,
      "direct_in": 1.2, "direct_out": 6.0,
      "price_in": 1.0, "price_out": 5.0,
      "discount_in": 0.17, "discount_out": 0.17,
      "payout_address": null,
      "low_demand_runs": 0,
      "dead_runs": 0,
      "last_window": { "tokens": 0, "earned_usdc": 0, "at": "<ISO>" },
      "last_move": "init"
    }
  },
  "competitors": {
    "<their_offer_id>": { "model": "claude-haiku-4.5", "obs": 6, "unhealthy": 2, "eff_in": 0.9, "eff_out": 4.5, "last_seen": "<ISO>" }
  },
  "health_incidents_seen": []
}
```
(`cost` = provider cost basis; `market` = surviving clearing price from the `/api/markets/{model}` order book; `direct` = `direct_*_per_1m`, the discount denominator; `discount` = `1 - price/direct`; `price` = your listed price; `low_demand_runs` = consecutive runs this offer's model has been below the `min_market_volume_usd` gate, used by the liquidity-dip debounce; `dead_runs` = consecutive runs this offer has been `healthy:false`, used by the dead-offer reap; `adaptive_discount` = the tuned effective `max_discount` carried across runs when `discount_adaptive` is on, else `null`. All prices per 1M tokens.)

**Migration.** Older state (`version <= 7`) may lack or carry now-unused keys. Treat every field as optional: missing `direct_*`/`discount_*` -> recompute from the book this run; missing `competitors` -> start an empty map (the flapper test doesn't fire until it has 6 observations); missing `payout_address`/`low_demand_runs`/`dead_runs` -> `null`/`0`; missing `adaptive_discount` -> `null` (starts from the config `max_discount`). Ignore and drop any legacy `pool`, `active_key_env`, or per-offer `bankr_key_env` fields (removed in the single-key / no-pool-learning simplification). Write `version: 8` on the way out.

### Required secrets

Secrets are grouped by provider; an instance sets only the group(s) it uses. A provider is enabled iff **both** its wallet and its credential are set (see *Providers*). Repo **variables** (not secrets) `BEDROCK_BASE_URL`, `VERTEX_PROJECT_ID`, `VERTEX_LOCATION` complete the aws/vertex wiring (details in *Provider adapters*).

| Secret | Provider | Used by | Purpose |
|--------|----------|---------|---------|
| `SURPLUS_SELLER_KEY` | bankr | all modes | `si_seller_...` Bearer wallet key. Mint via the dashboard **Connect wallet** (or `bootstrap-siwe.mjs`). |
| `BANKR_LLM_KEY` | bankr | **listing** | Provider key (`bk_...`), sent to Surplus only when **creating** an offer (stored encrypted to call Bankr). Needed to auto-list; repricing doesn't use it. Unset → monitor+reprice only. |
| `COMPUTE_RESELL_CONFIG` | bankr | optional | Compact JSON config override (Config table). Unset → defaults. |
| `SURPLUS_SELLER_AWS_KEY` | aws | all modes | `si_seller_...` Bearer wallet key for the **aws** Surplus wallet (separate from bankr's). |
| `BEDROCK_API_KEY` | aws | **listing** | Bearer key for your OpenAI-compatible Bedrock proxy. Sent to Surplus only on **create**. Unset → monitor+reprice only. |
| `AWS_COMPUTE_RESELL_CONFIG` | aws | optional | Compact JSON config override. Unset → defaults. |
| `SURPLUS_SELLER_VERTEX_KEY` | vertex | all modes | `si_seller_...` Bearer wallet key for the **vertex** Surplus wallet (separate from the others). |
| `VERTEX_SERVICE_ACCOUNT_JSON` | vertex | **listing** | The service-account JSON **string**, passed to Surplus as `api_key` on **create** (covers the full Vertex catalog). Primary Vertex credential. |
| `VERTEX_API_KEY` | vertex | **listing (alt)** | Alternative `AIza…` Gemini-Developer key (Gemini-only). Used if `VERTEX_SERVICE_ACCOUNT_JSON` is unset. |
| `VERTEX_COMPUTE_RESELL_CONFIG` | vertex | optional | Compact JSON config override. Unset → defaults. |

If a provider's wallet secret is unset, that provider is simply **skipped** (not an error). If **no** provider is enabled (no wallet+credential pair set anywhere): `./notify "compute-resell skipped: no provider configured (need a SURPLUS_SELLER_*_KEY + its credential)"` and exit `COMPUTE_RESELL_NO_KEY`.

## Cross-skill claim ledger (never double-list a sibling's model)

This skill's providers (`bankr` → `memory/state/compute-resell.json`, `aws` → `aws-compute-resell.json`, `vertex` → `vertex-compute-resell.json`, plus any legacy sibling whose state file matches `memory/state/*compute-resell.json`) all sell on the **same** Surplus marketplace. Surplus routes `/api/markets/{model}` to the cheapest healthy offer **regardless of which provider backs it**, so if two of your providers list the same market id they land in one order book and undercut *each other*, dragging your own clearing price toward zero. The ledger enforces one owner per market id across all providers (never create duplicate offers). It works identically whether the providers run in one unified skill (this design) or as separate legacy fork skills, since discovery is purely by state-file glob.

**Rule: one market id is owned by exactly one fork. Never list a model a sibling already lists.**

Discovery is dynamic and zero-config: peers are found by globbing `memory/state/*compute-resell.json` (minus the running provider's own file), so an added provider is respected automatically and a delisted model frees its claim on the next run. The helper `skills/compute-resell/claim_ledger.py` reads every peer's committed live offers; **`python skills/compute-resell/claim_ledger.py <state-skill> memory/state`** (where `<state-skill>` is the running provider's state-file basename - `compute-resell` / `aws-compute-resell` / `vertex-compute-resell`) prints `{siblings, claimed_models, conflicts}`. Run it per-provider in the **Preamble** right after loading that provider's state, and apply it in two places:

- **R1, exclusion (selection).** At the **very start of selection** (before the `min_market_volume_usd` liquidity gate, scoring, any test-list, and any create), drop every market id in `claimed_models`. A sibling-claimed model is never scored, probed, or created. Log each drop: `sibling-claimed: deepseek-v3.2 (aws-compute-resell) - skipped`.
- **R2, conflict self-heal (reconcile).** For any model **this** fork currently lists that a sibling *also* lists (a pre-existing double-claim, or the rare simultaneous-run race the staggered cron normally prevents), keep it only if `conflicts[model].keep_here` is true; otherwise move it to `to_delist` regardless of score (a hard reap, exempt from hysteresis). Ownership = the holder with the higher `last_window.earned_usdc` on that model, tie broken by smallest skill name: a pure function of the shared committed state, so every fork computes the **same** winner and the lineup converges to one owner per model. Log: `sibling-conflict: gemini-2.5-pro - vertex-compute-resell keeps (earned $0.18 > $0.00), delisting here`.

**R3, claim stamp.** On every create, write `claimed_at: <UTC ISO8601>` into the offer's state entry (audit trail + secondary tie-break for future forks). A missing `claimed_at` on an older offer is treated as epoch (oldest).

**Intra-run ordering (unified skill).** When one run processes multiple providers sequentially, each provider **writes its state file to `memory/state/` before the next provider's preflight** (the ledger reads files on disk, not git), so a later provider in the loop sees the earlier provider's fresh claims the same run. Process providers in a stable order (bankr, aws, vertex) so ownership is deterministic. Across runs, state files are git-committed at end of run as before. A reactive / `workflow_dispatch` run that races a legacy separate fork can briefly double-list; R2 heals it deterministically on the next run of the losing side. This ledger does **not** touch funding: each provider keeps its separate `SURPLUS_SELLER_*` wallet.

## Preamble (every run)

1. Read `memory/MEMORY.md` and the last ~2 days of `memory/logs/` (skip re-reporting an incident already logged).
2. Parse `${var}` → `[<provider>:]<mode>` (grammar above; empty = all enabled providers, reactive run). **Resolve the provider set**: the `<provider>` prefix if present, else every **enabled** provider (wallet + credential both set) in stable order `bankr, aws, vertex`. If the set is empty, notify + exit `COMPUTE_RESELL_NO_KEY` (see *Required secrets*). **Fetch the shared market reads once** (`GET /api/markets`, `GET /v1/prices`) and reuse them for every provider.
3. **For each provider `P` in the set**, run steps 3a-3d, then the mode body below, then write `P`'s state file before moving to the next provider:
   - **3a.** Set `RESELL_PROVIDER=P` for every helper-script call (`price_models.py` / `claim_ledger.py` / `allocate_caps.py`). Resolve `P`'s adapter row (*Providers*): wallet secret, credential, `seller_base_url`, cost basis, config secret, state file.
   - **3b.** Guard `P`'s wallet secret. Resolve config: read `P`'s config secret (`COMPUTE_RESELL_CONFIG` / `AWS_COMPUTE_RESELL_CONFIG` / `VERTEX_COMPUTE_RESELL_CONFIG`) **by name via `os.environ`** (NOT `$`-expansion - the permission layer blocks that; see *Config → Reading the config secret*) and parse as JSON if set, else defaults (`floor` **unset → undercut mode** = just below the cheapest competitor, `max_discount` **unset → no discount cap**, `daily_budget_usd=10`, `min_market_volume_usd=1.0` (the sole selection gate), offer count + caps auto (even split, no `max_models`/`demand_min`/`cap_mode` knobs), `cap_daily_usd` derived per-offer, `discount_adaptive` **unset → off**, models auto-discovered); invalid/unreadable JSON → defaults. **Log the resolved config** with the provider tag (`[aws] config: max_discount=0.80 daily_budget=5` / `[bankr] config: defaults (unset)`).
   - **3c.** Load `P`'s state file (empty skeleton if first run).
   - **3d.** Run the **Cross-skill claim ledger** (`python skills/compute-resell/claim_ledger.py <P-state-skill> memory/state`) and hold its `claimed_models` (R1) + `conflicts` (R2) for selection and reconcile - see *Cross-skill claim ledger*.

   A provider that fails (missing/rejected credential, funding exhausted, non-2xx write) logs its exit reason and is skipped - it never aborts the remaining providers.

---

## Market data (public - no auth, no key)

Unauthenticated reads (plain `curl`/WebFetch - **no** `secretcurl`, no key). Order-book prices are in **microdollars per 1M tokens** (÷ 1e6 = $/1M):

- **`GET /api/markets/{model}`** → `{model, offers:[{id, seller, rank, price_input_per_1m, price_output_per_1m, effective_input_per_1m, effective_output_per_1m, direct_input_per_1m, direct_output_per_1m, pricing_mode, cost_multiplier, cap_daily, cap_remaining, healthy, available, trusted, volume_24h, trades_24h, provider}]}` - **the live order book**, every seller's real offer. See **Who actually competes** below for how to reduce it to `M`; the naive "lowest price, healthy" read is wrong.
- **`GET /api/markets`** → all models with their best prices (roster summary).
- **`GET /api/markets/feed`** → `{items:[{model, input_tokens, output_tokens, cost_usd, created_at}]}` - the live sales feed = where real buyer demand is.
- **`GET /v1/prices`** → `models[]` of `{model, providers:[{provider, providerModelId, pricing:{input, output}}]}` in **$/1M**. The `bankr` entry is your **cost basis** `C` and the `providerModelId` to serve.

(`GET /v1/models` is only the reference catalog - it does **not** reflect live seller offers. Use `/api/markets/{model}` for real prices.)

**Target models & budget split (value-weighted).** Bankr credits are **free**, so your cost ≈ $0 and every won request is profit - the job is to point your finite free credits at the highest-revenue traffic, not to minimise a loss. Start from models with a `bankr` provider in `/v1/prices` (∩ config `models` if set) - the *serviceable* set. For each, the **`GET /api/markets` roster** gives `requests_24h` = the model's **total marketplace buyer demand across *all* sellers** (the addressable pool), plus the order book's `direct` prices. **Reduce each candidate's book to `M` first** (per *Who actually competes* - the lowest *serviceable* clearing price) and take the discount from `M`, **not** the roster's naive `best`: **market discount** `disc = 1 − M_blend/direct_blend`, where `M_blend = M_in + 3 × M_out` and `direct_blend = direct_in + 3 × direct_out`. Score each:

> ⚠️ **Demand = the model's market-wide `requests_24h` from the roster - NEVER your own captured requests** (`/v1/seller/earnings` `by_model`, or per-offer counts). A freshly-listed offer has captured ~0, so scoring on your own demand delists every new offer before it can win - a degenerate loop that collapses the lineup to whatever already happens to be winning (e.g. dropping a high-demand model's 10k+ market requests because *your* offer on it hasn't won traffic yet). The gate and the score both read the roster's total-market `requests_24h`.

> **`score = (1 − disc) × direct_blended × (1 + ln(requests_24h))`** - where `direct_blended = direct_in + 3 × direct_out` (the sticker **price level**, same blend as `disc`) and `disc` is the **serviceable** discount from `M` (above), never the roster `best`. Equivalently `M_blend × (1 + ln(requests_24h))`, since `(1 − disc) × direct_blended = M_blend` - your real serviceable revenue per blended token × demand.

**Why the `direct_blended` factor is load-bearing.** `(1 − disc)` alone is a *rate* - the fraction of sticker you keep - so a cheap model keeping 90% of a $0.05 sticker scores the same as an expensive one keeping 90% of a $3 sticker, though the expensive model pays ~60× more per won token. Multiplying by the price level `direct_blended` makes the score track **revenue per won token × demand** (revenue potential), not cheap volume. Without it the score would rank a cheap, low-demand model over an expensive, high-demand one, forcing a manual selection override - the price weight removes that. So: a high price level you keep × many buyers → the most revenue. Drop any model under `min_market_volume_usd` of 24h $-volume (default **$1.0**; the roster's `volume_24h / 1e6`) - the sole selection gate. There is no separate `demand_min` request-count knob: demand already rides in the score via `(1 + ln(requests_24h))`, and a count gate lets a market clear on a handful of tiny probe requests while trading near-zero *dollars* (fractions of a cent of 24h volume); the dollar gate drops those before scoring. Take the top **`n`** by score, where `n` is **auto-derived** via `auto_offer_count` = `min(winnable-serviceable count, floor(daily_budget_usd / floor), 50)` (no `max_models`). **If `max_discount` is set**, a model must also be *winnable within the cap* to be admitted - walk down the score ranking and keep only models where the market clears no deeper than your cap (`max_discount ≥ d_M` on both sides, precise per-side test at book-reduction time - see *Maximum-discount cap*), until you have `n` winnable models or the set is exhausted. If nothing clears the gate on a first run, fall back to the single highest-`requests_24h` serviceable model so the key still lists something.

**Why `disc` comes from the serviceable `M`, not the roster `best`.** The roster's `best` counts offers that can't actually serve - unhealthy, cap-exhausted, or untrusted - so a single phantom-cheap dead offer makes a model read fake-deep and tanks its score. Live: `claude-opus-4.6` (the top earner) showed a roster `best` of 90% off while its serviceable `M` was ~75%, scoring it dead-last and nearly delisting it - the run had to override the selection by hand. Scoring on the reduced-book `M` (the same price that pricing and the `max_discount` winnability test already use) removes that failure. It costs one `GET /api/markets/{model}` per liquidity-gated candidate before scoring; the serviceable set is small (~10-15), and those reduced books are reused for pricing (step 4), so it's not a double-fetch.

**Provider-id divergence (deliberate test-list).** A few high-demand models are served by Bankr under a `providerModelId` that differs from their Surplus market id (e.g. `gemini-3.1-pro-preview`, ~9k req/24h - the largest pool on the board). The serviceable-set match is by market id, so these get skipped even though Bankr can serve them. When such a model tops the demand board, **test-list it once**: create the offer with the `providerModelId` read from `/v1/prices` (not the market id). If the create returns `502 provider_probe_failed`, the divergence is real and unserviceable - record it in state and skip it henceforth; if it lists healthy, keep it. One deliberate probe, never a blind recurring create.

Each listed offer's daily cap is the flat **even** split: config `cap_daily_usd` if set, else `max(floor, daily_budget_usd / n)` (reference `allocate_caps(offers, daily_budget_usd, floor=1.0, cap_ceiling=cap_daily_usd)`). Here `daily_budget_usd` is **how much free credit to deploy per day** across the listed set (a throughput cap, not a loss). Recompute the score set + caps **every run** (the market shifts): PATCH a live offer's `cap_daily_usd` when its share changes, and **delist** (`DELETE /v1/seller/offers/{id}`) any offer that dropped out of the top-`n` so listings stay concentrated on the current highest-scoring models (a drop caused purely by a sub-`min_market_volume_usd` liquidity fall is debounced - see the liquidity-dip rule in the reactive run's step 2). Pricing stays **undercut** (`(1 - undercut_epsilon) x M`, default `0.99 x M`) - there's no cost floor to respect when the inventory is free.

### Who actually competes (deriving `M`)

Most of the book is noise. On a live `claude-opus-4.7` snapshot, **ranks 1-66 of 239 offers were all dead** (`healthy:false, available:false`) and the real clearing price sat at rank 67. Reduce the book before pricing against it.

**Always compare on `effective_*_per_1m`, never `price_*_per_1m`.** An offer with `pricing_mode: "cost_multiplier"` reports `price_input_per_1m: 0` and carries its real price in `effective_input_per_1m` (= its multiplier × a reference base). Ranking on `price_*` with a `> 0` filter silently drops **every** multiplier-priced competitor - and they are the majority of the book.

An offer counts toward `M` only if **all** hold:

| Test | Why |
|------|-----|
| `id` not in your `GET /v1/seller/offers` | never undercut yourself |
| `healthy && available` | it can actually serve the request |
| `trusted` | trusted-only routing is the default for new buyer accounts, so untrusted offers don't compete for most demand |
| `effective_input_per_1m > 0` | a zero effective price is missing data, not a free lunch |
| not cap-exhausted | `cap_daily` set and `cap_remaining / cap_daily < 0.05` → it drops out of the book shortly; don't cut price to beat a seller who is about to leave |
| not a flapper | seen unhealthy in ≥ half of its last 6 observations in `competitors` state → it won't hold rank |
| has real liquidity | `trades_24h ≥ 10` **or** already proven (≥6 healthy observations in `competitors` state) → a brand-new, negligible-volume offer can't actually absorb routing; letting it set `M` forces a phantom deep-undercut you'd have to override by hand |

`M_in` / `M_out` = the lowest surviving `effective_input_per_1m` / `effective_output_per_1m` (independently). Record every surviving competitor in `competitors` state so the flapper test has history. Log **book size vs survivors** (`opus-4.7: 239 offers → 126 live → 3 after filters`) - a large gap is the signal that nominal and clearing price have separated.

> **The `trusted` and liquidity tests are load-bearing.** Consider a high-value model whose order book holds three kinds of cheap-looking rivals: an *untrusted* offer at, say, `$0.55/1M`; a brand-new *trusted* newcomer with almost no throughput (a fraction of a dollar of volume, a few trades, no health history) at `$2.25`; and the cheapest **trusted seller with real volume** at `$2.74`, while the sellers actually *winning* the traffic sit higher still (a few dollars, on hundreds of trades each). Undercutting the `$2.25` newcomer (listing at `~$2.14`) chases a phantom no buyer routes through, because **routing here is not cheapest-wins** - a trusted seller with volume history routinely out-earns a cheaper newcomer. The `trusted` filter drops the `$0.55` offers; the **liquidity gate** (a rival needs real trade volume, `trades_24h ≥ 10`) drops the `$2.25` newcomer; together they set `M = $2.74`, the real clearing floor. Excluding these is what stops the engine demanding a manual override every run. Treat `trusted` as **missing → untrusted** (a missing flag is not a trust grant), so an offer with no `trusted` field never sets `M`.

## Maximum-discount cap (`max_discount`)

`max_discount` **caps how deep your discount can ever go** - a rate floor so the undercut engine can't chase the market into a race to the bottom. Set `max_discount: 0.80` and no offer this provider lists will ever sit deeper than **80% off the direct reference** (`d_in ≤ 0.80` **and** `d_out ≤ 0.80`). **Unset (default) → no cap.**

Discount is measured off `direct_*_per_1m` (the public sticker), like the `discount_*` state - **not** off the provider cost `C`. So the cap reads intuitively: *"never sell below 20% of sticker."* (The `floor` knob is the other way to bound price - a multiple of your true cost - and the two **compose**; see below.)

Per side, the cap defines a **price floor** `P_cap = direct × (1 − max_discount)` - the lowest price it allows. Two behaviours follow (this is the **"clamp & skip"** design):

**1. Clamp (pricing).** After step 4 produces a candidate `P`, clamp up per side: `P = max(P, P_cap)`. A would-be 92%-off undercut becomes an 80%-off listing. In undercut mode the low bound is just `P_cap`; in floor mode it's `max(true_cost, P_cap)` - whichever floor is higher wins.

**2. Skip (selection).** You can only *win routing* at/below the reduced-book clearing price `M` (per **Who actually competes**). If `P_cap > M` on **either** side - the market already clears **deeper** than your cap (`d_M > max_discount`) - you can't be competitive without breaking your rate, so **don't list that model at all**. A model is **winnable-within-cap** iff `max_discount ≥ d_M` on **both** sides, where `d_M_in = 1 − M_in/direct_in` and `d_M_out = 1 − M_out/direct_out`. In the reactive run's selection (step 2), **walk the score-ranked serviceable set and admit a model only when it's winnable-within-cap**, fetching each candidate's reduced book as you go and stopping at `n` admitted or the set exhausted - so the daily budget concentrates on models you can actually win at your rate, and a currently-live offer that stops being winnable-within-cap moves to `to_delist`. (When `max_discount` is unset every model is trivially winnable, so this degenerates to the current top-`n` and fetches no extra books.)


**When the cap bites, say so.** If the winnable-within-cap filter drops a model, or an offer is clamped to exactly `P_cap` and thus lands above market (won't win its traffic), emit the **`discount-capped`** signal (see *Notify*) - the analogue of floor mode's `no-margin` flag: the market for that model is deeper than your rate, so you're **choosing to hold your discount over winning its traffic**. Lower `max_discount` to chase deeper, or accept it. `max_discount` and `floor` are independent and compose (effective low bound = the higher of `P_cap` and `true_cost`); with free credits and no cost floor, `max_discount` is usually the *only* rate guard you want.

## Adaptive discount (`discount_adaptive`)

`max_discount` above is a *fixed* rate wall. **`discount_adaptive: true`** makes it self-tune: because Bankr credit is **free**, the deepest discount you'll list at is not a loss guard but a **revenue** knob - deeper wins more books (more volume) at fewer USDC per token, shallower keeps more USDC per token but wins fewer books. The controller walks the *effective* cap toward the revenue-maximizing point of that curve, one small step per run, so it finds the balance between "few selling → go deeper" and "lots selling → charge more." **Off by default → `max_discount` stays fixed (current behaviour unchanged).**

**The move (once per run, after step 3 reads earnings + offer health).** Start from `d = adaptive_discount` in state (first run: the config `max_discount`, or `discount_max` if `max_discount` is unset). Then, using the run's own signals:

- **Any live offer sold out its cap** (`cap_remaining / cap_daily < 0.10` on ≥1 offer) → **tighten**: `d ← max(discount_min, d − discount_step)`. A saturated offer means demand exceeds supply **at the current price** - price is not the binding constraint, the cap is - so a shallower discount keeps winning up to the cap while earning **more USDC per token**. **Guarded:** pass each currently-live offer's own discount (max of its `d_in`/`d_out`) as `live_offer_discounts=[...]` to `adapt_discount` - the tighten never moves the cap below the deepest live offer (that would orphan and reap an earner), and **holds** instead if it can't tighten without pricing one out. (Raising the per-offer *cap* is the lever for more volume; the discount lever captures margin.)
- **Else the run is cold** (`revenue_today ≤ 0` **OR** `winnable_books ≤ 1` - the two triggers are an **OR**, matching `price_models.py:adapt_discount` exactly: `if revenue_today <= revenue_deadband or winnable_books <= 1`) → **loosen**: `d ← min(discount_max, d + discount_step)`. Nothing is winning at the current rate, so open more books by allowing a deeper cut and capture idle demand - every won request is pure profit on free credit.
- **Else** (selling **and** ≥ 2 winnable books) → **hold**. You're in a good balance; don't churn the rate.

> **⚠️ Describing this to the operator: state BOTH loosen triggers.** The loosen condition is `revenue_today ≤ 0` **OR `winnable_books ≤ 1`**, so a **thin lineup keeps loosening even while earning money** (a run that sold $0.05 but has only one winnable market still walks the cap deeper). Do **not** tell the operator it "only loosens at $0 revenue" / "revenue > 0 means no walk" - that drops the winnable-book clause and is **wrong**. Hold fires **only** when `revenue_today > 0` **AND `winnable_books ≥ 2`**.

Reference impl: **`adapt_discount(prev, saturating=…, revenue_today=…, winnable_books=…, dmin=discount_min, dmax=discount_max, step=discount_step, live_offer_discounts=[…])`** in `price_models.py` - a pure function returning `(new_discount, direction, reason)`, clamped to `[discount_min, discount_max]`, moving at most `step`. Call it (or reproduce its arithmetic), then use the returned `d` **as `max_discount`** everywhere downstream this run (selection winnability, price clamp). **Persist `adaptive_discount: d`** in state so the next run continues from here. **Log the move**: `adaptive-discount: 0.65→0.70 (loosen: under-selling, 1 winnable book)` or `adaptive-discount: 0.65 held (selling, not saturated)`. When `discount_adaptive` is off, skip all of this and use the static `max_discount`.

**Why step-limited and hysteretic.** One `discount_step` per run (not a jump to the theoretical optimum) means the engine *hunts* the balance across runs instead of oscillating on a market that moves hour to hour - the same reason the lineup uses a fixed score-hysteresis margin. The bounds `[discount_min, discount_max]` keep it from tightening into no-sales or chasing a re-rated market past a rate you'd accept; `discount_max` is still a hard wall (never lists deeper).

## Funding preflight (write runs - do this FIRST)

> **Provider-specific probe.** This section is the **bankr** preflight (a 1-token probe against the Bankr gateway with `X-API-Key`). For **aws** and **vertex** the funding check differs (Bedrock proxy Bearer probe; Vertex SA→token or `AIza` probe) - see the provider's row in *Provider adapters*. The **semantics are identical** across providers: preflight before any create, skip a `401`/`403` bad credential, and pause that provider (`COMPUTE_RESELL_FUNDING_EXHAUSTED`) only when it is genuinely out of funds. Providers are independent - one exhausted provider never pauses the others.

**Before selection or any create, confirm the Bankr key is actually funded - don't infer it from Surplus's downstream errors.** Surplus stores your `BANKR_LLM_KEY` and probes Bankr on your behalf; when that probe fails it reports `502 provider_probe_failed` and **often drops the underlying `HTTP 402`**, and a low-traffic offer can read stale `healthy:true`. So the "402-string or all-offers-unhealthy" heuristic misses a genuinely empty wallet and churns doomed creates while half-blaming the wallet. Probe the provider **directly** instead - one minimal billable call to the Bankr gateway returns the *raw* status the wrapper hides. (Bankr publishes no balance/credits REST endpoint - credits live behind `bankr llm credits` / the dashboard - so a 1-token completion is the definitive programmatic funding signal.)

**Skip the preflight** when `BANKR_LLM_KEY` is unset (that's the orphan-reap path - reactive step 1) or in `monitor` mode (read-only: infer funding from offer health, never send a billable probe).

Pick the **cheapest serviceable model** from `/v1/prices` (the public read you already do) and send a 1-token completion with `X-API-Key: {BANKR_LLM_KEY}` (the gateway is OpenAI-compatible; base `https://llm.bankr.bot/v1`, auth is `X-API-Key`, **not** Bearer):

```bash
./secretcurl -sS -w '\nhttp=%{http_code}\n' --max-time 20 \
  -H "X-API-Key: {BANKR_LLM_KEY}" -H "content-type: application/json" \
  -d '{"model":"<cheapest-serviceable-id>","messages":[{"role":"user","content":"ping"}],"max_tokens":1}' \
  "https://llm.bankr.bot/v1/chat/completions"
```

Print `http=<code>` and branch **before** selection:

| Preflight result | Meaning | Action |
|---|---|---|
| `200` | **Funded** | Proceed with the normal reactive run (steps 1-6). |
| `402`, or a body naming insufficient credit / payment | **Wallet empty (confirmed)** | **Pause all offers and stop** - `DELETE` every live offer (state retained, the `pause` path), no selection, no creates, no reprice. Exit `COMPUTE_RESELL_FUNDING_EXHAUSTED`; send the **critical** funding alert with top-up guidance. The next run's preflight passes once funded and auto-relists the top-`n` - no manual `resume`. |
| `401` / `403` | **Key rejected** - bad/expired `bk_...`, *not* a balance problem | Stop. Exit `COMPUTE_RESELL_NO_KEY`; alert *"BANKR_LLM_KEY rejected (HTTP `<code>`) - rotate the provider key"*. **Do not** recommend a wallet top-up. |
| `5xx` / timeout | **Provider unreachable - ambiguous** (Bankr down, or an empty wallet masking its 402 behind a 5xx) | **Skip all creates** this run (don't churn doomed probes); leave existing offers untouched (Surplus routes only to healthy sellers, so an unhealthy offer isn't served anyway). Exit `COMPUTE_RESELL_API_ERROR:<code>`; alert *"Bankr probe failed (HTTP `<code>`) - provider outage OR an empty wallet returning a non-standard error; NOT a confirmed 402. Verify with `bankr llm credits` before topping up."* **Do not** assert the wallet is low. |

The billable cost is one token (≈ $0). **This preflight is the single source of truth for funding** - the create-path `402` handling (step 5) and the exit taxonomy defer to it. Log the outcome (`preflight: http=200 funded` / `preflight: http=402 - wallet empty, paused N offers`), including the exact response body snippet on a non-200 (`"Insufficient LLM Gateway credits"`) so the debug log records *why*.

**Credit-balance read (best-effort, every run, all modes).** For the *Debug snapshot* credit line, additionally attempt a **balance read** - this is a plain `GET` (not a billable completion), so it is safe even in `monitor`/read-only, and unlike the preflight it may surface an actual dollar figure. Try config `bankr_balance_url` if set, else `GET https://llm.bankr.bot/v1/credits` **once** with `X-API-Key: {BANKR_LLM_KEY}` via `./secretcurl` (print `http=<code>`). On a `200` whose body carries a numeric balance, log `bankr credits: $<n> (via <url>)`. On a **transient failure** - `403`/`429`/`5xx`, a timeout, or a `200` whose body is **not JSON** (an nginx/Cloudflare HTML error page from an edge rate-limit) - **retry once after a short pause** (a few seconds); the rate-limit usually clears. On any non-200 that persists (or a `401`/`404`, which would mean Bankr moved the path), **do not sweep further** - fall back to the **derived** credit line: `bankr credits: no endpoint (http=<code>) - preflight=<funded|empty|not-probed>, est. consumed today $<consumed>/$<daily_budget>`. Never leave the credit line blank. (In `monitor` mode the preflight itself is skipped, so `preflight=not-probed`; the balance `GET` still runs.)

**Never go silent when the balance read fails.** The `low-credit` warning below only has a number to threshold when a real balance was read, so a failed read would otherwise **silently disable the warning** - the wallet could drain to $0 with no early warning, surfacing only as the funding-exhausted **critical** after the fact (the exact gap the warning exists to close). So whenever the balance read did **not** yield a number (after the one retry), emit a visible one-liner in the log **and** the recap - `credit-read failed (http=<code>) - low-credit warning blind this run` - at `--severity info` (bump to `warn` if it fails on **two consecutive runs**, since a persistent block, not a blip, is now hiding the runway). This never *fabricates* a low-credit alert; it just makes the blind spot visible instead of silent.

**Low-credit early warning.** When a real `$<n>` balance was read, compute runway on the **real credit burn**, not the budget. `daily_budget_usd` meters *revenue* (USDC), but each USDC of that inventory burns `burn_ratio` USDC of credits, because credits are spent at your Bankr **cost basis** `C` while you sell at a discounted `price`. So the true daily credit drain is `daily_budget_usd × burn_ratio`, and:

```
burn_ratio = Σ_offer (cap_daily_i × cost_blend_i / price_blend_i) / Σ_offer cap_daily_i
             where cost_blend = cost_in + 3×cost_out, price_blend = price_in + 3×price_out
runway_days = n / (daily_budget_usd × burn_ratio)
warn (low-credit) if  n < min_credit_days × daily_budget_usd × burn_ratio   ⟺   runway_days < min_credit_days
```

`burn_ratio` is the cap-weighted `C/price` across the live lineup - everything the skill already has in state (`cost_*`, `price_*`, `cap_daily_usd` per offer); no cross-run state needed. Since Bankr's `C` currently equals the direct sticker exactly, `C/price = 1/(1 − discount)` - a lineup clearing ~55% off burns ~2.2×, so `min_credit_days` days of *real* runway ≈ half the budget-days the old formula reported (`n / daily_budget_usd`). It self-corrects if `C` ever drops below sticker (a real volume/promo tier) - the ratio reads straight from `cost_*`. Fallbacks: no live offers or missing `cost_*`/`price_*` → `burn_ratio = 1.0` (degrades to the old budget-days runway); a single offer priced *at* cost → ratio 1.0 (break-even, no bleed). Clamp `burn_ratio ≥ 1.0` (selling above cost is not negative burn for runway purposes). Config `min_credit_days` default 3; `0` disables.

This is the fix for two gaps: (1) the "preflight is a floor, not a balance" gap - a 1-token probe passes on a near-empty wallet, so a wallet with a sliver of credit lists offers, serves a few requests, drains, and goes unhealthy mid-day, invisible until the next daily run; (2) the **budget-vs-burn** gap - the old `n < min_credit_days × daily_budget_usd` test measured budget-days, so at a deep undercut it reads ~2× the real runway and stays silent through the window where the wallet actually drains fastest. Only fires when an actual balance number was read; on the derived fallback there's no number to threshold, so the warn is skipped **but not silent** - the *credit-read failed* line above makes the blind run visible (never silently drop the runway check).

## Mode: default reactive run (empty / `reprice`)

The scheduled default - self-bootstrapping, no separate setup. **Run the Funding preflight (above) first; only continue to step 1 on a `200`.**

> **Every run re-runs selection from the full serviceable set and reconciles the lineup - this is NOT a reprice-only pass.** Recompute the desired top-`n` from *all* serviceable models, then create / delist / reprice to match it. An offer being live and *earning* is **not** a reason to keep it: if it's no longer in the top-`n`, delist it. Repricing the existing offers without re-selecting is the exact failure mode to avoid. (The one exception is the step-2 liquidity-dip debounce: a lineup-wide liquidity collapse gets one grace run before delisting, so a transient market-wide zero doesn't tear down and rebuild the whole lineup.)

1. **Snapshot the live set.** `GET /v1/seller/offers` → `{items:[...]}`. The **live set** = items with `status:active`; the endpoint also returns soft-deleted offers with `status:inactive`. `401/403` → exit `COMPUTE_RESELL_NO_KEY`. Reconcile the active items with state (adopt server offers missing from state; drop state offers gone from the server).

   `inactive` (soft-deleted) offers returned by the listing are harmless and there is no hard-delete API - ignore them; only ever act on `active` offers.

   **Orphan reap (key removed → auto-pause).** If `BANKR_LLM_KEY` is **unset**, the key can serve nothing - every live offer is orphaned. `DELETE` all of them (the automatic counterpart to `var=pause` when the operator removes the key), **skip scoring + pricing (steps 2 & 4)**, still read market + usage for the recap in step 3, clear the reaped offers from state, notify the reap only if ≥1 was removed, and exit `COMPUTE_RESELL_OK`. This is a deliberate teardown, **not** funding exhaustion - don't send the critical funding alert. The lineup restores itself automatically once a funded `BANKR_LLM_KEY` is added: the next reactive run re-lists the top-`n` (no manual `var=resume`).
2. **Recompute the desired set + diff (mandatory - do this before any pricing).** `GET /api/markets` (roster) → **liquidity-gate** the serviceable set at `min_market_volume_usd`, then **reduce each survivor's book to `M`** (`GET /api/markets/{model}` per candidate, per *Who actually competes* - the set is small) and score by **`(1 − disc) × direct_blended × (1 + ln(requests_24h))`** with **`disc` taken from the serviceable `M`, not the roster `best`** (price-level-weighted - see *Target models*), using the **roster's market-wide `requests_24h`** (total buyers across all sellers - NOT your own captured requests; see the ⚠️ in *Target models*); the **desired set** = top **`n`** by that `M`-based score (per **Target models & budget split**), computed from scratch and **independent of what's currently live**. Reducing the book **before** scoring is what stops a phantom-cheap dead offer in the roster from mis-ranking (and near-delisting) a live earner. **Apply the claim ledger (see *Cross-skill claim ledger*): exclude every id in `claimed_models` from the serviceable set before the liquidity gate (R1), and add any live offer whose model is in `conflicts` with `keep_here == false` to `to_delist` regardless of score (R2, hard reap, hysteresis-exempt).** Diff desired vs the live set from step 1 and log all three lists:
   - **`to_create`** = desired − live → `POST` in step 5
   - **`to_delist`** = live − desired → `DELETE` in step 5 (they fell out of the top-`n` - delist even if earning). **Liquidity-dip debounce (prevents lineup thrash):** if an offer is a delist candidate *only because its model dropped below `min_market_volume_usd`* - a market-wide liquidity fall, not a score-rank drop while still above the gate - do **not** delist on the first low reading. Increment its `low_demand_runs` in state and **keep it live** one more run; only actually delist once `low_demand_runs ≥ 2` (two consecutive low runs). Any reading at/above `min_market_volume_usd` resets `low_demand_runs → 0`. This absorbs the transient full-market zeros (thin books read ~$0 volume for an hour, then recover) that would otherwise delist the whole lineup and rebuild it an hour later. A candidate that fell out purely by *score* while still **above** `min_market_volume_usd` is delisted immediately - that's normal rotation, no debounce.
   - **`to_reprice`** = desired ∩ live → keep, refresh price + cap in step 5

   Offers reaped for being **orphaned** (step 1, key removed) or **dead ≥2 runs** (step 3, sustained-unhealthy) are added to `to_delist` too.

   **Sticky lineup (hysteresis - prevents churn).** A live offer is an *incumbent*; a top-`n` model that isn't currently live is a *challenger*. Do **not** delist an incumbent merely because a challenger outscores it by a hair - the roster's `requests_24h` is noisy hour to hour, and a bare score flip round-trips the whole lineup daily. Rule: for each would-be **swap** (an incumbent in `to_delist` displaced by a challenger in `to_create` because the challenger scored into the top-`n`), **cancel the swap and keep the incumbent** unless `challenger.score ≥ incumbent.score × 1.15` (a fixed 15% hysteresis margin). An **earning** incumbent (`last_window.earned_usdc > 0` or `last_window.tokens > 0` - it is actually winning traffic) is worth keeping: never trade a proven earner for an unproven challenger that only clears the margin on paper; hold it and revisit next run. Hysteresis applies **only** to score-driven swaps - incumbents delisted for a *hard* reason (discount-capped/unwinnable per `max_discount`, liquidity below `min_market_volume_usd` after the debounce, dead ≥2 runs, orphaned) delist regardless, and a cancelled swap simply keeps the incumbent (no new create), so `n` stays bounded.

   Then for each model in the **desired set**, reuse the reduced book already computed while scoring in step 2 (`M_in`/`M_out`, the lowest surviving `effective_*_per_1m`) - or `GET /api/markets/{model}` and reduce it per **Who actually competes** if it wasn't retained. Also keep `direct_input_per_1m`/`direct_output_per_1m` for the cap rule. `GET /v1/prices` → provider cost `C`. (Optional: `GET /api/markets/feed` → live demand.) **`max_discount` winnability filter (if set):** with `M_in`/`M_out` in hand, drop any desired-set model where `d_M > max_discount` on either side (its market clears deeper than your cap - you can't win at your rate) and admit the next winnable candidate by score in its place, moving any now-unwinnable live offer to `to_delist` (see *Maximum-discount cap*).
3. **Read usage + health.** `GET /v1/seller/earnings` → `{total_earned_usdc, pending_usdc, paid_usdc, by_model[], share{requests,tokens,top_model}, recent_sales[], daily[]}`; compute Δ vs `earnings_cursor` (Δearned_usdc, Δtokens; per-model from `by_model`). `GET /v1/seller/health-log` → events not in `health_incidents_seen`. **Funding check (secondary - the preflight is the primary gate).** Funding was already settled by the *Funding preflight* (a direct `200`/`402`), so this is only a cross-check: a preflight `200` **proves** the wallet has credit, so if some offers still read `healthy:false` this run it's a **provider/model-specific Bankr outage, not exhaustion** - and a lineup where *some* offers are healthy while others fail is **never** wallet exhaustion (an empty wallet fails them all). Do **not** escalate to `COMPUTE_RESELL_FUNDING_EXHAUSTED` from unhealthy flags alone - only a confirmed `402` (preflight or a create body) is exhaustion; unhealthy-without-402 is a provider outage (`COMPUTE_RESELL_API_ERROR`). **Dead-offer reap (debounced):** track each live offer's health in `dead_runs` - increment when the offer is `healthy:false` this run (its `healthy` flag from `/v1/seller/offers` / the order book), reset to `0` when healthy. Any offer with `dead_runs ≥ 2` (unhealthy on two consecutive reactive runs - sustained wallet exhaustion or a model-specific outage) is **reaped**: add it to `to_delist` regardless of score, so dead listings don't linger. A single unhealthy reading is **not** reaped (transient-flap protection), and re-listing is automatic once the model is serviceable again. **Compute the daily-recap figures** (see *Notify → Daily recap*): **consumed** = the day's provider spend - the day's tokens from `daily[]` × per-model Bankr cost `C` (or, for an intraday number, Σ `cap_daily − cap_remaining` across your live offers from the order books); **earned_today** = `daily[]` for today (else Δearned_usdc since the cursor); **earned_yesterday** = `daily[]` for the **prior calendar day** (its own `{earned_usdc, requests}` row - the day-over-day figure the recap must always show); **net** = earned_today − consumed; plus requests, tokens, offers live, and the top model. Note which basis you used. **Save the raw `/v1/seller/earnings` response body to a scratch file** (`$RUNNER_TEMP/earnings.json`, else a repo-local temp) so the durable earnings-ledger writer in step 6 can read `daily[]` from it directly.
4. **Price each target model** (input & output independently, per 1M). **Two modes, chosen by whether `floor` is set:**

   **Undercut mode - `floor` unset (default).** Price at **`P = (1 − undercut_epsilon) × M`** (default `undercut_epsilon = 0.01` → `0.99 × M`) - *just* below the cheapest surviving competitor (`M_in`/`M_out` per **Who actually competes** - which now excludes untrusted and no-liquidity phantoms, so `M` is the real clearing floor, not a $0.07-volume newcomer). If no competitor survives the filter → fall back to `(1 − undercut_epsilon) × C` (Bankr cost). Routing is cheapest-wins, so being *just* under `M` wins the **same** traffic as a deeper cut - the deeper cut only keeps fewer USDC per token for no volume gain. This lands you just under the leader who can actually serve. With free/cheap Bankr credits (cost ≈ $0) every won request is profit, so there's **no cost clamp** - you just want to win at the highest routing price, and `daily_budget_usd` only bounds how much free credit you deploy. (Set a `floor` only if you have a real per-token cost you don't want to price under.) **If `max_discount` is set**, clamp up per side: `P = max((1 − undercut_epsilon) × M, P_cap)` with `P_cap = direct × (1 − max_discount)` - never deeper than your cap (a model that couldn't win within the cap was already skipped in step 2, so this only trims the last few % of discount).

   **Cap-bound pricing (pin at the top of the routing band).** A saturated offer is supply-constrained - the **cap binds before price does**, so a lower price wins **no** extra volume. Price is then a lever on *USDC-per-token only* (how much you keep on each sold token), not on *whether* you win. The routing behavior is the decider here: priced **above** the serviceable clearing floor `M` an offer stops being routed and goes **dark** (long multi-hour blackouts); priced **at or just under `M`** it sells out. So there is a hard wall at `M`, and the yield-max price for a cap-bound offer is the **highest price that still routes = `(1 − undercut_epsilon) × M`** (default `0.99 × M`) - the top of the routing band. Before pricing a **live** offer, branch on its cap (from the order book):
   - **Cap-bound / saturated** (`cap_remaining / cap_daily < 0.10`, filled ≥90% of `cap_daily`). Pin at **`P = min((1 − undercut_epsilon) × M, direct)`**, clamped up by `P_cap = direct × (1 − max_discount)` if `max_discount` is set. This is a jump **this run** to the top of the band (up from a stale under-price, or down from any price that had crept above `M`), never above `M`. Record `last_move: pinned`. *(A naive crawl of `price × probe_up_step` toward `direct` repeatedly crosses `M` into the dark zone; pinning removes both the giveaway and the blackout.)*
   - **Spare cap** (`cap_remaining / cap_daily ≥ 0.10`). Also price at **`(1 − undercut_epsilon) × M`** - the undercut. Since routing is cheapest-wins, being *just* under `M` already wins the routing; a deeper cut wins no more volume and only keeps fewer USDC per token. (A cold offer that stays dry at the cheapest price is a *demand* problem, not a price one - price is not the lever there.)
   - **No serviceable competitor** (`M` is `None` - you are the sole healthy seller, so there is no wall to hit). Only then climb toward the sticker: `P = min(price × probe_up_step, direct)`.

   A fresh offer (no serving window yet) skips this and prices the normal undercut way. Both branches converge on `(1 − undercut_epsilon) × M`: the cap-bound/spare split now governs only the **cap allocation** (the even split `max(floor, daily_budget_usd / n)`), not the price. `undercut_epsilon` is fixed at `0.01` (list at `0.99 × M`, the highest price that still wins routing).

   **Floor mode - `floor` set.** Protect cost: `true_cost = floor × C`, ceiling `C`, undercut `ε = 0.02`.
   - **Undercut** (`M < your price` - someone's now cheaper) → drop to `P = clamp(M·(1−ε), true_cost, C)` to reclaim routing. If `M·(1−ε) < true_cost` (can't win above cost) → hold at `true_cost`, flag `no-margin`.
   - **Dominant** (`your price ≤ M` - you set the market; can't see the seller above you) → **probe up** `P = min(your_price·1.03, C)`; if the prior raise lost tokens (Δtokens down after `last_move=="up"`) → revert down one step. (The only hill-climb left - extract margin while you're cheapest.)
   - Clamp to `[true_cost, C]` - and when `max_discount` is set, raise the low end to `max(true_cost, P_cap)` (`P_cap = direct × (1 − max_discount)`), so neither the cost floor nor the discount cap is ever broken. At `floor = 1.0`, `true_cost = C` so price pins to the reference (never below cost).

   **Both modes:** if `BANKR_LLM_KEY` is unset, skip create and log `needs BANKR_LLM_KEY to list` (a safety net - normally unreached, since the step-1 orphan reap short-circuits before pricing when the key is unset); round to ¢/1M. Record the resulting `d_in`/`d_out` in state.
5. **Apply the step-2 diff** (fail-closed, in-run; the step-2 diff prevents double-listing). Execute **all three** lists - a run that only PATCHes existing offers is the bug this guards against. **Two ordering rules govern this step:**

   **(a) Create the replacement before delisting the incumbent it replaces.** When a `to_delist` entry is a *replacement* (an incumbent swapped out for a challenger, not a hard reap), run the challenger's `POST` **first** and only `DELETE` the incumbent **after** the create returns `201`. If the create fails for any reason (daily-allowance `400`, provider `502`, etc.), **keep the incumbent live** - never end a run with an offer torn down and nothing put in its place. This is the direct guard against the failure mode where both live offers get delisted while their replacement creates fail, leaving 0 active offers all day. Hard reaps (discount-capped, dead ≥2 runs, orphaned, demand-debounced) have no replacement and `DELETE` normally.

   **(b) Order creates by descending score** so the highest-value models list first. If a `POST` returns Surplus's daily-allowance `400` (create pool full for the day), **stop creating** for this run, keep any incumbent the create would have replaced (rule a), and exit `COMPUTE_RESELL_OK` - a full pool with the lineup intact is steady state, not a failure. The pool resets at UTC midnight.

   Execute the lists in the order **to_create (replacements + net-new) → to_reprice → to_delist (replacements after their create confirmed, plus hard reaps)**:
   - **`to_create`** → `POST /v1/seller/offers` (pool-checked per rule b):
   - **`to_reprice`** → `PATCH /v1/seller/offers/{id}` when price changed by ≥ $0.01/1M **or** the per-offer cap share changed by ≥ $0.05 (measured against the read-echoed microdollar prices). The reprice body is the **three-field form** `{"pricing_mode":"cost_multiplier","cost_multiplier":<mult>,"cap_daily_usd":<cap>}` - **never** the retired `price_*_per_1m` fields (see the price-`PATCH` note below for the `cost_multiplier_mode_mismatch` guard). `cap_daily_usd` = the flat even split `max(floor, daily_budget_usd/n)` (or config `cap_daily_usd` if set), from `allocate_caps.py`. PATCH does not consume the pool (no new offer created).
   - **`to_delist`** → `DELETE /v1/seller/offers/{id}` for each hard reap, and for each replacement **only after** its challenger create returned `201` (rule a). Remember a `DELETE` does not refund the pool.
   The `POST /v1/seller/offers` body:
   ```bash
   ./secretcurl -sS -w '\nhttp=%{http_code}\n' --max-time 30 \
     -H "Authorization: Bearer {SURPLUS_SELLER_KEY}" -H "content-type: application/json" \
     -H "Idempotency-Key: $(python3 -c 'import uuid;print(uuid.uuid4())')" \
     -d '{"model":"<id>","api_key":"{BANKR_LLM_KEY}","seller_base_url":"https://llm.bankr.bot/v1","cost_multiplier":<mult>,"cap_daily_usd":<cap>,"payout_address":"<addr>"}' \
     "https://api.surplusintelligence.ai/v1/seller/offers"
   ```
   (The `api_key` and `seller_base_url` in the create body come from the running provider's adapter row - `BANKR_LLM_KEY` + `llm.bankr.bot/v1` for bankr; see *Provider adapters* for aws/vertex. A reprice `PATCH` carries no `api_key`.)
   **Quote creates with `cost_multiplier`, NOT `price_*_per_1m` (breaking change).** Surplus **retired per-token pricing for text models**; a create carrying `price_input_per_1m`/`price_output_per_1m` is rejected:
   ```
   400 {"code":"per_token_pricing_retired",
        "message":"Per-token pricing is retired for text models. Quote '<model>' with
                   cost_multiplier (a multiple of the marketplace benchmark) instead of
                   price_input_per_1m / price_output_per_1m."}
   ```
   The multiplier is a fraction of the order book's **`direct_*_per_1m`**: across live books, effectively all offers satisfy `effective_*_per_1m = cost_multiplier × direct_*_per_1m` (a few legacy asymmetric strays). So the multiplier **is** the price-to-sticker ratio, i.e. `1 − discount`:
   ```
   cost_multiplier = P_in / direct_in          (= 1 − d_in)
   undercut target: cost_multiplier = (1 − undercut_epsilon) × M_in / direct_in
   max_discount clamp:  cost_multiplier = max(that, 1 − max_discount)
   ```
   Because a single multiplier scales both sides, **input and output can no longer be priced independently** - the per-side pricing in step 4 collapses to one ratio. `M_in/direct_in` and `M_out/direct_out` are equal on essentially every book (rivals quote one multiplier too), so take the **input** side and verify the output side lands at/below `M_out`; if the two sides ever diverge, use the **higher** ratio (the shallower discount) so neither side breaches `max_discount`. Cap logic is unchanged - just convert the resulting `P` back to a ratio.
   Reads are **unaffected**: the create response and `GET` still echo `pricing_mode:"per_token"` plus derived integer-microdollar `price_*_per_1m`, and existing offers keep serving (all offers created before the change still report their implied `cost_multiplier`). Worked example - listing `gemini-3.1-flash-lite` at a 0.99× undercut of `M = $0.174825` against `direct = $0.25`: `cost_multiplier = 0.99 × 0.174825 / 0.25 = 0.692307` → `201`, offer priced $0.173077/$1.038461 per 1M, 30.77% off.
   **`Idempotency-Key` is required.** Every `POST /v1/seller/offers` **must** carry an `Idempotency-Key` header - without it the API returns `400 idempotency_key_required`. Use a fresh value per distinct create - generate it with `$(python3 -c 'import uuid;print(uuid.uuid4())')`, **not** `$(uuidgen)`: Claude Code allows `python3` but prompts on the `uuidgen` binary, which stalls an unattended run. Reuse the same value only when retrying the *same* logical create, so a retry dedupes instead of double-listing. `PATCH`/`DELETE` don't need it.
   **`payout_address` is create-only.** Include the key only when config sets it (omit it entirely otherwise - settlement then goes to your seller wallet). `PATCH` is documented for price/caps only, so it cannot retarget an existing offer: if config `payout_address` differs from the value in state for a live offer, **do not** try to PATCH it - log `payout drift: <old> → <new>; run var=pause then var=resume to re-create` and leave the offer alone.
   **API price units - microdollars on read; creates quote a multiplier.** `GET` responses return integer microdollars (`$/1M × 1e6`), so divide reads by `1e6`. **Creates** send `cost_multiplier` (a unitless float, see above) - the old float-`$/1M` create body is retired. **A price `PATCH` must send `pricing_mode` *and* `cost_multiplier` together.** Sending the multiplier alone on an offer created before the change is rejected, because that offer is still in per-token mode:
   ```
   PATCH {"cost_multiplier":0.68469588,"cap_daily_usd":15.43}
   → 400 {"code":"cost_multiplier_mode_mismatch",
          "message":"cost_multiplier only applies in cost_multiplier pricing mode.
                     Pass pricing_mode: 'cost_multiplier' to switch this offer."}

   PATCH {"pricing_mode":"cost_multiplier","cost_multiplier":0.68469588,"cap_daily_usd":15.43}
   → 200   (echoes price_input_per_1m 171174, price_output_per_1m 1027044)
   ```
   So the working reprice body is the **three-field form** - `{"pricing_mode":"cost_multiplier","cost_multiplier":<mult>,…}` - with the multiplier computed exactly as for a create. Send `pricing_mode` on **every** price `PATCH`; it is harmless once the offer is already in multiplier mode. The float-`$/1M` fallback was never needed and remains untested - do **not** reach for it before trying the three-field form. ⚠️ **The response is not a mode oracle:** it still echoes `pricing_mode:"per_token"` *after* a successful switch, so never branch on that field to decide which body to send. A cap-only `PATCH` (`cap_daily_usd` alone, no price keys) needs no `pricing_mode` and is unaffected. **Keep the JSON inline in `-d '{...}'` - never `-d @file`.** `secretcurl` substitutes `{BANKR_LLM_KEY}` only in command-line args, not in file contents; a payload file sends the literal `{BANKR_LLM_KEY}` string → provider `401` → `502 provider_probe_failed`. Likewise write any scratch (parse scripts, temp payloads) to `/tmp`, never the repo tree - the post-run auto-commit captures tracked-dir changes. ≤30 CRUD/min; on `429` honor `Retry-After` and stop. A non-2xx is handled by case (fail-closed, reporting the true reason). First the **daily-allowance `400`** (the *Funding preflight* passed `200`, so it is **not** a funding problem - it is Surplus's daily create-allowance pool): **stop creating** for this run, **keep every incumbent live** (do not delist the offers whose replacements you couldn't create), and exit **`COMPUTE_RESELL_OK`** - a full pool with the lineup intact is expected steady state, not a failure. Reserve `COMPUTE_RESELL_API_ERROR:400` for a genuinely malformed request (a `400` naming a bad field, not the allowance pool). Then the **two provider-error cases** (credit was confirmed moments ago by the preflight `200`, which is what tells these apart):
   - **`502 provider_probe_failed` *without* a `402`** - the common case: a **model-specific** Bankr provisioning/outage issue for *that model* (it can't be served right now while other models are fine). **Skip that model, keep creating the rest**, record it, and exit `COMPUTE_RESELL_API_ERROR:502`. Report it as a **provider outage** (see *Notify → Provider outage*) - **do not** recommend a wallet top-up (a passing preflight proves the wallet isn't the cause) and don't tear the lineup down.
   - **A confirmed `402`** (`502 … : HTTP 402` or a bare `402`) - the wallet emptied *mid-run* after the preflight passed: **short-circuit the remaining creates**, **pause all offers** (`DELETE` each - a dead lineup shouldn't linger), exit `COMPUTE_RESELL_FUNDING_EXHAUSTED`, and send the **critical** funding alert + recap. Rare now that the preflight catches an empty wallet before any create.
6. **Advance state + runbook.** Persist per-offer `{cost_in/out, market_in/out, direct_in/out, price_in/out, discount_in/out, payout_address, low_demand_runs, dead_runs, last_window:{tokens,earned_usdc}, last_move, claimed_at}` (stamp `claimed_at` with the UTC ISO8601 create time on a new offer, R3; carry it forward on an existing one), the `competitors` observations (cap ~100 ids, evict least-recently-seen), new health ids (cap ~200), `earnings_cursor`, and - when `discount_adaptive` is on - the tuned `adaptive_discount` (this run's effective cap, so the next run continues from it). Refresh `memory/topics/compute-resell.md` (roster: your price vs market vs cost, discount tier, window earnings; bump `timestamp:`).

   **Durable earnings ledger - `memory/compute-earnings.csv` (append-only, upsert by date).** State only keeps a rolling cursor and the topic file is overwritten each run, so the per-day earnings history is otherwise lost (and worse, reset to empty by a migration - exactly what a repo/skill rename once did). Fix: every run, **upsert one row per calendar date straight from the authoritative `daily[]` array** (not the noisy `earnings_cursor` delta the state file itself flags as unreliable). Because `daily[]` returns a **window of past days**, this **self-backfills**: the first run after this ledger exists captures every day the API still returns, and each later run rewrites the current day's row with the day's latest running total. Columns: `date,earned_usdc,requests,discount_cap,offers_live,credits_usd,updated_at`. `earned_usdc`/`requests` come from the `daily[]` row for every date (authoritative, backfilled); `discount_cap` (this run's effective adaptive cap), `offers_live`, `credits_usd`, `updated_at` are known only for **today**, so they are written on today's row and never blanked out on past rows. Save the raw `/v1/seller/earnings` body to a scratch file first (`$RUNNER_TEMP/earnings.json`, else a repo-local temp), then run the reference writer - a pure upsert, safe to run 3x/day:
   ```bash
   EARNINGS_JSON="$RUNNER_TEMP/earnings.json" UTC_TODAY="$(date -u +%F)" RUN_AT="$(date -u +%FT%TZ)" \
   LEDGER_DISCOUNT="<effective adaptive cap, e.g. 0.75>" LEDGER_OFFERS="<count of live offers>" \
   LEDGER_CREDITS="<bankr credit balance USD>" LEDGER_EARNED_TODAY="<earned_today fallback>" \
   LEDGER_REQS_TODAY="<requests_today fallback>" python3 - <<'PY'
   import csv, json, os, pathlib
   # Per-provider ledger: bankr -> compute-earnings.csv, aws -> aws-compute-earnings.csv,
   # vertex -> vertex-compute-earnings.csv (keyed off RESELL_PROVIDER; bankr keeps the legacy name).
   _p   = (os.environ.get("RESELL_PROVIDER") or "bankr").strip().lower()
   LED  = pathlib.Path("memory/%s" % ({"bankr":"compute-earnings.csv"}.get(_p, "%s-compute-earnings.csv" % _p)))
   COLS = ["date","earned_usdc","requests","discount_cap","offers_live","credits_usd","updated_at"]
   ej   = os.environ.get("EARNINGS_JSON","")
   earn = json.load(open(ej)) if ej and os.path.exists(ej) else {}
   daily = earn.get("daily") or []
   today = os.environ["UTC_TODAY"]
   ctx = {"discount_cap": os.environ.get("LEDGER_DISCOUNT",""),
          "offers_live":  os.environ.get("LEDGER_OFFERS",""),
          "credits_usd":  os.environ.get("LEDGER_CREDITS",""),
          "updated_at":   os.environ.get("RUN_AT","")}
   rows = {}
   if LED.exists():
       for r in csv.DictReader(open(LED)):
           if r.get("date"): rows[r["date"]] = {c: r.get(c,"") for c in COLS}
   for d in daily:  # authoritative earned/requests for every day in the window (self-backfill)
       dt = str(d.get("date") or d.get("day") or "")[:10]
       if not dt: continue
       row = rows.get(dt, {c:"" for c in COLS}); row["date"] = dt
       # live API returns "earned_usd" per calendar day, NOT "earned_usdc";
       # reading the wrong key silently zeroes every row of the ledger.
       val = d.get("earned_usd", d.get("earned_usdc"))
       if val is not None:
           try: row["earned_usdc"] = f'{float(val):.6f}'
           except (TypeError, ValueError): pass
       if d.get("requests") is not None: row["requests"] = str(d.get("requests"))
       rows[dt] = row
   row = rows.get(today, {c:"" for c in COLS}); row["date"] = today  # ensure today exists even if window omits it
   if not row.get("earned_usdc") and os.environ.get("LEDGER_EARNED_TODAY"):
       row["earned_usdc"] = f'{float(os.environ["LEDGER_EARNED_TODAY"]):.6f}'
   if not row.get("requests") and os.environ.get("LEDGER_REQS_TODAY"):
       row["requests"] = os.environ["LEDGER_REQS_TODAY"]
   for k,v in ctx.items():  # run-context: today's row only, never clobber past rows with blanks
       if v != "": row[k] = v
   rows[today] = row
   with open(LED,"w",newline="") as f:
       w = csv.DictWriter(f, fieldnames=COLS); w.writeheader()
       for dt in sorted(k for k in rows if k): w.writerow(rows[dt])
   print(f"ledger: {len([k for k in rows if k])} days -> {LED}")
   PY
   ```
   The microdollar-string `total_earned_usdc` (see the format note in step 3) is deliberately **not** a column: `daily[]` stays plain dollar floats, so the ledger sidesteps that trap; lifetime total already lives in `earnings_cursor`.

## Mode: monitor (`monitor`) - read-only

Steps 1-3 (offers + market + usage + health), then a digest **without** any `POST`/`PATCH`/`DELETE` and **without** advancing the cursor. Notify only on signal.

## Mode: pause / resume

- **pause** - `DELETE /v1/seller/offers/{id}` for each offer (soft-delete; key retained). Keep state. Notify count.
- **resume** - re-create each state offer at the current reactive price (step 5 create path). Notify count.

## Exit taxonomy

`COMPUTE_RESELL_NO_KEY` (missing/invalid Bearer key - 401/403 on the seller key, **or a preflight `401`/`403` rejecting the `BANKR_LLM_KEY`** - a key problem, not a balance problem) · `COMPUTE_RESELL_API_ERROR:<code>` (a non-2xx on a required call; abort, report - **includes a provider outage: a `502 provider_probe_failed` *without* a `402`, or a `5xx`/timeout preflight, where the wallet is NOT confirmed empty**; a create `400` counts here **only** when it names a malformed field, **not** when it's the daily allowance pool - a daily-allowance `400` keeps the lineup and exits `OK`) · `COMPUTE_RESELL_FUNDING_EXHAUSTED` (the Bankr wallet is out of credit - **confirmed by a direct `402` from the *Funding preflight* (the primary gate) or a `402` on create**, so the account earns **$0** until recharged; on exhaustion the skill **pauses all offers (`DELETE`) and halts** - no selection, no creates, no reprice - and the next funded run's preflight auto-relists the top-`n`. A **failure outcome**: send the recap/funding alert at `--severity critical`, never green. Unhealthy offers *without* a confirmed 402 are a provider outage → `API_ERROR`, not this) · `COMPUTE_RESELL_OK` (clean run - includes the no-offers-yet/no-`BANKR_LLM_KEY` case, which just monitors). Log the code; notify only when it carries signal.

## Log

Append to `memory/logs/${today}.md` under `### compute-resell`, as bullets (health loop parses this shape):
- mode; **resolved config** (`max_discount=0.80 daily_budget=20 → n=5 (auto)` / `defaults (unset)`) so a set override is visibly in effect; **adaptive-discount move** when `discount_adaptive` is on (`adaptive-discount: 0.65→0.70 (loosen: under-selling, 1 winnable book)` / `0.65 held (selling, not saturated)`); **cap split** (even, e.g. `caps: $4.00 x 5 offers`); offers listed/repriced/delisted; price moves in $/1M vs market (e.g. `haiku-4.5 in $1.00→$0.98 (mkt $1.00, cost $0.60)`); **cap-bound price probes** on a sold-out offer (`opus-4.7 sold-out (cap 100% used) → probe up $4.22→$4.43`, or `probe overshot → settle $4.65→$4.43`); **book depth** (`239 offers → 126 live → 3 after filters`) and any **liquidity/untrusted exclusions** that changed `M` (`opus-4.7: dropped $2.25 newcomer (3 trades < 10) and $0.55 untrusted - M=$2.74`); **discount reached** per offer (`d_in 31% / d_out 31%`); Δearned_usdc / Δtokens; **daily recap** (`consumed $X / $<budget>, earned today $Y (yesterday $W), net $Z`) plus a `RECAP_SENT: ${today}` line when the recap was sent this run; **liquidity-dip grace holds** (`gemini-3.1-flash-lite low 1/2 - held`) and any resulting delist; **reaped offers** (`reaped 7 orphaned (key removed)` or `reaped claude-x (dead 2 runs)`); **discount-capped skips** when `max_discount` is set (`opus-4.7 mkt 92% > cap 80% - skipped`); **credit** (`bankr credits $703 ≈ 6.3d real @ $50×2.24 burn`) and any `low-credit` warning; **hysteresis holds** where a live offer was kept over a marginally-higher challenger (`kept gpt-5-mini: challenger haiku score 5.36 < 6.51×1.15 - held`); the create-before-delete order actually followed for any swap; any health incident **or `FUNDING_EXHAUSTED`** (provider 402 / wallet empty); exit code.

**Debug snapshot (append every run, all modes - for diagnosis).** After the main `### compute-resell` bullet above, always append this verbose block under a **sibling `### compute-resell - debug` heading** (mirroring the existing `### compute-resell - under the hood` block, so the health-loop parser that keys on the `### compute-resell` entry isn't disturbed) so a dead or silent run is fully inspectable after the fact (it is the trail that would have made the wallet-drain obvious mid-day). It goes to the **log only - never `./notify`** (don't spam channels with debug):
- **Credit:** the *Credit-balance read* line - `bankr credits: $<n> (via <url>) ≈ <runway> days @ $<daily_budget>×<burn_ratio> real burn (budget-days <n/budget>)`, or the derived `no endpoint - preflight=<funded|empty|not-probed>, est. consumed today $<X>/$<budget>`. Show **both** the real-burn runway and the raw budget-days so the gap is visible (`≈ 6.3d real (14.1 budget-days) - burn 2.24×`). On an empty wallet, state it plainly (`bankr credits: EMPTY - preflight 402 "Insufficient LLM Gateway credits"`). Flag `low-credit` here when the real-burn runway `< min_credit_days`.
- **Offers (every live offer from `GET /v1/seller/offers`, incl. unhealthy/inactive - those are what you're debugging):** one row each - `<offer_id> <model> price=$<in>/$<out>/1M discount=<d_in%>/<d_out%> cap=$<cap>/day healthy=<t/f> status=<active|inactive> market=$<M_in>/$<M_out>`.
- **Revenue per offer (from `GET /v1/seller/earnings` `by_model[]`, one row per model/offer):** `<model>: total $<earned_usdc> · today $<earned_today>/<reqs_today> reqs/<tokens_today> tok · Δsince-cursor $<delta>`. A `$0 today` beside a healthy `yesterday` is the funding-death signature - call it out here.
- **Pool:** `pool $<spent>/$<limit> used (day <UTC-date>)`.
This block is intentionally redundant with the summary lines; its job is a complete per-run state dump, not signal. Emit it even on a clean no-change run (that's the point - a baseline to diff against).

## Notify (compact daily TLDR once/day + signal lines when things changed)

> **Multi-provider aggregation.** A run processes one or more providers but sends **one** `./notify` for the whole run. Compose **one TLDR line per enabled provider** (prefix each with its tag - `[bankr]` / `[aws]` / `[vertex]`), stacked under a single title, and append any provider's signal/action lines below (also tagged). A single-provider run (var-targeted, or only one provider enabled) collapses to exactly the one-provider shape below - no tags needed. Mute-keys and the daily-recap `RECAP_SENT` marker are **provider-scoped**: use `compute-resell:<provider>:<...>` (e.g. `compute-resell:aws:funding`, `RECAP_SENT:aws:${today}`) so one provider's mute or recap never silences another's. The `More →` log link is shared (all providers write the same daily log, under the same `### compute-resell` heading).

**Exactly ONE `./notify` call per run - no exceptions.** Compose the whole operator message (every enabled provider's daily TLDR *and* any signal/action lines that apply this run) into a **single** string and send it with **one** `./notify` invocation. Do **not** send the TLDR and a signal as two messages, do **not** re-send a "corrected" version, and **never** fire a scratch/probe/test send (`x`, `ping`, a bare title) - those double-text the operator (a real message plus a stray duplicate). If nothing qualifies to send this run (TLDR already sent today + nothing changed), send **nothing**. The notify.sh dedup is only a backstop; the single-call rule is the contract.

Send via `./notify` (Markdown). **Keep the operator message SHORT - a few lines, not the full recap.** All the verbose detail (per-offer prices, cap splits, book depth, burn ratios, the price-doesn't-drive-volume analysis) goes to the **log** (`memory/logs/${today}.md`), which is the **`More →`** target - never paste it into the notify. The notify message is: one **status headline**, at most one **what-changed** line, an **Action** line *only* when an operator lever is genuinely needed, and a **`More →`** link. The daily TLDR ships once per calendar day; signal lines are added only when they apply. On a day with neither (TLDR already sent + nothing changed), send nothing.

**`More →` link.** Build a GitHub blob URL to today's log from the CI env: `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/blob/main/memory/logs/${today}.md` (append `#compute-resell` if the renderer keeps the heading anchor; omit the fragment if unsure). **Read the org/repo from `$GITHUB_REPOSITORY` - never hardcode or guess it.** A hardcoded org/repo once shipped a dead link (the repo is whatever `$GITHUB_REPOSITORY` says). The full recap + debug snapshot are already written there, so the link is the "read more" - the notify stays a glance. Omit the line only if the env vars are unset (local run).

**📊 Daily TLDR (the deliverable, once per day).** Send on the **first** run of the day; skip later same-day runs. Dedup: scan the last ~2 days of `memory/logs/` for a `RECAP_SENT: ${today}` marker under `### compute-resell` - if present, skip the TLDR (still send signal lines below); when you send it, write that marker under this run's log entry. **Shape - 3 to 5 lines, no tables, no per-offer breakdowns** (all of that lives in the log behind `More →`):

```
📊 Compute resell - <date> · <🟢 selling | 🟡 watch | 🔴 not selling>
Earned $<today> today · <n> offers @ ~<disc>% off · credits $<C> (~<D>d left)
<Action: ONE plain line, only when you must decide or act - see below>
More -> <blob URL to today's log>
```
The message answers exactly three operator questions - **what did I earn, how deep am I discounting, do I need to do anything.** Nothing else belongs in it; everything else is a link away.
- **Line 1 status:** 🟢 selling roughly as expected · 🟡 a watch item (near cap, book shift, displaced but still earning, revenue dropped) · 🔴 earned ≈ $0 on a healthy wallet (pricing/market outage) **or** funding-exhausted.
- **Line 2 = earned + discount + runway, one line, no jargon.** `<today>` = earned today; `<disc>` = the **cap-weighted discount off sticker across the live lineup** (the "how deep am I selling" number - round to a whole %); `<n>` = live offers; `$<C> (~<D>d left)` = credit balance + **real-burn** runway (`D = C / (daily_budget_usd × burn_ratio)`, the real drain, not budget-days). Only add a `(<±$X> vs yest)` tail when it carries the funding signal - a healthy yesterday next to $0 today (exhaustion signature); on a normal day drop it (no "Δ n/a, early day" noise). No request count, no per-model prices, no ratio table - log them.
- **No "what-changed" line in the message.** Per-model market microstructure (which rivals appeared/vanished, who re-set the market, per-offer cap boundaries) is **log-only, never notify** - it reads as a jargon wall and does not change what the operator does. The one exception is when the lineup change *is* the operator's takeaway (offers reaped, a model dropped) - say that in **plain language** on the Action line, not as a market post-mortem: `⚠️ all 3 offers reaped (a model saturated its cap); auto-relists next run - no action needed`.
- **Drop the Action line** unless an operator lever genuinely applies (below). A quiet, still-selling day is just the two headline lines + `More ->`.

Pass `--title "Compute resell - <date>"` and `--severity info` - bump to `warn` if credit deployed ≥ 90% of `daily_budget_usd`, or earned ≈ $0 on a healthy wallet, and to **`critical`** on `COMPUTE_RESELL_FUNDING_EXHAUSTED` (dead wallet → $0 all day: an outage, never a normal quiet day).

**Action line (line 4) - include ONLY when the operator must decide or act.** One line: name the lever + exactly how to set it, then stop. Do **not** re-argue the economics in the message (the reasoning is in the log). Cases:
- **Under-selling at the current cap** (the recurring one): the market clears deeper than `max_discount`, so most books are unwinnable and revenue is a trickle. **Bankr credit is free, so every won request is pure profit and this is revenue left on the table - never a loss.** The only tradeoff is volume vs USDC-per-token: a deeper discount wins more books but keeps fewer USDC per token. `⚠️ Decision: only <k>/<n> books winnable at max_discount:<d> - revenue ~$<x>/day. Go deeper (raise max_discount → more volume, fewer USDC/token) or hold (current). Reply to change.` Send **only when the winnable-book count or the daily revenue materially changed** - not every day, and never as a fresh wall of analysis. **Never frame a sale as a cost, burn, or negative edge** - with free credit there is no such thing.
- **Displaced, price won't win it back:** an uncapped cheaper seller took our routing and undercutting won't recover it. `🟡 New uncapped seller took <model> routing; price isn't the lever. Options: accept lumpy revenue · pause · repoint. Reply.`
- **Funding / low credit / pool** roll up here as one line each (details in the signal-line rules below): `🔴 Bankr wallet empty - fix: bankr llm credits add` · `🟡 credits $<C> ≈ <D>d left - top up soon` · `🟡 create-pool full ($<L>/$<L>) - resets UTC midnight`.

Otherwise send **no** Action line.

**Signal lines (one line each, added only when they changed - keep them terse; the log carries the detail):**
- **Listed / repriced / delisted:** which offers moved and why (`listed glm-5.2 @ $0.68/$2.19 (5% under market); delisted gpt-5-nano (fell out of top-n)`). Prefix with the provider tag on a multi-provider run.
- **Reaped:** dead or orphaned offers were auto-delisted - `reaped 7 orphaned offers (BANKR_LLM_KEY removed) - add a funded key to relist`, or `reaped claude-x (unhealthy 2 runs)`. `--severity info`; skip when nothing was reaped.
- **Health incident:** offer marked unhealthy / recovered (dedup via `health_incidents_seen`). `--severity warn`, `--mute-key "compute-resell:<provider>:<offer_id>"`.
- **Funding exhausted (confirmed 402):** the provider wallet is empty - **confirmed by the *Funding preflight* (a direct `402`) or a `402` on create**, never inferred from unhealthy flags. That provider has **paused all its offers and halted** (the others keep running); it earns $0 until recharged. `--severity critical`, `--mute-key "compute-resell:<provider>:funding"`. State the fix (recharge the wallet; the next run auto-relists). Re-send each day the wallet stays empty.
- **Provider outage (502 - NOT funding):** a `502 provider_probe_failed` **without** a `402`, or a `5xx`/timeout preflight - provider-side, not your wallet. Name the affected models; **never** recommend a top-up (a passing preflight proves credit is fine). `--severity warn`, `--mute-key "compute-resell:<provider>:outage"`.
- **Low credit (`min_credit_days`, bankr):** a real balance was read and the real-burn runway is under `min_credit_days` days - `low-credit: $703 left ≈ 6.3 days - top up before it drains`. `--severity warn`, `--mute-key "compute-resell:low-credit"`. The early warning before the funding-exhausted critical. Only send on first crossing.

## Network note

The public market reads (`/api/markets/*`, `/v1/prices`, `/v1/models`) need no auth - use plain `curl`/WebFetch. Authed seller calls and the provider key in the create body go through `./secretcurl` with `{SURPLUS_SELLER_KEY}` / `{BANKR_LLM_KEY}` placeholders - never raw `curl` with a `$SECRET` (the permission layer blocks that). Capture `-w '%{http_code}'`, print `http=<code>`, and degrade only on a real non-2xx / timeout / empty body. There is no network sandbox. The seller key is sent only to `api.surplusintelligence.ai`; the provider key is sent only to `api.surplusintelligence.ai` (which stores it encrypted to call your provider) - never anywhere else. Key **minting** happens locally via `bootstrap-siwe.mjs`, never in CI.

## Summary contract

End every run with a `## Summary`, **grouped per provider processed this run** (tag each block `[bankr]`/`[aws]`/`[vertex]`; a single-provider run needs no tag): mode, offers created/repriced/paused/delisted/reaped (note any liquidity-dip grace holds, hysteresis holds where a live offer was kept over a marginal challenger, and any orphan/dead-offer reaps), **daily recap (consumed / earned today vs yesterday / net vs budget)**, health incidents **or funding exhaustion**, files written (that provider's `memory/state/<...>.json`, `memory/topics/<...>.md`, `memory/<...>-earnings.csv`, plus the shared `memory/logs/${today}.md`), and any follow-up (e.g. "cost advantage eroding - raise `floor`"). Close with a one-line roll-up across providers (total earned today, providers selling / skipped).

---

## Provider adapters

The body above is the shared engine. This section holds the per-provider wiring the *Providers* table points to - read the row for each provider you run. All three create offers with the **same** call: `POST https://api.surplusintelligence.ai/v1/seller/offers` with a JSON body `{model, api_key, seller_base_url, price_input_per_1m, price_output_per_1m, cap_daily_usd, ...}`. Only `api_key` + `seller_base_url` (and the cost basis / denylist) differ by provider. The provider credential is sent **only** to `api.surplusintelligence.ai`, which stores it encrypted and calls the provider on your behalf; **never** put it on a command line - assemble the create body in `python3` from `os.environ` and pipe to `./secretcurl --data-binary @-`.

### bankr (Bankr LLM Gateway)

- **`RESELL_PROVIDER=bankr`.** Wallet `SURPLUS_SELLER_KEY`; config `COMPUTE_RESELL_CONFIG`; state `memory/state/compute-resell.json`; ledger `memory/compute-earnings.csv`; topic `memory/topics/compute-resell.md`.
- **Credential → `api_key`:** `BANKR_LLM_KEY` (`bk_...`). **`seller_base_url` = `https://llm.bankr.bot/v1`** (fixed).
- **Cost basis `C`:** the `bankr` entry in `GET /v1/prices` (this is the only provider whose cost basis is a live Surplus read). The `providerModelId` there is also what you serve (watch the provider-id divergence probe).
- **Preflight:** 1-token completion against `https://llm.bankr.bot/v1` with header **`X-API-Key: {BANKR_LLM_KEY}`** (NOT Bearer). `200` funded, `402` exhausted, `401`/`403` bad key. Full status ladder in *Funding preflight*.
- **denied:** auto-learned only; no hard denylist needed (Bankr serves whatever `/v1/prices` lists).
- **Economics:** free credit → undercut mode default. Bankr publishes no balance endpoint - the 1-token probe is the funding signal.

### aws (AWS Bedrock via OpenAI-compatible proxy)

- **`RESELL_PROVIDER=aws`.** Wallet `SURPLUS_SELLER_AWS_KEY`; config `AWS_COMPUTE_RESELL_CONFIG`; state `memory/state/aws-compute-resell.json`; ledger `memory/aws-compute-earnings.csv`; topic `memory/topics/aws-compute-resell.md`.
- **Credential → `api_key`:** `BEDROCK_API_KEY` (Bearer key for your proxy). **`seller_base_url` = the `BEDROCK_BASE_URL` repo variable** (e.g. `https://your-gateway.example.com/v1`) - it must expose OpenAI-style `/chat/completions`. `BEDROCK_BASE_URL` is a **non-secret repo variable**, so read it as a plain `os.environ['BEDROCK_BASE_URL']` (a bare `_URL` name is not a secretcurl placeholder). Bedrock's native SigV4 API is **not** OpenAI-compatible, so the proxy (AWS Bedrock Access Gateway / LiteLLM) is required and holds the real AWS creds - **never** put `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` in this skill.
- **Serve id:** config `model_map` maps Surplus market id → Bedrock `providerModelId` (e.g. `claude-opus-4.5` → `anthropic.claude-opus-4-5-v1:0`); unmapped models fall back to a one-probe test-list.
- **Cost basis `C`:** config `bedrock_prices` (only read in floor mode; free-credit default ignores it).
- **Preflight:** 1-token `/chat/completions` against `BEDROCK_BASE_URL` with **`Authorization: Bearer {BEDROCK_API_KEY}`**. `200` funded; a Bedrock `AccessDeniedException` on a specific model → add it to state `denied` and skip (auto-learned). No account credit-balance read - cost control is AWS Budgets + service quotas.
- **denied:** hard denylist in config `denied_models`, matched against **both** the Surplus market id and the mapped Bedrock id. Seed it with the models your AWS account has no Bedrock access to (`AccessDeniedException` on invoke) - the skill also auto-learns them. Example shape: `["anthropic.claude-opus-4-8", "openai.gpt-5.6-sol", "xai.grok-4.6"]`.

### vertex (Google Cloud Vertex AI)

- **`RESELL_PROVIDER=vertex`.** Wallet `SURPLUS_SELLER_VERTEX_KEY`; config `VERTEX_COMPUTE_RESELL_CONFIG`; state `memory/state/vertex-compute-resell.json`; ledger `memory/vertex-compute-earnings.csv`; topic `memory/topics/vertex-compute-resell.md`.
- **Credential → `api_key`:** the **whole service-account JSON string** from `VERTEX_SERVICE_ACCOUNT_JSON` (covers the full Vertex catalog - Gemini/Gemma plus partner models Grok/GLM/Kimi/Qwen/DeepSeek/gpt-oss where the project enables them). Alt credential: an `AIza…` key in `VERTEX_API_KEY` (Gemini-only) paired with `seller_base_url = https://generativelanguage.googleapis.com/v1beta/openai`.
- **`seller_base_url`:** built from repo vars **`VERTEX_PROJECT_ID`** + **`VERTEX_LOCATION`** → `https://{host}/v1/projects/{project}/locations/{location}/endpoints/openapi` (host `aiplatform.googleapis.com` for `global`, else `{location}-aiplatform.googleapis.com`). `VERTEX_LOCATION` defaults to `global`, but Claude/partner models are region-specific - a per-model `location` in config `model_map` overrides it for that offer.
- **Serve id / region:** config `model_map` maps market id → `{id, location}` (e.g. `claude-opus-4.5` → `{id: claude-opus-4-5@20250514, location: us-east5}`). Gemini serves from `global` (no entry needed).
- **Cost basis `C`:** config `vertex_prices` (floor mode only).
- **Preflight:** for the SA credential, exchange the JSON for a short-lived access token (Google OAuth2 SA JWT flow) and send a 1-token `/chat/completions` **`Authorization: Bearer <access-token>`** against the openapi endpoint; for the `AIza` key, use the generativelanguage endpoint with the key. `PERMISSION_DENIED`/`404`/`FAILED_PRECONDITION` on a model → project can't serve it: add to state `denied` (auto-learned). No account credit-balance read - cost control is Google Cloud Billing budgets + Vertex quotas.
- **denied:** hard denylist in config `denied_models` (Surplus market id or mapped Vertex id). Two classes are auto-learned: **Vertex-side** (`PERMISSION_DENIED`/`FAILED_PRECONDITION`/`NOT_FOUND` - not enabled in Model Garden; operator-fixable) and **Surplus-side** (`400 vertex_model_not_mapped` - Surplus's own market-id→Vertex mapping gap; parked in `mapping_watch` for a free auto-relift once Surplus maps it). Note: OpenAI models **do** serve as `openai/gpt-oss-120b-maas` / `-20b-maas` (the `-maas` suffix + `global` location matter) and `gemini-3.1-pro-preview` is a live earner - never deny those. Most projects need a one-time Model Garden EULA-accept for the Claude family + grok/deepseek/llama before they invoke.
