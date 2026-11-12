---
name: spawn-instance
description: Clone this Aeon agent into a new GitHub repo - fork, configure skills, validate, and register in the fleet
metadata:
  title: Spawn Instance
  category: core
  var: ""
  tags:
    - dev
---
<!-- autoresearch: variation C — robust: skill-existence validation, exit taxonomy, idempotent recovery, dynamic SETUP.md, pre/post-flight verification -->

> **${var}** — Name and purpose of the new instance. Format `name: purpose`, e.g. `crypto-tracker: monitor DeFi protocols and token movements`. If empty, notify the owner and **stop** with exit `SPAWN_INVALID_VAR`.

Today is ${today}. Create a new Aeon instance by forking this repo, configuring it for a specific purpose, validating the configuration, and registering it in the fleet.

Read `memory/MEMORY.md` at the start for context.

## Security Model

This skill creates the repo and configuration but does **NOT** propagate secrets.
The new instance is inert until the owner manually sets secrets (`ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN`, plus notification secrets).
Each instance has its own API keys for billing isolation and blast-radius containment.

## Exit Taxonomy

Every run ends with one of these status codes, written to the log and (where relevant) included in the notification:

| Code | Meaning |
|------|---------|
| `SPAWN_OK` | Fork created, configured, pushed, Actions enabled, registered. |
| `SPAWN_FORK_EXISTS_RECOVERED` | Fork already existed but wasn't registered → configured + registered now. |
| `SPAWN_FORK_EXISTS_REGISTERED` | Fork exists AND is already registered and not archived — refused, no change. |
| `SPAWN_INVALID_VAR` | var was empty or couldn't be parsed into `name: purpose`. |
| `SPAWN_NO_SKILLS` | After validation, the skill plan was empty — refused. |
| `SPAWN_FORK_FAILED` | `gh repo fork` and the fallback `forks` API both failed. |
| `SPAWN_PUSH_FAILED` | Fork created but push failed — fork left in place, recovery instructions emitted. |
| `SPAWN_ACTIONS_FAILED` | Configuration pushed but enabling Actions failed — recovery instructions emitted. |
| `SPAWN_API_ERROR` | Any other GitHub API failure not covered above. |

## Steps

### 1. Parse and validate the var

- If `${var}` is empty, log `SPAWN_INVALID_VAR: empty var` to `memory/logs/${today}.md`, notify: `spawn-instance: empty var — re-run with "name: purpose"`, and **stop**.
- Split on the first `:` — left is `NAME_RAW`, right is `PURPOSE` (trim whitespace). If either is empty, exit `SPAWN_INVALID_VAR`.
- Derive `NAME`: lowercase `NAME_RAW`, replace non-alphanumeric runs with `-`, strip leading/trailing `-`, truncate to 40 chars. If empty after sanitization, exit `SPAWN_INVALID_VAR`.
- Set `REPO_NAME="aeon-${NAME}"`.

### 2. Pre-flight checks

**Shell shape.** Each Bash call is one allowed command (pipes are fine). The run refuses a call that sets a variable (`OWNER=$(gh api ...)`, `TMPDIR=$(mktemp -d)`), uses `if` / `for` / `while` or a `[ ... ]` test, joins commands with `;`, `&&` or `||` (including `|| { echo ...; exit 1; }`), or starts with `cd DIR`, and `find`, `rm`, `awk`, `basename`, `mktemp`, `seq` and `sleep` are not allowed commands; each refusal costs a model turn. So run each `gh` / `git` command as its own call, read what it prints and write that value into later commands literally (the `<OWNER>`, `<REPO_NAME>` style placeholders in the snippets); turn each `|| exit` into the prose check after the call; run `git` in the clone with `git -C <dir>`; write files with Write/Edit; and do the memory reset deletes inside one `python3 -c` call.

