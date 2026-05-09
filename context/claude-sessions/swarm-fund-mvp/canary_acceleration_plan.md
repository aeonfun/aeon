---
name: Canary acceleration plan — 2026-04-25 revision
description: 5-family swarm with new Bankr-Avantis + Aeon-Narrative families to reach ≥5 Canary in 4 weeks
type: project
originSessionId: 07e0fd63-5c10-47dd-9875-df2c9f852fef
---
**Plan doc:** `docs/plans/2026-04-25_canary-acceleration.md`. Read it before touching agent factory or canary-promotion logic.

**Why:** Currently 1 Canary (CalibrationGap-v1) + 96 paper variants of the SAME thesis. Adding tools doesn't help unless we add families. Bankr SDK + Aeon outputs unlock 4 new families uncorrelated to CalibrationGap.

**5 families targeted** (250 total agents at ~50 variants each):
1. **CalibrationGap** (existing) — 97 already spawned, 1 Canary
2. **Hermes 5-min BTC** — already spec'd in `memory/project_hermes_family.md`; just needs to land
3. **Bankr-Avantis-Macro** (NEW) — leveraged FX/commodities/equities; first non-crypto family
4. **Aeon-Narrative** (NEW) — reads Aeon's daily JSON outputs (`monitor-polymarket`, `polymarket-comments`, `narrative-tracker`) as signal feed
5. **Bankr-Social-Momentum** (NEW) — sentiment via Bankr SDK + LunarCrush

**How to apply:**
- DO NOT lower the 100-trade Apex gate — it's ADR-050. Acceleration comes from cadence (Hermes 5-min, Avantis 1-4hr) and signal diversity, not gate softening.
- New agent files go under `python/agents/{family}/` mirroring the existing `python/agents/strategy_registry.py` pattern.
- Bankr-using agents instantiate `python.execution.bankr_adapter.BankrAdapter` (currently STUB — fill in once x402 wallet is funded; see `outputs/manual_tasks_thomas.md`).
- Aeon-Narrative agents read Aeon's committed JSON via `gh api repos/tomscaria/aeon/contents/...` (decided when implementing).
- Master canary-capital allocator (Phase 5C in TASKS.md) becomes binding when ≥3 Canary across ≥2 families exist.

**Sequence (4 weeks):**
- Week 1: Hermes templates land. First Hermes variants enter shadow.
- Week 2: Avantis-Macro 5 variants in shadow. Aeon-Narrative 3 variants reading Aeon outputs.
- Week 3: First Hermes Canary (5-min cadence reaches 100 trades fast).
- Week 4: First Avantis Canary. Target: 3-4 Canary by week 4, 5+ shortly after.

**Forbidden phrases when documenting publicly:** RenTech/Simons/Medallion, "live-ingest as moat", "cross-venue alpha", "Darwinian as mechanism" — all per `memory/feedback_forbidden_phrases.md`. "Darwinian as ambition" is allowed.

**Pre-requisites for Bankr families to actually execute:**
- BANKR_X402_WALLET + BANKR_X402_PRIVATE_KEY in `.env` (USDC-on-Base wallet for x402 micropayments) — queued in `manual_tasks_thomas.md`.
- Avantis access (built into Bankr SDK, no separate signup expected — confirm at implementation time).
