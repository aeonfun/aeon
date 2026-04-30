## Summary

Ran the **external-feature** skill against `tomscaria/swarm-fund-mvp` (per MEMORY.md "Next Priorities" directive — same lane as PRs #18/#19/#20/#22/#23).

**What:** `fix(triage): defensive parsing of LLM scores + reasoning` — `paper_triage.triage_paper` was building `TriageDecision` with `float(parsed.get("relevance_score", 0.0))`. The default only kicks in when the **key** is missing — when Opus 4.7 returns `"relevance_score": null` on sparse abstracts, `float(None)` raises `TypeError` that bubbles past `run()`'s narrow `except (MissingApiKey, BudgetExceeded)` clause and kills the entire batch loop. Same bug class as the deepseek-tier counts KeyError fixes (`d85bccb` / `3f9a1af`) the literature → strategies playbook (`9865acb`) flags.

**Fix:** Extracted decision-construction into `_decision_from_parsed()` and added a `_safe_float()` helper. Also coerce non-string `reasoning` (list/dict) instead of relying on implicit `str()`.

**Files changed:** 2 (+184 / -15) — `python/research/papers/paper_triage.py` + new `python/tests/test_paper_triage.py` (10 tests, no LLM call needed since the parsing path is now testable in isolation).

**PR:** https://github.com/tomscaria/swarm-fund-mvp/pull/24
**Branch:** `ai/paper-triage-defensive-parse`

**Notification:** queued in `.pending-notify/` (immediate send dedup-skipped after a sandbox-blocked first attempt).
**Log:** appended to `memory/logs/2026-04-30.md`.

EXTERNAL_FEATURE_OK