Run each as its own call:
```bash
gh auth status
```
If it fails, log `SPAWN_API_ERROR: gh not authenticated` and stop.
```bash
gh api user --jq '.login'
```
It prints OWNER. If it fails, log `SPAWN_API_ERROR: cannot read user` and stop.
```bash
gh repo view --json nameWithOwner -q .nameWithOwner
```
It prints PARENT_REPO. If the current repo is itself a fork, use the upstream as the parent; this prints PARENT_UPSTREAM:
```bash
gh api repos/<PARENT_REPO> --jq '.parent.full_name // .full_name'
```

Check rate limit:
```bash
gh api rate_limit --jq '.resources.core.remaining'
```
It prints REMAINING. If it is below 50 (or empty, which counts as 0), log `SPAWN_API_ERROR: rate limit too low (<REMAINING>)` and stop.

### 3. Check the fleet registry

Read `memory/instances.json`. If it doesn't exist, create it with `{"instances": []}`.

```json
{
  "instances": [
    {
      "name": "crypto-tracker",
      "repo": "OWNER/aeon-crypto-tracker",
      "purpose": "monitor DeFi protocols and token movements",
      "created": "2026-04-20",
      "status": "pending_secrets",
      "skills_enabled": ["token-movers", "defi-overview", "heartbeat"],
      "parent": "OWNER/aeon"
    }
  ]
}
```

- If an entry with `name == NAME` exists and `status != "archived"`, exit `SPAWN_FORK_EXISTS_REGISTERED`, notify, and **stop**.
- If an entry exists and is archived, remove it — the new run replaces it.

### 4. Build the skill plan from the live catalog

**Do not use a hardcoded skill list.** The catalog in earlier revisions contained broken names (`wallet-digest`, `trending-coins`, `tweet-digest`, `hn-digest` — none of which exist in `skills/`). Always enumerate live.

Build the live catalog of available skills and their tags/description in one call (a shell `for` loop is refused; the loop lives inside `node -e`). It prints each skill's name and the frontmatter between its first two `---` lines, skipping directories with no `SKILL.md`:
```bash
node -e 'const fs=require("fs"); for (const d of fs.readdirSync("skills").sort()) { const f="skills/"+d+"/SKILL.md"; if (!fs.existsSync(f)) continue; const m=fs.readFileSync(f,"utf8").split(/^---[^\n]*$/m)[1] || ""; console.log("== "+d+"\n"+m.trim()) }'
```

For each skill, parse the frontmatter `description:` and `tags:` lines. Classify the purpose into themes by keyword match (case-insensitive) and pick skills whose description or tags overlap:

| Purpose keywords | Prefer skills matching tags / keywords |
|---|---|
| `crypto`, `defi`, `token`, `chain`, `wallet` | tags `[crypto]` or description contains `token`/`defi`/`chain` |
| `research`, `paper`, `academic`, `science` | tags `[research]` or name contains `paper`/`research`/`deep-research` |
| `social`, `twitter`, `x `, `tweet`, `farcaster` | tags `[social]` or name contains `tweet`/`twitter`/`farcaster`/`reply` |
| `news`, `digest`, `feed`, `brief` | name contains `digest`/`brief`/`morning`/`rss`/`hacker-news` |
| `dev`, `code`, `github`, `repo`, `pr ` | tags `[dev]` or name contains `github`/`code`/`repo`/`pr-`/`changelog` |
| `security`, `vuln`, `audit` | tags `[security]` or name contains `security`/`vuln`/`audit` |
| `prediction`, `polymarket`, `kalshi`, `market` | name contains `polymarket`/`kalshi`/`market`/`narrative` |

Rules:
- **Cap at 8** content skills. Rank by keyword density in description against purpose; tie-break by name.
- **Always include `heartbeat`** if the file `skills/heartbeat/SKILL.md` exists (health monitoring).
- If the purpose doesn't match any theme, fall back to `[reflect, heartbeat]` (filtered against existence).
- **Validate every candidate** — drop any skill where `skills/${skill}/SKILL.md` doesn't exist; log each drop as `SPAWN_DROPPED_SKILL: ${skill}`.
- If the final list is empty (no content skills survive), exit `SPAWN_NO_SKILLS`, notify, and **stop**.

