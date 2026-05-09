---
name: PM geofence — actual constraint is ToS §2.1.4 + IP-country geoblock
description: PM's geofence is IP-country geoblock (33 countries) + ToS §2.1.4 ban on VPNs/similar tools; AWS/GCP datacenter IPs are NOT banned (PM hosts its own infra on AWS eu-west-2)
type: project
originSessionId: 3ca7274e-999b-461c-b163-3e469018f0a8
---
**Corrected 2026-04-26** from primary PM docs ([geoblock](https://docs.polymarket.com/api-reference/geoblock), [help center](https://help.polymarket.com/en/articles/13364163-geographic-restrictions)). The previous version of this memory claimed "PM bans datacenter/VPN IPs and AWS/GCP/Azure ranges are hard-blocked" — that was wrong on the technical mechanism. Polymarket itself runs on AWS eu-west-2 (London).

**What PM actually enforces:**
- **IP-country geoblock** at `GET https://polymarket.com/api/geoblock` → returns `{blocked, ip, country, region}`. 33 countries fully blocked including US, GB, FR, DE, NL (added 2026), Portugal (added 2026), Australia, Japan, all OFAC-sanctioned. Three restriction levels: fully Blocked / Close-only / Frontend-UI-only-blocked-but-API-accessible.
- **ToS §2.1.4 prohibits "VPNs or similar tools"** to bypass restrictions. A remote VPS used by a person in a restricted country to mask their location qualifies as a "similar tool." Stated penalty: account freeze, funds locked indefinitely.
- Backstop: PM had a CFTC settlement in 2022 ($1.4M) for offering binary options to US persons; the geofence enforces that consent decree, not just contractual ToS.

**Why:** Thomas read PM docs 2026-04-26 noting "no VPN, AWS Ireland is fine." The first half is real (ToS §2.1.4); the second half is from third-party VPS-vendor blogs (newyorkcityservers.com, quantvps.com, tradoxvps.com), not PM. Verified primary PM docs make no AWS-Ireland recommendation; quickstart only mentions IP-country geoblock + Cloudflare. The original "datacenter IPs banned" framing in this memory came from extrapolating VPN-detection language and was self-imposed conservatism, not a PM rule.

**How to apply:**
- Live PM trading from the US is a **legal/entity question first, technical question second**. See [polymarket_compliance_gate.md](polymarket_compliance_gate.md) — Phase 0 must resolve before any code work.
- For non-US entities legitimately operating in non-restricted jurisdictions, AWS eu-west-1 (Ireland) is a fine host — sub-2ms RTT to PM's London infra. Not a PM recommendation, but no rule against it.
- The split-execution architecture (HL on Mac/co-lo, PM elsewhere) still holds, but for ToS / jurisdiction reasons, not because PM blocks AWS IPs.
- For latency-sensitive PM strategies that genuinely need <10ms, the bottleneck is hosting near eu-west-2; nothing about the IP type per se.

**Related:**
- [polymarket_compliance_gate.md](polymarket_compliance_gate.md) — the Phase-0 legal gate
- [polymarket_wallets.md](polymarket_wallets.md) — PM proxy wallet separation
- `infra_plan.md` — EC2 migration (HL leg, unaffected)
- `~/.claude/plans/what-are-other-latency-golden-corbato.md` — latency plan, predates this correction; treat AWS-IP-ban premise there as superseded

**SUPERSEDE-CHECK RESOLVED 2026-04-28 — Founder confirmed PM USA is NOT coming soon.** The 2026-04-27 web-search rumor of a late-2025 US relaunch is rejected. The geofence facts in this memo continue to apply: global PM remains the only venue, IP-country geoblock + ToS §2.1.4 still bind, AWS eu-west-1 (Ireland) is fine for non-US entities legitimately operating from non-restricted jurisdictions. Path forward = original Option A/B + Plan Ireland on AWS, gated on the compliance question in [polymarket_compliance_gate.md](polymarket_compliance_gate.md).
