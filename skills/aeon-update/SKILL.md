---
name: aeon-update
description: Pull framework updates from the upstream Aeon repo into this instance - 3-way merges canon's new commits into a PR, never clobbering operator config.
metadata:
  title: Aeon Update
  category: core
  var: ""
  tags:
    - dev
    - meta
  mode: write
---
> **${var}** — mode selector; space-separated tokens, order-independent, all optional:
> - **mode** (`sync` | `report`, default `sync`) — `sync` opens a PR with the framework changes; `report` computes the delta and notifies, mutating nothing (dry run).
> - **`repo=owner/name`** — override the upstream source repo (else auto-resolved from this instance's `parent`, falling back to `aeonfun/aeon`).
> - **`reset=<sha|fork-point>`** — force the stored baseline to `<sha>` (or the merge-base with upstream) before running. Recovery / backfill lever.
>
> Empty ⇒ **sync** from the auto-resolved upstream. Examples: `` · `report` · `repo=aeonfun/aeon` · `reset=fork-point`.

Today is ${today}. This is the fleet's **downstream updater** - the counterpart to `fork-fleet`. `fork-fleet` looks *outward* from the parent to find work in the forks worth pulling *up*; this skill runs *inside* an instance and pulls the parent's shipped framework changes *down* - new skills, script/harness fixes, workflow and doc updates - and lands them as a reviewable PR. It is how an instance stays current with `aeonfun/aeon` without a hand-run rsync-overlay rebase.

## Operating principles

- **PR, never push to `main`.** Every framework change ships as one reviewable PR. The operator merges.
- **Never clobber operator config.** `aeon.yml`, `STRATEGY.md`, `soul/`, `memory/`, `output/`, `.mcp.json` and the git-derived catalogs are instance-owned. Upstream changes to them are **surfaced for manual review in the PR body**, never written into the tree.
- **3-way, not blind overwrite.** A framework file the operator has already customized is **auto-merged** when its local edits and upstream's edits touch disjoint regions (a real `git merge-file` 3-way, S6); it is only listed as a **conflict** for a human when the same lines changed on both sides. This is what lets a hand-narrowed workflow keep receiving unrelated upstream fixes without a manual merge every run.
- **Silent when in sync.** Baseline == upstream HEAD ⇒ nothing to do, no notification.
- **The baseline is the watermark, and it advances by merge.** The new baseline SHA is written *only into the PR branch commit* (never main, never the run log), so the watermark only moves when the operator merges the PR, and one sync PR is open at a time. Unresolved conflicts are tracked separately so advancing the baseline can never silently drop them.

---

## Steps

Every command below is **one Bash call**: run it, read the value it prints, and type that value into the next command (shown as `<UPSTREAM>`, `<HEAD_SHA>`, ...). Never assign shell variables (`X=$(...)`), chain with `&&`/`;`, redirect into a file, or write a script and run it with `bash`: the permission layer refuses all of those in this run. Create or change files with Write/Edit.

### S0. Bootstrap + load state

If `memory/topics/aeon-update-state.json` does not exist, create it with Write:

```json
{"baseline_sha": null, "upstream": null, "last_run": null, "last_pr": null, "pending_conflicts": []}
```

Read `memory/MEMORY.md` for context and scan the last ~3 days of `memory/logs/` - drop anything already reported so a repeat run isn't re-sent. Read the state file:
- `BASELINE` = `.baseline_sha` (the upstream commit this instance was last synced to).
- `PENDING` = `.pending_conflicts` (files surfaced as conflicts in a prior run, not yet resolved).

### S1. Parse `${var}`

- `MODE` = `report` if the token `report` (or `dry`) is present, else `sync`.
- `REPO_OVERRIDE` = value of a `repo=owner/name` token, if any.
- `RESET` = value of a `reset=` token, if any (`fork-point` or a 7-40 char SHA).

### S2. Resolve the upstream source

```bash
gh repo view --json nameWithOwner -q .nameWithOwner                # -> SELF
gh api "repos/<SELF>" --jq '.parent.full_name // empty'            # -> UPSTREAM (skip when REPO_OVERRIDE is set)
```

`UPSTREAM` = `REPO_OVERRIDE`, else the parent, else `aeonfun/aeon` when the parent is empty.

If `UPSTREAM` == `SELF`, this instance **is** canon - there is nothing upstream to pull. Write status `AEON_UPDATE_IS_UPSTREAM` to `memory/logs/${today}.md`, send **no** notification, and stop.

```bash
gh api "repos/<UPSTREAM>" --jq '.default_branch'                    # -> UP_DEFAULT
gh api "repos/<UPSTREAM>/commits/<UP_DEFAULT>" --jq '.sha'          # -> HEAD_SHA (HEAD7 = first 7 chars)
```

### S3. Establish / reset the baseline

- **`reset=fork-point`** → run `git rev-parse HEAD` (-> LOCAL_HEAD), then `gh api "repos/<UPSTREAM>/compare/<HEAD_SHA>...<LOCAL_HEAD>" --jq '.merge_base_commit.sha'` -> `BASELINE`. `reset=<sha>` → `BASELINE=<sha>`. Persist it to the state file with Edit, then continue.
- **First run (`BASELINE` null and no `reset`):** a fresh instance already carries all of canon from fork time, so there is no delta to apply - just **anchor the watermark**. Set `baseline_sha = HEAD_SHA`, write state, log `AEON_UPDATE_BASELINE_SET`, send a one-line notify (`baseline initialized at <head7>; future runs sync from here`), and stop. (To backfill everything since the fork point instead, re-run with `reset=fork-point`.)
- **`BASELINE` == `HEAD_SHA`:** in sync. Run the S4 `plan` command anyway: it returns `AEON_UPDATE_IN_SYNC` with `pending_conflicts` re-verified against HEAD. If that list differs from `PENDING` (a prior conflict was resolved), write it into the state file with Edit. Log `AEON_UPDATE_IN_SYNC`, notify nothing, stop.
- **A sync PR is still open (sync mode):** the state file on `main` still holds the old baseline until that PR merges, so a second PR from it would carry the same commits again and two branches would each move the watermark. Check before doing any work, including before persisting a `reset=`:

  ```bash
  gh pr list --repo "<SELF>" --state open --base "<UP_DEFAULT>" --limit 100 --json number,headRefName,url --jq '[.[] | select(.headRefName | startswith("aeon-update/sync-"))] | sort_by(.number) | last // empty | "\(.number) \(.headRefName) \(.url)"'
  ```

  If it prints a PR (`OPEN_PR`): write nothing (no state file, no branch, no PR) and log `AEON_UPDATE_PR_OPEN` with the PR and its range. If its branch already ends in `HEAD_SHA`'s first 7 chars, stay silent; if upstream has moved past it, send one line (`PR #N still open; upstream is M commits past it, merge or close it and the next run syncs the rest`, `--mute-key "aeon-update:${HEAD7}"`). Stop. `report` mode skips this check and notes the open PR in its report.

### S4-S6. Plan: compare, partition, 3-way classify

All of S4-S8's file work is done by `scripts/aeon_update.py`, in single commands. **Do not re-implement it in the shell**: helper functions, loops, redirects into files and `bash <script>` are all refused in this run, so a hand-written classify script ends the run with nothing synced (miroshark-aeon, 2026-10-21). Run:

```bash
python3 scripts/aeon_update.py plan --upstream "<UPSTREAM>" --baseline "<BASELINE>" --head "<HEAD_SHA>"
```

It prints a JSON summary and mutates nothing in the repo (its scratch goes to `${RUNNER_TEMP:-/tmp}/aeon-update/`). Read `status`:
- `AEON_UPDATE_IN_SYNC`: handle as S3's in-sync case.
- `AEON_UPDATE_BASELINE_UNREACHABLE` (exit 3; the baseline is not an ancestor of HEAD - history rewrite or unrelated repo): stop with that status and notify the operator to re-run with `reset=fork-point` or `reset=<sha>`.
- `AEON_UPDATE_ERROR` (exit 2): stop, log the `error`, and notify it. Never fall back to classifying by hand.
- `AEON_UPDATE_PLANNED`: the summary has `counts`, the `clean` paths per disposition, `conflicts` (path, reason, in-range `upstream_commits`, and a `diff` file with upstream's BASELINE..HEAD diff), `operator` (OPERATOR-owned paths upstream changed, each with a `diff` file), `unreadable`, the recomputed `pending_conflicts`, and the `commits` in range. Read the `diff` files you need with the Read tool.

What the plan decides, so you can explain it in the PR:

**Changed paths** are every path whose entry differs between upstream's BASELINE and HEAD trees (no 300-file compare cap). A rename is a delete of the old path plus an add of the new one.

**OPERATOR-owned** (surfaced, never written):

```
aeon.yml            STRATEGY.md         soul/**             memory/**
output/**           .mcp.json           .env*               aeon.db
skills.lock         eyebrowlock.json    .claude/**  (except .claude/skills/aeon/**)
catalog/*.json  (except catalog/skill-packs.json)
apps/dashboard/outputs/**       .github/dependabot.yml
```

Everything else is **OWNED**: `skills/**`, `scripts/**`, `bin/**`, `harness-adapter/**`, `.github/**`, `apps/**`, `docs/**`, `CLAUDE.md`, `AGENTS.md`, `CHANGELOG.md`, `.gitignore`, `eyebrow.policy.json`, `catalog/skill-packs.json`, root helpers. `catalog/*.json` and `eyebrowlock.json` are never copied from upstream: apply regenerates them from the synced sources.

**`catalog/skill-packs.json` is synced, not regenerated** (it has no generator and is hand-maintained with the Listed packs table in `docs/community-skill-packs.md`; `ci-skill-packs` fails when they disagree, aeon-agent#232). Its **pack-registry unit** (`catalog/skill-packs.json`, `docs/community-skill-packs.md`, `scripts/validate-skill-packs.mjs`, `scripts/tests/test_validate_skill_packs.sh`, `.github/workflows/ci-skill-packs.yml`) is classified together and is all-or-nothing: one CONFLICT member demotes the rest to CONFLICT `skill-packs-unit`. A local registry that lists no pack upstream HEAD lacks is a frozen copy, not an edit, and is CLEAN-UPDATEd (`stale-copy`).

**Dispositions** (local copy vs upstream@BASELINE vs upstream@HEAD; equal = same content and exec bit):

| Upstream | Local | Disposition |
|----------|-------|-------------|
| unchanged | any | SKIP |
| added | absent / same as HEAD / different | CLEAN-ADD / SKIP / CONFLICT `local-collision` |
| modified | same as HEAD | SKIP |
| modified | same as BASELINE | CLEAN-UPDATE |
| modified | absent | CONFLICT `deleted-locally` |
| modified | customized | `git merge-file --diff3`: disjoint hunks -> CLEAN-MERGE (both edits kept), overlap -> CONFLICT `operator-customized` |
| removed | absent / same as BASELINE / edited | SKIP / CLEAN-DELETE / CONFLICT `removed-upstream-local-edited` |

A removed path of a skill upstream retired (`skills/<name>/SKILL.md` gone from HEAD) whose `<name>` is `enabled: true` in the operator's `aeon.yml` is never deleted: CONFLICT `enabled-skill-removed-upstream`, its own loud PR-body section (S9). Fork-only skills are never touched (only upstream paths are ever in the change set). A blob the API cannot return is `UNREADABLE`: list it and continue with a partial sync.

In `report` mode stop after the plan and go to S10.

### S7-S8. Apply on a branch (sync mode only)

```bash
git checkout -b "aeon-update/sync-<HEAD7>"
python3 scripts/aeon_update.py apply
```

`apply` refuses to run off an `aeon-update/*` branch. It re-checks each file against the plan (a file that changed since is CONFLICT `changed-since-plan`), then:

1. Writes every CLEAN-ADD / CLEAN-UPDATE / CLEAN-MERGE (with upstream's exec bit) and `git rm`s every CLEAN-DELETE. A written `.json`/`.yml` that does not parse is put back and becomes CONFLICT `parse-failed`.
2. Runs `node scripts/validate-skill-packs.mjs` when a pack-registry member was applied; on failure it puts the unit back as CONFLICT `skill-packs-parity` and returns the validator output as `skill_packs_validator`.
3. **Eyebrow lock.** When any `skills/**` path was applied, it fetches the `eyebrow` binary at the exact version `ci-skill-integrity.yml` runs (the step's `version:` input), checks it against the release's `checksums.txt`, and rescans `eyebrowlock.json` with a scrubbed env (`eyebrow: "scanned"`). If the binary is unavailable or the scan fails, the fail-safe never ships a skill against a stale lock entry: for a new skill, an applied `SKILL.md` whose lock entry has findings (an edit that moves lines relocates a finding, which `eyebrow verify --ci` reports as capability expansion), or a skill whose upstream lock `capabilities` changed between BASELINE and HEAD (miroshark-aeon#183), it carries upstream's HEAD lock entry when the skill's tree is byte-identical to HEAD (`eyebrow_carried`), else puts the skill back as CONFLICT `needs-eyebrowlock-scan` (`eyebrow_held`).
4. Copies each new skill's glyph from upstream's `catalog/skill-icons.json` (hand-authored, so the generator cannot invent it; `glyphs_carried`), then regenerates `bin/generate-skills-json`, `bin/generate-packs-json`, `bin/generate-skill-icons` and `node scripts/gen-agents-md.js` from the final tree. Failures are listed in `catalog_errors`.
5. Runs `node scripts/validate-config.js aeon.yml`; its output, if it flagged anything, is `validate_config` (may be pre-existing drift: note it, do not abort).
6. Recomputes `pending_conflicts`: this run's conflicts plus each prior entry that is still divergent (local differs from HEAD). Prior entries applied this run (CLEAN-UPDATE or CLEAN-MERGE) are resolved; an `enabled-skill-removed-upstream` entry resolves once the skill is disabled or upstream re-adds it.
7. Writes `memory/topics/aeon-update-state.json` in the branch: `baseline_sha` = HEAD, `upstream`, `last_run`, `last_pr: null`, `applied` counts and `pending_conflicts` (other keys kept). It must reach `main` only through the PR merge: if the new baseline landed on `main` while the PR is open, the PR would conflict on the state file, and closing it unmerged would make the next run skip its commits.

Its JSON result (`status`, the final `clean` lists, `conflicts`, `operator`, `pending_conflicts`, and the notes above) is also saved as `result.json` in its work dir. Statuses:
- `AEON_UPDATE_APPLIED`: go to S9.
- `AEON_UPDATE_MANUAL_ONLY` (nothing clean was left to apply): open no PR. Run `git checkout -- .`, then `git checkout <UP_DEFAULT>` and `git branch -D aeon-update/sync-<HEAD7>`, log `AEON_UPDATE_MANUAL_ONLY`, and go to S10 (notify that the sync needs a manual merge).
- `AEON_UPDATE_ERROR`: same cleanup, log the error, notify it.

### S9. Commit + open the PR (sync mode; skip in report mode)

Stage the synced files and the state file only. Never `memory/logs/`, `token-usage.csv`, `output/` or the dashboard feed: the run writes those again after this commit, and the post-run commit moves them to `main`, so a copy in the branch makes the PR conflict with `main` and drags the branch's state file onto `main` with it.

Write `/tmp/aeon-update-commit.txt` and `/tmp/aeon-update-pr-body.md` (below) with the Write tool, then run each line as its own call (`notify`, `notify-jsonrender` and `secretcurl` are the run's generated helpers):

```bash
git add -A -- . ':(exclude)memory' ':(exclude)output' ':(exclude)apps/dashboard/outputs' ':(exclude)notify' ':(exclude)notify-jsonrender' ':(exclude)secretcurl'
git add -- memory/topics/aeon-update-state.json
git commit -F /tmp/aeon-update-commit.txt
git push -u origin "aeon-update/sync-<HEAD7>"
gh pr create --repo "<SELF>" --base "<UP_DEFAULT>" --title "aeon-update: sync <N_COMMITS> upstream commits (<BASE7>..<HEAD7>)" --body-file /tmp/aeon-update-pr-body.md
```

Never inline the commit message with `-m` (backticks or `$()` in it get shell-substituted).

`/tmp/aeon-update-commit.txt`:
```
aeon-update: sync upstream ${BASE7}..${HEAD7}

${N_COMMITS} upstream commits from ${UPSTREAM}. ${N_APPLIED} files applied cleanly, ${N_CONFLICT} need manual review. Baseline advanced to ${HEAD7}.
```

PR body (`/tmp/aeon-update-pr-body.md`) - only include sections that have content:
```markdown
## Upstream sync: `${UPSTREAM}` `${BASE7}..${HEAD7}`

**${N_COMMITS} commits** ({earliest date} → {latest date}) · **${N_APPLIED} applied** · **${N_CONFLICT} manual** · baseline → `${HEAD7}`.

### Applied cleanly
- **New skills:** `foo`, `bar`   _(regenerated catalogs + agents.md + skill-icons)_
- **Modified skills:** `baz`
- **Scripts / harness:** `scripts/notify.sh`, ...
- **Workflows:** `.github/workflows/...`
- **Auto-merged (3-way):** `.github/workflows/aeon.yml`, ...  _(your local customization kept; upstream's disjoint changes applied - review the merged hunks)_
- **Docs / other:** `docs/...`, `CLAUDE.md`, ...

### ⚠️ Currently-enabled skills removed upstream
For each CONFLICT with reason `enabled-skill-removed-upstream`:
- `verdikta-hunter` — enabled in your `aeon.yml`, deleted upstream in {commit(s)}. **Not deleted here** so nothing breaks. Pick one: keep it as a fork-only skill going forward (nothing else to do), or disable it in `aeon.yml` to match upstream's current default set.

### Needs manual review (conflicts - your local copy diverges from upstream)
For each *other* conflict reason (`enabled-skill-removed-upstream` is covered above, don't duplicate it here): what upstream changed and why it wasn't auto-applied.
- `scripts/foo.sh` — you customized this locally; upstream changed it in {upstream_commits}. Upstream diff (from the conflict's `diff` file, trimmed):
  ```diff
  {short upstream base..head diff for the file}
  ```

### Operator config changed upstream (not auto-applied - reconcile by hand)
- `aeon.yml` — upstream added skills / changed defaults: {summary}. Merge the new entries you want (keep your enable/schedule/model choices).
- `soul/…`, `STRATEGY.md` — {summary, if changed}

### Upstream commits
| SHA | Summary |
|-----|---------|
| abc1234 | ... |
```

Capture the PR URL; write it into `last_pr` in the branch's state file with Edit, then `git add -- memory/topics/aeon-update-state.json` and `git commit --amend --no-edit` (two calls; the post-run step pushes the amended branch) so the merged watermark records its own PR.

### S10. Log + notify

Stay on the PR branch and do not commit from here on: the post-run commit pushes the branch and records the log and other run state on `main`, while the state file stays in the branch. Do not check out `main` or touch the state file again.

Append to `memory/logs/${today}.md` under `### aeon-update`: status, `UPSTREAM`, `${BASE7}..${HEAD7}`, applied/conflict counts, PR URL (or `report`/`manual-only`), and `pending_conflicts` count.

**Notify only on signal** - match `soul/` voice if present. Send when there is a PR, a report with changes, or a manual-only situation; stay silent for `IN_SYNC` / `BASELINE_SET`-with-nothing. Keep it ≤4000 chars:

```
*aeon-update — ${today}*
{verdict: "synced N commits → PR" | "N changes need manual merge" | "report: N commits behind"}

Upstream `${UPSTREAM}` is ${AHEAD} commits ahead. Applied ${N_APPLIED} cleanly, ${N_CONFLICT} need review.
{Top applied highlight: e.g. "new skill: `token-radar`; harness fix in run-harness"}
{If conflicts: "Manual: `aeon.yml` (new skills), `scripts/foo.sh` (local edit)"}

PR: {url}   (or "dry run — nothing changed")
```

Pass `--mute-key "aeon-update:${HEAD7}"` so a muted sync doesn't re-ping for the same upstream HEAD.

## Exit taxonomy

| Code | When | Notify |
|------|------|--------|
| `AEON_UPDATE_OK` | PR opened with ≥1 clean file (conflicts, if any, listed in it) | Yes - PR link |
| `AEON_UPDATE_MANUAL_ONLY` | Upstream changed only operator-owned / conflicting files - no clean apply, no PR | Yes - manual call-out |
| `AEON_UPDATE_REPORT` | `report` mode - delta computed, nothing mutated | Yes - dry-run summary |
| `AEON_UPDATE_IN_SYNC` | Baseline already == upstream HEAD | No (log only) |
| `AEON_UPDATE_PR_OPEN` | An earlier `aeon-update/sync-*` PR is still open - nothing written | Only if upstream moved past it (one line) |
| `AEON_UPDATE_BASELINE_SET` | First run - watermark anchored, nothing applied | One-line notify |
| `AEON_UPDATE_IS_UPSTREAM` | This instance is the upstream repo itself | No (log only) |
| `AEON_UPDATE_BASELINE_UNREACHABLE` | Baseline is not an ancestor of HEAD (history rewrite) | Yes - asks for `reset=` |
| `AEON_UPDATE_ERROR` | `scripts/aeon_update.py` could not read upstream or the repo - nothing applied | Yes - the error |

## Constraints

- **Never** push to `main` or auto-write an OPERATOR-owned path (`aeon.yml`, `soul/`, `memory/`, `STRATEGY.md`, `.mcp.json`, `output/`).
- **Never** delete a fork-only skill, and **never** copy `catalog/*.json` / `eyebrowlock.json` from upstream - regenerate them. Two exceptions: `catalog/skill-packs.json` has no generator and is synced as part of the pack-registry unit (S5), and a single skill's lock entry may be carried from upstream when that skill's tree matches upstream HEAD exactly (S7 fail-safe).
- **Never** advance `baseline_sha` without carrying unresolved conflicts forward in `pending_conflicts`.
- Cross-repo compare caps at 300 files - note `files_truncated=true` and let a follow-up run pick up the rest.
- A clean, in-sync run is **correct**, not a failure - it notifies nothing.

## Network note

Every network call is `gh api`, which authenticates via `GITHUB_TOKEN` automatically - no `curl`, no `./secretcurl`, no `$SECRET` on the command line for the Bash permission layer to refuse, and no secret beyond the default `GITHUB_TOKEN`. There are no irreversible side-effects: the skill's only mutation is a PR against this instance's own repo, which the operator reviews and merges. Retry policy: on `403` with `X-RateLimit-Remaining: 0`, sleep 60s and retry once; on a persistent contents-API failure for one file, mark it `UNREADABLE` in the report and continue with a partial sync rather than aborting the whole run.
