# Push Recap — 2026-05-08

## Verdict
> SHIPPING — huggingface-trending skill lands, reply-maker XAI prefetch unblocks day-13 carrier

**Shape:** 2 user-visible commits · 0 internal · 0 infra · 96 automation-filtered (swarm-fund-mvp `metrics.json` heartbeat)
**Volume:** 7 files changed, +229/-5 lines across 2 human commits by 2 authors
**Merged PRs:** 2 (#162 huggingface-trending skill; #156 reply-maker XAI prefetch fix)

---

## Top impact today
1. `9c36154` — feat: add huggingface-trending skill (#162). Adds a new daily research skill that pulls trending HF models/datasets/spaces from the keyless `/api/{models,datasets,spaces}?sort=trendingScore` endpoints, applies six noise filters (test/debug, low-signal gated, trivial fine-tunes, 3-day refeatures, quantization-only forks under 500 likes, broken/scaffold spaces), tags each survivor DEBUT/ACCELERATING/RETURNING/HOLDOVER, clusters into five buckets (LLMs/Reasoning, Multimodal, Agents/Tooling, Datasets, Spaces), and forces an 18-word "why notable" line per pick. (5 files, +196/-3)
2. `795a5a1` — fix(reply-maker): wire XAI prefetch case + cache-read path (#156). Adds a `reply-maker)` branch to `scripts/prefetch-xai.sh` that detects var shape (numeric → X list ID, `@handle` → handle with `allowed_x_handles` filter, else → topic) and writes results to `.xai-cache/reply-maker.json`; rewrites `skills/reply-maker/SKILL.md` to read that cache as Path A and explicitly skip runtime curl under sandbox. (2 files, +33/-2)

---

## aaronjmars/aeon

### [Theme 1 — New artifact-layer surface for the AI ecosystem digest stack]

**What this is:** `aeon` already has `paper-pick` (one daily HF Papers pick) and `paper-digest` (multiple paper summaries) for research, plus `github-trending` for repos. Until today there was nothing covering the model/dataset/space layer that ships alongside (and frequently before) the paper. PR #162 fills that hole and slots into the 09:30 UTC morning block right after `github-releases`, completing the papers → repos → HF Hub triptych for "what moved overnight in the AI ecosystem."

**Shipped to users**
- `9c36154` — feat: add huggingface-trending skill (#162)
  - `skills/huggingface-trending/SKILL.md`: 179-line spec defining the keyless HF API fetch (limit 20 models / 15 datasets / 15 spaces sorted by `trendingScore`), six noise filters with explicit keep-rules for novel architectures, four-state momentum tagging based on `createdAt`/`trendingScore`/`likes`, five-bucket clustering capped at 8 picks total, mandatory ≤18-word "why notable" line per pick (drop the pick if you can't write it), Top pick framing, four exit codes (`HF_TRENDING_OK` / `_QUIET` / `_ERROR` / `_BAD_VAR`), and the curl-then-WebFetch sandbox fallback pattern. New file. (+179/-0)
  - `aeon.yml`: registers the skill at `30 9 * * *`, pinned to `claude-sonnet-4-6` for cost discipline, `enabled: false` so the operator opts in. (+1/-0)
  - `skills.json`: bumps total `111 → 112`, adds the new skill catalog entry under the `research` category with `updated: 2026-05-08`. (+14/-2)
  - `generate-skills-json`: adds `huggingface-trending) echo "research"` to the category-mapping case statement. (+1/-0)
  - `README.md`: bumps "Research & Content (17)" → "(18)" and inserts `huggingface-trending` into the cluster list right after `paper-pick`. (+1/-1)

### [Theme 2 — Reply-maker XAI prefetch unblocks operator-priority carrier]

**What this is:** PR #156 was day 13 idle and listed in `MEMORY.md` as a top-tier operator-blocking carrier alongside chain-runner and reddit-prefetch — its ISS-014 EMPTY/DEGRADED recurrence count was at 12 because the runtime curl pattern was the only path and the sandbox blocks it. This merge ports `reply-maker` onto the same prefetch contract `narrative-tracker` and `tweet-roundup` already use, so `reply-maker` can finally consume XAI `x_search` results in CI.

**Shipped to users**
- `795a5a1` — fix(reply-maker): wire XAI prefetch case + cache-read path (#156)
  - `scripts/prefetch-xai.sh`: new `reply-maker)` case (+21 lines). Three branches by `${var}` shape — numeric for X list IDs (`https://x.com/i/lists/${VAR}`), `@`-prefixed for single-handle queries with `allowed_x_handles` filter, else free-text topic. Empty `${var}` exits 0 with a logged "skipping" line so the skill cleanly falls through to its memory/WebSearch path. All three branches request 12 reply-worthy original posts (not retweets, not replies), prioritize the last 6 hours, and capture handle/text/url/posted_at/engagement counts.
  - `skills/reply-maker/SKILL.md`: introduces a "Path A — pre-fetched cache (preferred)" section with the `jq` recipe to extract candidates from `.xai-cache/reply-maker.json`; demotes runtime curl to "Path B — Skipped" with an explicit sandbox note; renumbers the fallback chain so the cache is step 1 ahead of memory logs and WebSearch. (+12/-2)

---

## Developer notes
- **New dependencies:** none (HF API is keyless; XAI fix uses existing `prefetch-xai.sh` machinery and `jq`).
- **Breaking changes:** none. Both PRs ship behind opt-in flags — `huggingface-trending` is `enabled: false` in `aeon.yml`; `reply-maker` Path A only activates when the prefetch cache file exists.
- **New public surface:** `huggingface-trending` skill (`./add-skill aaronjmars/aeon huggingface-trending`); 4 new exit codes (`HF_TRENDING_OK`, `HF_TRENDING_QUIET`, `HF_TRENDING_ERROR`, `HF_TRENDING_BAD_VAR`); skill total 111 → 112; Research & Content cluster 17 → 18.
- **Tech debt added:** none observable in either diff. SKILL.md cleanup section in PR #162 explicitly deletes `.hf-{models,datasets,spaces}.json` intermediates after step 8.

## Open threads
- `huggingface-trending` ships disabled — operator must flip `enabled: true` in `aeon.yml` to bring it online for the 09:30 UTC slot.
- ISS-014 (reply-maker EMPTY/DEGRADED, recurrence 12 in MEMORY) should close on the next reply-maker run that successfully consumes `.xai-cache/reply-maker.json` — verify on tomorrow's dispatch and graduate the issue if the cache populates and the skill returns non-empty.
- swarm-fund-mvp pushed only the automated `metrics.json` heartbeat in this window — no human merges. Last week's ADR-093/094/095 defect-hardening phase (PRs #29/#30/#31/#32) showed no merge motion in the last 24h. The 72h merge-cadence test (does a new ADR open by 2026-05-09, or do PRs #30/#31 stall?) tightens by one day; still inside healthy-defect-hardening framing but watch for a 48h flat-line tomorrow.
- tomscaria/lore-financial-teaser silent for the day — no commits, no PRs.

## Sources
- aaronjmars/aeon: ok
- tomscaria/swarm-fund-mvp: ok (96 automated metrics-refresh commits, single file `swarm-lab-site/public/metrics.json`, +84/-84 each — folded as automation, not human work)
- tomscaria/lore-financial-teaser: empty
- gh api events: ok
- gh api commits: ok
- gh pr list: ok
- bot-filtered: 96 (automated `data: refresh site metrics` on swarm-fund-mvp; author is `tomscaria` so falls outside the literal `*-bot` filter, but identical message + 15-min cadence + single-file `metrics.json` touch = automation by spirit)
- diff-truncated: 0
