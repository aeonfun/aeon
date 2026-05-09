---
name: Forbidden phrases in external docs
description: Specific comparisons and claims that are banned from all LP docs, grant applications, site copy, and pitch materials (per Aristotle v2 critique)
type: feedback
originSessionId: b13dbf26-06a1-40a9-9766-2d4ff7773916
---
Never use any of these in LP docs, grant applications, site copy, pitch emails, or any external-facing material:

- **RenTech / Simons / Medallion comparison** — any framing of Revenant/Swarm Lab as "RenTech-like", "Simons discipline", "Medallion-style" etc.
- **"Live ingest is a structural edge"** or any variant claiming calibration-surface freshness as a moat.
- **"Bidirectional cross-venue routing is alpha"** — it's an operational capability, not alpha, and is currently deferred (ADR-054).
- **"Darwinian evolution under live capital"** as an alpha/mechanism claim. Lifecycle brand (Birth/Canary/Apex/Cold/Dead/Revenant) stays; mechanism language for what runs TODAY is "structured A/B with pre-registered gates".
  - **Nuance (2026-04-21 update):** using "Darwinian agent swarms" as a stated *ambition / research direction* is allowed and appears in current hero copy ("Our ambition is to explore Darwinian agent swarms..."). The banned framing is claiming Darwinian selection works at the n we have today. Ambition language must be clearly labeled as ambition, not paired with statistical claims.

**Why:** Aristotle v2 (2026-04-21) flagged each of these as either unprovable at current scale or a "tell" that invites scrutiny we can't defend. The brand names and the calibration-surface math are fine; specific comparisons to the most successful quant fund in history are not.

**How to apply:** Before sending any external doc or publishing any site copy, grep for these phrases. If found, rewrite. The Founder.tsx page may keep factual Wyre $50M / Lore $50M+ AUM legacy — that's verified history, not aspiration.

**Related:** `docs/aristotle_response_v2.md` (ledger), `DECISIONS.md` ADR-053 (Darwinian reframing), ADR-054 (cross-venue deferral).
