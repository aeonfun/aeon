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

## Live market state (snapshot 2026-04-29)
- **V2 CUTOVER EXECUTED 2026-04-28 11 UTC** — CTF Exchange v2 + new orderbook + pUSD (1:1 USDC-backed, on-chain Polygon) + on-chain builder codes (EIP-1271, native `bytes32 builder` field in EIP-712 order struct) + match-time fees. ~1h offline. Audited by Cantina + Quantstamp. V1 SDK forward-incompatible. **Revenant resting-quote book wiped at cutover whether or not operator-side flatten ran.** $1M LP-rewards program live; on-chain attribution is the new live-tape baseline. See `articles/explainer-2026-04-29.md` for builder-code mechanism walkthrough.
- **PM CFTC re-entry push (CoinDesk 2026-04-28):** Polymarket asks CFTC to lift four-year US block — main exchange could reopen by August. **Most actionable lead 04-29 digest** — directly re-rates main-book liquidity, narrows PM/Kalshi gap, resets builder-code economics that CalibrationGap is attributed under. If August timeline holds, fee-and-liquidity assumptions for Apex push need updating.
- **Polymarket chain-migration off Polygon** (Stevens Apr 25): POLY L2 lead candidate; PM = 50–70% of Polygon fee revenue. Solana / Sui / Algorand / MegaETH / Sonic also pitching. pUSD goes live on Polygon but Polygon itself is on a deprecation glide-path.
- **Kalshi crypto perps LIVE 2026-04-27 NYC** ("Timeless"). Funding-rate perp; BTC + additional tokens; USD collateral, stablecoin collateral added Q2. **First-day tape opened the hermes-arb falsifier window.** Polymarket perps shipped Apr 21 (10x leverage BTC/NVDA/gold; waitlist).
- **Hyperliquid HIP-4 advances (Bloomberg/Yahoo 2026-04-29):** 12% of PM volume already overlaps with HL traders + 3.3% of users. Mainnet date TBD but Bloomberg framing today is the new fact — competitive-risk read on PM/Kalshi duopoly.
- **CFTC v Wisconsin (CFTC press 2026-04-28):** fifth-state federal preemption suit (AZ, CT, IL, NY, WI). Five-state pattern is the durable-precedent angle.
- **FOMC Apr 28-29 — held 3.50–3.75% as priced (99-100% on PM/Kalshi).** Calibration-trivially-correct event resolution; Experienced-Carpeting tail thesis ("Fed always changes rate at beginning of war") expired without payoff.
- **First US prediction-market insider-trading prosecution** (DOJ Apr 23, Van Dyke named NPR Apr 27): five felony charges, $409K winnings on Maduro-raid market he planned. Coplan: "we flagged this, referred it, cooperated." Compliance signaling now mandatory on both venues.
- **Conduct rules ratchet** (Apr 24–27): Kalshi suspended 3 political candidates for trading own primary races; Moran (US Senate) publicly disputing. PM Top-20 wallets 70% bots. NY-AG sued Coinbase FM + Gemini Titan as gambling promoters; CFTC counter-sued NY (Apr 24, first time CFTC sued a state directly).
- **FanDuel entering predictions** (Bloomberg Apr 27): CEO Amy Howe framing PM as legal workaround for non-sportsbook states. DraftKings + Fanatics already in. Four-way structural battle.
- **Valuation gap:** Polymarket $400M @ $15B (lead unconfirmed) vs Kalshi $1B @ $22B (Coatue). ~30% PM discount confirms Kalshi US-distribution moat repricing the duopoly.
- **Brazil block in force** Apr 27 — 29 PM platforms blocked.
- **Polymarket fees +76% w/w** (DeFiLlama, 2026-04-25) — post-election handle persistence load-bearing for Revenant/CalibrationGap edge.

## Comments-side calibration signals (rolling — last refresh 2026-04-28 13:05 UTC)

