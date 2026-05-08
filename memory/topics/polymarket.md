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

## Live market state (snapshot 2026-05-08)
- **Iran-airspace-by-May-8 RESOLUTION DAY.** Intraday volatile: ladder repriced 4% → 12.5% YES on AM kinetic-news re-assertion (US strikes on Iranian targets confirmed; oil >$100/bbl; $87.91M long liquidations 24h), then faded back to **2.05% YES at T-0** with $916k v24. Market closed pricing the NO direction despite peak kinetic intensity — same ceasefire-frame discipline that held 05-06 fade. Final disposition midnight ET. **48pp clause-text divergence vs sister "major closure" market (~52% YES) holds intact** — anchor for ADR-096+ resolution-text-ingest survives the resolution.
- **Hantavirus pandemic 2026 — NEW MARKET 2026-05-08** at 9.65% YES / $2.12M v24 / 9.6% (event 448037). First appearance in polymarket-comments today. Resolution clause divergence (Andes-virus close-contact transmission vs airborne) flagged as **second concrete ADR-096+ candidate** alongside Iran-airspace; sante.gouv.fr is the gold-standard resolution cite.
- **Peace-deal cluster repriced sharply:** US-Iran peace-by-May-15 dropped 25.8% → 20.3% (-5.5pp); May-31 40.5% → 34.5% (-6pp); June-30 priced ~52.5% (most uncertain). All three CalibrationGap-adjacent.
- **Tape: F&G dropped 47 → 38 (Fear, first since May 1).** BTC $80,040 (-1.3% 24h, ~+4.9% 7d); breadth 4/20 green; ~16/20 green 7d. Ethereum chain TVL -2.1% second consecutive drawdown. STRK +29.74% trending #1 (ZK L2/AI breakout); ONDO +7.57% (RWA narrative); privacy/TON cooling for second consecutive day.
- **USD1 (World Liberty Financial) entered top-5 stablecoins at $4.48B**, first appearance above USDS+DAI in supply ranking — Trump-linked institutional-tier issuer.

## Live market state (snapshot 2026-05-07)
- **Powell→Warsh Fed transition.** Polymarket "Kevin Warsh confirmed by May 15" 96% (effectively resolved at 100% on $49.5M cumulative volume since March 4 launch). **Senate Banking Committee 13-11 (party-line) 04-29; full Senate floor week of May 11; Powell's term ends May 15.** Markets pricing as continuity; Warsh's stated platform is regime change: kill forward guidance, retire dot plot, accelerate QT, strict 2% inflation target. **First observable falsifier:** June 17-18 FOMC statement keeps forward-guidance language verbatim ⇒ continuity won; meaningful change ⇒ regime change. Cite stack: Bernanke-Kuttner NBER w10402 (event-study foundation), Cleveland Fed EC-202401 (chair testimony 15-min window). Comments-side leverage opens around floor vote.
- Tillis flipped no→yes after DOJ dropped Powell criminal investigation; Fetterman (D-PA) yes; floor margin wider than 13-11 committee margin. Powell remains on Board of Governors after stepping down — first sitting-and-former-chair pairing in ~80 years.

