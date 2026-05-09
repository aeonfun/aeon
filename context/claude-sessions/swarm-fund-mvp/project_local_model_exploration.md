---
name: Founder is exploring local model hosting
description: As of 2026-05-01, founder is investigating self-hosting a model "for some purposes" — specific use cases TBD. Affects cost calculus on Anthropic / multi-LLM credits.
type: project
originSessionId: 3a509466-2821-41e6-8fe0-a50c918e168a
---
Founder mentioned 2026-05-01 they are looking into hosting a local model "for some purposes" (specific workloads not yet specified).

**Why this matters:** changes the cost calculus for several queued decisions —
- ADR-058 multi-provider LLM adapter + tiered caps was sized assuming all paths are API-billed
- Phase 1 credit-hunt ROI (Anthropic Startup, OpenAI for Startups, Azure via MS Founders Hub) partly depends on whether local inference covers the same workloads
- The "No LLM calls inside on_tick()" rule (CLAUDE.md cost-control section) is API-cost-driven; local hosting could relax it for some strategies (e.g. `pm-semantic-pattern` was rejected on this basis per TASKS.md)
- Autoresearch loop, KB extractor, paper-triage are the heaviest API consumers — natural candidates for local fallback

**How to apply:** when proposing LLM-cost-sensitive work or ranking credit programs, ask the founder which workloads are local-bound vs. API-bound before assuming all-API. Don't propose architectural changes that *require* local inference until the use cases are concrete — this is exploration, not a committed direction. Re-check this memory's relevance if it goes stale (founder may decide local hosting isn't worth it for any path).
