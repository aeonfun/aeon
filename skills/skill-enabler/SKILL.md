---
name: skill-enabler
description: Flip enabled:false → enabled:true for a comma-separated list of skill slugs in aeon.yml — validate against skills/, fail loudly on already-enabled or missing slugs, commit, open a PR with per-skill rationale
var: ""
tags: [dev, meta]
---

> **${var}** — REQUIRED. Comma-separated list of skill slugs to enable (e.g. `skill-a,skill-b,skill-c`). Empty var is a no-op — log `SKILL_ENABLER_NO_INPUT` and exit silently (this skill is explicit opt-in only; an empty `var` must never flip switches by accident). Pass `dry-run:slug1,slug2` to validate without committing or opening a PR.

Today is ${today}. Skills can sit at `enabled: false` for days while the operator is occupied elsewhere. The human review of "is this skill ready to run" is not what blocks activation — the typing is. This skill makes the typing one command.

## Why this exists

Flipping `enabled: false → true` in `aeon.yml` is mechanical:

- The text-edit is a single regex-safe substitution per skill
- Validation is straightforward: skill directory exists, current state is `enabled: false`, slug doesn't appear under `chains:` (which would conflict with a top-level entry)
- The risk is low: the worst case is a noisy skill, fixed by a one-line revert PR

So the bottleneck is "open the file, find the line, edit, commit, push, open a PR, wait for CI" — 5 minutes of friction per skill, applied N times, batched into operator sprints that don't happen. This skill collapses that loop: operator dispatches with `var=slug1,slug2,slug3`, gets a PR with one merge-button click.

**Explicit opt-in is the safety bar.** No scheduled run, no automatic discovery. The operator names the slugs. The skill validates them and writes a PR — nothing flips on `main` until the operator clicks merge.

## Steps

### 1. Parse var

- `${var}` empty → log `SKILL_ENABLER_NO_INPUT` and exit. **Do not flip anything on empty var.** Send no notification — silence is correct when there's nothing to do.
- `${var}` starts with `dry-run:` → `MODE=dry-run`. Strip the prefix; the remainder is the slug list. In dry-run: parse + validate + report, but do **not** edit `aeon.yml`, commit, or open a PR.
- Otherwise → `MODE=execute`. Treat `${var}` as the slug list.

Split the slug list on comma. Trim whitespace from each entry. Drop empty entries (handles trailing commas). Lowercase each slug. Deduplicate, preserving first-seen order.

Validate slug format: each must match `^[a-z0-9][a-z0-9-]{0,63}$`. Slugs that fail this check are tagged `BAD_SLUG_FORMAT` in step 3 — they don't poison the run, but they don't get enabled either.

If after parsing the input list is empty (e.g. `var` was just commas/whitespace), log `SKILL_ENABLER_NO_INPUT` and exit silently.

### 2. Read source state

