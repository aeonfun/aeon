# Mode: Sealed Sprint

A pre-authorized, local-only, end-to-end work mode. The agent drives autonomously through a punchlist; nothing leaves the working tree until the operator breaks the seal.

---

## When to use it

- You want a focused unit of work executed end-to-end without per-step approvals.
- You're willing to inspect the result before any release rather than gating each step.
- The work fits in one session and produces a coherent artifact (a session prompt from `_session-prompts/`, a refactor across N files, a bug investigation with a fix).

Don't use it for:

- Open-ended exploration (use a regular conversational session).
- Work that crosses repos or needs external coordination (use the standard PR flow).
- Anything that has irreversible side effects you wouldn't want to undo even with full local-only constraints (rare).

---

## The contract

### Authorization (pre-granted)

- Full read/write/edit on any file in the working tree.
- Shell commands allowed within the existing permission settings.
- Free use of all tools (Bash, Read, Write, Edit, Agent, TodoWrite, etc.).
- No per-step "may I" prompts. The seal is the gate; everything inside the seal is authorized.

### Locality (the seal)

- **No `git commit`, no `git push`, no `git tag`, no PR creation, no release.**
- **No external state mutations**: no notifications fired to production channels, no API calls that create/update remote records, no posts to social platforms.
- Working tree is the only persistence layer.
- New files and directories may be created freely; that's the work surface.

### Completeness (the gate)

- Define the punchlist via TodoWrite at the start of the sprint.
- Drive every item to completion. No partial work.
- "Complete" = code written + tests pass locally (if a test surface exists) + dossier doc updated to reflect the change + doctor check green (if applicable).
- On a genuine blocker (missing credential, undecided architecture choice, scope gap) — stop, surface, wait. **Don't fake around it.**

### Documentation discipline (kept current)

- Code changes have matching dossier updates *before* the item is marked complete.
- New skills → subsystem doc page (or addition to existing one).
- New runtime features → update `01-ARCHITECTURE.md`.
- New security surfaces → update `05-SECURITY.md`.
- Open decisions → append to `08-OPEN-QUESTIONS.md`.

### Sprint log (the trail)

- Append-only `docs/contributor-dossier/_sprint-log/${YYYY-MM-DD}-${slug}.md`.
- One entry per meaningful action: what you did, what you learned, what you skipped and why.
- The sprint log is the artifact the operator reviews before breaking the seal.

### Visibility (the punchlist)

- TodoWrite tracks every meaningful unit of work.
- Updated in real time, not batched.
- One `in_progress` item at a time.
- Items move to `completed` immediately on finish.

### The release

- At 100% complete, stop. Summarize: files touched, tests added, docs updated, blockers resolved.
- Wait for explicit "**break the seal**" approval.
- On approval: commit in logical chunks, push to a feature branch, open the PR.

---

## Safety hatches (when to checkpoint anyway, even with the seal in place)

- About to delete > 10 existing files → checkpoint.
- About to modify `.git/`, `node_modules/`, or any operator-private file (`soul/`, secrets, etc.) → checkpoint.
- About to run a command whose intent isn't obvious from the punchlist item → narrate first, then run.
- About to introduce a new external dependency that costs money → checkpoint.
- About to make an architectural choice not documented in the session prompt → surface as an open question; don't decide unilaterally.

These hatches preserve the spirit of the seal: *autonomous execution* doesn't mean *silent execution*.

---

## Invocation

Paste this at the start of a session:

```
/sealed-sprint

[the contract — see _modes/sealed-sprint.md]

THE WORK:
<specify what to execute — e.g. "session-06-skill-discovery.md">
```

Or by reference: *"Operate in sealed-sprint mode per `docs/contributor-dossier/_modes/sealed-sprint.md`. The work is `<session prompt or task description>`."*

## Example invocations

### Single session

> Operate in sealed-sprint mode. Execute `_session-prompts/session-06-skill-discovery.md` end-to-end. Sprint log slug: `2026-05-26-skill-discovery`.

### Sequential sessions

> Operate in sealed-sprint mode. Execute sessions 06 → 02 sequentially per the recommended sequencing in `09-EXPANSION-OPTIONS.md`. Sprint log slug: `2026-05-26-q2-foundation`. Stop after each session for me to inspect before starting the next.

### Targeted scope

> Operate in sealed-sprint mode. Focus: add CI lint workflow (`lint.yml`) wiring the `skill-lint.sh` scaffold to the existing tests. Sprint log slug: `2026-05-26-ci-lint`.

### Investigation with potential fix

> Operate in sealed-sprint mode. Investigate why `pr-review` skill has had `consecutive_failures: 5` for three days; if you find a clear cause and a low-risk fix, implement it. Otherwise file an ISS and stop. Sprint log slug: `2026-05-26-pr-review-investigation`.

---

## What breaking the seal looks like

When the agent reports 100% completion, you'll see:

```
Sealed Sprint complete.

  Punchlist: 12/12
  Files touched: <list>
  Tests added: <list>
  Docs updated: <list>
  Sprint log: docs/contributor-dossier/_sprint-log/<file>.md
  Doctor: ✓

Waiting for "break the seal" to commit/push.
```

To break the seal, reply:

> break the seal — commit in logical chunks, push to `expansion/skill-discovery`, open the PR with the session prompt linked in the body.

Or to reject and re-work:

> not yet — <feedback>. Stay sealed; address these and re-summarize.

---

## Anti-patterns

- **"Mostly done."** Sealed Sprint is binary. 99% complete is sealed; 100% is releasable.
- **"I'll commit just this small thing."** No. The seal is whole or broken.
- **"I'll skip docs for now."** Docs are part of "complete." A code change without its doc update is incomplete.
- **"I'll mock the credential so I can proceed."** No. Missing credential is a genuine blocker; surface and wait.
- **"I'll commit to a feature branch — that's not main."** No. Any git history mutation breaks the seal.

---

## Related

- [`_session-prompts/`](../_session-prompts/) — work units designed to be executed in this mode.
- [`_sprint-log/`](../_sprint-log/) — append-only trail of past sprints.
- [`06-IMPLEMENTATION-PATTERNS.md`](../06-IMPLEMENTATION-PATTERNS.md) — conventions the sprint enforces.
- [`07-TESTING.md`](../07-TESTING.md) — what "tests pass locally" means.
- [`../README.md`](../README.md) — dossier entry point.
