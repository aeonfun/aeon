---
name: push-recap
description: Daily deep-dive recap of all pushes — reads diffs, ranks impact, separates user-visible shipments from internal work, delivers a verdict
var: ""
tags: [dev]
---
<!-- autoresearch: variation B — sharper output via verdict line, user-visible/internal split, impact ranking, significance-gated notification -->

> **${var}** — Repo (owner/repo) to recap. If empty, recaps all watched repos.

If `${var}` is set, only recap that repo (owner/repo format).

## Config

Reads repos from `memory/watched-repos.md`. If the file doesn't exist, bootstrap it with the repo from `git remote get-url origin` (one line: `owner/repo`) and continue. If bootstrap fails, notify `push-recap: no watched repos configured` and stop.

Read `memory/MEMORY.md` and the last 2 days of `memory/logs/` for context.

## The thesis

A flat chronological list of commits hides the answer readers actually want: **what shipped to users today, what's internal churn, and what's stuck**. This skill ranks commits by impact, separates user-visible work from maintenance, and leads with a one-line verdict. Noisy days get suppressed instead of flooding the channel.

## Steps

### 1. Gate on signal

Fetch push events + commits for each watched repo from the last 24h:

```bash
SINCE="$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-24H +%Y-%m-%dT%H:%M:%SZ)"

gh api repos/OWNER/REPO/events --jq '[.[] | select(.type == "PushEvent") | {actor: .actor.login, created_at: .created_at, ref: .payload.ref, commits: [.payload.commits[] | {sha: .sha[0:7], message: .message, author: .author.name}]}]' --paginate

gh api repos/OWNER/REPO/commits -X GET -f since="$SINCE" --jq '.[] | {sha: .sha[0:7], full_sha: .sha, message: .commit.message, author: .commit.author.name, date: .commit.author.date}' --paginate
```

Also pull **merged PRs** in the same window (they anchor themes better than raw commits):

```bash
gh pr list --repo OWNER/REPO --state merged --search "merged:>=$SINCE" --json number,title,author,mergedAt,mergeCommit,additions,deletions,files,body,labels --limit 50
```

**Bot filter.** Drop commits whose author matches `dependabot[bot]`, `renovate[bot]`, `github-actions[bot]`, `*-bot`, or whose message starts with `chore(deps):` **unless** they touch files outside `package*.json`/`*.lock`/`.github/`. Note the dropped count — you'll surface it in the footer.

**Significance gate.** After bot-filtering, if the remaining set is all empty across every watched repo: log `PUSH_RECAP_QUIET` to `memory/logs/${today}.md` and **stop — send no notification, write no article**.

If any fetch errors (non-empty `stderr`, rate-limit hit, 5xx), record the repo under `errors[]` and continue with partial data. If **every** fetch fails, log `PUSH_RECAP_ERROR` with the per-repo reasons and notify `push-recap: all sources failed — [reasons]` then stop.

### 2. Classify every commit (user-visible vs internal)

For each commit, read the diff:

```bash
gh api repos/OWNER/REPO/commits/FULL_SHA --jq '{files: [.files[] | {filename, status, additions, deletions, patch}]}'
```

If `patch` is `null` for any file (diff too large), note it and fall back to `{filename, status, additions, deletions}` only.

Classify by file paths touched. A commit is **user-visible** if it touches any of:
- Product source paths (`src/`, `app/`, `lib/`, `pkg/`, `cmd/`, `components/`, `pages/`, `api/`, `routes/`, `handlers/`, `public/`)
- New public surface: new file with `export`, new HTTP route, new CLI flag, new config key, new migration, new schema field
- UI strings, copy, templates, public docs
- Release/version files (`package.json` version bump, `CHANGELOG.md`, `VERSION`)

A commit is **internal** if it *only* touches: `tests/`, `__tests__/`, `*.test.*`, `.github/`, `ci/`, `scripts/`, `docs/internal/`, `.vscode/`, lockfiles, dotfiles, or is a pure dependency bump.

A commit is **infra** if it *only* touches CI/CD, Docker, Terraform, workflow files. Infra is a third bucket — not user-visible, not internal engineering churn, but worth calling out separately.

### 3. Rank impact

Compute an impact score per commit:

```
impact = (additions + deletions) × user_visible_multiplier × breadth_multiplier
  user_visible_multiplier = 2.0 if user-visible, 1.2 if infra, 1.0 if internal
  breadth_multiplier = 1 + 0.2 × min(files_touched, 5)
```

Read diffs in full for the **top 10 by impact** plus every commit linked to a merged PR. For the rest, skim filename + stats only.

### 4. Write the verdict

After ranking, produce a **one-line verdict** that describes today in ≤12 words. Pick exactly one shape:
- `SHIPPING — <user-visible thing that went out>`
- `BUILDING — <feature in progress, not yet user-visible>`
- `HARDENING — <bugs/robustness work dominates>`
- `REFACTORING — <internal restructuring dominates>`
- `MAINTAINING — <deps, CI, chore dominate>`
- `MIXED — <two-thread summary>`

The verdict must be specific (name the thing, not "various improvements").

### 5. Group by theme, then by audience

