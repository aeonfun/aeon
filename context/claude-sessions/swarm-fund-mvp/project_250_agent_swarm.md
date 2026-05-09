---
name: 250-agent swarm direction + Revenant redefinition + master allocator
description: Target architecture decided 2026-04-21 — 250 agents in tiered lifecycle, Revenant now means demoted-with-feedback-loop (not graveyard resurrection), Medallion-style internal portfolio allocator for canary capital
type: project
originSessionId: 4f921160-aa7e-467c-9307-6a6401ab65ac
---
**Target swarm size: 250 agents, tiered lifecycle.**
- 230 Birth/PAPER
- 20 Canary
- 5 Apex
- Any Apex or Canary that falls below performance gates → **Revenant** (still paper-trading, but data logs handed off to a master system that fine-tunes configs across the whole 250-agent fleet)

**Why:** user asked 2026-04-21 to scale from 10 current paper agents to 250; wants evolutionary pressure under capital discipline — only 5 Apex agents get real HL capital.

**How to apply:**
- The Revenant definition here SUPERSEDES the 2026-04-20 memory note ("mutant spawned from Dead's graveyard"). New definition: demoted Apex/Canary with two-way data-feedback contract. Dead → Revenant resurrection is now a separate concept (if it still exists at all).
- Master portfolio allocator is a NEW module — Medallion-style capital routing across Canary tier. Internal naming only; MEMORY `feedback_forbidden_phrases.md` still bans RenTech/Simons/Medallion in external copy.
- Landing-page stats can go live by tunneling FastAPI `/api/public/stats` (server.py:1562) — swap swarm-lab-site/public/metrics.json static consumer for tunneled API fetch. Matches `infra_plan.md` EC2 + Cloudflare Tunnel migration.
- Cost envelope at 250 agents (rough): ~$1.1k–1.5k/mo. LLM tier ~$900 (50 closed × $10 + 200 open × $2), data/API ~$80, compute ~$80, PM fees on Canary/Apex ~$200–500. Currently spending <$50/mo.
- Edge-weighted market allocation: CalibrationGap doesn't care (Becker surface is category-agnostic); Archer/Mage/Pathfinder DO. Slice by family first, allocate extra agents to verticals where early edge shows up.
