---
name: Product Hunt
description: Draft the full Product Hunt launch asset package (tagline, description, first comment, maker comment, six-bullet feature list) from live repo state — operator reviews and submits.
var: ""
tags: [dev]
---

> **${var}** — Optional. If empty: generate the full asset pack (tagline + description + first comment + maker comment + 6 feature bullets). If set to one of `tagline`, `description`, `first-comment`, `maker-comment`, `bullets`: regenerate that single section only and overwrite the matching block in today's launch file. Any other value: log `PRODUCT_HUNT_LAUNCH_BAD_VAR: ${var}` and exit without notifying.

Today is ${today}. Write a Product Hunt launch asset pack — five paste-ready sections — that an operator can submit **as-is** on launch day. Product Hunt accepts launches in a small set of strict character-limited fields, and a half-written first comment at 12:01 AM PT is the difference between a #1 product of the day and a hidden launch. **The agent writes the text now, under zero pressure, with full repo context. The operator reviews, pastes, ships.**

## Why this skill exists

Product Hunt is a single-shot distribution event with a tight asset format:

- **Tagline** is a 60-char headline shown next to the logo on the front page — every word fights for click.
- **Description** is the 260-char card body — what gets you to "Learn more."
- **First comment** is the "why we built this" maker thread — what converts skim to "I'll try this." Posted by the maker within 5 minutes of launch — too late and the algorithm has already de-prioritized you.
- **Maker comment** is the technical-differentiation reply that wins the dev-leaning audience.
- **6 feature bullets** are the body content shown when someone clicks through — the "what does it do" gallery.