## Live market state (snapshot 2026-05-06)
- **Iran-airspace-by-May-8 (4% YES, T-2)** — CRASHED 11.5pp from 15.5% YES yesterday on the day **kinetic intensity peaked since April-8 truce** (Iran fired on US Navy, US destroyed 7 Iranian boats, Tehran struck UAE Fujairah, S Korean freighter damaged, 5 Iranian civilians dead on Iranian passenger boat hit by US fire). Hegseth: "ceasefire is not over … separate and distinct project." Market priced the frame, not the kinetic tape. Iran-airspace ladder $7.5M total / May-8 slot $5.6M (75% of ladder). **Most-traded slot in the ladder collapsed on the day every Hormuz headline ran in the opposite direction.**
- **Trump-China-by-May-31 (92.5% YES) — multi-handle NO cluster FALSIFIED by Iran-airspace move 05-06.** Same Threadbare-Signal / Glamorous-Eagle / Partial-Intestine cluster that pointed at Iran-airspace tail-risk just got steamrolled. **Stand down on planned NO entry** until clause-text ingest lands or kinetic tape actually breaks ceasefire. Lesson: comment-cluster's predictive value on geopolitical-spillover markets is weak when ceasefire-frame holds.
- **48pp Iran-airspace clause-text divergence still live** — same Polymarket "major closure" market sits at 52% YES ($3.7M) on the same five-airport resolution clause (IKA/THR/MHD/SYZ/IFN). Direct surface the planned **ADR-096+ resolution-text-ingest** is built to capture; **single highest-leverage CalibrationGap upgrade** — no ADR slot opened yet (ADR-095 was re-allocated to OLLAMA_FULL routing 05-06).
- **Iran-cluster top-volume markets (05-06 market-context refresh):** US-invade-Iran-2027 19.5% YES $3.20M v24; US-Iran-peace-May-31 26.0% YES $1.78M; Hormuz-normal-May 30.5% YES $1.27M; US-Iran-peace-June-30 47.0% YES $0.80M. Combined $6.25M = dominant theme.
- **Hormuz-end-of-June NO position re-eval continues** — May 2 entry 54.5c. With Hormuz-normal-May at 30.5% YES today, end-of-June priced NO has structural pressure from Trump Truth Social ("STRAIT OF HORMUZ COMPLETELY OPEN") + Hegseth ceasefire-frame. Headline-risk binary.

## Live market state (snapshot 2026-05-05)
- **Trump-visit-China-by-May-31 (92.5% YES, $230k v24) — multi-handle structural NO-calibration cluster vs priced consensus.** Glamorous-Eagle absence-of-evidence (Chinese state media still negative-coverage, no public-opinion build-up) + Partial-Intestine C-17 anomaly + Threadbare-Signal Iran-kinetic-spillover. Potential CalibrationGap NO entry candidate; surface to monitor-polymarket for next-slot price-move detection. Sized for entry if still 92%+ at T-7. **FALSIFIED 05-06 — see snapshot above.**
- **US-iranian-uranium-by-May-31 (8.5% YES, $196k v24) — fresh UMA-resolution-arb candidate.** 4-handle bluff cluster across 4 weeks (Grown-Songbird → Somber-Interviewer → Energetic-Folder → Naughty-Completion) all repeat: "Trump-Truth-Social-claim → resolves YES." Direct sister to Iran-cf/Hez-cf paradox. Pull resolution text into clause-text scanner once that upgrade lands.
- **Iran-airspace-by-May-8 (15.5% YES, $2.58M v24, T-3) — narrative-shift watch.** Verifiable-Romance NEW citation chain "Araqchi-in-China + Trump-arriving + China-mediation = ceasefire imminent" links 3 markets into single live-tape narrative. If China-mediation confirmed by WebSearch on Iranian FM activity 05-05, 15.5% YES likely fades toward <8% by T-1. If kinetic-strike narrative dominates instead (Hegseth/Caine + CNN Israel-US strikes), 15.5% spikes toward 25-30%.
- **Strike-market suppression confirmed durable** across 2 days + 3 independent thread-pin'd cites (Fantastic-Refrigerator 14x + Canine-Practice 6x + Attentive-Algebra 23x). Sister to 05-03 strike-market-suppression finding. Structural CalibrationGap-binary-universe-shrinkage; track which markets get suppressed vs reopened as a CFTC compliance signal.
- **Crypto comment-vertical DEAD 4th consecutive day** (BTC-150k $5.82M v24): +855 96 982 9883 Cambodia phone-number scam recurring across 4 days; birthday-spam (Abandoned-Tadpole multi-day) + scam-callout-by-confusion is the only signal pattern. Var=crypto in future polymarket-comments runs should default-substitute with politics market unless non-spam crypto signal materializes.
- **High-volume ≠ comment-activity** finding: 3 of 5 first-pass top-volume picks returned dead threads (US-invade-Iran-2027 / Iranian-regime-fall-May-31 / RU-UA-cf-May-31 / Hormuz-by-May-15 / Hormuz-by-end-May). Comment volume gates correctly on **near-resolution OR multi-event-linked-narrative** markets, not on raw $-volume. Surface to skill prompt for future runs.

