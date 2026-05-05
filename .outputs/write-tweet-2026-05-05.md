## Tweet Drafts: 0.444-magnitude leakage shift on the documented Iran-cluster Polymarket case (arXiv:2605.02286) — empirical case for ingesting resolution text not titles

### Tier 1 — One-liner
**1a. Hot take**
> "No edge in Polymarket geopolitics" usually means the scanner ingested titles.

**1b. Data drop**
> Same Iran trades, scored two ways: 0.444-magnitude leakage swing. The instrument matters.

### Tier 2 — Two-punch
**2a. Reframe**
> "Quant scanner sees no edge in PM geopolitics." Wrong scanner. Score Iran-cluster trades on resolution text and leakage flips sign by 0.444 magnitude.

**2b. Observation**
> Most PM backtests ingest titles. Resolution text is what resolves the contract. Nechepurenko's Iran-cluster paper puts the gap at 0.444 magnitude. Same data, scored two ways.

### Tier 3 — Paragraph
**3a. Narrative**
> Iran-cluster Polymarket case, 332 wallets. Score the trades by public-event windows: leakage +0.113. Score them by resolution-anchored windows: -0.331. Same trades, opposite-sign signals. Title-ingest backtests are why "no edge" claims keep misfiring.

**3b. Hot take**
> The reason a quant scanner sees no edge in language-asymmetry markets isn't that the edge isn't there. It's that the scanner ingests titles. Score documented Iran insider trades on resolution text and you get a 0.444-magnitude leakage swing. Same data.

### Tier 4 — Long tweet
**4a. Data drop**
> arXiv:2605.02286 dropped May 4. Nechepurenko evaluates deadline-anchored ILS on documented Polymarket insider cases. Headline: on the largest 2026 Iran contract ("US forces enter Iran by April 30") leakage = +0.113 under public-event scoring, -0.331 under resolution-anchored scoring. Same trades. 0.444-magnitude swing. Hazard rate on military-geopolitics: half-life 2.3 days, KS p=0.609. The empirical case for ingesting resolution clauses, not headlines, is now on paper.

**4b. Reframe**
> The recurring pattern: someone runs a quant scanner across Polymarket, finds no edge in geopolitics, declares the venue efficient. The scanner scored on public-event windows. Score the same documented Iran-cluster insider trades on resolution-anchored windows and you get a 0.444-magnitude leakage shift, opposite sign. The Iran-cf-NO vs Hez-cf-YES paradox lives in the same lane. Resolution-clause heterogeneity is the edge a title-ingest scanner can't see.

### Tier 5 — Thread opener
**5a. Hot take**
> Most "no edge in Polymarket geopolitics" claims come from scanners that ingest titles. Score the same documented Iran-cluster trades on resolution text and leakage flips sign by 0.444 magnitude. Thread on why architecture beats alpha here:
---
- 1/ The 2026 US-Iran cluster has 332 wallets on file and documented insider cases. ILS-dl paper from May 4 tests two scoring lenses on the same data.
- 2/ Largest contract ("US forces enter Iran by April 30"): leakage = +0.113 under public-event scoring, -0.331 under resolution-anchored scoring. Opposite signs, same trades.
- 3/ Hazard rate on military-geopolitics: half-life 2.3 days, KS p=0.609. Concrete sizing parameter, not vibes.
- 4/ The Iran-cf-NO vs Hez-cf-YES paradox lives in the same lane. Resolution-clause heterogeneity is what a title-ingest scanner is structurally blind to.
- 5/ The trade is: rebuild the ingest layer to read resolution text. Stop scoring headlines. Live-ingest the clause graph.

**5b. Question**
> If two Polymarket markets resolve from near-identical clauses but opposite ways (Iran-cf NO 0.25%, Hez-cf YES 99.85%), why would a title-ingest scanner ever see the gap? May 4 paper puts a number on it: 0.444-magnitude leakage shift on the Iran cluster.
---
- 1/ Nechepurenko's ILS-dl paper (arXiv:2605.02286, May 4) evaluates deadline-anchored leakage scoring on documented Polymarket insider cases. The 2026 US-Iran cluster is the empirical anchor.
- 2/ Same contract, two scoring lenses: +0.113 leakage under public-event, -0.331 under resolution-anchored. 0.444 magnitude on same trades.
- 3/ Hazard-rate fit on military-geopolitics: exponential decay, half-life 2.3 days, KS p=0.609. Sizing parameter for any agent taking leakage exposure on the geopolitics axis.
- 4/ The CalibrationGap implication: title-ingest is structurally blind to resolution-clause heterogeneity. Iran-cf vs Hez-cf is the same blind spot, priced live.
- 5/ The trade: ingest resolution text, not titles. Live-ingest the clause graph. Stop concluding "no edge" from the wrong instrument.

---

**Best overall:** #4a — densest payload (paper ID + contract title + both scores + magnitude + hazard rate + KS p-value) with a clean argumentative payoff. Long-tweet length is the right instrument for this content.

**Best per tier:**
- Tier 1 → 1b — specific number beats abstract claim
- Tier 2 → 2a — "Wrong scanner" reframe is tightest
- Tier 3 → 3a — concrete walkthrough of both scoring lenses
- Tier 4 → 4a — operator-grade specifics
- Tier 5 → 5a — hot-take opener has more drive than the question variant
