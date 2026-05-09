---
name: Manual tasks for Thomas
description: Actions only Thomas can do — wallet funding, external service setup, IC decisions, account creation
type: project
originSessionId: 17f9b3b9-2b16-48d3-b970-60b2e5e996e9
---
## DO NOW — Under 10 min, highest leverage (as of 2026-04-18)

| # | Task | Time | Unlocks |
|---|------|------|---------|
| ~~1~~ | ~~**HL Wallet Funding**~~ | ✅ DONE | $60 USDC deposited 2026-04-20 |
| ~~2~~ | ~~**Privy App**~~ | ✅ DONE | App ID `cmnxxzffu00hu0cik4qfuwbly`, Vercel set |
| 3 | **Expert Network** (GLG/AlphaSights/Guidepoint/Third Bridge) | 30 min | Cash in 14 days |
| 4 | **Anthropic + AWS credits** (both apps written) | 30 min ea | $20-75K compute |
| 5 | **Multi-LLM API keys for cross-family agent backbones** (see below) | 20 min | Unblocks Pathfinder/Mage/Archer live scans + cross-LLM judge panel |

---

## Multi-LLM agent backbone — API keys required (added 2026-04-20)

The strategy registry (`python/agents/strategy_registry.py`) assigns each agent a different foundation-model family so the cross-LLM judge panel breaks calibration-bias correlation. Per-agent backbones and the API keys to provision:

