---
name: Don't surface compliance issues or workarounds in public-facing materials
description: Compliance language (regulator names, ToS sections, geoblock probes, "entity restructure" workarounds) must not appear on public surfaces. Allowed only in 201+ deep-dive appendices distributed under LP-only / password-gated workflow.
type: feedback
originSessionId: 1172f14b-8997-432c-a6d2-1e5e5a26b289
---
Compliance language — specifically anything that surfaces a *workaround* — must not appear on any public-facing material. Includes:

- Specific regulators (CFTC, SEC, FinCEN, OFAC) named in failure / risk context
- Specific ToS sections cited (e.g. "ToS §2.1.4")
- Geoblock evidence (e.g. `/api/geoblock returns {blocked: true, country: "US"}`)
- Restructure / workaround language ("entity restructure required for live PM size", "non-US entity to operate", "VPN", "jurisdiction shopping")
- Consent-decree references (e.g. "CFTC consent decree")

**Surfaces this rule applies to** (scrub aggressively):
- Public landing page (rswarm.ai) — including FailureLog, ResearchThesis, Risks, etc.
- /investors web route (currently public; will become password-gated)
- 1-pager teaser (cold-open + email forward risk)
- 12-slide 101 first-look deck

**Allowed exception:**
- 201+ deep-dive PPTX appendices distributed under password-gated / LP-only workflow only. The user's stated future plan is to password-gate the /investors web route and the 201 deck → at that point, the 201 deck appendix can carry full compliance detail.

**Replacement framing for public surfaces:**
Use "scope-defined" language: "Live execution scoped to current jurisdictional constraints" or "Entity / venue scope is part of pre-Apex Phase 0 work" — without naming the regulator, the ToS section, or the workaround.

**Why:** Surfacing how we'd work around compliance reads as both legally exposed and PR-fragile. Even documenting that a workaround *exists* on a public surface invites diligence concerns and headline risk. Investors who need this detail get it under NDA / direct conversation.

**How to apply:**
- When writing failure logs, risk sections, "what we tried that failed", scrub regulator names + ToS citations + workaround language before publishing.
- When auto-generating from harvest / incident logs, filter compliance-tagged items out of public-facing copy.
- Default to OMITTING; only restore when audience is verified LP / under password gate.

Source incident: 2026-04-27 — landing-page FailureLog shipped a "COMPLIANCE: Polymarket live execution from US — /api/geoblock returns {blocked: true} ... ToS §2.1.4 + CFTC consent decree. Entity restructure required for live PM size." entry. Founder flagged immediately on review. Scrubbed from landing + 1-pager + 101 deck same session.
