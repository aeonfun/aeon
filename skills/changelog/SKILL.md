---
name: Changelog
description: Generate a user-facing weekly changelog (Keep a Changelog format) from recent commits across watched repos
var: ""
tags: [dev]
---
<!-- autoresearch: variation B — sharper output: Keep a Changelog categories, breaking-change surfacing, plain-English rewrites, noise filtering -->

> **${var}** — Repo (owner/repo) to scan. If empty, scans all watched repos.

## Why this skill exists

A changelog is not a commit log. Raw commit dumps grouped by conventional prefix are the noise anti-pattern — users can't tell what matters. This skill produces a [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)-style weekly summary: categorized, plain-English, breaking changes surfaced, internal churn filtered out.

## Config

Reads repos from `memory/watched-repos.md`. If the file doesn't exist, abort and notify: "changelog: `memory/watched-repos.md` missing — nothing to scan." Do not create it silently.

```markdown
# memory/watched-repos.md
- owner/repo
- another-owner/another-repo
```

If `${var}` is set to `owner/repo`, scan only that repo (skip the file list).

---

Read `memory/MEMORY.md` and the last 3 days of `memory/logs/` for context (prior runs, known issues).

## Steps

### 1. Pick the scan set

- If `${var}` is non-empty, scan only `${var}`.
- Otherwise, read `memory/watched-repos.md` and parse `- owner/repo` lines.
- If the list is empty, notify "changelog: no repos configured" and exit cleanly.

### 2. Fetch commits and merged PRs per repo

For each repo, isolate failures — one broken repo must not kill the run. Track status in a `sources` dict (`repo → ok|empty|fail`).

Compute `SINCE` as UTC 7 days ago:
```bash
SINCE=$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-7d +%Y-%m-%dT%H:%M:%SZ)
```

