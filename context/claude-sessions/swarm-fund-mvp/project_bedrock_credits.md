---
name: Amazon Bedrock — 100,000 credits granted
description: 2026-05-06: founder has 100K Amazon Bedrock credits. Relevant to ADR-058 multi-provider adapter, KB re-extraction runs, and local-first inference calculus.
type: project
originSessionId: 961e922e-7410-4e19-888b-7943cd293968
---
**Fact:** 100,000 Amazon Bedrock credits secured as of 2026-05-06.

**Why this matters:**
- ADR-058 multi-provider LLM adapter already has OpenRouter (6th) + Ollama (7th). Bedrock = natural 8th provider.
- Bedrock offers Claude (Haiku/Sonnet/Opus), Amazon Nova (ultra-cheap bulk), Llama 3, Mistral — all via single AWS SDK (`boto3`).
- High-volume tiers (paper_triage, factor_extractor, KB extraction, structural_break) currently routed to Gemini Flash or local Ollama. Nova Micro/Lite on Bedrock may be cheaper per token than Gemini Flash at scale.
- Credit-hunt playbook (project_credit_hunt_playbook.md) had "M8 AWS credits (DONE)" as a milestone — this is presumably the realization.

**How to apply:**
- Before wiring Bedrock in, confirm credit denomination ($ vs unit) and expiry.
- Primary candidates for Bedrock routing: bulk-inference tiers (paper_triage flash, factor_extractor default, KB stub generation).
- Claude-on-Bedrock path exists if Anthropic direct credits run dry — same model family, different billing.
- Update ADR-058 + provider_router when adding BedrockAdapter.