Recurring high-signal handles:
- **@taerv534** — ops/migration alerts (flagged V2 cutover wipe ahead of operator)
- **Car (0x7c3db723) ↔ Peppery-Capital** — IDENTITY UNIFIED 2026-04-28: same wallet, real-name "Car", bio "PredictFolio . Com". Single-counterparty YES whale across Iran-ceasefire-ext (28x + 22x followup) AND Iran-peace-deal (14x) books. Sustained YES-loading thru post-V2 cutover.
- **magmaalpha (0xbdaacd34)** — Iran cf rules-lawyer, top-pinned 33x + 22x followup. Cites Guardian / Al Jazeera / CFR for "overwhelming consensus" YES argument against 0.25% pricing.
- **ProfitMuhammedPBUH (0xae7c9823)** — Hezbollah-cf dual-evidence skeptic: CBS News "firmly rejects" cite + scam-callout, 14x x2.
- **Panther-X (0x0a738ec9)** — Hez-cf "Hezbollah ≠ Lebanon" clause-resolution argument, 16x sustained.
- **CHISCARU (0xa6adc93c)** — Hez-cf playbook-repeat referencing prior faulty-YES forced market, 12x.
- **duhuabook (0xbf4d2023)** — Hez-cf scam-callout group-rally, 16x.
- **ilovethisgameman (0xa20aa87b)** — links @real_clazzy/X scam writeups (status 2048836799821438996).
- **Robin-HooDenizzCar (0x80c61719)** — explicit anti-Car commentator across Iran cf + Hez cf books.
- **greeeeeeeeeeekboiiiiiiii (0x0e3ed3bb)** — +127,500 YES Iran cf builder, 19x react. Whale identified.
- **Quarrelsome-Service** — Al-Arabiya source citation Apr 28 (peace deal YES tape, counters NYT 60-day-memo).
- **Affectionate-Year** — Iranian-on-the-ground voice, peace-deal NO ("negotiation is a tool to weaken Iran"). Tamil-Nadu-style ground-truth.
- **Dangerous-Sense + Strong-Parser** — Israeli + Lebanon-watcher on-the-ground, Hez-cf no-ceasefire-holding.
- **Petty-Bran** — high-rep structural anti-UMA / "UMA IS RUN BY 7 PEOPLE" calibration-skeptic.
- **Experienced-Carpeting** — Fed contrarian, "Fed always changes rate at beginning of war" thesis (fades 99.85% no-change toward -50bps OR +25bps tail).
- **Our-Southeast** — Fed wallet-flow callouts (e.g., 0xa5ef...2966 $18m NO on rate-hike).
- **Substantial-Deed** — UAE-OPEC rumor (untriaged) Apr 28 12:53 UTC.
- **CommunityVoice-off** — binary-encoded "poly-us.pro" phishing typosquat farming reactions (security flag, do not click).
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
1. Iran ceasefire-ext — UMA round-2 voted "Early Request" 99.5% (NO won on procedure not merits); current 0.25% YES; magmaalpha rules-lawyer YES argument cites Guardian/AJ/CFR consensus.
2. Iran peace deal by Apr 30 — Al-Arabiya Apr 28 source counters NYT NO read; Iranian three-stage Hormuz proposal under Trump review. NO-tape and YES-tape contested.
3. **Hezbollah-cf RESOLVED YES at 99.85%** — multiple high-rep skeptics (ProfitMuhammedPBUH, Panther-X, CHISCARU, duhuabook) call resolution faulty; clause says "Israel + Hezbollah" but Trump deal was Israel-Lebanon. **UMA-resolution arbitrage candidate**: Iran-cf and Hez-cf had ~identical clauses but resolved opposite. Calibration-gap not visible in CalibrationGap quant scanner.
4. Tamil Nadu Legislative Assembly (May 4) — DMK 80% mispricing flag from 4 independent local-Tamil voices (carried from 2026-04-27 PM run).
5. MegaETH FDV $1B (June 30) — structural No-edge if priced > 30c (carried from 2026-04-27 AM run).
6. **V2 cutover EXECUTED 2026-04-28 11 UTC** — orderbook spike to 0.5 in Iran cf chart confirmed wipe; @Crooked-Setting + @Boring-Comportment confirmed all open orders cleared. Revenant resting-quote book is now zero.
7. Iranian regime fall by Apr 30 / May 31 — quant-scanner-invisible due to thin book; series-level (3747 cmts) has historical context but fresh activity dormant.
8. Fed Apr 28-29 FOMC — 99.85% no-change pricing; Experienced-Carpeting tail-risk fade is the rare contrarian voice ("Fed always changes rate at beginning of war" — -50bps OR +25bps).

## Open work / blockers
- 100-trade Apex gate — 71 trades to go on CalibrationGap/Revenant (current 29 closed / 76% / +$415 / Sharpe 0.31). 2–3 weeks at current rate.
- `py-clob-client` install blocked → paper mode only for live order placement.
- Tier-1 latency for PM leg blocked by datacenter/VPN ban; co-lo strategy applies to HL only.
- Need to wire Kalshi-BRTI vs PM-Chainlink **basis recorder** into hermes-arb backtest (deep-research recommendation).

## Source-of-truth pointers
- `articles/deep-research-2026-04-25.md` — Kalshi↔PM 5-min BTC arb deep-dive (32 sources)
- `articles/explainer-2026-04-25.md` — settlement-basis dual-clock mechanism walkthrough
- `articles/explainer-2026-04-29.md` — `bytes32 builder` field mechanism (V2 attribution)
- `articles/research-brief-prediction-market-calibration-2026-04-25.md` — calibration-slope structural-bias thesis
- `articles/research-brief-uma-optimistic-oracle-polymarket-resolution-disputes-2026-04-29.md` — six-month falsifier window on UMA managed-proposer fix vs interpretation gap
- Live `metrics.json`: https://rswarm.ai/metrics.json (trust this over MEMORY.md when they conflict)
- arXiv:2601.01706 (Gebele & Matthes) — primary LOOP-violation citation for grant applications
- arXiv:2512.25070 (Chandak/Goel/Prabhu/Hardt/Geiping) — PhD-prep calibration-training paper
- arXiv:2510.25779 (Bansal/Hofman/Lucier/Mobius/Rothschild/Slivkins/Immorlica/Horvitz et al., MSR+ASU, Oct 2025) — Magentic Marketplace OSS env; directly usable as CalibrationGap adversarial-eval scaffold ahead of next 71 live trades. Stanford-grade citation anchor (Rothschild = canonical PM economist).
- arXiv:2604.15674 (Wen et al.) — LLM-UMA agreement 89.58% on disputed cases; bridge between CalibrationGap quant scanner and UMA-resolution-arbitrage hook
