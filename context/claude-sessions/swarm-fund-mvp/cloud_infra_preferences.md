---
name: Cloud infra preferences — default to AWS
description: User has AWS credits available; prefer AWS services when choosing cloud infrastructure
type: user
originSessionId: 17f9b3b9-2b16-48d3-b970-60b2e5e996e9
---
**Default cloud provider: AWS.** User has (or is pursuing) AWS credits (milestone M8 shipped — see outputs/). Use AWS as much as possible for new cloud workloads.

**How to apply:**
- S3 for object storage (not Cloudflare R2, despite R2's zero egress — credits trump egress)
- EC2 / ECS / Fargate for compute (not Fly, Railway, Render)
- RDS or Aurora for managed Postgres (not Supabase, Neon)
- MSK for Kafka (not Confluent Cloud) — only if we need managed RedPanda alternative
- Bedrock for alternative LLM access
- SageMaker for any fine-tuning GPU work (Chronos LoRA training → SageMaker, not vast.ai)

**Exceptions — non-AWS is fine when:**
- Service is fundamentally better and not duplicable on AWS (e.g., ClickHouse Cloud — AWS doesn't offer managed ClickHouse natively; CH Cloud runs on AWS under the hood anyway)
- Vercel for the Next.js site (already deployed)
- Hugging Face for public dataset/model publishing (no AWS equivalent)

**When choosing between two comparable options, pick the AWS one** even if slightly more expensive — credits offset the delta.
