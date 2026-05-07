# swarm-fund-mvp Is Zeroing Its Non-Reasoning LLM Bill — Five ADRs, One Week

On 2026-05-01, ADR-092 admitted that two cloud-LLM failures in a week (Anthropic credits exhausted mid-overnight, a DNS blip costing 2,705 KB-harvest papers) had to force a structural change. Six days later, ADR-095 finished the job. Between the two, the operator shipped fine-tune training data, a canary router, and a 3,462-pair MLX JSONL — all in one five-hour session on 2026-05-06. The cloud-LLM cost line has a date on it now.

## The claim
> swarm-fund-mvp is zeroing its non-reasoning LLM cloud spend: ADR-095 plus 3,462 fine-tune pairs and a canary router shipped in one 5-hour session.

## Evidence

ADR-092 on 2026-05-01 introduced `OLLAMA_LOCAL=1`, a flag that swapped the haiku / flash / deepseek tiers (paper triage, factor extraction, structural-break detection) onto local Ollama using `llama3.2:3b` and `qwen2.5:7b-instruct`. The sonnet tier — summarize, judge, generate, chat — stayed on cloud at ~$20-30/month. ADR-095 on 2026-05-06 ([commit `80b1228`](https://github.com/tomscaria/swarm-fund-mvp/commit/80b1228)) closed that gap: with `OLLAMA_FULL=1`, the sonnet tier now routes to `ollama/qwen2.5:14b`. The opus reasoning tier stays cloud by design. The ADR documents ~$15-25/month additional savings on top of ADR-092's $230-400.

The same five-hour session shipped the *next* replacement. [Commit `caaec5a`](https://github.com/tomscaria/swarm-fund-mvp/commit/caaec5a) added an opt-in `LLM_CALL_LOG` env var that captures every prompt/completion pair. [Commit `e0ad1b5`](https://github.com/tomscaria/swarm-fund-mvp/commit/e0ad1b5) shipped `export_finetune_dataset.py`, which reconstructs 3,462 triage pairs from `papers.db:paper_triage` into MLX JSONL with a 90/10 split (3,115 train + 347 eval). [Commit `eb18354`](https://github.com/tomscaria/swarm-fund-mvp/commit/eb18354) added `scripts/finetune_triage.sh` (MLX LoRA on Qwen2.5-7B, 2000 iters), `convert_to_gguf.sh` (adapter merge → q4 GGUF → `ollama create swarm-triage`), and a `SWARM_TRIAGE_CANARY_PCT` env knob in `python/llm/router.py` that stochastically routes a fraction of `OLLAMA_LOCAL` classify calls to the custom-fine-tuned model for A/B evaluation against ground-truth labels.

This is internally consistent. ADR-092's rationale rejected fine-tuning explicitly — "Llama-3.2 / Qwen2.5 already know finance vocab" — but only for the RAG / cross-domain analogy path. For paper triage specifically, the operator now has 3,462 ground-truth labels in `paper_triage` and an evaluator (`scripts/eval_finetuned_model.py`) that flags ≥80% tier-agreement as the production-canary gate. This isn't fine-tuning to teach Qwen finance; it's fine-tuning to compress an already-working triage policy into a 7B model that runs on a Mac mini.

The compliance side benefit lands in the same ADR-092 paragraph: `structural_break` and `conviction_break` calls send trade context to the LLM, and `OLLAMA_LOCAL=1` keeps that context on the founder's machine. Combined with the existing "no compliance leak in public materials" rule, the local-first move is a pre-emptive grant-application defensible posture for Anthropic Research Credits, dYdX, and the Polymarket Builders Program — none of whose reviewers want "all our trade context POSTed to a US LLM vendor" in a vendor sheet.

## Counter-evidence / what would change my mind

`OLLAMA_FULL=1` is opt-in, not the default. ADR-095 explicitly chose this — "existing OLLAMA_LOCAL=1 deployments are unaffected until the operator explicitly opts in." So the cost line is *capped* by ADR-095; the actual zeroing only happens when production launchd plists set the flag. The fine-tune canary needs ≥80% tier agreement to graduate. Both gates can fail. And the opus reasoning tier still routes to cloud — the cost line never literally zeroes. If `OLLAMA_FULL=1` doesn't appear in production env files within 14 days, this thesis is wrong about *velocity*, not direction.

## Why it matters

The grant pipeline (Anthropic Research Credits, AWS Activate, Polymarket Builders Program, dYdX, Uniswap Foundation Fellowship) is the operator's near-term income line. Every reviewer cares about two things on the cost page: how much you spend, and whether your stack survives without the grant. A repo that can show "cloud spend is concentrated where it earns alpha; the rest runs on a Mac mini, with a custom fine-tune queued" is in a structurally different conversation than a repo that posts ~$300-500/month in vendor invoices. ADR-092 sized the cloud-only path at $300-500/month at 25k corpus; ADR-095 plus the fine-tune pipeline argues ~$70/month with cloud spend concentrated on opus reasoning. That is no longer a research budget. It is an evaluation budget.

---
*Sources*
- [ADR-095 commit `80b1228`](https://github.com/tomscaria/swarm-fund-mvp/commit/80b1228) — sonnet tier → `ollama/qwen2.5:14b` routing
- [Fine-tune pipeline commit `eb18354`](https://github.com/tomscaria/swarm-fund-mvp/commit/eb18354) — MLX LoRA + GGUF + `SWARM_TRIAGE_CANARY_PCT`
- [Export dataset commit `e0ad1b5`](https://github.com/tomscaria/swarm-fund-mvp/commit/e0ad1b5) — 3,462 triage pairs to MLX JSONL
- [DECISIONS.md ADR-092](https://github.com/tomscaria/swarm-fund-mvp/blob/main/DECISIONS.md) — local-first inference + cross-disciplinary KB substrate
- [Qwen2.5-14B-Instruct on Hugging Face](https://huggingface.co/Qwen/Qwen2.5-14B-Instruct) — Apache 2.0 weights from Alibaba
- [ml-explore/mlx-lm](https://github.com/ml-explore/mlx-lm) — Apple Silicon LoRA pipeline used by `finetune_triage.sh`