Cluster commits into 2-4 themes. **Within each theme**, split into subsections:
- **Shipped to users** — user-visible commits. Lead with these.
- **Under the hood** — internal refactors/tests that support the user-visible work.
- **Infra** — CI/CD/deploy changes tied to the theme.

If a theme has no user-visible commits, label it `Internal: <theme>` and push it below user-visible themes in the article.

### 6. Write the deep recap

Write to `articles/push-recap-${today}.md`:

```markdown
# Push Recap — ${today}

## Verdict
> <one-line verdict>

**Shape:** X user-visible commits · Y internal · Z infra · N bot-filtered
**Volume:** X files changed, +Y/-Z lines across N commits by M authors
**Merged PRs:** <count> (<#num> <title>; <#num> <title>...)

---

## Top impact today
1. `abc1234` — <commit message>. <one sentence: what the diff actually shows and who notices>. (<files> files, +X/-Y)
2. `def5678` — <commit message>. <one sentence>. (<files> files, +X/-Y)
3. `ghi9012` — <commit message>. <one sentence>. (<files> files, +X/-Y)

---

## owner/repo

### [Theme 1 — descriptive name]

**What this is:** <2 sentences stating the user-facing or developer-facing outcome — not the commit messages repeated>.

**Shipped to users**
- `abc1234` — <message>
  - `path/to/file.ts`: <what the patch actually introduces in plain language> (+85/−4)
  - `new/file.ts`: <what this new file contains> (+45/−0)
- `def5678` — <message>
  - `path/to/other.ts`: <specific change> (+23/−4)

**Under the hood** *(only if present)*
- `ghi9012` — <message>: <one-liner>

### [Theme 2 — descriptive name]
...

### Internal: [Theme 3] *(only if any purely-internal theme exists)*
...

---

## Developer notes
- **New dependencies:** <list with versions, or "none">
- **Breaking changes:** <API/config/schema changes that ripple, or "none">
- **New public surface:** <new routes, CLI flags, config keys, exported functions — the things that show up in docs>
- **Tech debt added:** <new TODOs/FIXMEs introduced in the diff, or "none">

## Open threads
- <branches pushed but not merged, with PR link if any>
- <incomplete work visible in diffs — stubbed functions, commented-out blocks, TODO comments added>

## Sources
<per-repo status line — see step 8>
```

Keep it substantive. If there are fewer than 3 user-visible commits, drop the `Top impact today` header and merge those commits into the theme section — don't pad.

### 7. Log before notifying

Append to `memory/logs/${today}.md`:

```
### push-recap
- Repos: <list>
- Commits: <total> (user-visible: X, internal: Y, infra: Z, bot-filtered: B)
- Merged PRs: <count>
- Verdict: <the one-line verdict>
- Article: articles/push-recap-${today}.md
- Sources: <per-repo ok/error/empty>
```

### 8. Notify with significance gating

**Skip the notification entirely** if all of the following are true (log `PUSH_RECAP_LOW_SIGNAL` and stop):
- Zero user-visible commits
- ≤3 internal commits
- Zero merged PRs

Otherwise send via `./notify`:

```
*Push Recap — ${today}*
<repo> — <verdict>

Shipped to users:
• <top user-visible commit, specific sentence>
• <second>
• <third — omit if fewer than 3 user-visible>

Under the hood:
• <top internal change worth mentioning, or omit this block if noise>

Shape: X user-visible · Y internal · Z infra · N bot-filtered · P merged PRs
Volume: X files, +Y/-Z lines

Full recap: https://github.com/$(git remote get-url origin | sed -E 's|.*github.com[:/]([^/]+/[^/.]+).*|\1|')/blob/main/articles/push-recap-${today}.md
```

The notification must let a reader know what shipped without clicking through. Names and numbers, not "various improvements." Each bullet must cite at least one: specific file, specific feature, specific user impact.

## Source-status footer (required in article)

End every article with:

```
## Sources
- OWNER/REPO: <ok | rate-limited | partial (<reason>) | empty | error (<reason>)>
- gh api events: <ok | fail>
- gh api commits: <ok | fail>
- gh pr list: <ok | fail>
- bot-filtered: <count>
- diff-truncated: <count>
```

This distinguishes `PUSH_RECAP_QUIET` (real empty) from `PUSH_RECAP_ERROR` (all fetches failed) from `PUSH_RECAP_PARTIAL` (some repos fetched, some didn't) in future-you's debugging.

## Sandbox note

`gh api` and `gh pr list` handle auth internally and work in the sandbox. If a call returns a rate-limit error (403 with `X-RateLimit-Remaining: 0`), record it in the source-status footer and continue with what you have. For large diffs where the `patch` field is `null`, fall back to filename + additions/deletions stats. Never use raw `curl` against the GitHub API — always `gh api`.

## Constraints

- Do not repeat the commit message verbatim as "what changed" — read the patch and state what the code now does.
- Do not invent user impact. If the diff only shows internals, say "internal: <what>", not "improves user experience by <speculation>".
- Do not pad the notification with boilerplate when the day was quiet — the gate exists so the channel stays high-signal.
- Do not skip the source-status footer even on successful runs.
