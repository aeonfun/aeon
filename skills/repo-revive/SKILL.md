---
name: Repo Revive
description: Pick the highest-★ dormant watched repo and make one targeted improvement to reactivate it — refresh stale model references, README, or metadata
var: ""
schedule: "0 10 * * 6"
commits: true
permissions: [contents: write, pull-requests: write]
tags: [dev, growth]
---
> **${var}** — Specific repo (`owner/repo`) to target. If empty, auto-selects from watched repos by `stars × log10(days_dormant)`.

If `${var}` is set, skip selection and work on that repo directly.

Read `memory/MEMORY.md`, `memory/watched-repos.md`, and the last 7 days of `memory/logs/` before starting.

## Voice

If `soul/SOUL.md` and `soul/STYLE.md` are populated, read both and match the operator's voice exactly for the revival tweet draft (step 5). If they are empty templates or absent, write the tweet in a clear, direct, neutral tone — short, factual, no hashtags, no emojis, no corporate launch-language.

## Config

This skill reads two operator-controlled files:

- **`memory/watched-repos.md`** — the candidate repo pool. One `owner/repo` per line (markdown bullets like `- owner/repo` are fine; comment lines starting with `#` are ignored). If the file is missing or empty, log `REPO_REVIVE_NO_CONFIG` and exit cleanly (no notification — empty config is not an error).
- **`memory/topics/stale-models.md`** — list of AI model names the operator considers stale and the current model names they want to see referenced instead. Used only when scoring stale-model fixes. Example shape:

  ```markdown
  # Stale Models

  ## Considered stale (flag if a watched repo's README/config still references these)
  - gpt-3.5
  - claude-2
  - claude-instant
  - gpt-4 (without version suffix)
  - text-davinci

  ## Current models (suggest these as replacements)
  - claude-sonnet-4-6
  - claude-opus-4-7
  - gpt-4o
  - gemini-2.0
  ```

  If the file is missing, skip the "stale model" fix category entirely (other fix categories still apply) and log `REPO_REVIVE_NO_MODEL_CONFIG: skipping model audit`.

## Steps

### 1. Select target repo

If `${var}` is set, use that repo. Otherwise:

- Parse `memory/watched-repos.md` into a list of `owner/repo` candidates
- For each candidate, fetch metadata via `gh api`:
  ```bash
  gh api "repos/$REPO" --jq '{stars: .stargazers_count, pushed_at, archived, default_branch}'
  ```
- Filter to repos meeting ALL of these criteria:
  - Stars ≥ 100
  - Not archived
  - `pushed_at` > 60 days ago (excluding pushes from this skill or other Aeon-bot accounts — check the most recent non-bot human commit via `gh api "repos/$REPO/commits?per_page=10"` and skip bot authors)
  - Not already revived in the last 30 days (grep `memory/logs/` for `REPO_REVIVE_OK` lines mentioning this repo)
- Score each: `score = stars × log10(days_dormant + 1)`
- Pick the highest-scoring repo
- Log the selection: `Selected: owner/repo (score: X, Yd dormant, N★)`

If zero repos pass the filters: log `REPO_REVIVE_SKIP: no eligible repos` and exit (no notification).

### 2. Audit what's stale

Inspect the selected repo via `gh api`:

```bash
gh api "repos/$REPO/git/trees/HEAD?recursive=1" --jq '.tree[].path' \
  | grep -E '\.(md|json|js|ts|py|toml|yaml|yml)$' | head -50
```

Look for these stale signals — check at most 3 files per category:

**A. Stale AI model references** (only if `memory/topics/stale-models.md` is populated):
- README, config, or source files referencing any model name listed under "Considered stale" in `stale-models.md`
- Missing models from the "Current models" list when the file demonstrably enumerates a supported-models list

**B. Missing README elements:**
- No demo GIF or screenshot
- No "Quick Start" or "Installation" section
- No badges (stars, npm version, license)

**C. Open community issues** (fetch up to 10):
```bash
gh api "repos/$REPO/issues?state=open&per_page=10" \
  --jq '.[] | {number, title, comments, created_at, labels: [.labels[].name]}'
```
Look for issues that are simple to close with a README clarification or a small code fix.

**D. Stale metadata:**
- Repository description missing or generic
- Topics/tags empty or outdated
- Homepage URL missing

### 3. Pick ONE improvement

Rank the stale signals by effort-to-impact. Pick the single highest-impact, lowest-effort fix:

| Fix type | Effort | Impact |
|----------|--------|--------|
| Update model list in README | very low | high (signals active maintenance) |
| Add Quick Start section | low | high (reduces friction) |
| Close simple issue with README clarification | low | high (community signal) |
| Update repo description + topics | very low | medium |
| Add install badge | very low | low |

Do NOT attempt:
- Architectural refactors
- New features (use `external-feature` or `feature` for that)
- Security fixes (use `vuln-scanner` for that)
- Multiple improvements in one PR — one thing, one PR

### 4. Make the improvement

Clone, branch, change, commit, push, PR:

```bash
gh repo clone "$REPO" "/tmp/repo-revive-${REPO##*/}"
cd "/tmp/repo-revive-${REPO##*/}"
git checkout -b "chore/revive-${today}"
# ... apply the targeted change ...
git add -A
git commit -m "chore: <what you changed>

Periodic maintenance pass — repo is at ${STARS}★ and worth keeping fresh."
git push -u origin "chore/revive-${today}"
gh pr create --title "chore: <what you changed>" --body "<concise body>"
```

If the repo doesn't accept outside PRs or the clone fails, fall back to updating description + topics via API (requires you to be the owner — skip if not):

```bash
gh api -X PATCH "repos/$REPO" -f description="..." -f homepage="..."
```

### 5. Draft revival tweet

Write one tweet draft (≤ 280 chars) announcing the update. **Voice rules:**
- If soul files are populated, match the operator's voice exactly (lowercase, em dashes, position-first, no corporate launch-language — whatever the soul prescribes).
- If soul files are empty/absent, use a clear, direct, neutral tone — short, factual, no hashtags, no emojis.
- Always reference something specific about what changed. No "maintenance release" filler.

Save to `/tmp/revival-tweet.md`.

### 6. Notify

Write notification to `/tmp/repo-revive-notify.md`:

```
*Repo Revive — ${today}*

**${owner/repo}** (${N}★, ${N}d dormant)

fix: <one-line description>
pr: <PR URL or "no PR — updated via API">

tweet draft:
"<exact tweet text>"
```

Then: `./notify -f /tmp/repo-revive-notify.md`.

### 7. Log

Append to `memory/logs/${today}.md`:

```markdown
## Repo Revive
- **Target:** owner/repo (N★, Nd dormant)
- **Fix:** <one-line description>
- **PR:** <URL or "API update">
- **Tweet draft:** yes/no
- REPO_REVIVE_OK
```

If no eligible repos found:

```markdown
## Repo Revive
- REPO_REVIVE_SKIP: no eligible repos — all recently revived or below threshold
```

## Guidelines

- One repo per run. One fix per run. Both intentional.
- The goal is to make the repo look actively maintained, not to ship features.
- A single README line that updates a model name is better than a PR nobody reviews.
- When in doubt, update the model list — it's the most-visible "is this still alive?" signal for a developer landing on the repo.

## Sandbox Note

Uses `gh` CLI for all GitHub operations — no curl with env-var auth needed. `./notify -f` handles delivery reliably even when the sandbox blocks outbound network.

## Environment Variables

None required. `gh` CLI handles GitHub auth via the `GITHUB_TOKEN` already available in Actions.
