## Summary

Ran daily-ops-review as chain Step 4 for 2026-05-20 from upstream chain context.

**Verdict: Complete — 2 ✓, 6 ⚠, 1 ✗.**

- **✓ clean (2):** perps-scan (QUIET, 2 ACCUMULATION — ZEC, NEAR), perps-brief (3 HIGH CONVICTION — ZEC, NEAR, LIT)
- **⚠ ISS-005 Summary-blob leak (6):** market-context-refresh, aixbt-pulse, narrative-tracker, token-movers, token-call, morning-macro — each contains the assistant `## Summary` blob in `.outputs/` instead of the v2.1 locked format. token-call is newly affected today; previously clean.
- **✗ monitor-runners:** `.outputs/monitor-runners.md` holds the literal seven-byte payload `--help`. Skill log records a clean run with a 1.5kb v2-locked signal written. Something overwrote the artifact between the skill's write and Step 4's read. Distinct failure mode from ISS-005.

**Sources:** all clean — coingecko, defillama, fng, polymarket, geckoterminal, aixbt, websearch. No source-side degradations.

**New issue filed:** **ISS-006** (high · output-format) for the monitor-runners overwrite. Documents the hypothesis space (chain-runner / postprocess script / aliased command writing `--help` to the artifact path).

**Chain duration:** n/a — no `GITHUB_RUN_ID` exposed, no bracketing log timestamps; 7-day median still unestablished.

**Files:**
- `.outputs/daily-ops-review.md` — v2.1 locked layout. Wrote via Write before composing this chat Summary to avoid the ISS-005 trap.
- `memory/issues/ISS-006.md` (new)
- `memory/issues/INDEX.md` (added ISS-006, revised ISS-005 affected_skills: dropped monitor-runners, added token-call)
- `memory/issues/ISS-005.md` (frontmatter affected_skills synced)
- `memory/logs/2026-05-20.md` (appended `## Daily Ops Review` block)
- `.pending-notify/daily-ops-review-20260520.signal.md` (queued for post-run Discord delivery to #aeon-ops; inline `./notify --signal "$(cat ...)"` blocked by sandbox)

**Self-check vs writing-style v2.1 Section 4:** ran clean across Patterns 1–6. No participle ambiguity, no adjective stacking, no banned internal jargon (skill/artifact/.outputs/ are operator-monitoring-channel allowed), one tolerated passive ("overwritten by an unknown later step" — the agent really is unknown), no em-dashes used as connectors, no weak verbs.

**Follow-ups:** ISS-005 still needs the perps-scan v3 structured-render pattern generalized to the remaining six skills. ISS-006 needs `chain-runner.yml` + `scripts/postprocess-*.sh` inspected for a stray write path to `.outputs/monitor-runners.md` after the skill exits.