Required reads — all in the current working directory (this fork's repo root):

- `aeon.yml` — the file to patch. Read once at start; rewrite once at end.
- `skills/` directory — `ls skills/` gives the set of skills present in this fork. A slug must have a `skills/${slug}/` directory or it's `MISSING_DIRECTORY`.
- `skills.json` (optional) — used for the per-skill rationale ("registered skill: <description>"). Missing `skills.json` is a warning, not a failure; rationale falls back to the SKILL.md frontmatter `description` field, then to the slug itself if both are absent.

If `aeon.yml` is missing or unreadable → log `SKILL_ENABLER_NO_CONFIG` and exit with notification (operator can't proceed without it).

### 3. Validate each slug

For each parsed slug, walk these gates **in order**. The first failing gate is the slug's verdict; do not check subsequent gates for that slug.

| Gate | Pass condition | Failure tag |
|------|----------------|-------------|
| 1. Format | matches `^[a-z0-9][a-z0-9-]{0,63}$` | `BAD_SLUG_FORMAT` |
| 2. Directory | `skills/${slug}/SKILL.md` exists | `MISSING_DIRECTORY` |
| 3. Present in aeon.yml | `aeon.yml` contains a top-level entry `${slug}:` under `skills:` | `NOT_IN_AEON_YML` |
| 4. Not under chains | the slug does NOT appear as a `skill:` entry under `chains:` (chains run skills as steps, not standalone — flipping the top-level entry produces double-runs) | `CHAIN_CONFLICT` |
| 5. Currently disabled | the slug's line currently contains `enabled: false` | `ALREADY_ENABLED` if `enabled: true`; `UNPARSEABLE_STATE` if neither |

For each slug record one of:
- `ELIGIBLE` — passed every gate
- one of the failure tags above

### 4. Apply edits (skip in dry-run)

For each `ELIGIBLE` slug, patch the matching line in `aeon.yml`:

```
${slug}: { enabled: false, ...   →   ${slug}: { enabled: true, ...
```

Use an exact-match substitution scoped to the slug — never a global `enabled: false → true` replace. Each slug should match exactly one line; if the file contains the slug twice (e.g. a chain reference duplicated as a top-level entry), gate 4 would have caught it as `CHAIN_CONFLICT` and we wouldn't be editing it here.

Preserve every other character on the line — schedule, model, var, the trailing comment — byte-for-byte. The only change is `false` → `true` in the `enabled:` field.

After all eligible slugs are patched, write `aeon.yml` once. Do not write per-slug; one final write avoids partial-state on a mid-loop failure.

If zero slugs are `ELIGIBLE`:
- If at least one slug was `ALREADY_ENABLED` → log `SKILL_ENABLER_ALL_ALREADY_ENABLED` and notify (operator should know the work is already done).
- Otherwise → log `SKILL_ENABLER_NO_ELIGIBLE` and notify with the failure breakdown so the operator can fix the input.
- Skip steps 5 and 6 entirely — no commit, no PR.

### 5. Commit, branch, push (skip in dry-run)

```bash
git checkout -b feat/enable-skills-${today}
git add aeon.yml
git commit -m "chore: enable ${N} skill(s) — ${comma_separated_slugs}"
git push -u origin feat/enable-skills-${today}
```

`${N}` is the count of `ELIGIBLE` slugs that were patched. `${comma_separated_slugs}` lists their slugs (capped at 6 in the title; if more, append `+${overflow}`).

If `git push` fails with auth issues (workflows-scope PAT not configured, etc.), log `SKILL_ENABLER_PUSH_FAILED` and notify with the underlying error message — the operator may need to set up the right token. **Do not retry indefinitely.**

### 6. Open PR (skip in dry-run)

```bash
gh pr create \
  --title "chore: enable ${N} skill(s)" \
  --body "$(cat <<EOF
## What
Flips \`enabled: false → true\` for ${N} skill(s) in \`aeon.yml\`:

${per_skill_table}

## Why
Operator dispatch via \`skill-enabler\` with explicit slug list. Each slug was validated against skills/ directory presence, current disabled state, and chain-conflict checks before patching.

## Verify
- [ ] Each enabled skill's next scheduled run lands on its expected cron tick
- [ ] No regressions in adjacent skills (cron windows don't overlap with newly enabled work)
- [ ] Notification channels (Telegram / Discord / Slack) are configured if the enabled skill writes notifications

---
*Built autonomously by skill-enabler*
EOF
)"
```

`${per_skill_table}` is a Markdown table with columns: `Slug | Schedule | Rationale`. Rationale is pulled from `skills.json` description, or `skills/${slug}/SKILL.md` frontmatter `description`, or the slug itself if neither is available. Schedule is the cron string from the patched aeon.yml line.

Capture the PR URL from `gh pr create`'s stdout. If `gh pr create` fails, log `SKILL_ENABLER_PR_FAILED` with the error, but **do not roll back the push** — the branch is already on origin and the operator can open the PR manually from the GitHub UI.

### 7. Notify

Send via `./notify`:

```
*Skill Enabler — ${today}*

Enabled ${N} skill(s) in aeon.yml via PR:
${bullet_list_eligible_slugs}

${ineligible_section_if_any}

PR: ${pr_url}
Branch: feat/enable-skills-${today}

Note: cron picks up the change on next scheduled tick after the PR merges. Use \`gh workflow run aeon.yml -f skill=<slug>\` to fire any of them immediately if you want a same-day signal.
```

`${ineligible_section_if_any}` is omitted entirely if every slug was `ELIGIBLE`. Otherwise, group the ineligible slugs by failure tag and list them:

```
Ineligible (${M}):
- ALREADY_ENABLED (${k}): slug-a, slug-b
- MISSING_DIRECTORY (${k}): slug-c
- NOT_IN_AEON_YML (${k}): slug-d
- ...
```

For `dry-run` mode, prefix the notification with `[DRY RUN — no changes made]` and omit the `PR:` / `Branch:` lines.

### 8. Log

Append to `memory/logs/${today}.md`:

```
## Skill Enabler
- **Skill**: skill-enabler
- **Mode**: ${execute|dry-run}
- **Input slugs**: ${original_var}
- **Eligible**: ${N} — ${list_eligible}
- **Ineligible**: ${M} — ${grouped_by_tag}
- **PR**: ${pr_url_or_none}
- **Branch**: ${branch_or_none}
- **File touched**: aeon.yml
- **Notification**: sent
- **Status**: SKILL_ENABLER_OK | SKILL_ENABLER_PARTIAL | SKILL_ENABLER_NO_ELIGIBLE | SKILL_ENABLER_ALL_ALREADY_ENABLED | SKILL_ENABLER_NO_INPUT | SKILL_ENABLER_NO_CONFIG | SKILL_ENABLER_PUSH_FAILED | SKILL_ENABLER_PR_FAILED | SKILL_ENABLER_DRY_RUN
```

Status mapping:
- `SKILL_ENABLER_OK` — every input slug was `ELIGIBLE` and got patched
- `SKILL_ENABLER_PARTIAL` — at least one slug `ELIGIBLE` AND at least one slug ineligible (mixed outcome)
- `SKILL_ENABLER_NO_ELIGIBLE` — zero slugs eligible, but at least one was a real ineligible (operator's input had problems)
- `SKILL_ENABLER_ALL_ALREADY_ENABLED` — every slug was already `enabled: true` (the work was already done)
- `SKILL_ENABLER_NO_INPUT` — `var` was empty or contained no parseable slugs (silent exit)
- `SKILL_ENABLER_NO_CONFIG` — `aeon.yml` missing or unreadable
- `SKILL_ENABLER_PUSH_FAILED` / `SKILL_ENABLER_PR_FAILED` — the file was patched but git or gh choked downstream
- `SKILL_ENABLER_DRY_RUN` — `dry-run:` prefix consumed; validation reported, no edits made

## Constraints

- **Never flip a switch on empty `var`.** This is the load-bearing safety rule. The skill is explicit opt-in; an empty dispatch must produce zero edits and zero PRs.
- **Never flip a switch on a slug under `chains:`.** Chains run skills as workflow steps; flipping the top-level `enabled: false` would create a double-run schedule. Gate 4 catches this.
- **Never global-replace `enabled: false → true`.** Use slug-scoped substitution. A global replace would flip every disabled skill in the file — exactly the autonomy-overstep this skill is designed to avoid.
- **Never amend or force-push.** Always a new commit, always a new branch, always a PR. The merge button is the operator's checkpoint.
- **Never run during a scheduled tick.** This skill is `workflow_dispatch` only. There's no cron entry — the operator dispatches by hand each time.

## Sandbox note

All work is local file reads + `git`/`gh` CLI. No external HTTP. `gh` handles auth via the workflow's GITHUB_TOKEN (workflows-scope PAT preferred — required for `aeon.yml` edits to land cleanly; without `workflows` scope, the push will fail at step 5 and the skill will exit with `SKILL_ENABLER_PUSH_FAILED`).

If `gh pr create` itself fails (rate-limit, transient 5xx), retry once after 30s. Persistent failure → log `SKILL_ENABLER_PR_FAILED` and notify with the error — the operator can open the PR manually from the pushed branch.

## Edge cases

- **Slug appears twice in `aeon.yml` (e.g. defined as a top-level skill AND referenced inside a `chains:` block):** gate 4 catches this and tags `CHAIN_CONFLICT`. The slug is not patched. The operator must resolve the duplication manually.
- **Slug's `enabled:` line uses unusual whitespace (e.g. `enabled : false` or `enabled:false` with no space):** the substitution should be tolerant — match `enabled\s*:\s*false`. If no match is found despite gate 5 reporting `enabled: false`, tag `UNPARSEABLE_STATE` and report it in the ineligible breakdown.
- **Multiple slugs share a branch-name collision** (i.e. `feat/enable-skills-${today}` already exists locally because the operator ran the skill twice in one day): pick a numeric suffix — `feat/enable-skills-${today}-${run_count}` — and proceed. The existing branch is left untouched; a separate PR is opened.
- **Skill is `enabled: false` AND has `schedule: workflow_dispatch`:** still eligible. The operator's intent is to mark it as "active in this fork" so heartbeat treats it as expected-but-on-demand rather than `disabled-and-ignored`. The PR is the right outcome.
- **`aeon.yml` line has a trailing comment that mentions `false`:** the substitution must scope to the `enabled:` key only — match `enabled\s*:\s*false`, do not touch other `false` tokens on the line. The most likely format is `${slug}: { enabled: false, ... } # comment` and the substitution should change `enabled: false,` (with the comma) without touching the comment.
- **Operator passes the same slug twice in `var` (e.g. `slug-a,slug-a`):** deduplicate during parsing in step 1 — second occurrence is dropped silently. Don't fail the run.
- **`MODE=dry-run` with a valid slug list:** report all gates as if executing, but include `[DRY RUN]` in every log line and notification, and DO NOT branch / commit / push / open a PR. Status: `SKILL_ENABLER_DRY_RUN`.
