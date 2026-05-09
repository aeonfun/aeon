---
name: PM compliance gate — resolve before any live-PM code work
description: Phase 0 of any "enable live Polymarket trading" plan; US-person via non-US VPS = ToS §2.1.4 evasion + CFTC consent-decree exposure; do not engineer that path
type: project
originSessionId: 0ef4f908-3366-4d80-beb5-a107a7f22332
---
Before writing or shipping any code that places live Polymarket orders, this question must be resolved (Thomas-only, legal):

**Who legally holds the PM account, and from what jurisdiction do they operate?**

Three answers:

- **Option A (clean):** Non-US entity (Cayman/BVI fund vehicle, EU GP, etc.) with non-US KYC, legitimately operating from a non-restricted jurisdiction. Engineering is straightforward; hosting matches account jurisdiction.
- **Option B (clean):** Non-US-tax-resident principal. Same shape as A from PM's view.
- **Option C (NOT clean):** Thomas-as-US-person trading via an Ireland/EU VPS. This is the textbook "similar tool" prohibited by PM ToS §2.1.4 and is exposure to PM's CFTC consent decree (2022, $1.4M). Do not engineer this. If this is the intended path, surface it explicitly and stop.

**Why:** Without this gate, "let's enable live PM trading" looks like routine engineering (SDK install, L2 HMAC, EU VPS). It isn't. PM's geofence is an enforced legal obligation, not a leaky technical control. Engineering around it makes the platform team complicit in ToS evasion and creates Thomas-personal regulatory exposure (PM accounts get frozen on suspicion, funds locked indefinitely).

**How to apply:**
- Any plan that touches `polymarket_adapter.py`'s `place_order(paper=False)` path, adds `POLY_PRIVATE_KEY` to `.env`, or provisions an EU VPS must reference this file and confirm Phase 0 status.
- The current paper-mode + HL-hedge architecture is the right state until Phase 0 resolves to A or B. PM signals continue to inform HL execution; no orders leave to PM.
- If C is the de-facto path, the right escalation is "resolve the entity question," not "implement workarounds."

**Related:**
- `~/.claude/plans/how-are-we-making-abundant-allen.md` — full plan with Phase 0–5
- [polymarket_datacenter_ban.md](polymarket_datacenter_ban.md) — the technical geofence facts (post-correction)
- PM ToS §2.1.4 (via [help center](https://help.polymarket.com/en/articles/13364163-geographic-restrictions))

**SUPERSEDE-CHECK RESOLVED 2026-04-28 — Founder confirmed PM USA is NOT coming soon.** The 2026-04-27 web-search rumor of a late-2025 US relaunch is rejected. QCX acquisition is real and the CFTC framework was approved, but no public launch / waitlist / pilot exists and none is imminent. Option D (US-person KYC'd at PM USA) is OFF the table for the foreseeable future. The original gate stands: live PM = Option A or B (non-US entity or non-US-tax-resident principal), and Option C (US-person via EU VPS) remains a textbook ToS §2.1.4 violation. Active path is "Plan Ireland on AWS" (`~/.claude/plans/how-are-we-making-abundant-allen.md`) — but only after Phase 0 entity/jurisdiction resolves to A or B. Do NOT start Ireland-on-AWS engineering work until that resolution is recorded.