## Live market state (snapshot 2026-05-04 — counting day)
- **Tamil Nadu RESOLVED — TVK closed 99.65% YES** ($22.66M traded). Reality: TVK 110 / AIADMK 59 / DMK 48; Stalin lost Kolathur by 7,731 votes to a TVK first-time candidate. **MEMORY's prior "TVK 4-6c-fair" thesis is FALSIFIED.** Quant-blind-spot lesson — single-venue confidence + Dravidian-duopoly continuity prior is exactly the surface CalibrationGap is structurally blind to. Source-class lesson: pseudonymous-on-PM ground intel (orangexyz door-to-door Vijay survey + KairosHunter TMC→BJP whale flip) is a class the quant scanner cannot ingest.
- **West Bengal RESOLVED — BJP 51% T-1 → 99.55% YES at close.** Validated by 92.47%-turnout BJP-200+ blockbuster. Two-venue convergence (Polymarket + Phalodi) tracked observable phase-by-phase turnout — late flip held because both venues priced the same evidence. **"Watch the flip not the level" thesis CONFIRMED.** Cross-venue convergence works only when both venues price the same evidence; when both share a continuity prior (TN's Dravidian duopoly), agreement is shared blind spot, not signal.
- **Hormuz blockade-lift live-tape (05-04)** — arsenelupin (NEW) + compute (3rd day, archetype CONFIRMED) + Hossein-m citing Trump Truth Social ("STRAIT OF HORMUZ COMPLETELY OPEN…"). Castwolffox + tilda89 counter-cite Rubio. **MEMORY's 54.5c NO Hormuz-end-of-June position at risk** — re-evaluate before next CalibrationGap entry; headline-risk binary, grand-bargain peace deal collapses fair to 30%+ on a single Trump tweet.
- **Crypto comment-vertical dead 3rd consecutive day** — pin as structural finding for polymarket-comments routing.
- **monitor-polymarket 05-08:** No >5pp movers. Mexico FIFA YES 1.05% flat (5th consecutive flat day, $662k vol, $2.4M liq, Revenant first order). BTC/GTA VI YES 49.25% (+0.10pp, $2.7k vol) — **NO-edge EVAPORATED: resolution-ambiguity confirmed in live comments today (Vague-Kangaroo + Stiff-Secretariat confirm GTA VI won't release before July 31 → 50-50 fallback priced in at 49.25%).** Vance R-nom YES 37.55% (was 39.15% on 05-03, -1.6pp 5-day). VOLUME SPIKES: Rand Paul R-nom $415k on 0.95% YES (NO accumulation, no comment catalyst); Oprah D-nom $342k on 0.75% YES (+1pp, YES buying, no comment catalyst).
- **monitor-polymarket 05-03 quiet:** No >5pp movers. Mexico FIFA YES 1.05% flat, $108k 24h vol. BTC $1M before GTA VI YES 49.0%, $3.6k 24h vol. J.D. Vance 2028 R-nom YES 39.15%. Ossoff 2028 D-nom YES 6.45%. BTC/GTA VI 49% YES with BTC ~$97k needs 10x in 89d — potential NO edge (resolution ambiguity risk if GTA VI delays past Jul 31).
- **monitor-kalshi 05-03:** KXBTC daily binaries dominate. Hermes-arb falsifier-window still live.
- **AI-Agent-Personhood (Manfred Macx / ClawBank)** — CoinDesk Tier-1 mainstream pickup 05-03. First-of-kind precedent invites KYA/AML clampdown. FinCEN AML/CFT comment period closes 06-09.

## Live market state (snapshot 2026-05-02)
- **Senate unanimous self-ban EFFECTIVE 2026-04-30** — Moreno (R-OH) wrote, Padilla (D-CA) amended to include staff. Schumer: "no-brainer." Same day CFTC ANPRM closed. Both Kalshi and Polymarket public-cheered the framing as legitimization. See `articles/2026-05-01.md` and `articles/research-brief-polymarket-regulatory-front-2026-2026-05-01.md` (thesis: by Dec 31 2026 CFTC issues NOPR excluding ≥1 of sports/elections/war-death from public-interest presumption).
- **Russia-Ukraine ceasefire (Updated 05-02)** — Putin/Trump 04-29 90-min call; Ushakov briefing says ceasefire "for the duration of Victory Day celebrations." Peskov clarifies: applies *only* to May 9, unilateral, no Kyiv response needed. Zelensky 04-30: "long-term ceasefire, reliable and guaranteed security" + "we need to understand exactly what is being proposed." May-31 priced 6% YES ($1.8M); June-30 11.5%; EoY-2026 25.5%. Resolution rule explicitly excludes unilateral/humanitarian/non-general pauses by name — what's offered fails 3 of 4 criteria. **No binary edge; comments-side leverage opens 05-08 to 05-10 around resolution-debate spike.** Article 2026-05-02 ("Putin's Victory Day Truce Can't Resolve the Polymarket") lands the explicit "ingest resolution text not titles" lesson for CalibrationGap.
- **Trump end-mil-ops-Iran (RESOLVED 2026-05-01)** — War Powers Act T+60 from Feb 28; "hostilities have terminated." YES paid at 36% entry. Putrid-Campaign "pause not end" vs Proud-Compulsion's NO-holder honest-loser admission validated as track-record handles for clause-resolution arbs.
- **MegaETH FDV TGE (RESOLVED 2026-05-01)** — >$1B & >$1.5B → YES (1.0); >$2B → NO. Memory's >$1.5B 67.5% was directionally correct; pre-market $2B+ overstated. ArmageddonRewardsBilly insider thesis (NO on >$2B) confirmed paid.
- **Tamil Nadu T-2 (May 4 resolution; today is 05-02)** — TVK cooled 8.25c → 6.95c (residual edge cooling but still under 4-6c-fair); DMK 87.5%; ADMK 6.65%. Crafty-Kiss FLIPPED — once-TVK-bull (held from 5c) now says "DMK only +EV bet ngl." Re-run polymarket-comments + reply-maker on T-1 (May 3) and resolution morning (May 4).
- **Hyperliquid HIP-4 mainnet ACTIVATED 2026-05-01** — first live market BTC>78,213 on 2026-05-03 11:30 AM (zero-fee open / settle-only / oracle-based). Promotes HL HIP-4 narrative Rising → Peak. PM market "go live by [tighter earlier deadline]" resolved NO ($27K vol) — but mainnet activation real. 12% PM vol overlap with HL traders + 3.3% users (Bloomberg 04-29).
- **Roundhill PM ETFs T-3 to 2026-05-05 launch** — BLUP/REDP/BLUS/REDS/BLUH/REDH; RPM Dem/GOP Pres targeting 2028, Senate/House targeting Nov 2026 midterms; CFTC-swap mechanism via Kalshi.
- **monitor-polymarket 05-03 quiet:** No >5pp movers. Mexico FIFA YES 1.05% flat, $108k 24h vol (up from $78.5k 05-02). BTC $1M before GTA VI YES 49.0% (+0.15pp), $3.6k 24h vol, 7d ratio 0.74x (up from 0.27x). J.D. Vance 2028 R-nom YES 39.15% — clear frontrunner. Ossoff 2028 D-nom YES 6.45% (-0.05pp). BTC/GTA VI at 49% YES with BTC ~$97k needs 10x in 89d — potential NO edge (resolution ambiguity risk if GTA VI delays past Jul 31; rule-read required before entry).
- **monitor-polymarket 05-02 quiet (archived):** No >5pp movers. Bitcoin $1M before GTA VI: YES 48.85%, vol drought 0.27x 7d-avg. GTA VI event top comment "SCAM market — READ THE RULES" (12 rxn, Downright-Juice) → resolution-criteria ambiguity live. Revenant first order (Mexico YES 1.05%) flat all 24h on $78.5K vol.
- **monitor-kalshi 05-02:** KXBTC daily binaries dominate (all other open events <$200/d 24h vol). Today's 5pm EDT close: combined $78k-$78.5k zone at ~48% implied prob. ALERT: B78125 ($78k-$78.25k) +8pp move (12%→20%) on loose 4pp book, $1.1k vol. Hermes-arb falsifier window day-4 still live.

## Live market state (snapshot 2026-04-30)
- **V2 CUTOVER EXECUTED 2026-04-28 11 UTC** — CTF Exchange v2 + new orderbook + pUSD (1:1 USDC-backed, on-chain Polygon) + on-chain builder codes (EIP-1271, native `bytes32 builder` field in EIP-712 order struct) + match-time fees. ~1h offline. Audited by Cantina + Quantstamp. V1 SDK forward-incompatible. **Revenant resting-quote book wiped at cutover whether or not operator-side flatten ran.** $1M LP-rewards program live; on-chain attribution is the new live-tape baseline. See `articles/explainer-2026-04-29.md` for builder-code mechanism walkthrough.
- **V2 TVL hits $514M two days in** (CryptoTimes 04-30): $514.19M TVL, 14,146 24h actives, 291,365 transactions, $513.77M OI, $4.49B 30d DEX vol. Material new fact answering "did orderbooks rebuild cleanly?" — yes. Resets `polymarket-comments` baseline for engagement scoring.
- **CFTC ANPRM comment window closed 2026-04-30** — Warren/Merkley + 40 lawmakers filed aggressive letter explicitly naming election/war/sports/government-action prohibitions; ~800 comments on file. CalibrationGap's universe of binary markets is shaped by what categories the eventual rule prohibits. Tailored CFTC rule could land Q3 2026. Track Polymarket/Kalshi own filings.
- **Brazil bans 27 prediction-market platforms** (Resolution CMN 5.298, effective 2026-05-04). Polymarket + Kalshi included. Finance Minister Dario Durigan cites investor protection. "Event-based contracts effectively mirror gambling" framing other state regulators (MA, WA) likely to cite next.
- **PM CFTC re-entry push (CoinDesk 2026-04-28):** Polymarket asks CFTC to lift four-year US block — main exchange could reopen by August. Directly re-rates main-book liquidity, narrows PM/Kalshi gap, resets builder-code economics that CalibrationGap is attributed under. If August timeline holds, fee-and-liquidity assumptions for Apex push need updating.
- **Polymarket chain-migration off Polygon** (Stevens Apr 25): POLY L2 lead candidate; PM = 50–70% of Polygon fee revenue. Solana / Sui / Algorand / MegaETH / Sonic also pitching. pUSD goes live on Polygon but Polygon itself is on a deprecation glide-path.
- **Kalshi crypto perps LIVE 2026-04-27 NYC** ("Timeless"). Funding-rate perp; BTC + additional tokens; USD collateral, stablecoin collateral added Q2. **First-day tape opened the hermes-arb falsifier window.** Polymarket perps shipped Apr 21 (10x leverage BTC/NVDA/gold; waitlist).
- **Hyperliquid HIP-4 advances (Bloomberg/Yahoo 2026-04-29):** 12% of PM volume already overlaps with HL traders + 3.3% of users. Apr 29 fee structure published (zero-fee open, settle-only); two-phase mainnet (curated canonical first, then permissionless builder); no mainnet date. **HL HIP-4 + XO Market $6M seed + Kalshi music/fashion** make Polymarket binary-calibration the *least* differentiated venue going forward — Revenant's edge needs to lean harder on PM-Chainlink settlement specificity (vs Kalshi-BRTI) and on UMA-resolution-arb tails. "PM has the most markets" decaying as a moat.
- **CFTC v Wisconsin (CFTC press 2026-04-28):** fifth-state federal preemption suit (AZ, CT, IL, NY, WI). Five-state pattern is the durable-precedent angle.
- **FOMC Apr 28-29 — held 3.50–3.75% as priced (99-100% on PM/Kalshi).** Calibration-trivially-correct event resolution; Experienced-Carpeting tail thesis ("Fed always changes rate at beginning of war") expired without payoff.
- **First US prediction-market insider-trading prosecution** (DOJ Apr 23, Van Dyke named NPR Apr 27): five felony charges, $409K winnings on Maduro-raid market he planned. Coplan: "we flagged this, referred it, cooperated." Compliance signaling now mandatory on both venues.
- **Conduct rules ratchet** (Apr 24–27): Kalshi suspended 3 political candidates for trading own primary races; Moran (US Senate) publicly disputing. PM Top-20 wallets 70% bots. NY-AG sued Coinbase FM + Gemini Titan as gambling promoters; CFTC counter-sued NY (Apr 24, first time CFTC sued a state directly).
- **FanDuel entering predictions** (Bloomberg Apr 27): CEO Amy Howe framing PM as legal workaround for non-sportsbook states. DraftKings + Fanatics already in. Four-way structural battle.
- **Valuation gap:** Polymarket $400M @ $15B (lead unconfirmed) vs Kalshi $1B @ $22B (Coatue). ~30% PM discount confirms Kalshi US-distribution moat repricing the duopoly.
- **Brazil block in force** Apr 27 — 29 PM platforms blocked.
- **Polymarket fees +76% w/w** (DeFiLlama, 2026-04-25) — post-election handle persistence load-bearing for Revenant/CalibrationGap edge.

## Comments-side calibration signals (rolling — last refresh 2026-05-05)

NEW handles since 05-04 (from polymarket-comments 05-05):
- **Verifiable-Romance** — Iran-airspace 05-05; cross-market China-mediation citation ("Araqchi-in-China + Trump-arriving + China-as-mediator + ceasefire-imminent"). Links Iran-airspace + US-Iran-peace + Trump-China into single narrative-shift signal. Watch.
- **Glamorous-Eagle** — Trump-China 04-29, 7x; cleanest absence-of-evidence NO-side argument vs 92.5% priced ("If Trump were really going to visit, Chinese state media would be building public opinion in advance — there's absolutely no sign of that"). NO-calibration handle.
- **Partial-Intestine** — Trump-China 05-04; flight-tracking insider callout ("C-17 second time landing in Beijing this month"). Opposite-direction signal vs Glamorous-Eagle.
- **Threadbare-Signal** — Trump-China 05-04; kinetic-spillover synthesis handle ("US will respond, new phase of war starts, Donald cancels his China visit"). Cross-market reasoning handle.
- **Watery-Boycott** — Iran-airspace 05-05; Pentagon-leadership signal ("Hegseth and Caine both sound like they are ready to go"). Also confirms Car/Peppery-Capital identity tracker durable ("Car cant lose with grace .. Not once ive seen him take the L without trying to scam an extra cent or 2").
- **Other-Takeover** — Iran-airspace 05-05; CNN-citation handle ("Israel and US discussing new strikes on Iran. Source: CNN").
- **Bleak-Full** — cross-market kinetic-tape claimer (Iran-airspace "us already answered by shooting 6 small boats, multiple iranians were killed" 8x 05-04 + Iranian-uranium "this one will be my masterpiece" 5x). Multi-market presence; insider-claim style; verify before trust.
- **Same-Epauliere** — US-Iran-peace-deal 04-24, 14x; binary-encoded "poly-us.pro" phishing typosquat (decodes via `01110000 01101111 01101100 01111001 00101101 01110101 01110011 00101110 01110000 01110010 01101111`). Confirms CommunityVoice-off archetype durable across pseudonyms — security flag, do not amplify.

UMA-resolution-arb cluster (Iranian-uranium-by-May-31, 4-handle 4-week pattern, fresh 2026-05-05):
- **Grown-Songbird** (6x, 04-02) lead resolution-text question: "What happens if they 'say' they have the uranium but don't actually provide proof of its possession?"
- **Somber-Interviewer** (6x, 04-06): "Trump can just bluff that he took some uranium and this will be YES, easy game easy life"
- **Energetic-Folder** (2x, 05-03): "Trump writes on Truth social 'we have the uranium' → resolves YES. What a stupid market rules."
- **Naughty-Completion** (05-05): "they can give 1gram to Trump so he can say he 'won', and then it will be resolved as yes."
- Counter-argument from **Powerful-Election** (04-03): "It says government. If Trump submitted a false claim, there'd be a dispute in other branches and consensus of credible reporting." UMA-rules procedural argument variant.
- Sister to Iran-cf/Hez-cf paradox; pull resolution text into clause-text scanner once that upgrade lands.

NEW handles since 05-03 (from polymarket-comments 05-04):
- **orangexyz** — TN ground-intel; door-to-door Vijay survey, single highest-leverage call against the priced consensus. Top track-record handle of the week.
- **0x7C544D** — Kolkata-insider; phase-by-phase turnout reads on WB.
- **KairosHunter** — TMC→BJP whale flipper; tracks own position publicly.
- **arsenelupin** — Hormuz blockade-lift live-tape; new entry, watch-list.
- **tilda89** — Hormuz NO-side, cites Rubio counter; pairs with Castwolffox.
- **WISEWARRIOR** — loud-loser archetype (28pp claim no cite). Negative-signal handle.
- **God404** — TN-resolution day commenter.
- **audacity.** — TN T-0 commenter.

NEW handles since 04-30 (from polymarket-comments 05-01):
- **Gorgeous-Coffin** — Trump-Iran-ops citation-chain handle (AP/Reuters/Times-of-Israel URL stack); future-resolution-debate signal.
- **Rich-Carotene** — RU-UA ground-reporter + market-rule-lawyer; flagged May-9 ceasefire-proposal first.
- **Abandoned-Kielbasa** — RU-UA insider-trading watch flagger ("look for big trades"). Explicit info-asymmetry alpha callout pattern.
- **Mixed-Sofa** — RU-UA contrarian; counters early-ceasefire optimism.
- **Crafty-Kiss** — Tamil Nadu flipper (TVK→DMK), held TVK from 5c, public reversal "DMK only +EV bet ngl." Track-record handle for swing-flips.
- **Remote-Presentation** — MegaETH FDV resolution-day commenter.
- **Putrid-Campaign** — Iran-mil-ops "pause not end" YES-side argument (T-0 today).
- **Proud-Compulsion** — Iran-mil-ops NO-holder admitted "termination of war ≠ end of military ops"; rare honest-loser tape.

NEW handles since 04-28 (from polymarket-comments 04-30):
- **Pedro1414** (Equatorial-Lung) — Iran-cf YES coordinator, organizational lead. 6+ comments above 19x in 48h. Disc channel + planned UMA vote-day live broadcast + court-threat. Folk-hero coordinator of YES rally; comparable to magmaalpha's procedural advocacy but with org structure.
- **allenzzz** (Vital-Browser, 25x) — Iran-cf NO whale, "$100,000 is hamburger dollars" wallet-flow callouts.
- **Internal-Slope** (21x + 10x) — Hez-cf supplementary-info procedural argument; UMA-rules counsel for "Israel x Lebanon ≠ Israel x Hezbollah" thesis hardening.
- **Accomplished-Stain** (11x) — Hez-cf hostile-oracle-takeover ID'd `Clear-Corridor` as 150,362 YES holder ($36k); mirror of 04-28 Bosaurum/Car pattern.
- **Digital-Archaeologist** (5x) — Tamil-Nadu pollster-calibration historical-record citation pattern (2021/2024 Axis record).
- **French-Temptation** (Apr 30) — Tamil-Nadu ADMK contrarian, names campaign-finance ties (Aadhav Arjuna→Axis, Sabareesan→DMK polls); calls JVC as realistic ≥94%-hit-rate pollster.
- **Alert-Identification** (Apr 30 12:51) — Tamil-Nadu Chanakya-poll citation.
- **Lumbering-Analyst** (8x) + **Fearful-Concentrate** (6x) — both name `ArmageddonRewardsBilly` as MegaETH team insider with futures-manipulation pattern; tagged as "one of the most profitable FDV-after-launch traders." Track-record handle for future FDV launches.
- **Murky-Cowboy** (Apr 30 11:18) — MegaETH pre-market FDV reporter ($2B+ FDV pre-market vs `>$1.5B` market 67.5%).
- **Humiliating-Injunction** (Apr 30 13:41) — restated Iran-cf NO vs Hez-cf YES paradox under near-identical clauses; comment-side voice density rising 48h on.
- **Quarrelsome-Service** + **Grimy-Vibrissae** + **Constant-Optimization** — peace-deal Apr 30 mediator-chain (Pakistani-mediator + Trump-blockade-conditional + UMA-loophole resolution play).

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
4. Tamil Nadu Legislative Assembly (May 4) — DMK 87% market-priced is now ~fair (vs 04-27 baseline of 80%); residual mispricing migrated to **TVK 8.25c** (fair 2-4c, 4-6c edge per share). 8/9 exit-poll consensus + critique of the lone Axis-My-India outlier (sampling base misses 31% of electorate, inflates Brahmin representation 3x — sourced critique from oneindia.com 04-29). TVK NO is a Revenant-shape binary-calibration entry; consider for the 71-trades-to-Apex queue. Re-run polymarket-comments + reply-maker on T-1 (May 3) and resolution morning (May 4). See `articles/research-brief-tamil-nadu-2026-dmk-tvk-calibration-2026-04-30.md`.
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
