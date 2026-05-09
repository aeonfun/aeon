---
name: Polymarket US waitlist — manual track, Ireland path remains primary
description: 2026-04-28 verification of Polymarket US relaunch state; founder joined polymarket.com/usa waitlist, no ETA. Engineering continues on Ireland VPS path for international CLOB.
type: project
originSessionId: e69207b8-6ca3-4c44-9a77-c0d7963b0c4b
---
**State (verified 2026-04-28 via web research):** Polymarket US is live but invite-only. Operated by QCX LLC d/b/a Polymarket US (CFTC-regulated DCM), beta opened 2025-11-12. Waitlist surface at https://polymarket.com/usa. Founder submitted phone number 2026-04-28 — "see you soon," no ETA. Industry estimates Q3/Q4 2026 for open access; Feb-2026 signups reportedly waiting 6–12 weeks.

**KYC required for US path:** gov ID + SSN + proof of residency + selfie; deposits via approved FCMs (not direct crypto).

**Why:** Sept–Nov 2025 CFTC approvals (no-action letter Sept 3, amended designation order Nov 25) cleared the regulated US path. QCX acquired by Polymarket for $112M; qcx.io domain dead, brand consumed into Polymarket US. First full month US-app volume ~$450M.

**How to apply:**
- US-regulated path is **on the shelf**, tracked manually. Do NOT engineer toward it without founder go-ahead.
- Ireland VPS path remains primary for international CLOB execution. `polymarket_compliance_gate.md` and `polymarket_datacenter_ban.md` stay authoritative for the international platform — they are NOT superseded for that scope.
- Public read endpoints from US residential continue to work for international CLOB (signal ingestion unchanged).
- If founder later gets off waitlist: regulated path = different order book, different fees, different liquidity than international CLOB. Treat as a separate venue integration, not a swap.

**Sources:** CoinDesk Sept 2025 + Nov 2025; Sportico March 2026 ("fumbles U.S. launch"); polymarket.com/usa waitlist; startpolymarket.com US guide.