Detect the default branch (don't assume `main`):
```bash
BRANCH=$(gh repo view owner/repo --json defaultBranchRef --jq '.defaultBranchRef.name')
```

Fetch commits on the default branch since `SINCE`:
```bash
gh api -X GET "repos/owner/repo/commits" -f sha="$BRANCH" -f since="$SINCE" --paginate \
  --jq '.[] | {sha: .sha, short: .sha[0:7], message: .commit.message, author: (.author.login // .commit.author.name), date: .commit.author.date, url: .html_url}'
```

Also fetch merged PRs in the window — PR titles/bodies are usually cleaner than raw commit messages:
```bash
gh pr list --repo owner/repo --state merged --limit 100 \
  --search "merged:>=$SINCE" \
  --json number,title,body,mergedAt,author,url,labels
```

**Sandbox note:** `gh` uses `GITHUB_TOKEN` internally and works in the sandbox. If `gh` fails, log `fail` for that repo and continue — do not fall back to WebFetch (public API is rate-limited and adds noise).

### 3. Filter noise

Exclude before classifying:
- Bot authors: `dependabot[bot]`, `renovate[bot]`, `claude[bot]`, `github-actions[bot]`.
- Merge commits where the underlying PR commits are already included (dedupe by PR number).
- Revert commits paired with the reverted commit in the same window (collapse both into a single "Reverted: X" Fixed entry, or drop if trivial).
- Pure auto-generated commits: "Update submodule", "Bump version to X", release-bot tags.

Keep a per-repo count of filtered commits for the footer ("N internal/bot commits hidden").

### 4. Classify into Keep a Changelog categories

Do **not** use Features/Fixes/Docs/Chores — those are for developers. Use:

| Category | Use for |
|----------|---------|
| **⚠️ Breaking** | `feat!:` / `fix!:` / any commit whose body contains `BREAKING CHANGE:`. Also any removed public API. |
| **Added** | New user-visible features (typically `feat:` without `!`). |
| **Changed** | Modifications to existing functionality users will notice (behaviour, UX, defaults). |
| **Fixed** | Bug fixes users care about (`fix:` only if the bug was observable). |
| **Security** | `security:` prefix, `CVE-`, dependency bumps flagged as security, or commits touching auth/crypto with obvious security framing. |
| **Internal** | Everything else (`chore`, `ci`, `build`, `test`, `refactor`, `style`, `docs` unless docs are user-facing). Show only a one-line count, not full entries. |

`Deprecated` and `Removed` categories: include only if genuinely present — don't pad with empty sections.

### 5. Rewrite each entry in user language

Commit message → changelog line rules:
- Strip the `type(scope):` prefix. Keep scope only if it clarifies (`dashboard: add dark mode` is fine; `core: fix bug` is not).
- Rewrite imperative dev-speak into a past-tense user statement: `feat(auth): add oauth2 pkce flow` → `OAuth 2 PKCE login is now supported.`
- Collapse related commits into one entry when they share a PR or scope (e.g. 4 commits for one feature → one line, list the shas in parentheses).
- Length: one sentence, ≤20 words per entry. Cut internal implementation details.
- Include one linked reference per entry: prefer PR (`[#123](url)`) over sha; fall back to short sha (`[a1b2c3d](url)`).

### 6. Assemble the article

Save to `articles/changelog-${today}.md`:

```markdown
# Changelog — Week of ${today}

*Window: ${SINCE_date} → ${today} · Sources: repo1=ok, repo2=empty, repo3=fail*

## owner/repo

> **Highlights:** ≤2 sentences naming the most important user-facing change(s). If nothing user-facing, write "No user-facing changes this week; N internal commits."

### ⚠️ Breaking
- Plain-English breaking change description. Migration hint if obvious. ([#123](url))

### Added
- User-facing feature description. ([#124](url))

### Changed
- Behaviour/UX change. ([a1b2c3d](url))

### Fixed
- Bug that users would have hit. ([#125](url))

### Security
- Patch description, CVE if known. ([a1b2c3d](url))

*Internal: N commits hidden (chore/ci/build/refactor). Bots filtered: M.*

---

## owner/repo2
…
```

Rules:
- Omit categories that are empty (don't print "### Added\n- None").
- Omit entire repo section if `sources[repo] == empty` and no Highlights line is meaningful — but still list the repo in the sources line.
- If `sources[repo] == fail`, include a stub: `## owner/repo\n\n*Could not fetch — see logs.*`

### 7. Notify

Send one concise paragraph via `./notify`:

```
*Changelog — Week of ${today}*
${total_repos} repos: ${total_user_facing} user-facing changes (${breaking_count} breaking, ${added_count} added, ${fixed_count} fixed, ${security_count} security). Top: ${one_line_most_important_change}. Full: articles/changelog-${today}.md
```

If zero user-facing changes across all repos: send `CHANGELOG_QUIET — no user-facing changes across ${N} repos this week.`

If all repos failed: send `CHANGELOG_ERROR — all ${N} repos failed to fetch. See logs.` and exit non-zero.

### 8. Log to memory

Append to `memory/logs/${today}.md`:

```
### changelog
- Window: ${SINCE_date} → ${today}
- Repos: ${ok_count} ok, ${empty_count} empty, ${fail_count} fail
- User-facing: ${breaking} breaking, ${added} added, ${changed} changed, ${fixed} fixed, ${security} security
- Internal filtered: ${internal_count} commits, ${bot_count} bot commits
- Article: articles/changelog-${today}.md
- Notes: [anything surprising — e.g. big breaking change, repo with no activity, first run for a new repo]
```

## Constraints

- Never paste raw commit messages as changelog entries — always rewrite.
- Never emit empty categories or empty-highlight repos.
- Never include bot commits in user-facing output.
- Breaking changes always lead. Never bury a `!:` commit under Added/Changed.
- Keep notifications to one paragraph per CLAUDE.md rules.

## Sandbox note

`gh` CLI handles auth and works in the sandbox. If `gh api` fails for a repo, mark it `fail` in the sources dict and continue with other repos — don't abort the whole run, and don't fall back to unauthenticated WebFetch (rate limits will cascade failures).
