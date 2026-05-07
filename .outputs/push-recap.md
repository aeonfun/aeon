*Push Recap — 2026-05-07*
MIXED — aeon shipped v4-prep skill kit; swarm-fund wired a local-LLM canary

Shipped to users:
• aaronjmars/aeon #161 — `./new-from-template` CLI + six runnable starter SKILL.mds (crypto-tracker, research-digest, code-reviewer, social-monitor, deploy-watcher, community-manager); first-touch fork operators no longer reverse-engineer SKILL.md
• aaronjmars/aeon #160 — `v4-readiness` skill (workflow_dispatch, read-only) emits Safe/Review/Custom/Action breakdown of a fork's aeon.yml + skills.json + MEMORY.md against an embedded v4 manifest
• swarm-fund-mvp eb18354 — fine-tuning pipeline (MLX LoRA on Qwen2.5-7B → GGUF → ollama swarm-triage) + `SWARM_TRIAGE_CANARY_PCT` stochastic A/B router; ADR-095 lands in DECISIONS.md alongside `OLLAMA_FULL=1` flag routing sonnet-tier to qwen2.5:14b

Under the hood:
• swarm-fund-mvp caaec5a — opt-in `LLM_CALL_LOG` env var captures {ts, agent, task, model, prompt, completion}; raw material for the 3,462-pair triage dataset exported in e0ad1b5

Shape: 7 user-visible · 5 internal · 0 infra · 95 bot-filtered · 2 merged PRs
Volume: 36 files, +2,361/−11 lines
Note: every flag added today defaults off — canary chain built, not yet measured

Full recap: https://github.com/aeonframework/aeon/blob/main/articles/push-recap-2026-05-07.md

