---
name: GitHub Trending
description: Curated trending GitHub repos — clustered, filtered, and labeled by momentum
var: ""
tags: [dev]
---
<!-- autoresearch: variation B — sharper output via curation, clustering, "why notable" gate, momentum tags -->

> **${var}** — Optional language filter (e.g. `python`, `typescript`, `rust`). If empty, covers all languages.

Read `memory/MEMORY.md` for context.
Read `memory/logs/` for the last 2 days to dedupe repos you've already featured.
Read `soul/SOUL.md` + `soul/STYLE.md` if populated to match voice.

## Goal

Don't just dump the top 10 trending repos — GitHub already shows that. Deliver a **curated** slate of 5-8 repos that a busy dev would actually want to click, grouped by category, stripped of noise, with a one-line "why notable" per pick and a momentum tag.

## Steps

### 1. Fetch candidates

Fetch the daily trending page via **WebFetch** (not curl — sandbox blocks outbound curl):
```
https://github.com/trending?since=daily
```
If `${var}` is set, append the language segment: `https://github.com/trending/${var}?since=daily`.

Extract for each of the ~25 returned repos:
- `owner/repo`
- one-line description
- primary language
- stars today (the "X stars today" widget)
- total stars
- URL

### 2. Enrich with velocity metadata (supplementary)

For the 10-15 repos that survive the filter in step 3, try to enrich with **stars-per-day since creation** using `gh api` (has auth built in, bypasses sandbox curl issues):
```bash
gh api "repos/OWNER/REPO" --jq '{created_at, stargazers_count, pushed_at}'
```
Compute `velocity = stargazers_count / max(days_since_created, 1)`.

If `gh api` fails for a repo, skip enrichment for that one — it's not required, just informative.

### 3. Filter noise (required)

**Drop** any repo matching these patterns — they're low-signal for a dev audience:
- **Meta-lists**: repo names containing `awesome-`, `awesome_`, `-list`, `free-`, `public-apis`, `interview-`, `cheatsheet`, `resources`
- **Bare tutorials / learn-X**: names starting with `learn-`, `build-your-own-`, `30-days-of-`, `X-in-Y`, `hello-world-*`
- **Non-code bundles**: dotfiles, config dumps, blog-source repos (check description for "my personal blog", "my dotfiles")
- **Low-activity**: stars today < 50 AND not new this week (created > 14 days ago)
- **Already featured**: repo appeared in `memory/logs/YYYY-MM-DD.md` in the last 2 days

If a repo *barely* fails a filter but is genuinely technically interesting (novel algorithm, new runtime, new framework), you may keep it — note it as a judgment call.

### 4. Require a "why notable" for each survivor

For every repo that survives filtering, write **one line** (≤ 18 words) explaining *why a dev should care today*. No paraphrasing the description.

Good: *"Replaces Electron with native webview bindings — ships a 3MB hello-world instead of 120MB."*
Bad: *"A new framework for building desktop apps."* (that's just the description)

If you can't write a concrete "why notable" line, **drop the repo**. The filter is the feature.

### 5. Tag momentum

Tag each surviving repo with one of:
- **DEBUT** — created within the last 14 days (first-time trending)
- **ACCELERATING** — velocity > 50 stars/day AND total stars > 500 AND older than 14 days
- **RETURNING** — older repo (> 90 days) trending again; note this means a release, a viral post, or a HN moment
- **HOLDOVER** — appeared in yesterday's logs (use sparingly; prefer to drop)

### 6. Cluster into categories

Buckets are **heuristic and author-inferred** — classify by the repo's primary utility, not by author self-description. Cap total buckets at **5** (merge adjacent ones if you hit 6+; e.g. fold Data into Infra).

Group survivors into these buckets (omit empty ones):
- **AI/ML** (models, inference, agents, training, prompts)
- **Devtools** (CLIs, build systems, dev servers, debuggers, IDEs)
- **Infra** (databases, networking, observability, orchestration)
- **Web/Apps** (frameworks, UI libs, user-facing apps)
- **Data** (pipelines, analytics, notebooks, viz)
- **Other** — if a repo fits none of the above, put it under Other with a **one-line reason** why none of the named buckets fit. Keep Other tight; if Other ≥ 3, reconsider whether your buckets fit.

Aim for 5-8 total picks. If fewer than 3 survive, send a short note (see step 8) rather than padding.

### 7. Lead with a top pick

Pick the single most interesting survivor (highest-signal regardless of category) as *"Top pick"*. One sentence on why it's the top pick — not the "why notable" line, a higher-level framing.

### 8. Notify

Send via `./notify` (≤ 4000 chars, no leading spaces on any line):

```
*GitHub Trending — ${today}*

*Top pick* — [owner/repo](url)
One-sentence framing of why this is the standout today.

*AI/ML*
• [owner/repo](url) — ★ Xt today (Yk total) · LANG · [TAG]
why notable (one line)

• [owner/repo](url) — ...

*Devtools*
• ...

---
sources: trending=ok|fail · gh_api=ok|fail · kept N/M
```

Replace `Xt` with stars today, `Yk` with total stars in thousands, `[TAG]` with DEBUT/ACCELERATING/RETURNING/HOLDOVER.

### 9. Log and exit

Append to `memory/logs/${today}.md` under a `### github-trending` heading:
- picked repos (owner/repo + tag)
- dropped-for-noise count
- source status
- any judgment-call keeps (noted in step 3)

**Exit codes:**
- `GITHUB_TRENDING_OK` — fetched successfully, 0 or more picks sent
- `GITHUB_TRENDING_ERROR` — trending page fetch failed AND `gh api` fallback also empty

If the trending fetch fails, try one fallback before erroring: `gh api "search/repositories?q=created:>$(date -d '7 days ago' +%Y-%m-%d)+stars:>100&sort=stars&order=desc&per_page=25"` then run steps 3-8 on those results (skip the "stars today" field — use velocity instead).

If both fail, log `GITHUB_TRENDING_ERROR` with the failure reason and send a brief notify: *"GitHub Trending — sources unavailable today."*

If fetch succeeds but every repo fails filters (rare but possible on slow days), send a short note: *"GitHub Trending — quiet day, nothing above the noise floor."* and exit OK.

## Sandbox note

The sandbox blocks outbound curl. Use **WebFetch** for the trending page and `gh api` for repo metadata (it handles auth internally and bypasses the sandbox). No pre-fetch script needed.

## Constraints

- Quality over quantity: 4 curated picks > 10 padded ones.
- Never feature a repo you featured in the last 2 days unless it has a genuinely new reason (major release, security incident, viral moment) — note the reason in "why notable".
- Don't invent stats. If you don't have a number, omit it rather than guess.
- Stay under 4000 chars in the notification. If tight, drop the lowest-signal category first.
