# Session Prompts — Build Packets for Every Expansion Option

Self-contained build briefs for each of the 9 expansion options in [`../09-EXPANSION-OPTIONS.md`](../09-EXPANSION-OPTIONS.md). Each session prompt is designed to be **pasted into a fresh Claude / Claude Code session** along with a pointer to the dossier. The session prompt + dossier should be enough context to start building without re-doing the design work.

---

## How to use these

Each session is one file. Two depths:

- **Full session prompts** (~200 lines, for the high-conviction options) — include the prompt-to-paste, a punchlist with milestones and acceptance criteria, dependencies, files touched, out-of-scope, risks, and a "doctor check" for verifying done-ness.
- **Light session prompts** (~80 lines, for the lower-priority options) — same skeleton, less detail. Treat as conversation-starters; the implementing engineer fills in specifics.

Recommended starting envelope when invoking a session:

```
I'm about to start expansion-option session <N> for the Aeon framework.

Context:
- Working directory: /path/to/aeon
- Dossier: docs/contributor-dossier/ (READ FIRST, especially 01-ARCHITECTURE.md
  and the relevant 03-subsystems/ docs)
- Session prompt: docs/contributor-dossier/_session-prompts/session-<NN>-<name>.md

Read the session prompt. Confirm dependencies are met. Walk me through your
plan before writing code. Operate in feature branches; do not commit to
main without explicit approval.
```

## Sessions

| # | Direction | File | Depth | Effort |
|---|---|---|---|---|
| 1 | Cloudflare runtime port | [`session-01-cloudflare-runtime.md`](session-01-cloudflare-runtime.md) | Full | 4–8 weeks |
| 2 | Knowledge-graph memory layer | [`session-02-kg-memory.md`](session-02-kg-memory.md) | Full | 3–5 weeks |
| 3 | Federation / Aeon-as-protocol | [`session-03-federation.md`](session-03-federation.md) | Full | 6–12 weeks |
| 4 | Time-travel replay + observability | [`session-04-time-travel-replay.md`](session-04-time-travel-replay.md) | Light | 4 weeks |
| 5 | Chat-first operator console | [`session-05-chat-console.md`](session-05-chat-console.md) | Light | 3 weeks |
| 6 | Skill discovery via embeddings | [`session-06-skill-discovery.md`](session-06-skill-discovery.md) | Full | 1 week |
| 7 | Agentic dev loop (Aeon-as-junior-dev) | [`session-07-agentic-dev-loop.md`](session-07-agentic-dev-loop.md) | Light | 4 weeks |
| 8 | Multi-modal outputs | [`session-08-multimodal.md`](session-08-multimodal.md) | Light | 2 weeks |
| 9 | The Aeon Agora (glass-box agent-social) | [`session-09-agora.md`](session-09-agora.md) | Full | 4–6 weeks |

## Recommended sequencing

Per [`../09-EXPANSION-OPTIONS.md`](../09-EXPANSION-OPTIONS.md):

```
session-06 (skill discovery)         ← 1 week, immediate
       │
       ▼
session-02 (KG memory)               ← 6 weeks, builds on #6
       │
       ▼
session-03 (federation)              ← 6-12 weeks, architectural decision
       │
       ▼
session-09 (Agora)                   ← 4-6 weeks, requires #3 live
       │
       ▼
session-01 (Cloudflare runtime)      ← biggest lift, deferred to Q3
```

#4 (time-travel replay), #5 (chat console), #7 (agentic dev), #8 (multimodal) can interleave; none block the main sequence.

## Per-session checklist

When you run a session, the implementing engineer (or Claude Code) should:

1. **Read the dossier first.** [`../README.md`](../README.md) lists the entry points.
2. **Confirm dependencies.** Each session lists what must exist before starting; the `./scripts/doctor` script (see [`../_tests-scaffold/doctor.sh`](../_tests-scaffold/doctor.sh)) can validate baseline state.
3. **Work on a feature branch.** Convention: `expansion/<slug>-<short-description>`.
4. **Write tests as you go.** Each session's acceptance criteria are explicit.
5. **Open a PR with the session prompt linked in the description.** This gives reviewers full context.
6. **Run `./scripts/doctor` before requesting review.**
7. **Update [`../08-OPEN-QUESTIONS.md`](../08-OPEN-QUESTIONS.md)** if you surface new author-decisions during the build.

## Author-decision gates

Sessions that need author sign-off before merging upstream (per [`../09-EXPANSION-OPTIONS.md`](../09-EXPANSION-OPTIONS.md) § Decisions):

- **Session 1** — runtime-alongside-vs-replacement decision.
- **Session 3** — Aeon-as-protocol positioning is a strategic call.
- **Session 9** — agora hosting domain + brand association.

Sessions 6, 2, 4, 5, 7, 8 are author-informed but not author-gated for build start.

---

## What these prompts are NOT

- **Specs.** They're build briefs. The session may surface design changes; the dossier is the place to update.
- **Project plans.** No Gantt chart, no detailed schedule. Effort estimates are calibration, not commitment.
- **Code.** They tell the next session what to build; they don't include implementations beyond illustrative snippets in the dossier.

## Related

- [`../09-EXPANSION-OPTIONS.md`](../09-EXPANSION-OPTIONS.md) — the option menu these prompts implement.
- [`../06-IMPLEMENTATION-PATTERNS.md`](../06-IMPLEMENTATION-PATTERNS.md) — conventions every session must follow.
- [`../05-SECURITY.md`](../05-SECURITY.md) — security posture for any session touching runtime / dashboard / supply chain.
- [`../07-TESTING.md`](../07-TESTING.md) — test scaffolding to extend.