Save the final list as `SKILLS_ENABLED`.

### 5. Fork the parent repo

First check whether the fork already exists:
```bash
gh api repos/<OWNER>/<REPO_NAME> --jq '.full_name'
```
If it prints the full name, `FORK_STATE` is `exists`; skip to the wait below. If it fails (404), try the modern flag first:
```bash
gh repo fork <PARENT_UPSTREAM> --fork-name <REPO_NAME> --clone=false
```
If that fails, fall back to a POST to `/repos/{owner}/{repo}/forks` with a custom name:
```bash
gh api repos/<PARENT_UPSTREAM>/forks -X POST -f name=<REPO_NAME> --jq '.full_name'
```
If that fails too, log `SPAWN_FORK_FAILED` and stop. Otherwise `FORK_STATE` is `created`.

**Wait for fork availability** (GitHub forks are async): run this check as a separate call, up to 10 times, until it prints the full name (each model turn between calls is the wait; there is no `sleep`):
```bash
gh api repos/<OWNER>/<REPO_NAME> --jq '.full_name'
```
If it still fails after 10 tries, log `SPAWN_FORK_FAILED: fork not reachable after wait` and stop.

### 6. Configure the fork

Work in the fixed directory `/tmp/spawn-instance-work` (the runner is thrown away after the run, so there is no cleanup step). Each line below is its own call:
```bash
mkdir -p /tmp/spawn-instance-work
```
```bash
gh repo clone <OWNER>/<REPO_NAME> /tmp/spawn-instance-work/repo -- --quiet
```
If the clone fails, log `SPAWN_API_ERROR: clone failed` and stop.
```bash
git -C /tmp/spawn-instance-work/repo config user.name "aeonframework"
```
```bash
git -C /tmp/spawn-instance-work/repo config user.email "aeonframework@proton.me"
```

Every path in 6a-6e (`aeon.yml`, `SETUP.md`, `CLAUDE.md`, `memory/...`, `skills/...`) is inside the clone, `/tmp/spawn-instance-work/repo`. Read and change those files with Read/Edit/Write on their absolute paths.

#### 6a. Write a customized `aeon.yml`

- Read the parent `aeon.yml` as a base (preserves comments, ordering, and the full skill list).
- Set `enabled: true` only on skills in `SKILLS_ENABLED`. All others must have `enabled: false`.
- Do not drop any skills — keep the full inventory so the child can enable more later.
- **Validate the result**: every skill name with `enabled: true` must correspond to an existing `skills/${skill}/SKILL.md` in the fork's tree. If any enabled skill is missing, abort before pushing (this is a sanity check — step 4 already validated, but the child's repo tree must match).

#### 6b. Write `SETUP.md` dynamically

Parse each enabled skill's `skills/${skill}/SKILL.md` for references to uppercase env var names (pattern: `[A-Z][A-Z0-9_]{2,}_(KEY|TOKEN|URL|ID|SECRET)`). Collect the union across enabled skills, excluding built-ins (`GITHUB_TOKEN`, `GH_TOKEN`).

Emit a SETUP.md with three sections:

```markdown
# Aeon Instance Setup

This is a managed Aeon instance spawned from `${PARENT_UPSTREAM}`.

## Purpose
${PURPOSE}

## Enabled Skills
${comma-separated list with one-line descriptions from each SKILL.md}

## Activate This Instance

Go to **Settings > Secrets and variables > Actions** and add these secrets:

### Required (pick one for Claude auth)
| Secret | Description |
|--------|------------|
| `ANTHROPIC_API_KEY` | Anthropic API key - console.anthropic.com |
| `CLAUDE_CODE_OAUTH_TOKEN` | Alternative: Claude Code OAuth token |

### Recommended (notifications)
| Secret | Description |
|--------|------------|
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `TELEGRAM_CHAT_ID` | Telegram chat ID |
| `DISCORD_WEBHOOK_URL` | Discord webhook URL |
| `SLACK_WEBHOOK_URL` | Slack webhook URL |

### Required by your enabled skills
${one row per detected env var, with the list of skills that reference it}

## Fleet Parent
Managed by `${PARENT_UPSTREAM}`. The parent can dispatch skills and monitor health via `fleet-control`.

## Security Note
This instance has NO access to the parent's secrets. Each instance maintains its own API keys and credentials.
```

