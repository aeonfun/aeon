---
name: Hermes family — fast-twitch cross-venue/latency-sensitive agents
description: 5-min BTC binary cluster (cross-venue arb, liquidation cascade, oracle front-run, funding spike, CEX fan-out) — template + factor-tuple genealogy approach
type: project
originSessionId: 3ca7274e-999b-461c-b163-3e469018f0a8
---
**Family name:** `hermes` — fits the Greek/archetype branding (Pathfinder, Mage, Archer, Shepherd, Alchemist). Greek messenger god → "speed + cross-venue."

**Variants:**
- `hermes-arb` — Kalshi ↔ Polymarket 5-min BTC mispricing arb (lowest model risk, primary)
- `hermes-cascade` — HL liquidation feed → 5-min PM "BTC down" (highest latency-sensitivity)
- `hermes-oracle` — Chainlink BTC/USD strike-cross front-run on PM 5-min markets (extreme latency)
- `hermes-funding` — HL funding-rate spike → directional 5-min PM (medium latency)
- `hermes-fan` — Coinbase/Binance/Kraken spot-spread divergence → vol direction (medium latency)

All inherit: WS data plane, sub-second fill budget, 5-min horizon, regime-conditional sizing per HMM state.

**Genealogy = template × factor-tuple × LLM backbone.** Don't write N files for N agents. One template per variant + `variants.yaml` enumerating 30–60 factor-tuples per variant + factory instantiation in `python/agents/factory.py`. Each tuple gets its own `agent_id`, `eval_log.jsonl`, `program.md`, lifecycle state. Birth → Canary → Apex → Revenant per ADR-045. This realizes the 250-agent swarm direction (`project_250_agent_swarm.md`).

**Factor space (10 dials per agent):**
1. `entry_threshold` (¢ or σ) — log-scale 1–10
2. `time_to_resolution_min` — 0.5–4
3. `regime_affinity` — subset of 5 HMM states (per backtest matrix)
4. `kelly_fraction` — 0.1, 0.25, 0.5
5. `max_fill_latency_ms` — 50, 200, 1000
6. `confidence_floor` — 0.55–0.85
7. `liquidity_floor_usd` — $500–$50k
8. `llm_backbone` — Claude / DeepSeek / Gemini / Llama (thesis only, not on_tick)
9. `stop_loss_pct` — 5–25% / off
10. `secondary_signal_weight` — 0–1

Sampling: Latin Hypercube over factor space, 30–60 agents per variant.

**Backtest unit of analysis = per-regime edge matrix (5 regimes × N variants), NOT pooled Sharpe.** Strategy fires only if current regime ∈ regime_affinity from backtest. Skip during HMM transitions or confidence < 0.7. See `feedback_latency_gated_on_edge.md` for why.

**Venue aggregation — confirmed Kalshi + PM only for now.**
- Kalshi: regulated US, asymmetric audience to PM crypto-natives → real 2–8¢ mispricings on identical BTC binaries. Free WS API. **Add first.**
- PredictIt: skip — $850/market cap kills Kelly; no real BTC market; CFTC-distressed.
- Drift Predict (Solana): maybe later if `hermes-arb` proves out.
- Manifold: play-money, sentiment signal only, not for arb.
- Crypto.com MCP: spot reference, not arb leg (already wired).

Wider dislocations exist on smaller venues but **smaller venues can't be filled within the latency budget** — the arb sweet spot is two deep, audience-asymmetric venues.

**PM low-latency origin (per `polymarket_datacenter_ban.md`):** Hetzner Dublin or OVH bare-metal, NOT AWS eu-west-1. Cloudflare bot-detection flags AWS ranges globally.

**Sequencing:**
1. Backtest `hermes-arb` (30d Kalshi+PM history) — produce per-regime edge matrix + edge-vs-latency curve. ~1 week.
2. If clears gate (>50 bps net per trade in ≥1 regime, edge curve drops >100 bps from 1s to 15-min latency): paper-trial 30 variants of `hermes-arb` at current 15-min cadence first.
3. If paper-trial earns: build Tier 1 WS-triggered scan + Hetzner Dublin co-lo for the PM leg + AWS Tokyo for HL leg.
4. Promote winners to Canary, mutate via Revenant loop.

**Not yet built:** Kalshi adapter, variant factory, edge-vs-latency Monte Carlo harness. All gated on (1) backtest result first.
