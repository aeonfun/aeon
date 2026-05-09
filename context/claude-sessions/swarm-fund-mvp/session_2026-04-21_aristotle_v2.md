---
name: Session 2026-04-21 — Aristotle v2 intake
description: Summary of the second Aristotle critique response — scope cuts, 4-metric edge reporting, 100-trade Apex gate, cross-venue removal
type: project
originSessionId: b13dbf26-06a1-40a9-9766-2d4ff7773916
---
Aristotle sent a second, sharper critique (stored as context in the prompting session on 2026-04-21). Most of the first critique's doc-reconciliation and Lab-pivot work was already absorbed; this second round forced code and copy changes.

**Four forked decisions locked with founder:**

1. **Sample gate:** Canary→Apex raised 60 → **100 closed trades**. Birth→Canary stays at 60.
2. **Edge metric:** 2×2 display on dashboard (mean/median × gross/net). Net = gross − 205 bps (200 taker + 5 funding). Lead with median-net in prose.
3. **Research Backlog formalized:** MiroFish, culture/music, OSINT political, RWA multi-venue arb moved out of near-term execution. Visible in docs, hidden from landing.
4. **Cross-venue routing: removed from near-term entirely.** `VenueRouter` / `HyperliquidAdapter` stay in repo as deferred infra. Polymarket-only execution until 100-trade Apex gate closes.

**Why it applies going forward:**
- When talking LP/grant narratives, lead with "research experiment trading Polymarket calibration gaps with real capital" — not "cross-market information asymmetry fund" and not any RenTech analogy.
- When reporting edge stats anywhere (site, reports, emails), report median-net alongside mean; leading with mean on small n is the exact thing Aristotle flagged.
- Before advocating to reinstate cross-venue routing or any Research Backlog item, require: (a) single-venue 100-trade gate passed AND (b) a fresh ADR.

**Files changed in session:** see `docs/aristotle_response_v2.md` for the full list. ADRs 050–055 appended to `DECISIONS.md`.

**What this did NOT change:** Wyre $50M / Lore $50M+ AUM factual legacy (stays in Founder bio — factual, not aspirational), Becker 302M dataset, lifecycle brand (Birth/Canary/Apex/Cold/Dead/Revenant), 4-layer risk gate, convergence thesis (now explicitly 10-year backdrop).
