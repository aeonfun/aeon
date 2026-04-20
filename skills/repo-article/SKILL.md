---
name: repo-article
description: Thesis-driven article about a watched repo — falsifiable claim, cited evidence, self-edit quality gate
var: ""
tags: [dev, content]
---
> **${var}** — Angle or topic (e.g. "architecture", "recent progress", "roadmap"). If empty, phase 2 picks the angle with the strongest supporting evidence.

## Config

Reads repos from `memory/watched-repos.md`. If multiple repos are listed, pick the one with the most activity in the last 7 days.

---

<!-- autoresearch: variation B — editorial discipline: research → thesis → draft → self-edit, with a falsifiable claim and a quality gate -->

Read `memory/MEMORY.md` and the last 7 days of `memory/logs/` for context on recent activity.
Read `memory/watched-repos.md` for the repo to cover.

An article without a thesis is filler. This skill runs four phases and only advances when the current phase's gate passes.

## Phase 1 — Research (gather, don't write yet)

Run these in parallel where possible:

```bash
# Repo metadata
gh api repos/owner/repo --jq '{name, description, language, stargazers_count, forks_count, open_issues_count, topics, created_at, updated_at, pushed_at, default_branch}'

# Commits in last 7 days (paginated)
gh api repos/owner/repo/commits -X GET \
  -f since="$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-7d +%Y-%m-%dT%H:%M:%SZ)" \
  --jq '.[] | {sha: .sha[0:7], msg: .commit.message | split("\n")[0], author: .commit.author.name, date: .commit.author.date, url: .html_url}' --paginate

# Merged PRs in last 7 days
gh api 'repos/owner/repo/pulls?state=closed&sort=updated&direction=desc&per_page=50' \
  --jq '[.[] | select(.merged_at and (.merged_at > (now - 86400*7 | todate))) | {number, title, user: .user.login, merged_at, additions, deletions, url: .html_url}]'

# Open PRs
gh api repos/owner/repo/pulls --jq '[.[] | {number, title, user: .user.login, created_at, draft, labels: [.labels[].name], url: .html_url}]'

# Issues opened/closed in last 7 days (exclude PRs)
gh api 'repos/owner/repo/issues?state=all&since='$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%SZ)'&per_page=100' --paginate \
  --jq '[.[] | select(.pull_request | not) | {number, title, state, created_at, closed_at, labels: [.labels[].name]}]'

# Last 3 releases
gh api repos/owner/repo/releases --jq '.[0:3] | .[] | {tag_name, name, published_at, body}'

# README (fallback: WebFetch raw URL if base64 decode fails)
gh api repos/owner/repo/readme --jq '.content' | base64 -d
```

From the commit list, find the most-frequently-touched files. Read the top 2-3 of those with `gh api repos/owner/repo/contents/<path>` plus any `CHANGELOG.md`, `ROADMAP.md`, or architecture docs.

**External context** — three distinct WebSearch queries:
1. `"owner/repo" site:news.ycombinator.com OR site:lobste.rs OR site:reddit.com`
2. `"owner/repo" twitter OR x.com` (or the project name if distinctive)
3. One query to anchor positioning against a comparable/competing project.

**Gate 1 — enough story?** If **all** of the following hold, abort and notify `REPO_ARTICLE_SKIPPED: insufficient activity` (log reason, write no article):
- <3 commits in the last 7 days, AND
- 0 merged PRs in the last 7 days, AND
- no release in the last 30 days, AND
- no external mentions surfaced in step 3.

**Quiet-repo exception**: if the repo has historical importance but is currently slow (e.g. only 1-2 commits this week, no release), do **not** skip — instead narrow the article's focus to the single most substantive recent change (a specific commit, a contested issue thread, a roadmap update) and write a shorter piece around *that*. Prefer publishing a tight 600-word piece on one real change over skipping.

## Phase 2 — Thesis

Write one **falsifiable claim** in ≤25 words. The claim must be disprovable by specific evidence — not a vibe.

- Good: "aaronjmars/aeon is pivoting from scheduled digests to reactive skill chains — 4 of 7 merged PRs this week added or consumed `.outputs/*.md` contracts."
- Bad: "Aeon is an interesting agent framework." (not falsifiable)

