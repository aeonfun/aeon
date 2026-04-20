---
name: Tool Builder
description: Build automation scripts from action-converter suggestions and recurring manual tasks
var: ""
tags: [dev, build]
depends_on: [action-converter]
---
<!-- autoresearch: variation B — sharper output via agent-friendly CLI quality gates and a pre-commit checklist -->

> **${var}** — Specific tool or automation to build. If empty, finds opportunities from recent action-converter outputs and logs.

If `${var}` is set, build that specific tool instead of auto-selecting.

Today is ${today}. Read `memory/MEMORY.md` and the last 7 days of `memory/logs/` for context before starting.

Your job is to ship one small, self-contained CLI tool that future Aeon runs (and the operator) will actually re-use. The bar for "shippable" is the **Quality gates** in step 3 — a tool that doesn't pass them is not done.

## Steps

### 1. Find an opportunity (skip if `${var}` is set)

Score candidates from these sources, then build the highest-scoring one. Each source contributes at least one concrete pattern; do not invent ideas with no grounding.

| Source | What to look for |
|--------|------------------|
| `memory/logs/` (last 14 days) | Action-converter outputs and recurring tasks; the same shell incantation (`gh api …`, `curl … \| jq …`) repeated across days |
| `.outputs/action-converter.md` | Latest action-converter chain output, if present |
| `memory/MEMORY.md` | Stated goals, tracked items, "Next Priorities" |
| `memory/cron-state.json` | Skills with consecutive failures — a retry/diagnose helper may be the right tool |
| `scripts/` directory | Existing TODOs in headers, near-duplicate scripts that could share a helper |

**Score each candidate** as `occurrences × estimated_minutes_saved_per_run × reusability` where:
- `occurrences` = distinct days the pattern shows up (1 if speculative)
- `estimated_minutes_saved_per_run` = realistic, not aspirational
- `reusability` = 1 (one-skill use) to 3 (used by many skills or operator-facing)

Drop candidates that:
- Already exist in `scripts/` (run `ls scripts/` and check). Treat near-name matches as duplicates unless clearly different.
- Are better solved by a new skill than a script (multi-step reasoning, LLM-driven output → skill, not script).
- Have score < 4. If nothing scores ≥ 4, abort with `./notify "tool-builder: no opportunity scored ≥ 4 today — skipping"` and log the top 3 candidates to `memory/logs/${today}.md` for next time. Do not build a low-value tool just to ship something.

Write the chosen candidate's name, source, score, and one-sentence purpose into a working note before building.

### 2. Design the tool

State explicitly, in 5 lines max:
- **Name**: kebab-case, ≤24 chars, no extension (e.g. `cron-doctor`, not `cron_doctor.sh`)
- **Purpose**: one sentence, present tense
- **Inputs**: positional args, flags, env vars, stdin
- **Outputs**: stdout shape (text or JSON), stderr usage, file writes (if any), exit codes
- **Dependencies**: prefer `bash + jq + gh + curl + date` (already available). Node.js or Python only when bash gets ugly. **No `npm install`, no `pip install`.**

### 3. Build it — Quality gates (all must pass)

Write to `scripts/{tool-name}` (no extension). Match the conventions of `scripts/eval-audit` and `scripts/skill-runs`. Every shipped tool must satisfy **all** gates below; if a gate doesn't apply, say why in the header comment.

**Header (mandatory):**
```bash
#!/usr/bin/env bash
# {tool-name} — {one-sentence purpose}
#
# Usage:
#   ./scripts/{tool-name}                  # default
#   ./scripts/{tool-name} --json           # machine-readable
#   ./scripts/{tool-name} --dry-run        # show what would happen
#   ./scripts/{tool-name} --help           # this message
#
# Exit codes:
#   0  success
#   1  generic failure
#   64 usage error           (EX_USAGE)
#   75 transient failure     (EX_TEMPFAIL — retry-able, e.g. network)
#   78 missing configuration (EX_CONFIG — e.g. required env var unset)
#
# Used by: {skills or "operator-only" — be honest}
# Dependencies: {jq, gh, curl, date, etc.}

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
```

**CLI gates:**
1. `--help` / `-h` prints the header (using `sed -n '2,N p' "$0" | sed 's/^# \?//'`) and exits 0.
2. Unknown arg exits 64 with a one-line error to stderr.
3. `--json` (when output is structured) emits valid JSON to stdout, nothing else. No mixed text + JSON.
4. `--dry-run` is required for any tool that writes files, posts to APIs, mutates git state, or sends notifications. It must print the intended actions to stderr and make zero side effects.
5. **stdout = data, stderr = diagnostics.** Progress messages, warnings, and errors go to stderr so `tool | jq` works.
6. **Idempotent**: a second consecutive invocation with the same args produces the same end state and same exit code 0. If real idempotency is impossible (e.g. the tool fetches live data), idempotency means "no duplicate writes / no double-posts" — say so in the header.
7. Required env vars are checked at startup; if missing, exit 78 with `error: $VAR_NAME required` to stderr.
8. **Path-portable**: use `SCRIPT_DIR` (above) for any repo-relative paths. No hardcoded `/home/runner/...`.
9. Bash uses `set -euo pipefail`. Python uses `from __future__ import annotations` + explicit error handling. Node uses `process.exit(code)` and try/catch around async work.
10. Final line of bash scripts is a meaningful command — no trailing `exit 0` unless deliberate.