| Agent | Backbone family | Action | `.env` key |
|---|---|---|---|
| calibration-gap | Claude Opus 4.5 (Anthropic) | ✅ already set | `ANTHROPIC_API_KEY` |
| funding-rate | GPT-5 (OpenAI) | Create key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | `OPENAI_API_KEY` |
| pathfinder | Gemini 2.0 (Google) | Create key at [aistudio.google.com](https://aistudio.google.com/app/apikey) | `GEMINI_API_KEY` |
| mage | Llama 3.3 70B (Together) | Create key at [api.together.xyz/settings/api-keys](https://api.together.xyz/settings/api-keys) | `TOGETHER_API_KEY` |
| archer | DeepSeek V3 (DeepSeek direct OR via Together) | Create key at [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) | `DEEPSEEK_API_KEY` |

**Cross-family judge panel logic**: each weekly rating cycle, each agent's `program.md` + `eval_log.jsonl` is graded by the other four families. That means all five keys need to be present for the full panel to run — missing keys cause that rater's column to be dropped with a warning, not crash.

**HuggingFace model picks** (for open-source tier experimentation, not required for the immediate judge panel): [huggingface.co/spaces/lmarena/chatbot-arena-leaderboard](https://huggingface.co/spaces/lmarena/chatbot-arena-leaderboard) is the live ranking. For Mage's Llama backbone, use `meta-llama/Llama-3.3-70B-Instruct` via Together (no HF self-host needed); if experimenting with alternatives, Qwen2.5-72B-Instruct and DeepSeek-V3 are the top open competitors.

**Budget guidance**: at expected rating volume (~5 agents × ~50 rating rounds/month × ~3k tokens each = 750k tokens/month/family), costs are:
- Anthropic Claude Opus: ~$11/month
- OpenAI GPT-5: ~$9/month (estimate)
- Gemini 2.0: ~$3/month
- Together Llama 3.3 70B: ~$1/month
- DeepSeek V3: ~$0.50/month
Total: ~$25/month for the full judge panel. Anthropic + AWS credits should cover bulk-classification usage on top of this.

---

## PRIORITY 1 — Do Today (5-10 min each)

### Provision ClickHouse Cloud (BLOCKING Becker v1 migration + long-term data sink)
1. Go to [clickhouse.cloud](https://clickhouse.cloud), sign in with AWS SSO if possible (credits stack).
2. Create service: **region us-east-1** (free AWS egress to CH, matches AWS credit strategy), tier **Development** or **Production** (both Starter; Dev is cheaper, can upgrade later).
3. Once provisioned: Settings → Connect → copy the HTTPS endpoint (`<uid>.us-east-1.aws.clickhouse.cloud:8443`) and default password.
4. Apply schema from a local terminal:
   ```bash
   cat infra/init-clickhouse.sql | clickhouse-client \
     --host <endpoint> --port 8443 --secure \
     --user default --password <pwd>
   ```
   (Install `clickhouse-client` via `brew install --cask clickhouse` if needed.)
5. Add to `.env`:
   ```
   CLICKHOUSE_HOST=<uid>.us-east-1.aws.clickhouse.cloud
   CLICKHOUSE_PORT=8443
   CLICKHOUSE_SECURE=1
   CLICKHOUSE_USER=default
   CLICKHOUSE_PASSWORD=<from-console>
   CLICKHOUSE_DATABASE=swarm
   ```
6. Smoke test: `.venv/bin/python -m scripts.becker_v1_to_clickhouse --max-rows 10000` (should finish in <30s; verify rows landed via CH Cloud console SQL tab).

**Why:** Long-term data sink for Becker v1 (302M rows) + live Revenant indexer. LowCardinality columnar compression gives 10–20× at 1B+ rows; sub-second analytical queries; native Parquet/S3 integration for HF publishing. Runbook: `docs/becker_v1_migration.md`.

### Run Becker v1 Full Load (after CH Cloud is live)
1. From an EC2 `m6i.large` in us-east-1 (zero egress cost, same region as CH Cloud):
   ```bash
   git clone https://github.com/tomscaria/swarm-fund-mvp
   # Mount or rsync the tools/prediction-market-analysis-main/data/ dir (~45GB)
   .venv/bin/python -m scripts.becker_v1_to_clickhouse 2>&1 | tee data/becker_v1_load.log
   ```
2. Expected: 3–6 hours, 302M rows. Resumable via `--resume`.
3. Verify with the queries in `docs/becker_v1_migration.md` step 6.

**Why:** Running from your laptop = slow upload + WAN reliability issues. EC2 in us-east-1 pegs 1Gbps to CH Cloud.

### Flip Live Pipeline to Dual-Write (after Becker v1 is loaded)
1. On the box running the trading loop, set `export SINK_BACKEND=both` in the service env.
2. Restart `python -m pipeline.run_all`.
3. Tail logs: `grep clickhouse_writer /tmp/swarm-main.log`.
4. After 30 days of stable dual-write: `export SINK_BACKEND=clickhouse_cloud` and decommission local QuestDB.

**Why:** Live trades now land in both QuestDB (local dev) and CH Cloud (prod durable). Zero downtime cutover.

### ~~HL Wallet Funding~~ ✅ DONE (2026-04-20)
- $60 USDC deposited from Arbitrum → Hyperliquid
- Address: `0x83F4c49cF459cAbEDE08228FC471Ab89D0B189e3`
- Loop will now place real $50 canary orders on next signal

### ~~Create Privy App for Swarm Lab~~ ✅ DONE (2026-04-19)
- App ID: `cmnxxzffu00hu0cik4qfuwbly`
- `VITE_PRIVY_APP_ID` set in `.env` and Vercel production (encrypted, 2026-04-13)

## PRIORITY 2 — This Week (30-60 min each)

### Expert Network Registration (M1 — cash in 14 days)
1. Bio is ready at `outputs/expert_network_bio.md` — review, edit voice if needed
2. Register at: GLG, AlphaSights, Guidepoint, Third Bridge
3. Paste bio into each profile. Add: CFA, Series 7/31/66, crypto infrastructure, RWA tokenization
4. Set hourly rate: $500-1000/hr (standard for CFA + Series 7 + crypto operator combo)

### Submit AWS Research Credits (M8 — $10-25K compute)
1. Application ready at `outputs/aws_research_credits_application.md`
2. Go to [aws.amazon.com/research-credits](https://aws.amazon.com/research-credits/)
3. Copy-paste application, adjust formatting to their form
4. Attach: Thomas bio, Swarm Lab description

### Get Gemini API Key (BLOCKING brand asset generation)
1. Go to [ai.google.dev](https://ai.google.dev/) or [console.cloud.google.com](https://console.cloud.google.com/)
2. Create API key for Gemini
3. Add to `.env`: `GEMINI_API_KEY=AIza...`
4. Use `compound-engineering:gemini-imagegen` skill to generate branded visuals

**Why:** Recraft V4 and Gemini are the best models for brand-consistent image generation. Gemini is free tier available. Needed for social cards, agent icons, marketing assets.

### Submit Anthropic Research Credits (M7 — $10-50K API credits)
1. Application ready at `outputs/anthropic_research_credits_application.md`
2. Apply at Anthropic research access page
3. Frame: alignment research, mesa-optimization, real-capital adversarial environment

### Send Advisory Outreach (M3 — retainer pipeline)
1. Templates ready at `outputs/advisory_outreach_templates.md`
2. Pick 5-10 targets from Polychain portfolio, Wyre network, protocol founders
3. Personalize each template with [bracketed] fields
4. Send from thomas@lore.xyz

## PRIORITY 3 — This Month

### Deploy Swarm Lab Site
1. Review site at `swarm-lab-site/` (run `cd swarm-lab-site && npm run dev`)
2. Deploy: `cd swarm-lab-site && npx vercel --prod`
3. Set custom domain: swarmlab.xyz (purchase if needed)
4. Set env var: `VITE_PRIVY_APP_ID` in Vercel dashboard

### Submit dYdX Grant (M5 — $10-30K USDC)
1. Application ready at `outputs/dydx_grant_application.md`
2. Submit at [dydxgrants.com](https://dydxgrants.com)
3. Wait for M4 (research note) to be published first for credibility

### Submit Uniswap Fellowship (M6 — $10-25K)
1. Application ready at `outputs/uniswap_fellowship_application.md`
2. Submit at Uniswap Foundation TLDR Fellowship page

### Publish Research Note (M4)
1. Review at `outputs/research_note_01_calibration_gap.md`
2. Post to Substack or personal blog
3. Share on Twitter/X from @swarmlab_ handle

### IC Decisions (ongoing)
- Review `/promote` gate status via Telegram
- `/confirm_promote` when 60-trade gate is hit
- Review autoresearch scorecards at `autoresearch/reports/` (when available)