If `${var}` is set, the thesis must relate to that angle (e.g. `var=architecture` → an architectural claim). If no angle is forced, pick the one with the strongest evidence from: shipping velocity shift, architectural pivot, community growth inflection, roadmap commitment, deprecation/scope cut, performance or scale milestone.

**Gate 2 — falsifiability.** Finish the sentence: "This claim would be wrong if ____." If you can't complete it with something concrete and checkable, rewrite the thesis.

## Phase 3 — Draft (600-900 words, Markdown)

```markdown
# [Title that asserts the thesis or a consequence of it — not "A look at X"]

[1-paragraph hook, ≤80 words: lead with the thesis or a surprising number that sets it up.]

## The claim
> [The falsifiable thesis, verbatim, as a blockquote.]

## Evidence
[Two to four sub-paragraphs. Each MUST cite at least one specific commit SHA, PR#, file path, release tag, or external mention. Link the source inline.]

## Counter-evidence / what would change my mind
[One paragraph. What recent signals argue against the thesis? Be honest. If genuinely nothing does, say so — but only after looking.]

## Why it matters
[One paragraph. Who benefits or loses if the thesis is true? Connect to an ecosystem trend, user need, or competing project.]

---
*Sources*
- [Label](url)
- [Label](url)
[≥4 total, ≥1 in-repo (commit/PR link) and ≥1 external (news/social/doc).]
```

## Phase 4 — Self-edit (required)

Run this checklist. Rewrite any line that fails. Target: 8/8 passing.

1. **Thesis visible in first 100 words?** If not, rewrite the hook.
2. **Every section has ≥1 specific number, SHA, PR#, filename, or date?** (generic adjectives don't count)
3. **Zero banned phrases** (see *Banned phrase lexicon* section below — check against that explicit list).
4. **Counter-evidence is real** — not a strawman like "some might say it's complex".
5. **Sources ≥4 links, ≥1 in-repo, ≥1 external.**
6. **Title asserts something** (not "A look at X" / "Exploring Y").
7. **Word count in 600-900** (hard bounds — trim or expand).
8. **No placeholder phrases** like "[TBD]", "[link]", "[title]".

If any item still fails after one rewrite pass, publish with status `REPO_ARTICLE_DEGRADED` and note which items failed in the log — don't hide it.

## Phase 5 — Save, log, notify

1. Save the article to `articles/repo-article-${today}.md`.
2. Append to `memory/logs/${today}.md` **before** notifying:
   ```
   ### repo-article
   - Repo: owner/repo
   - Thesis: [verbatim]
   - Angle: [var or auto-selected]
   - Word count: N
   - Self-edit checklist: X/8 passing
   - Status: REPO_ARTICLE_OK | REPO_ARTICLE_DEGRADED | REPO_ARTICLE_SKIPPED
   ```
3. Update the `Recent Articles` table in `memory/MEMORY.md` (Date | Title | Topic).
4. Notify via `./notify`:
   ```
   *[Article title]*

   Thesis: [one sentence]

   Read: [link to articles/repo-article-${today}.md in THIS repo — get the repo name from `git remote get-url origin`, not the watched repo]
   ```

## Sandbox note

The sandbox may block outbound curl. Use **WebFetch** as a fallback for any URL fetch. For auth-required APIs, use the pre-fetch/post-process pattern (see CLAUDE.md). `gh api` handles GitHub auth internally.

## Banned phrase lexicon

Reject a draft that contains any of these. Match case-insensitively, whole phrase or obvious variant:

- "in today's fast-paced world"
- "leveraging" / "leverage" (as a verb meaning "use")
- "robust"
- "game-changer" / "game-changing"
- "under the hood" (unless the section actually walks through internals)
- "taking X to the next level"
- "at the end of the day"
- "diving into" / "deep dive"
- "delving into" / "delve"
- "comprehensive suite"
- "cutting-edge"
- "seamlessly" / "seamless"
- "empowers" / "empowering"
- "revolutionize" / "revolutionary"
- "unlock" (metaphorical, e.g. "unlocks new possibilities")
- "streamline" (as filler)
- "best-in-class"
- "paradigm shift"

If a banned phrase is the *most accurate* word in a technical context (e.g. actually describing leverage in a derivatives article), keep it and note the exemption in the log.

## Constraints

- Never publish without a thesis.
- Never pad to hit word count — 600 honest words beat 900 padded.
- Never fabricate a SHA, PR number, or quote. If real evidence isn't available, weaken the thesis or skip.