**Sandbox gate (network-using tools only):** include a WebFetch fallback note in the header comment, OR follow the prefetch/postprocess pattern (see CLAUDE.md). Never silently fail on network errors — exit 75.

### 4. Verify (multi-step)

Run, in order, and only proceed if each passes:

```bash
chmod +x scripts/{tool-name}
scripts/{tool-name} --help                                    # → exits 0, prints usage
scripts/{tool-name} --notarealflag 2>/dev/null; [ $? -eq 64 ] # → unknown arg exits 64
scripts/{tool-name} --dry-run [args]   2>/dev/null            # → exits 0, no side effects
scripts/{tool-name} [args]              # real run            # → exits 0
scripts/{tool-name} [args]              # second run          # → exits 0, no duplicates
```

If `--json` is supported, also: `scripts/{tool-name} --json [args] | jq . >/dev/null` must succeed.

If any verification fails: fix once. If still failing, **abort the build** — delete the half-built script, send `./notify "tool-builder: aborted {tool-name} — {reason}"`, log the attempt to `memory/logs/${today}.md`, and exit. Do not ship broken tools.

If a required secret is unavailable in this environment, **still ship the tool** but document the env var clearly in the header and have it exit 78 cleanly when unset — don't skip the PR.

### 5. Branch, commit, PR

```bash
git checkout -b feat/tool-{name}-${today}
git add scripts/{tool-name}
git commit -m "feat(scripts): add {tool-name} — {one-line purpose}"
git push -u origin feat/tool-{name}-${today}
```

Open a PR. **Build the body in a heredoc** (do not use literal `\n` — they render as backslash-n on GitHub):

```bash
gh pr create --title "feat(scripts): {tool-name}" --body "$(cat <<'EOF'
## What
{one-paragraph description}

## Usage
\`\`\`bash
./scripts/{tool-name} --help
./scripts/{tool-name} [common invocation]
\`\`\`

## Why
{source — action-converter dates, log pattern, MEMORY priority}. Score: {N} ({occurrences} × {minutes} × {reusability}).

## Quality gates
- [x] --help / --dry-run / --json (where applicable)
- [x] stdout=data, stderr=diagnostics
- [x] idempotent re-run
- [x] meaningful exit codes (0/64/75/78)
- [x] verified end-to-end before commit
EOF
)"
```

If `gh pr create` fails (permissions), capture the branch URL from `git push` output and use it in the notification — do not retry blindly.

### 6. Notify

```bash
./notify "tool-builder: built scripts/{tool-name} — {one-line purpose}
score: {N} | source: {source} | PR: {url-or-branch}"
```

### 7. Log

Append to `memory/logs/${today}.md`:

```
## Tool Builder
- **Tool:** scripts/{tool-name}
- **Purpose:** {one-line}
- **Source:** {what triggered this — action-converter dates, log pattern, etc.}
- **Score:** {occurrences} × {minutes_saved} × {reusability} = {N}
- **Gates:** all passed (help/dry-run/json/idempotent/exit-codes)
- **PR:** {url-or-branch}
```

If you aborted in step 1 (no candidate ≥ 4) or step 4 (verification failed), log it under `## Tool Builder` with `**Outcome:** skipped — {reason}` and the top 3 candidates considered, so the next run can pick up the trail.

## Guidelines

- **Bash first, Node second, Python third.** Match the existing codebase (`scripts/eval-audit`, `scripts/skill-runs`).
- **Small and focused.** One tool, one job. If a tool needs >150 lines of bash, it's probably two tools.
- **Don't duplicate skills.** Skills do reasoning; scripts do mechanical work. If the task needs an LLM, it's a skill, not a script.
- **Don't add new dependencies.** Only use binaries already in the workflow runner (`jq`, `gh`, `curl`, `date`, `python3`, `node`).
- **Operator-friendly.** Every tool must be runnable locally with `./scripts/{name}` — no CI-only shortcuts.
- **No backwards-compat shims.** If you need to refactor a script, change it; we don't keep dead flags.

## Sandbox note

The sandbox may block outbound `curl`. Tools that need network access must either:
1. Document a **WebFetch** fallback in their header (for skill consumers), OR
2. Use the prefetch/postprocess pattern (`scripts/prefetch-{name}.sh` runs before Claude with full env access; `scripts/postprocess-{name}.sh` runs after — see CLAUDE.md).

For `gh` API calls, use `gh api` (auth handled internally) instead of `curl` with a token in the header.

## Constraints

- Do not ship a tool that fails any quality gate. Aborting is a valid outcome — log it.
- Do not invent opportunities. If the score floor (≥ 4) is not met, skip the run.
- Do not change the `var` semantics: empty = auto-discover, set = build that specific thing.