If no env vars are detected beyond the required/recommended set, omit the "Required by your enabled skills" section header (don't leave an empty table).

#### 6c. Update `CLAUDE.md` idempotently

Find the heading line `## About This Repo` (or the first `## ` section if not present). Under it, insert exactly one line:
```
- Managed instance of ${PARENT_UPSTREAM}. Purpose: ${PURPOSE}.
```

If a line starting with `- Managed instance of` already exists, replace it rather than appending a duplicate.

#### 6d. Reset child memory

The child starts with a clean slate:

1. Reset `memory/MEMORY.md` to a minimal template with Write (PARENT_UPSTREAM and PURPOSE written in literally):
   ```markdown
   # Long-term Memory
   *Last consolidated: never*

   ## About This Repo
   - Aeon instance of <PARENT_UPSTREAM>. Purpose: <PURPOSE>.

   ## Next Priorities
   - Configure secrets per SETUP.md
   - Wait for first scheduled skill to run
   ```
2. Clear logs, state and topics, safe paths only, never following symlinks, in one call: it deletes every regular file under `memory/logs`, `memory/topics` and `memory/issues` (except files named `INDEX.md`), and removes `memory/instances.json` (the child has no fleet of its own). Missing directories are skipped:
   ```bash
   python3 -c 'import os; r="/tmp/spawn-instance-work/repo/memory"; [os.remove(p) for s in ("logs", "topics", "issues") for dp, _, fs in os.walk(os.path.join(r, s)) for f in fs for p in [os.path.join(dp, f)] if os.path.isfile(p) and not os.path.islink(p) and not (s == "issues" and f == "INDEX.md")]; j=os.path.join(r, "instances.json"); os.path.lexists(j) and os.remove(j)'
   ```
3. If `memory/issues/INDEX.md` exists (check with Glob), overwrite it with Write as the single line `# Issues - none open`.
4. Write `memory/cron-state.json` as `{}` with Write.

#### 6e. Commit and push

Each its own call, with PURPOSE, the skills list and PARENT_UPSTREAM written in literally:
```bash
git -C /tmp/spawn-instance-work/repo add -A
```
```bash
git -C /tmp/spawn-instance-work/repo commit -m "chore: configure instance - <PURPOSE>

Skills enabled: <SKILLS_ENABLED_CSV>
Parent: <PARENT_UPSTREAM>
Spawned: ${today}"
```
```bash
git -C /tmp/spawn-instance-work/repo push origin main
```
If that push fails, try:
```bash
git -C /tmp/spawn-instance-work/repo push origin HEAD:main
```
If that fails too, log `SPAWN_PUSH_FAILED` and stop.

If push fails, **do not delete the fork** — leave it for manual inspection and notify with:
```
spawn-instance: fork created but push failed for ${OWNER}/${REPO_NAME}.
Recover with: gh repo clone ${OWNER}/${REPO_NAME} && push manually, then re-register.
```

### 7. Enable GitHub Actions on the fork

Forks have Actions disabled by default. Use **typed** booleans (`-F`, not `-f`, or `enabled=true` is sent as the string "true"):

```bash
gh api repos/<OWNER>/<REPO_NAME>/actions/permissions -X PUT \
  -F enabled=true -f allowed_actions=all
```
If it fails, log `SPAWN_ACTIONS_FAILED` and stop.

### 8. Post-flight verification

Three separate calls. Fork reachable:
```bash
gh api repos/<OWNER>/<REPO_NAME> --jq '.full_name'
```
If it fails, log `SPAWN_API_ERROR: post-flight fork check failed` and stop. Our commit is HEAD:
```bash
gh api repos/<OWNER>/<REPO_NAME>/commits/main --jq '.sha'
```
It prints HEAD_SHA. If it fails or prints nothing, log `SPAWN_API_ERROR: post-flight HEAD check failed` and stop. Actions enabled:
```bash
gh api repos/<OWNER>/<REPO_NAME>/actions/permissions --jq '.enabled'
```
If it does not print `true`, log `SPAWN_ACTIONS_FAILED: post-flight` and stop.

### 9. Register the instance

Update `memory/instances.json` in the **parent** repo. Append:
```json
{
  "name": "${NAME}",
  "repo": "${OWNER}/${REPO_NAME}",
  "purpose": "${PURPOSE}",
  "created": "${today}",
  "status": "pending_secrets",
  "skills_enabled": ${SKILLS_ENABLED_JSON},
  "parent": "${PARENT_UPSTREAM}"
}
```

If `FORK_STATE == "exists"` at step 5, the final exit status is `SPAWN_FORK_EXISTS_RECOVERED`, otherwise `SPAWN_OK`.

### 10. Log to memory

Append to `memory/logs/${today}.md`:
```
### spawn-instance
- Status: ${EXIT_CODE}
- Instance: ${OWNER}/${REPO_NAME}
- Purpose: ${PURPOSE}
- Skills: ${SKILLS_ENABLED_CSV}
- Dropped skills: ${DROPPED_CSV or "(none)"}
- Actions enabled: yes
```

### 11. Notify via `./notify`

On success (`SPAWN_OK` or `SPAWN_FORK_EXISTS_RECOVERED`):
```
*New Aeon Instance*

Repo: ${OWNER}/${REPO_NAME}
Purpose: ${PURPOSE}
Skills (${N}): ${SKILLS_ENABLED_CSV}
Status: ${EXIT_CODE} - PENDING SECRETS

Activate:
1. https://github.com/${OWNER}/${REPO_NAME}/settings/secrets/actions
2. Add ANTHROPIC_API_KEY (or CLAUDE_CODE_OAUTH_TOKEN)
3. Add TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (or Discord/Slack)

See SETUP.md in the repo for the full secret list tailored to your enabled skills.
```

On refusal (`SPAWN_FORK_EXISTS_REGISTERED`, `SPAWN_INVALID_VAR`, `SPAWN_NO_SKILLS`):
```
spawn-instance: ${EXIT_CODE} - ${one-line reason}. No changes made.
```

On failure (`SPAWN_FORK_FAILED`, `SPAWN_PUSH_FAILED`, `SPAWN_ACTIONS_FAILED`, `SPAWN_API_ERROR`):
```
spawn-instance FAILED: ${EXIT_CODE}
Target: ${OWNER}/${REPO_NAME}
Recovery: ${one-line recovery instruction}
```

## Network note

This skill runs entirely through `gh` CLI, which handles auth internally, so no bare `$SECRET` ever lands on the command line for the Bash permission layer to refuse. No WebFetch fallback needed. If `gh` is missing or unauthenticated, the pre-flight step fails with `SPAWN_API_ERROR`.

## Constraints

- **No secret propagation.** Never read or write `ANTHROPIC_API_KEY`, `TELEGRAM_*`, `DISCORD_*`, `SLACK_*`, or any API key into the child repo. The whole security model depends on this.
- **No hardcoded skill list.** Always enumerate `skills/*/SKILL.md` at runtime to avoid referencing renamed or removed skills.
- **Idempotent.** Re-running with the same `${var}` must never produce duplicate registry entries, duplicate CLAUDE.md lines, or a second fork.
- **Never delete a fork.** If anything fails partway through, leave the fork in place and emit recovery guidance — the operator is the only party authorized to delete it.
- **Never push to the parent without committing `memory/instances.json` via the normal Aeon workflow.** The parent commit happens through the same path as any other skill output.

Write complete, working code. No TODOs or placeholders.
