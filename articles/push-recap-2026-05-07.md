# Push Recap — 2026-05-07

## Verdict
> MIXED — aeon shipped v4-prep skill kit; swarm-fund wired a local-LLM canary

**Shape:** 7 user-visible commits · 5 internal · 0 infra · 95 bot-filtered
**Volume:** 36 files changed, +2,361/−11 lines across 12 substantive commits by 2 authors
**Merged PRs:** 2 — aaronjmars/aeon #160 (v4-readiness checklist), #161 (skill template library + new-from-template CLI)

---

## Top impact today

1. `8fcf2f5` — feat: skill template library — six starters + ./new-from-template (#161). Adds a top-level Bash CLI that scaffolds a new skill from one of six pre-built templates (crypto-tracker, research-digest, code-reviewer, social-monitor, deploy-watcher, community-manager), token-substitutes operator values via `--var KEY=VALUE`, and registers a disabled entry in `aeon.yml` — first-touch fork operators no longer have to reverse-engineer a SKILL.md from scratch. (9 files, +755/−0)
2. `eb18354` — feat: fine-tuning pipeline + canary router (Tasks 9-11). Lands the second half of the local-LLM cutover: MLX LoRA training script for Qwen2.5-7B, GGUF conversion + `ollama create swarm-triage`, agreement-vs-ground-truth eval gated at ≥80%, and a `SWARM_TRIAGE_CANARY_PCT` env knob that stochastically routes a fraction of classify calls to the fine-tuned model when `OLLAMA_LOCAL=1`. Default 0% — off until eval passes. (6 files, +404/−1)
3. `3450b31` — feat(v4-readiness): per-fork v4 upgrade readiness checklist (#160). New `workflow_dispatch` skill that reads a fork's `aeon.yml` + `skills.json` + `MEMORY.md` against an embedded v4 change manifest and emits Safe / Review / Custom / Action breakdowns with effort tags. Read-only — never auto-mutates aeon.yml or opens a PR. Ships `enabled: false`; manual dispatch only. (4 files, +310/−7)

---

## aaronjmars/aeon

### Activation kit for the v4 announcement window

**What this is:** Two operator-facing additions that close the lead-time gap before v4. The skill template library makes "I want a skill that monitors X" a one-command bootstrap; v4-readiness gives existing forks a structured pre-flight before the v4 cron-key churn lands. Both ship to the ~40-fork install base downstream of `aaronjmars/aeon` main.

**Shipped to users**
- `8fcf2f5` — skill template library + new-from-template (#161)
  - `new-from-template`: 254-line Bash CLI. `--list` enumerates templates; `<template> --tokens` prints replacement tokens; `<template> <name> --var KEY=VALUE...` copies the template into `skills/<name>/`, sed-replaces `[REPLACE: KEY]` tokens, inserts a disabled `aeon.yml` entry before the fallback marker. Bash-3.2 compatible (no `declare -A`; uses parallel `VAR_KEYS`/`VAR_VALS` arrays for stock macOS). KEYs validated against `^[A-Z_][A-Z0-9_]*$` to close a sed-injection path. (+254/−0)
  - `templates/TEMPLATE.md`: shared scaffolding/docs for token format. (+57/−0)
  - `templates/{crypto-tracker,research-digest,code-reviewer,social-monitor,deploy-watcher,community-manager}/SKILL.md`: six runnable starters, each with its own Sandbox note (prefetch / postprocess fallback) so they execute on GitHub Actions out of the box. (+442/−0 across six files)
  - `README.md`: two lines linking the new CLI. (+2/−0)
- `3450b31` — v4-readiness skill (#160)
  - `skills/v4-readiness/SKILL.md`: 289-line skill with the v4 change manifest embedded inline (Removed table empty by design until v4 PRs finalize). Local-mode is pure file I/O over the working tree — no `curl`, no env-var-in-headers, no prefetch. Remote-mode (`var=owner/repo`) uses `gh api contents` — ~5 calls per fork survey, well under the 5,000/h `GITHUB_TOKEN` budget. (+289/−0)
  - `aeon.yml`: register skill, `enabled: false`, no cron. (+1/−0)
  - `generate-skills-json` + `skills.json`: bumped 110 → 111 entries, productivity category. (+20/−7)

---

## tomscaria/swarm-fund-mvp

### Local-LLM cutover chain (paper_triage → ollama → fine-tune)

**What this is:** Six commits (≥21:32 UTC on 2026-05-06, all in one ~25-minute push window) form a coherent thread: (1) hook prompt/completion capture into the LLM client, (2) export 3,462 captured triage pairs into MLX format, (3) ship the LoRA-train + GGUF-convert + Ollama-publish + eval-vs-ground-truth pipeline, (4) wire a stochastic canary router behind `SWARM_TRIAGE_CANARY_PCT`, (5) flip `paper_triage` to honor `OLLAMA_LOCAL` instead of the hardcoded sonnet, and (6) add an `OLLAMA_FULL=1` flag that routes the full sonnet-tier (summarize/judge/generate/chat) to local `qwen2.5:14b`. Net direction: cost-side ADR-094 decisions become operationally executable. None of it is auto-on — `SWARM_TRIAGE_CANARY_PCT` defaults to 0 and `OLLAMA_FULL` to unset, so the cloud path is unchanged until the operator flips a launchd plist.

**Shipped to users** *(product-source paths under `python/`)*
- `eb18354` — fine-tuning pipeline + canary router (Tasks 9-11)
  - `python/llm/router.py`: adds `_triage_canary_pct()` reading `SWARM_TRIAGE_CANARY_PCT` (clamped 0.0–1.0) and gates a stochastic switch in `route_for_task()` so when `task == "classify"` and `prefer_local` is true, that fraction of calls go to `ollama/swarm-triage` instead of the default tier model. Cloud path untouched. (+27/−1)
  - `python/tests/test_llm_router.py`: 4 canary tests (zero/full/no-local/classify-only). (+43/−0)
  - `scripts/finetune_triage.sh`: MLX LoRA on Qwen2.5-7B-Instruct, 2,000 iters, ~3–5h. (+87/−0)
  - `scripts/convert_to_gguf.sh`: merges adapter → GGUF q4 → `ollama create swarm-triage`. (+109/−0)
  - `scripts/eval_finetuned_model.py`: tier-agreement vs ground-truth labels, flags ≥80% as ready. (+124/−0)
  - `scripts/Modelfile.triage`: Ollama model definition. (+14/−0)
- `80b1228` — OLLAMA_FULL routes summarize/judge/generate/chat to qwen2.5:14b (ADR-095)
  - `python/llm/router.py`: adds `TIER_MODEL_OLLAMA_FULL` dict + `_ollama_full()` helper. When both `OLLAMA_LOCAL=1` and `OLLAMA_FULL=1` are set, the sonnet tier maps to `ollama/qwen2.5:14b`. The opus tier (reason tasks) stays on cloud regardless. `OLLAMA_FULL=1` alone is a no-op. (+20/−1)
  - `python/tests/test_llm_router.py`: 9 new tests across all flag combinations. (+108/−0, new file)
  - `DECISIONS.md`: ADR-095 entry (~$15–25/mo expected savings at current volume). (+10/−0)
- `caaec5a` — opt-in LLM_CALL_LOG for prompt-completion capture
  - `python/llm/client.py`: adds `_maybe_log_call()` that appends `{ts, agent_id, task, model, prompt, completion}` rows to the path in `LLM_CALL_LOG` after `log_cost()`. Silent when env var unset. Never raises into the call path. (+46/−0)
  - `python/tests/test_llm_client.py`: 3 new tests (set/unset/IO-error). (+77/−0)
- `42a5ba5` — paper_triage routes through OLLAMA_LOCAL instead of hardcoded sonnet
  - `python/research/papers/paper_triage.py`: replaces import-time `model = "sonnet-4-6"` constant with `_resolve_triage_model()` lazy resolver evaluated at call time. Fixes both pytest monkeypatching and launchd env-var injection (where `os.environ` isn't set until after import). (+20/−2)
  - `python/tests/test_paper_triage.py`: 4 tests cover both modes. (+48/−0)

**Under the hood**
- `e0ad1b5` — `scripts/export_finetune_dataset.py` (+161/−0). Reconstructs `(prompt, completion)` pairs from `papers.db:paper_triage` using the same `TRIAGE_PROMPT` template; outputs 90/10 train/eval split in MLX chat-message format. `--exclude-skip` flag for class imbalance. Reported run: 3,115 train + 347 eval = 3,462 pairs.
- `99ae5e6` — backfill tests for `/router_suggestions` Telegram command (+67/−0); function was already implemented in ADR-094, this commit closes the test-coverage gap.

### Pitch-surface polish

**What this is:** Skill chips on the public landing page — categorized chip strip on the Founder section and the InvestorsDeck sec-06 slide. Affects what LP / grant readers see when they hit the site.

**Shipped to users**
- `a65e936` — skill chips on Founder + InvestorsDeck with cross-theme contrast fixes
  - `swarm-lab-site/src/components/Founder.tsx`: render the chip strip. (+6/−0)
  - `swarm-lab-site/src/pages/InvestorsDeck.tsx`: same render in deck slide. (+9/−0)
  - `swarm-lab-site/src/content/copy.tsx`: source the four-category data. (+15/−0)
  - `swarm-lab-site/src/styles/components.css`: WCAG-AA-safe palette on Dark Cartography theme + `color-mix()` overrides for every lore-token theme so chips stay legible regardless of `data-theme`. (+81/−0)

### Internal: research KB build-out

**What this is:** Two operator-action commits with empty file diffs (DB build steps gitignored) plus one runner script. The DB writes happened locally; the commits log that they happened. No production code path touched.

**Under the hood**
- `846cf44` — `scripts/run_analogy_synthesis.py` Phase G runner (+155/−0). Calls `judge_pair()` directly without domain filter; intended to run after MIT OCW harvest populates non-finance concepts with `source_domain`, at which point the same runner produces the cross-disciplinary analog edges.
- `0be0537` — verify `harvest_mit_ocw.py` live (Firecrawl scrape working). Zero-diff log entry; commit notes 10 MIT OCW math resources inserted into `kb_sources` with `domain='math'`. Bulk harvest still awaits the operator's full OCW search URL.
- `a23f999` — build initial `kb_concepts` embedding index (3,446 concepts). Zero-diff log entry; ran `python -m python.research.knowledge.embeddings` to populate `kb_concept_embeddings` in `data/papers.db`. Embeddings: BAAI/bge-small-en-v1.5 (384-dim, brute-force cosine).

---

## Developer notes
- **New dependencies:** `mlx-lm` becomes operator-side optional for `scripts/finetune_triage.sh` (not a runtime dep — only needed when training the canary model). No package-manifest version bumps.
- **Breaking changes:** none. Every flag added today defaults to off (`SWARM_TRIAGE_CANARY_PCT=0`, `OLLAMA_FULL` unset, `LLM_CALL_LOG` unset, `enabled: false` on v4-readiness skill). The `paper_triage` routing fix preserves the cloud-mode default (sonnet-4-6).
- **New public surface:**
  - `aaronjmars/aeon`: `./new-from-template` CLI (six template names; `--list`/`--tokens`/`--var` flags). New `v4-readiness` skill (workflow_dispatch only).
  - `tomscaria/swarm-fund-mvp`: env vars `SWARM_TRIAGE_CANARY_PCT` (0.0–1.0), `OLLAMA_FULL` (boolean-ish), `LLM_CALL_LOG` (path). New ollama model name `swarm-triage`. ADR-095 entry in `DECISIONS.md`.
- **Tech debt added:** none observed in diffs. Two zero-file-change "log" commits (`0be0537`, `a23f999`) document local DB-build runs but are not meaningful version-control state — fine for an operator-side audit trail, less fine if treated as code commits in a `git log` review.

## Open threads
- swarm-fund-mvp open queue (per yesterday's repo-article framing): PRs #30 (variant_bandit) + #31 (aeon_adapter) — neither moved today. The 72h merge-cadence test from 2026-05-06 (does a new ADR open by 2026-05-09, or do PRs #30/#31 stall?) is still running. ADR-095 *did* land today inside `eb18354` / `80b1228` (commit-level ADR entry in `DECISIONS.md`), which counts toward the cadence test on the "new ADR opens" side.
- The canary chain ships disabled by default on every flag. Until the operator flips `SWARM_TRIAGE_CANARY_PCT > 0` and runs `eval_finetuned_model.py --limit 100` and crosses the ≥80% agreement gate, the cost-saving thesis behind ADR-094/095 is built but not measured.
- `aeon.yml` v4-readiness entry registered with `enabled: false`. No automation runs the readiness check on the ~40 fork install base — pure operator-dispatch.
- ADR-093 falsifier (`tomscaria/aeon` must ship `outputs/{skill}/{date}.json` JSON contract by ~2026-05-17) — still 11 days remaining; nothing today touches that contract.

## Sources
- tomscaria/swarm-fund-mvp: ok (105 commits, 95 bot-filtered, 0 diff-truncated)
- aaronjmars/aeon: ok (2 commits, 0 bot-filtered, 0 diff-truncated)
- tomscaria/lore-financial-teaser: empty (no commits in 24h window)
- gh api events: not used (commits + PR list sufficient)
- gh api commits: ok
- gh pr list: ok
- bot-filtered: 95 (`data: refresh site metrics`, automated 15-min cadence on `tomscaria/swarm-fund-mvp` site-metrics path)
- diff-truncated: 0
