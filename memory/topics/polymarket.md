# Polymarket — operational state

> Single source of truth for Polymarket-specific facts that surface across skills (CalibrationGap/Revenant edge, hermes-arb, polymarket-comments, monitor-polymarket, digest, deep-research). MEMORY.md links here.

## Account / attribution
- Polymarket proxy wallet: `0x0a10…52B1`
- Builder code (Revenant attribution): `0xcddc4ba3...8286f`
- Datacenter / VPN IP ban: Polymarket blocks GHA / co-lo IPs at the edge. Co-lo strategy applies to the **Hyperliquid leg only**; PM leg must run from residential / consumer egress.
- `py-clob-client` install blocked in current env — paper mode only for live order placement until resolved.

## Settlement mechanism (load-bearing for hermes-arb)
- **Polymarket BTC binaries:** single sub-second cryptographically signed Chainlink Data Streams read at window close.
- **Kalshi BTC binaries (CFB):** arithmetic mean of 60 one-per-second BRTI prints across the final minute (8-exchange basket; trim happens upstream in BRTI construction, not in Kalshi's settlement layer — earlier deep-research framing of "60s trimmed mean" is imprecise).
- Implication: on a volatile minute the **same UP/DOWN question can resolve oppositely** across venues. Gap is structural, not arbitrageable. See `articles/explainer-2026-04-25.md` for the dual-clock walkthrough.
- **Order signing latency:** Polymarket order signing is ~1s per order (NautilusTrader docs) — forces resting limits on PM leg, takes on Kalshi leg.

## Edge / decay numbers
- **LOOP violations** (Gebele & Matthes, arXiv:2601.01706, Jan 2026): persistent 2–4% cross-platform price gaps measured across ~100k aligned events 2018–2025 (10 venues). Frames residual gap as **structural friction (capital cost, fragmented liquidity, identity ambiguity), not information disagreement** — durable, not arb'd-away. Methodological contribution = semantic alignment over (NL description × resolution semantics × temporal scope). Paper does **not** zoom into 5-min / tick-level — that's open problem for hermes-arb.
- **Opportunity-duration decay** (vendor-source, T2/T3): 12.3s (2024) → 2.7s (early 2026). 73% of arb profit goes to sub-100ms bots. No T1 measurement of headline curve yet.
- **IMDEA Networks 2025**: $40M realized prediction-market arbitrage profits over 12 months across cross-platform binaries.
- **Hermes-arb ADR-038 gate:** 7pp min-gap = 2% PM taker + 5bps funding + 4.95pp buffer. Deep-research suggests gate likely understates noise floor by 50–100bp; bump to **~7.5–8pp** queued.
- **Sister-paper backlog:** arXiv:2508.03474 (probabilistic-forest arbitrage), 2511.20606 (LOB dynamics in matching markets — Kalshi CLOB tick structure), 2512.02436 (semantic trading, agentic alignment).

## Live market state (snapshot 2026-04-27)
- **🔴 V2 CUTOVER 2026-04-28 11 UTC** — Polymarket platform upgrade wipes ALL existing limit orders, no migration path disclosed. USDC.e → pUSD (own stablecoin on Polygon, per @0xPolygon Apr 27), builder codes go on-chain, ~1h offline window. Operator action: **flatten Revenant resting-quote book before 07 UTC Tue Apr 28**, or accept the wipe. First flagged by @taerv534 in polymarket-comments 02:17 UTC. Confirmed via help.polymarket.com primary doc.
- **Polymarket chain-migration off Polygon** (Stevens Apr 25): POLY L2 lead candidate; PM = 50–70% of Polygon fee revenue. Solana / Sui / Algorand / MegaETH / Sonic also pitching. Tension: pUSD goes live on Polygon Tuesday but Polygon itself is on a deprecation glide-path.
- **Kalshi crypto perps LIVE 2026-04-27 NYC** (codename "Timeless"). Funding-rate perp; BTC + additional tokens at launch; USD collateral, stablecoin collateral added Q2. **First-day tape opens the hermes-arb falsifier window now.** Polymarket perps shipped Apr 21 (up to 10x leverage on BTC, NVDA, gold; sign-up waitlist only). FRONT-RUN narrative confirmed in narrative-tracker.
- **Polymarket fees +76% w/w** (DeFiLlama, 2026-04-25) — confirms post-election handle persistence; high-volume binaries remain liquid → directly load-bearing for Revenant / CalibrationGap edge thesis. PM International fees +7.3% vs 7d-avg (PM defi-overview 2026-04-27) corroborates handle stickiness post-perps-launch.
- **First US prediction-market insider-trading prosecution** (DOJ, Apr 23): Special Forces Sgt. Van Dyke (named in NPR Apr 27) — five felony charges; won $409K betting on the Maduro raid he planned. Coplan public response: "we flagged this, referred it, cooperated throughout the process." Both venues now leaning hard into compliance signaling.
- **Conduct rules ratchet** (Apr 24–27): Kalshi suspended 3 political candidates for trading their own primary races (5-yr bans, $539–$6,229 fines); Mark Moran (US Senate candidate) publicly disputing — claims he was added to market *after* his run was public. PM Top-20 wallets are 70% bots (Finance Magnates / Coindesk). NY-AG sued Coinbase Financial Markets + Gemini Titan as gambling promoters; CFTC counter-sued NY (Apr 24, first time CFTC has sued a state directly).
- **FanDuel entering predictions** (Bloomberg Apr 27): CEO Amy Howe at Semafor framing PM as the legal workaround for non-sportsbook states. DraftKings (Dec) and Fanatics (10 states) already in. Four-way structural battle (Kalshi / Polymarket / FanDuel-Predicts / CME).
- **Valuation gap:** Polymarket $400M @ $15B (lead unconfirmed) vs Kalshi $1B @ $22B (Coatue). ~30% PM discount confirms Kalshi US-distribution moat is repricing the duopoly.
- **Brazil block in force** Apr 27 — 29 PM platforms blocked; announcement Apr 24, technically enforced today.

## Comments-side calibration signals (rolling — last refresh 2026-04-27 14:30 UTC)

Recurring high-signal handles:
- **@taerv534** — ops/migration alerts (flagged V2 cutover wipe ahead of operator)
- **@Car** — single-counterparty whale across both Iran-ceasefire and Hezbollah-ceasefire UMA disputes; +127.5K YES on Iran (also flagged Hezbollah position closure)
- **@anon (8x)** — meta-pattern caller: flagged Hezbollah-ceasefire-ext UMA dispute as "exact duplicate of [Iran ceasefire]"
- **@Clear-Corridor** — Hezbollah hostile-oracle takeover attempt, $36k YES
- **@b4k9xj2wh / @anoin123** — Kharg Island NO whales ($464k / $398k positions)
- **@Ignorant-Case / @ItsCrashBandicoot / @starbuck02** — geopolitical primary-source citations
- **@Valid-Bonding / @Beautiful-Interpreter** — NYT/Reuters / Iranian-official direct-quote diggers
- **@Tart-Recommendation** — whale-flow callouts on BTC books
- **@Dimpled-Planet / @0x6B025355 / @0xf4836B6A** — UMA-resolution playbook + dispute-rules analysts
- **@Glossy-Carpenter** — cross-market arb candidate flags
- **@DropsBot-Tracker** — wallet-bot whale flow ($565k No / $147k No on Iran ceasefire, etc.)
- **@Kii0nX / @Honeybees / @crypto-leo-das / @smartspec1** — Tamil Nadu ground-truth / counter — DMK 80% potentially mispriced (May 4 resolution)
- **@maxdawg / @bartdump / @jessik-mw** — MegaETH thesis stack (structural No-edge if priced > 30c)

Concrete tradable hooks (carry to CalibrationGap):
1. Iran ceasefire-ext — UMA two-sided uncertainty, downweight quant signal
2. Iran peace deal by Apr 30 — fade YES drift, NYT 60-day-memo + Ghalibaf = near-deterministic NO
3. Hezbollah-ceasefire-ext UMA vote ~02:00 UTC Apr 28 — replicates Iran-ceasefire playbook line-for-line; near-deterministic NO if YES drifts
4. Tamil Nadu Legislative Assembly (May 4) — DMK 80% mispricing flag from 4 independent local-Tamil voices
5. MegaETH FDV $1B (June 30) — structural No-edge if priced > 30c
6. **Apr 28 V2 platform upgrade — BLOCKING for Revenant resting orders**
7. Iranian regime fall by Apr 30 — book only $30.5k, 4 comments — quant-scanner-invisible due to thin book; Crypto Briefing strikes/blockade headlines escalating

## Open work / blockers
- 100-trade Apex gate — 71 trades to go on CalibrationGap/Revenant (current 29 closed / 76% / +$415 / Sharpe 0.31). 2–3 weeks at current rate.
- `py-clob-client` install blocked → paper mode only for live order placement.
- Tier-1 latency for PM leg blocked by datacenter/VPN ban; co-lo strategy applies to HL only.
- Need to wire Kalshi-BRTI vs PM-Chainlink **basis recorder** into hermes-arb backtest (deep-research recommendation).

## Source-of-truth pointers
- `articles/deep-research-2026-04-25.md` — Kalshi↔PM 5-min BTC arb deep-dive (32 sources)
- `articles/explainer-2026-04-25.md` — settlement-basis dual-clock mechanism walkthrough
- `articles/research-brief-prediction-market-calibration-2026-04-25.md` — calibration-slope structural-bias thesis
- Live `metrics.json`: https://rswarm.ai/metrics.json (trust this over MEMORY.md when they conflict)
- arXiv:2601.01706 (Gebele & Matthes) — primary LOOP-violation citation for grant applications
- arXiv:2512.25070 (Chandak, Goel, Prabhu, Hardt, Geiping) — PhD-prep calibration-training paper
