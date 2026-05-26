# Session 04 — Time-Travel Replay + Observability

> **Goal:** Per-run timeline UI: rewind any skill run with the exact context, prompt, output, quality score, token cost.
>
> **Effort:** ~4 weeks.
> **Risk:** Low.
> **Author gate:** No.
> **Reference:** [`../09-EXPANSION-OPTIONS.md`](../09-EXPANSION-OPTIONS.md) Option #4.

---

## The prompt to paste

```
You are building Time-Travel Replay for the Aeon framework. Read these
dossier docs first:
  - docs/contributor-dossier/03-subsystems/runtime.md
  - docs/contributor-dossier/03-subsystems/memory.md
  - docs/contributor-dossier/03-subsystems/self-healing.md
  - docs/contributor-dossier/03-subsystems/dashboard.md

Your task: extend the runtime so every skill run captures a full replay
bundle (skill prose at time of run, resolved var, model, prompt with
${var}/${today} substituted, raw Claude response, quality score breakdown,
token usage, notify payloads, postprocess outputs, exit-taxonomy marker,
duration). Bundles land in memory/replay/${date}/${run-id}.json.

Add a dashboard view at /replay/<run-id> that renders the bundle as a
timeline with diff against the prior successful run of the same skill.

Constraints:
  - Replay bundles are append-only and committed.
  - Bundle size capped (skip raw API responses > 50KB; store path to
    truncated payload).
  - PII/secret redaction before write (regex pass over env-var values).
  - One PR per phase.

Out of scope:
  - Replaying the actual run (re-executing). Read-only inspection.
  - Cross-instance replay.
```

## Punchlist

- [ ] Schema: `memory/replay/${YYYY-MM-DD}/${run-id}.json`.
- [ ] Runtime hook: append step to `.github/workflows/aeon.yml` that builds the bundle from existing artifacts (prompt, output, scoring, token usage, exit marker).
- [ ] Redaction: scrub any string matching repo-secret values before write.
- [ ] Dashboard route `/replay/<run-id>` rendering the bundle as a vertical timeline.
- [ ] Diff view against the most recent prior successful run of the same skill (text diff on output, table diff on metrics).
- [ ] Pagination/search: `/replay?skill=<name>&status=<failed|success>&days=<N>`.
- [ ] Janitor extension: archive replay bundles older than 90 days to `memory/replay/archive/YYYY-MM/`.
- [ ] `./scripts/replay <run-id>` CLI for terminal-based inspection.
- [ ] Doc: `docs/contributor-dossier/03-subsystems/replay.md`.

## Files touched

| Path | Action |
|---|---|
| `memory/replay/` | New |
| `.github/workflows/aeon.yml` | Append "build replay bundle" step |
| `dashboard/app/replay/[runId]/page.tsx` | New |
| `dashboard/app/api/replay/route.ts` | New |
| `dashboard/components/ReplayTimeline.tsx` | New |
| `./scripts/replay` | New CLI |
| `skills/janitor/SKILL.md` | Extend with replay archival |
| `docs/contributor-dossier/03-subsystems/replay.md` | New |

## Dependencies

- None new. Reuses existing runtime + dashboard.

## Risks

| Risk | Mitigation |
|---|---|
| Replay bundle leaks secrets | Redact-before-write pass; secret-mask regex tested against known-bad inputs. |
| Disk grows unbounded | Janitor archives after 90d; CI lint warns if `memory/replay/` exceeds 100MB. |
| Bundle write fails → run loses observability | Capture step uses `if: always()`; failure logs to `memory/logs/`. |

## Doctor check

- ✓ Latest skill run has a corresponding `memory/replay/${date}/${run-id}.json`
- ✓ Redaction sanity: secret values do not appear in any committed bundle (grep test)
- ✓ Dashboard `/replay` page loads under 500ms for the last 50 runs

## Related dossier docs

- [`../03-subsystems/runtime.md`](../03-subsystems/runtime.md)
- [`../03-subsystems/self-healing.md`](../03-subsystems/self-healing.md) — replay is the debug surface this loop needs
- [`../09-EXPANSION-OPTIONS.md`](../09-EXPANSION-OPTIONS.md) § Option #4
