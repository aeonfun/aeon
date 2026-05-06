# Push Recap — 2026-05-06

## Verdict
> SHIPPING — paper_triage OLLAMA_LOCAL hatch + aeon star-momentum-alert + dashboard hardening

**Shape:** 3 user-visible commits · 4 internal · 0 infra · 96 automation-only (timestamp-only metric refreshes)
**Volume:** 8 files changed, +590/-9 lines across 7 substantive commits by 2 authors
**Merged PRs:** 2 (#159 star-momentum-alert; #158 dashboard execFileSync hardening) — both on aaronjmars/aeon

---

## Top impact today

1. `42a5ba5` — fix(paper_triage): route through OLLAMA_LOCAL instead of hardcoded sonnet. Adds an env-flag escape hatch on the swarm-fund research-triage hot path: when `OLLAMA_LOCAL=1`, `triage_paper()` calls `ollama/qwen2.5:7b-instruct` locally instead of Anthropic Sonnet. Resolution is lazy (per-call, not at import time) so launchd env injection and pytest monkeypatch both work. Direct surface for the cost-discipline OPS ALERT — current ~$2,696/mo projection has Sonnet triage as a non-trivial line item; flipping a launchd flag now gates it without code redeploy. (2 files, +68/-2)
2. `1e167cf` — feat(star-momentum-alert): project next milestone crossing date for show-hn-draft dispatch timing (#159). Daily Sonnet skill that walks 14 days of `repo-pulse` log blocks, projects the next star-milestone crossing via 7-day linear extrapolation, alerts only when the projection lands 7-14d out **and** on Tue/Wed/Thu — i.e. when `show-hn-draft` should be dispatched. Shipped registered but `enabled: false`. (3 files, +295/-2)
3. `89d566b` — fix(dashboard/skills/run): use execFileSync to harden against shell injection (#158). Mirrors PR #150's pattern on the last `execSync` path that interpolated user input (`var`, `model`) on the dashboard's `workflow_dispatch` trigger. Whitelist already neuters metacharacters; this is defense-in-depth. (1 file, +5/-5)

The 96 swarm-fund-mvp commits in the window labelled `data: refresh site metrics` are all `+1/-1` changes to the `generated_at` timestamp line in `swarm-lab-site/public/metrics.json`. Treated as automation noise, not bot-filtered (author is `tomscaria`, not `*-bot`).

---

## tomscaria/swarm-fund-mvp

### [Theme 1 — Cost-router escape hatch on the research pipeline]

**What this is:** The paper-triage hot path now honours an `OLLAMA_LOCAL` env flag and calls a local 7B model (qwen2.5:7b-instruct via ollama) when set, instead of routing every call through Anthropic Sonnet. This is the first concrete cost-control lever on the research pipeline since ADR-094 landed 2026-05-03 — and it lands the same week MEMORY.md flagged the ~$2,696/mo projection vs. the $40/wk discipline budget.

**Shipped to users (operator-visible)**
- `42a5ba5` — fix: route paper_triage through OLLAMA_LOCAL instead of hardcoded sonnet
  - `python/research/papers/paper_triage.py` (+20/-2): adds `_resolve_triage_model()` lazy resolver — checks `os.environ.get("OLLAMA_LOCAL")` against `("1", "true", "yes")` on every call, returns `ollama/qwen2.5:7b-instruct` when set, otherwise falls through to `DEFAULT_TRIAGE_MODEL = "anthropic/claude-sonnet-4-6"`. `triage_paper()` signature switches `model: str = DEFAULT_TRIAGE_MODEL` to `model: Optional[str] = None` so the resolver runs on each invocation (important for launchd env injection where the env may not be set at import time). The inline comment cites "ADR-NNN (2026-05-06)" — placeholder ADR number, no number written into the diff yet.
  - `python/tests/test_paper_triage.py` (+48/-0): two new tests using `monkeypatch.setenv` and `unittest.mock.patch.object(pt, "complete", ...)`. `test_ollama_local_flag_routes_triage_to_local` asserts the captured model `startswith("ollama/")`; `test_cloud_mode_keeps_sonnet_default` asserts `"anthropic" in captured["model"]`.

**Under the hood — Phase G knowledge-base build**

A four-commit research-pipeline build that reaches behind the gitignored `data/papers.db` to set up the analogy-synthesis pass. None of these commits ships user-facing surface, but together they unblock the next research-data milestone.

- `a23f999` — feat: build initial kb_concepts embedding index (3446 concepts) — empty commit (zero file diff). Documents running `python -m python.research.knowledge.embeddings` to populate the gitignored `kb_concept_embeddings` table in `data/papers.db`. Embeddings: `BAAI/bge-small-en-v1.5`, 384-dim, brute-force cosine retrieval. Smoke-tested with retrieval query — top-5 results correct.
- `846cf44` — feat: add run_analogy_synthesis.py Phase G runner script
  - `scripts/run_analogy_synthesis.py` (new, +155/-0): CLI runner for the analogy-synthesis pass. Pulls pillar-tagged target concepts from `kb_concepts` (`revenant_pillars IS NOT NULL`), retrieves top-K semantically similar candidates via `python.research.knowledge.retrieval.retrieve()`, dedupes pairs already judged in `kb_concept_links` with `relation = 'analog_of'`, calls `judge_pair()` (sonnet by default at ~$0.032/call), persists verdicts. Has a `--dry-run` mode that prints pairs and an estimated cost without LLM calls. Skips domain filter because `source_domain` is NULL for all current concepts (MIT OCW not yet harvested).
- `0be0537` — feat: verify harvest_mit_ocw.py live — Firecrawl scrape working — empty commit. Documents a test run inserting 10 MIT OCW math resources into `kb_sources` with `domain='math'`. Bulk harvest is paused awaiting the founder's full OCW search URL (the ~50-topic faceted query from the ADR-092 plan).
- `99ae5e6` — test: add tests for /router_suggestions Telegram command
  - `python/tests/test_router_suggestions_telegram.py` (new, +67/-0): three async test cases (anyio) for `render_router_suggestions()` — empty-log path, top-suggestion-formatting path, router-import-failure safe-error path. Tests patch `python.llm.router.SUGGESTIONS_LOG` to a `tmp_path` JSONL file. Pinned to the LLM router's per-tier-mismatch suggestions stream that ADR-094 introduced.

### Internal: Metrics-refresh cron

The 96 `data: refresh site metrics` commits are the cron-driven heartbeat on `swarm-lab-site/public/metrics.json` (15-min interval). Sampled head and tail: every commit is a `+1/-1` change to the `generated_at` timestamp line — agent metrics did not change. Trust live `metrics.json` at https://rswarm.ai/metrics.json over any inference from these commits.

---

## aaronjmars/aeon

### [Theme 2 — Launch-timing instrumentation]

**What this is:** aeon now has a dispatch-timing oracle for its own Show HN launch. It watches its own star-count series in `memory/logs/`, projects when the next round milestone (300, 500, 1000) crosses, and only fires when that crossing falls inside the Tue–Wed–Thu launch window 7-14 days out. Closes the lead-time gap between "show-hn-draft is ready" (PR #151, May 1) and "today is the day to dispatch it." aeon at 276⭐ on May 6; the 300 milestone is the active first target with a memory-noted ~05-13 ETA.

**Shipped to users**
- `1e167cf` — feat(star-momentum-alert) (#159)
  - `skills/star-momentum-alert/SKILL.md` (new, +280/-0): the full skill — walks `memory/logs/${date}.md` for 14 days, greps `**owner/repo**: stargazers_count=N` lines that `repo-pulse` writes, builds per-repo daily series, normalizes day-gaps, computes 3-day and 7-day rolling deltas, projects next-milestone crossing via 7-day mean, gates on weekday + days-remaining, dedupes per `(repo, milestone)` with a 7-day re-emit window. State in `memory/topics/star-momentum-state.json`. Pure local file I/O — no curl, no `gh api`, no env-var-in-headers.
  - `aeon.yml` (+1/-0): schedule `10 10 * * *`, sonnet model, `enabled: false` slot inserted after `star-milestone`.
  - `skills.json` (+14/-2): catalog total `109 → 110`, registers the entry alphabetically after `star-milestone` in the dev category.

### [Theme 3 — Dashboard shell-out hardening]

**What this is:** The last `execSync` path on the dashboard that round-tripped user-supplied input through bash now uses `execFileSync` with an argv array, matching the pattern PR #150 set on `secrets/route.ts` and `auth/route.ts:46`. The `var` and `model` whitelists already strip shell metacharacters, so this isn't a live exploit — it removes the place where dashboard input still touched a shell at all.

**Shipped to users**
- `89d566b` — fix(dashboard/skills/run) (#158)
  - `dashboard/app/api/skills/[name]/run/route.ts` (+5/-5): replace `execSync` (string command) with `execFileSync` (file + args array); drop the `JSON.stringify` shell-quoting on `var`/`model` since `gh` receives `-f key=value` directly without bash.

The PR description notes the author audited the other `execSync` call sites (`auth`, `analytics`, `runs`, `runs/[id]/logs`, `outputs`, `sync`, `skills` GET) and confirmed they all use hardcoded commands or pre-validated digit-only IDs — so this commit closes the dashboard's last user-input shell surface.

---

## tomscaria/lore-financial-teaser

Empty in the window. Last push event 2026-05-03 21:21 UTC. No commits, no merged PRs.

---

## Developer notes
- **New dependencies:** none in the diffs. The kb_concepts commit notes a runtime dependency on `BAAI/bge-small-en-v1.5` (sentence-transformers / huggingface) but the dependency line itself was not modified in the window.
- **Breaking changes:** the `paper_triage.triage_paper()` signature changes its `model` parameter from `str = DEFAULT_TRIAGE_MODEL` to `Optional[str] = None`. Callers passing positional `model=` strings still work; callers omitting `model` now get the resolver's runtime answer instead of the import-time constant — that **is** a behavior change for any test or harness that previously assumed the cloud Sonnet model and runs in an env where `OLLAMA_LOCAL` happens to be set.
- **New public surface:**
  - swarm-fund: new env flag `OLLAMA_LOCAL` is now load-bearing on the research pipeline (values `1` / `true` / `yes` route through ollama). Operator config surface — should be documented in the ADR backfill.
  - swarm-fund: new script entry point `scripts/run_analogy_synthesis.py --targets N --candidates K [--dry-run]`. CLI flags are operator-visible.
  - aeon: new skill `star-momentum-alert` registered in `skills.json` and `aeon.yml`. New state file path expected: `memory/topics/star-momentum-state.json`. New article path expected per the SKILL.md.
  - aeon: no new dashboard route or CLI flag — `skills/[name]/run/route.ts` is an existing endpoint, internals only.
- **Tech debt added:** `paper_triage.py` line cites `ADR-NNN (2026-05-06)` — placeholder ADR number not yet allocated. If the ADR backfill doesn't land, this comment becomes a dangling reference. Otherwise diffs are clean.

## Open threads
- swarm-fund: ADR backfill for the OLLAMA_LOCAL routing change — diff comment says `ADR-NNN (2026-05-06)`, no actual ADR file in the commit set. Will likely land separately given the 72h merge-cadence test memory note (decides healthy-defect-hardening vs queue-stagnation by 2026-05-09).
- swarm-fund: bulk MIT OCW harvest awaits the founder's full OCW search URL (the ~50-topic faceted query from ADR-092). The `0be0537` commit message names this as the next gate. Until it lands, `kb_concepts.source_domain` stays NULL and the analogy-synthesis runner has to skip the domain filter (its current behavior).
- swarm-fund: ADR-093 falsifier window — `tomscaria/aeon` must ship `outputs/{skill}/{date}.json` JSON contract by ~2026-05-17 or the wire-up is aspirational. 11 days remaining.
- aeon: `star-momentum-alert` is registered with `enabled: false`. Operator must flip the flag in `aeon.yml` for the skill to actually run on its 10:10 UTC slot. The PR description says "Operator enables the skill in `aeon.yml` once the running instance has at least 4 days of `repo-pulse` data on disk (already true)." — gate is operator action, not data sufficiency.
- swarm-fund: zero substantive `python/strategies/` or `python/runners/` commits in the window. The five new commits are all on the research / triage / knowledge-base side — not on agent-runtime or strategy code. CalibrationGap (Revenant) live state is unchanged from these.
- aeon: no progress on the `tomscaria/aeon` 9 stalled PRs (#1–#5, #8–#11) — those live on the other fork; not in the window's commit set but flagged in MEMORY.md as the pipeline that must close to deliver the swarm-fund tick-broker contract.

## Sources
- tomscaria/swarm-fund-mvp: ok (101 commits — 5 substantive + 96 automation noise, 0 merged PRs)
- tomscaria/lore-financial-teaser: empty (0 commits, 0 merged PRs, last push 2026-05-03)
- aaronjmars/aeon: ok (2 commits, 2 merged PRs)
- gh api events: ok
- gh api commits: ok
- gh pr list: ok
- bot-filtered: 0 (none matched the `*-bot` / `chore(deps):` rule)
- diff-truncated: 0
- automation-only flagged separately: 96 (swarm-fund-mvp metrics-cron)
