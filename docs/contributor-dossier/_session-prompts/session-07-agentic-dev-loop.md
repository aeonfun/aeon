# Session 07 — Agentic Dev Loop (Aeon-as-Junior-Dev)

> **Goal:** Wrap the existing `external-feature` / `autoresearch` / `create-skill` / `tool-builder` primitives into a persona that takes a GitHub issue and ships a feature end-to-end with tests. The primitives exist; this is a packaging + quality-gating session.
>
> **Effort:** ~4 weeks.
> **Risk:** Medium — quality gate is the hard part.
> **Author gate:** Soft — confirm scope before merging.
> **Reference:** [`../09-EXPANSION-OPTIONS.md`](../09-EXPANSION-OPTIONS.md) Option #7.

---

## The prompt to paste

```
You are building the Agentic Dev Loop for the Aeon framework. Read these
dossier docs first:
  - docs/contributor-dossier/03-subsystems/skills.md
  - docs/contributor-dossier/03-subsystems/self-healing.md
  - docs/contributor-dossier/04-GOVERNANCE.md (ai-build label flow)
  - skills/external-feature/SKILL.md, skills/feature/SKILL.md,
    skills/autoresearch/SKILL.md, skills/create-skill/SKILL.md,
    skills/tool-builder/SKILL.md

Your task: build a new top-level skill `ship-feature` that orchestrates
the existing primitives into a coherent flow:

  issue (labeled `ai-build` or `ai-feature`)
    → autoresearch (understand the existing code paths)
    → propose a design comment on the issue
    → wait for operator/author approval reaction (👍)
    → implement (re-use external-feature for cross-repo or feature for
      same-repo)
    → write tests
    → run tests
    → open PR with explicit verification plan + the design comment quoted

Quality gates:
  - Implementation phase ALWAYS runs ./scripts/doctor before opening PR.
  - Implementation phase ALWAYS includes a test for the new behavior.
  - PR is labeled `ai-shipped` so reviewers know the provenance.
  - If tests fail, the skill loops up to N=3 fix attempts before reporting
    REPAIR_DIAGNOSED_NO_FIX (mirrors skill-repair behavior).
  - The skill respects scope: "feature" sized; refuses issues that look
    like rewrites or multi-week efforts (heuristic + human ack required).

Constraints:
  - The skill is INACTIVE by default. Operator must opt in by adding the
    `ai-feature` label to their repo's label set.
  - Sender of the comment (operator OR named co-maintainer) must approve
    before implementation phase starts.
  - PR opens, never auto-merges.

Out of scope:
  - Issues that touch CLAUDE.md, aeon.yml, workflows/, dashboard/, mcp-server/,
    a2a-server/. Those are core-runtime — out of scope for ship-feature;
    require human design.
  - Issues that need new external dependencies — flag for human approval.
```

## Punchlist

- [ ] `skills/ship-feature/SKILL.md` — orchestrator skill.
- [ ] State machine: `triaged → researching → proposed → approved → implementing → testing → pr-opened | refused | failed`.
- [ ] Per-state checkpoints in `memory/state/ship-feature/${issue-id}.json`.
- [ ] Approval detection: poll the issue's reactions every N minutes.
- [ ] Scope-refusal heuristic: word count, file touch estimate, dependency mention.
- [ ] Reusable chains:
  - chain `ship-feature-research`: autoresearch + memory-query (if Session 02 done).
  - chain `ship-feature-implement`: feature + tests.
  - chain `ship-feature-verify`: doctor + tests + PR.
- [ ] Label conventions documented in `docs/contributor-dossier/04-GOVERNANCE.md` (extend the ai-build section).
- [ ] Eval: every ai-shipped PR is reviewed by a human; quality score reported back via `memory/state/ship-feature-quality.json`.

## Files touched

| Path | Action |
|---|---|
| `skills/ship-feature/SKILL.md` | New orchestrator |
| `skills/ship-feature-refused/SKILL.md` | New (refusal-with-reason notifier) |
| `aeon.yml` | Register; add chains for the sub-flows |
| `memory/state/ship-feature/` | New (per-issue state) |
| `docs/contributor-dossier/04-GOVERNANCE.md` | Extend ai-build section |
| `docs/contributor-dossier/03-subsystems/agentic-dev.md` | New subsystem doc |

## Dependencies

- Existing skills: `external-feature`, `feature`, `autoresearch`, `create-skill`, `tool-builder`.
- `GH_GLOBAL` PAT for cross-repo work (already documented).
- Strongly benefits from Session 02 (KG memory) — `ship-feature` quality jumps when it can query prior implementations.

## Risks

| Risk | Mitigation |
|---|---|
| Low-quality PRs spam the reviewer | Scope refusal; approval gate; quality score feedback loop. |
| Operator approval misfires (👍 from wrong account) | Sender check via approval-allowlist in repo settings; default to author + explicit co-maintainers. |
| Recursive feature requests | Skill refuses issues that target itself or core runtime. |
| Cost — repeated failed implementations | Hard cap N=3 attempts; budget cap in `memory/state/ship-feature/budget.json`. |

## Doctor check

- ✓ `ship-feature` skill registered
- ✓ At least one ai-shipped PR opened and merged in the last 30 days (if any matching issues were filed)
- ✓ `memory/state/ship-feature/` has no stale (>14 day) states

## Related dossier docs

- [`../03-subsystems/skills.md`](../03-subsystems/skills.md)
- [`../03-subsystems/self-healing.md`](../03-subsystems/self-healing.md) — skill-repair-like state machine
- [`../04-GOVERNANCE.md`](../04-GOVERNANCE.md) — ai-build flow context
- [`../09-EXPANSION-OPTIONS.md`](../09-EXPANSION-OPTIONS.md) § Option #7