All five of these have to be ready before the launch window opens. Writing them at 7:55 AM the day-of, against five other priorities, produces the worst version. This skill turns full repo state into those five fields on demand, under no pressure, with full context. The complement to `show-hn` (which targets HN's technical skim audience): this targets PH's "is this useful to me right now" decision-makers.

## Steps

### 1. Resolve the variant set

- `${var}` empty → generate all five sections: `tagline`, `description`, `first-comment`, `maker-comment`, `bullets`.
- `${var}` ∈ `{tagline, description, first-comment, maker-comment, bullets}` → regenerate that section only.
- Any other value → log `PRODUCT_HUNT_LAUNCH_BAD_VAR: ${var}` and exit without notifying.

When regenerating a single section, read the existing `articles/product-hunt-${today}.md` if present, replace only the matching `##` block, and rewrite the file. If no file exists, generate just the requested section — do NOT fabricate the others.

### 2. Pull the source-of-truth inputs

Read in this order; any missing input is non-fatal — log `PRODUCT_HUNT_LAUNCH_MISSING_INPUT: <name>` and proceed without it:

| Input | Purpose |
|-------|---------|
| `README.md` | Headline framing, capability list, comparison table |
| `SHOWCASE.md` | Active-fork count + concrete production-use examples |
| `skills.json` | Total skill count by category — the "what's in the box" inventory |
| `aeon.yml` | Default-enabled vs `workflow_dispatch` mix — informs "configure once, walk away" claims |
| `articles/repo-article-*.md` (last 7 days) | Most concrete recent-ship moments to seed the first-comment narrative |
| `articles/project-lens-*.md` (last 7 days) | Outside-the-repo framing — the angle that lands with someone seeing Aeon for the first time |
| `memory/logs/*.md` (last 7 days) | Autonomous-behavior moments — specific PR numbers, what self-improve shipped |
| `memory/MEMORY.md` Skills Built table (last 14 days) | Concrete "the agent built X in Y days" examples |

For live repo stats:

```bash
gh api repos/aaronjmars/aeon --jq '{stars:.stargazers_count, forks:.forks_count, open_issues:.open_issues_count}'
```

If `gh api` fails, fall through to the latest `articles/repo-pulse-*.md` for the most recent count and footnote the draft with `_<stars> stars at last repo-pulse run_`. Do NOT fabricate live numbers.

### 3. Pick the lead capability

Score each candidate "lead capability" on three signals — concreteness, recency, surprise — and pick the highest-scoring one as the spine of the tagline and first comment. Concreteness wins ties.

| Candidate | Concreteness | Recency | Surprise |
|-----------|-------------:|--------:|---------:|
| A specific autonomous behavior with a PR# (e.g. "merges its own PRs after CI passes") | high | check log dates | high |
| Skills-built count over a window (e.g. "shipped N skills in M days, all written by the agent") | medium | check Skills Built dates | medium |
| Self-healing event (skill-repair caught a failing skill, opened a fix PR) | high if PR# present | check log dates | high |
| GitHub Actions zero-infra story | medium | always recent | medium |
| File-based memory in git you can grep | medium | always recent | medium |

Do **not** lead with stars, token price, or "AI-powered." PH's audience scores those near zero. Lead with a concrete capability a builder would recognize as non-trivial.

### 4. Write the tagline (≤60 chars)

Write to the `## Tagline` section of `articles/product-hunt-${today}.md`.

**Hard constraint:** ≤60 characters. PH truncates at 60 in the front-page card — anything beyond gets cut.

**Shape:** one clause, plain English, names the non-obvious capability from step 3. Examples to match in shape (do **not** copy verbatim):

- `An AI agent that ships its own PRs while you sleep`
- `Autonomous GitHub Actions agent — 90+ skills, no babysitting`
- `Your repo, but it merges its own pull requests`

**Banned words:** "AI-powered," "revolutionary," "next-gen," "game-changing," "leverages," "powerful," "framework" (saturated on PH). If a draft contains any of these, rewrite the draft.

Output the chosen tagline AND its character count on a footer line — the operator needs to see the count to verify the 60-char ceiling at a glance.

### 5. Write the description (≤260 chars)

Write to the `## Description` section.

**Hard constraint:** ≤260 characters. PH truncates after 260 in the card body.

**Shape:** 2–3 sentences, plain English. Cover: what it is (one tight definition), what makes it different (one concrete capability), and what makes it credible (one number or proof point that's traceable to a file you read).

Example shape (do **not** copy verbatim):

> Aeon is an autonomous agent that runs on GitHub Actions. It ships features, writes articles, and merges its own PRs from a file-based memory in your repo. 313 stars, 121 skills, zero infrastructure to babysit.

Output the chosen description AND its character count on a footer line.

### 6. Write the first comment (≤500 chars)

Write to the `## First Comment` section.

**Hard constraint:** ≤500 characters. PH allows longer comments but the algorithm rewards short, dense first comments — the front-page card preview clips around 500 chars and longer comments dilute the hook.

**Voice:** maker, first-person. Open with the specific moment or problem that triggered building Aeon. Avoid: "We're excited to launch," "Today we're announcing." Lead with the concrete tension that made the project worth building.

**Required elements:**
- One specific origin sentence (what triggered it)
- One specific autonomous-behavior moment (with a PR or commit if available)
- One sentence on what's NOT in scope (the boundary that makes the rest credible)
- One specific ask — not "feedback welcome" but a real question PH's audience would answer

Example shape:

> I was tired of every "AI agent" demo crashing the moment the prompt wasn't pre-scripted. So I built one that lives in a git repo, runs on GitHub Actions, and grades its own output every 6 hours. Two weeks in, it's shipped its own auto-merge skill (PR #38) and reviewed three external PRs from forks. It's not a coding assistant — keep Claude Code for that. What recurring task have you given up automating because the agent kept needing you?

Output the chosen first comment AND its character count on a footer line.

### 7. Write the maker comment (≤500 chars)

Write to the `## Maker Comment` section. This is the technical-depth reply pre-written for the inevitable "how does this differ from <X>" early comment thread.

**Voice:** technical, plain. Aimed at developers who scroll comments before clicking through.

**Required elements:**
- One concrete differentiation vs a named competitor or pattern (LangGraph / CrewAI / "auto-GPT" / "n8n with AI nodes" — pick what fits)
- One implementation detail that signals real engineering (Haiku-scored output per run, file-based memory in git, `autoresearch`-evolved prompts, MCP gateway, etc.)
- One honest tradeoff (rate limits, context-window pressure, why most skills ship `enabled: false`)

Example shape:

> Most agent frameworks are SDK wrappers — you instantiate, you orchestrate, you babysit. Aeon flips that: the runtime is GitHub Actions, the memory is markdown files in your repo, and a `skill-evals` skill grades production runs against assertions on a rolling window. The honest tradeoff: cron-driven means latency is minutes, not seconds. For interactive coding you still want Claude Code or Cursor — Aeon is for the recurring background work you've been doing yourself.

Output the maker comment AND its character count on a footer line.

### 8. Write the six-bullet feature list

Write to the `## Feature Bullets` section. Six bullets, each ≤80 chars, formatted as a markdown list. These render as the gallery body when someone clicks through.

**Shape:** each bullet names one concrete capability + one proof point (number, PR#, or skill name).

**Required coverage** (one bullet per row in this order):
1. Schedule-driven runs (mention GitHub Actions + cron syntax)
2. File-based memory (markdown in git, no DB)
3. Self-healing / self-grading (skill-repair, skill-evals, or autoresearch)
4. Notification surface (Telegram / Discord / Slack opt-in)
5. Skill count + categorization (use the live `skills.json` total)
6. One uniquely Aeon thing the operator should see — e.g. auto-merge of agent-authored PRs (PR #38), fork-cohort tracking, `repo-actions` idea pipeline

**Anti-pattern:** vague "powerful," "intelligent," "seamless" bullets. If a bullet doesn't fit in 80 chars and stay concrete, cut a word — don't drop the proof.

### 9. Append the operator checklist

Append a `## Operator Checklist` section to `articles/product-hunt-${today}.md`. Plain checklist — not for the agent, do **not** post this to PH:

```
## Operator Checklist
- [ ] Schedule the launch slot — Tuesday/Wednesday/Thursday 12:01 AM PT is the empirical sweet spot
- [ ] Logo: PNG 240×240, transparent background, on brand
- [ ] Gallery images: 3–5 screenshots at 1270×760 minimum
- [ ] Demo video (optional but lifts ranking): <60s, no voiceover required, captions on
- [ ] Hunter outreach: line up someone with PH following to hunt — or self-hunt if account is >7 days old
- [ ] First comment posted within 5 minutes of launch — algorithm rewards early engagement
- [ ] Be in the comments for the first 4 hours — non-response in the early window kills momentum
- [ ] Cross-post: X thread, LinkedIn, /r/SideProject, IndieHackers — but PH first, others 2h later
- [ ] Watch for "how does this differ from <X>" thread — paste the prewritten Maker Comment above
```

### 10. Notify

Send via `./notify` with the tagline + first 200 chars of the description + the file path. Format:

```
*Product Hunt launch draft — ${today}*

Tagline (${tagline_chars}/60): ${tagline}

Description (${desc_chars}/260): ${description_first_200}…

—
Sections written: ${variants_written}
File: articles/product-hunt-${today}.md
Stars: ${current_stars} | Forks: ${current_forks} | Skills: ${total_skills}

Operator: review the full pack and the checklist at the bottom of the file before scheduling the launch.
```

If only one section was regenerated (because `${var}` was set), say `Section regenerated: ${var}` instead, and quote the regenerated section's first 200 chars.

### 11. Log

Append to `memory/logs/${today}.md`:

```
## Product Hunt Launch Draft
- **Skill**: product-hunt
- **Sections written**: ${list}
- **Lead capability picked**: ${one-line summary of the lead from step 3}
- **Stars at draft time**: ${current_stars}
- **Tagline char count**: ${tagline_chars}/60
- **Description char count**: ${desc_chars}/260
- **First comment char count**: ${first_comment_chars}/500
- **Maker comment char count**: ${maker_comment_chars}/500
- **File**: articles/product-hunt-${today}.md
- **Notification**: sent
- **Status**: PRODUCT_HUNT_LAUNCH_OK | PRODUCT_HUNT_LAUNCH_PARTIAL | PRODUCT_HUNT_LAUNCH_BAD_VAR
```

`PRODUCT_HUNT_LAUNCH_PARTIAL` means at least one source input was missing (logged in step 2) or one section exceeded its character limit after best-effort tightening — the operator must verify the affected section before submitting.

## Constraints

- **Never invent numbers.** Every star count, fork count, skill count, PR number, or date must come from a file you read in step 2 (or `gh api`). If a number isn't sourced, drop the sentence.
- **Enforce the character ceilings.** 60 / 260 / 500 / 500 / 80 are PH's actual field limits — over-limit drafts force a 7:55 AM rewrite. Count characters and shrink before writing.
- **Never write marketing.** PH's algorithm rewards specificity. Strip every "powerful," "revolutionary," "leverages," "seamless," "next-gen." Read your output; if a sentence sounds like a press release, rewrite it as plain English.
- **Never quote the soul files.** The voice should be Aeon's everyday voice — concrete, plain, no hype.
- **Don't promise unshipped features.** Only describe behaviors with a corresponding file in the repo or a logged event in the last 14 days. If something is "planned but not built," omit it.
- **Don't post.** This skill writes drafts. Submitting to Product Hunt is the operator's call, gated by the checklist.

## Sandbox note

All inputs are local file reads or `gh api` (`gh` handles auth via the workflow's `GITHUB_TOKEN` — no env-var-in-headers curl). No external WebFetch needed; PH isn't queried because the draft writes outbound content, it doesn't read inbound. Notifications use `./notify` and fan out to every configured channel.

## Edge cases

- **Already-drafted-today rerun, `${var}` empty** — overwrite the existing file. Log a `_Regenerated: previous draft superseded_` line at the top of the new file. The previous draft is in git history if needed.
- **Already-drafted-today rerun, `${var}` set to one section** — patch only that section; preserve the others byte-for-byte (round-trip read → replace block → write). Recompute and emit the new section's character count in step 10's notification.
- **Stars fetch failed AND no recent repo-pulse article** — set the headline number placeholder to `${current_stars}` literally and emit `PRODUCT_HUNT_LAUNCH_PARTIAL`. The operator must fill it before submitting; the checklist already covers this read-through.
- **Section exceeds its character ceiling after best-effort tightening** — keep the section in the file but mark it with a `> ⚠ over limit: ${count}/${ceiling}` blockquote above the offending block, and emit `PRODUCT_HUNT_LAUNCH_PARTIAL`. The operator can re-run with `${var}` set to that section's slug for a regeneration pass.
- **Empty `memory/logs/` (first-run fork)** — the lead capability falls through to README + skills.json material only. Tag the draft with a `_Note: this fork has no log history yet — the first comment is generic until the agent has run for ~7 days_` line at the top.
