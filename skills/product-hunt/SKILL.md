---
name: Product Hunt
category: social
description: Draft paste-ready launch copy from live repo state for any channel — a full Product Hunt asset pack (tagline, description, first + maker comment, six feature bullets), a Show HN post, or Reddit launch variants (r/MachineLearning + r/selfhosted). The agent writes now under zero pressure; the operator reviews, pastes, ships.
var: ""
tags: [dev]
---

> **${var}** — Optional channel selector, grammar `channel[:section]`:
> - **empty** or `producthunt` → the **Product Hunt** channel: generate the full asset pack (tagline + description + first comment + maker comment + 6 feature bullets) into `articles/product-hunt-${today}.md`.
> - `producthunt:<section>` where `<section>` ∈ {`tagline`, `description`, `first-comment`, `maker-comment`, `bullets`} → regenerate that single PH section only and overwrite the matching block in today's PH file. Invalid `<section>` → log `PRODUCT_HUNT_LAUNCH_BAD_VAR: ${var}` and exit without notifying.
> - `showhn` → the **Show HN** channel: write the Show HN post (title + 4-paragraph body) into `articles/show-hn-${today}.md`.
> - `reddit` → the **Reddit** channel: write both Reddit launch variants (`r/MachineLearning` + `r/selfhosted`) into `articles/show-hn-${today}.md`.
> - `reddit:r/MachineLearning` or `reddit:r/selfhosted` → regenerate that single Reddit variant only. Any other `reddit:` suffix → log `SHOW_HN_DRAFT_BAD_VAR: ${var}` and exit without notifying.
> - Any other value (unrecognized channel) → log `LAUNCH_DRAFT_BAD_VAR: ${var}` and exit without notifying.
>
> Example values: `` (empty → PH pack) · `producthunt:tagline` (regen one PH section) · `showhn` (Show HN post) · `reddit:r/selfhosted` (regen one Reddit variant).

Today is ${today}. This skill turns full live repo state into **paste-ready launch copy** an operator can submit **as-is** at the moment a launch push is right — no last-minute typing, no worst-version-shipped. Launch surfaces are one-shot distribution events with tight, character-limited formats, and a half-written first comment at 12:01 AM PT (or a 4-paragraph Show HN written in 10 minutes) is the difference between a front-page run and a dead post. **The agent writes the text now, under zero pressure, with full repo context. The operator reviews, edits, pastes, ships.**

## Why this skill exists

Each launch channel is a single-shot moment with a strict asset format, and the parts that decide front-page-vs-dead — the title, the first 200 words, the first comment — are exactly the parts that suffer when written last-minute. This skill inverts that: it turns the entire project state into ready launch copy on demand, so the launch text is done before the launch window opens. The three channels target different audiences with different framings — never cross-post one verbatim to another; that reads as low-effort.

- **Product Hunt** (`channel` empty / `producthunt`) — targets PH's "is this useful to me right now" decision-makers. PH accepts launches in a small set of strict, character-limited fields:
  - **Tagline** — a 60-char headline shown next to the logo on the front page; every word fights for the click.
  - **Description** — the 260-char card body; what gets you to "Learn more."
  - **First comment** — the "why we built this" maker thread, posted by the maker within 5 minutes of launch (too late and the algorithm has already de-prioritized you); what converts skim to "I'll try this."
  - **Maker comment** — the technical-differentiation reply that wins the dev-leaning audience.
  - **6 feature bullets** — the "what does it do" gallery body shown on click-through.
  All five must be ready before the window opens. Writing them at 7:55 AM the day-of, against five other priorities, produces the worst version.
- **Show HN** (`channel` = `showhn`) — targets HN's technical skim audience. A front-page run for a project at this scale (~500 stars, ~165 forks, ~195 skills across 8 categories, an external skill-packs ecosystem, and an onchain security layer) historically adds 50–200 stars in 48h — but front-page-vs-dead is largely the title and the first 200 words. Note: the 500-star milestone is the auto-dispatch trigger wired by `star-milestone`, which fires this skill with `channel=showhn` — so a fresh Show HN draft must be sitting in `articles/` when that fires.
- **Reddit** (`channel` = `reddit`) — cross-posting verbatim from HN to r/MachineLearning or r/selfhosted reads as low-effort. Each subreddit has a different framing that lands (ML-technical vs operational/self-hosting); this channel writes both.

## Shared preamble (run on every invocation, before dispatch)

### A. Read memory

Read `memory/MEMORY.md` for high-level context and scan the last ~3 days of `memory/logs/` for recent activity — including any prior launch-draft run today (so a rerun overwrites rather than duplicates, per Edge cases). Don't re-report a signal already logged.

### B. Resolve the channel and section from `${var}`

Parse `${var}` into `channel[:section]`:

- empty → `channel = producthunt`, `section = all`.
- `producthunt` → `channel = producthunt`, `section = all`.
- `producthunt:<s>` → `channel = producthunt`, `section = <s>`; `<s>` must be one of `tagline`, `description`, `first-comment`, `maker-comment`, `bullets`, else log `PRODUCT_HUNT_LAUNCH_BAD_VAR: ${var}` and exit without notifying.
- `showhn` → `channel = showhn`, `section = show-hn`.
- `reddit` → `channel = reddit`, `section = all` (both Reddit variants).
- `reddit:<s>` → `channel = reddit`, `section = <s>`; `<s>` must be `r/MachineLearning` or `r/selfhosted`, else log `SHOW_HN_DRAFT_BAD_VAR: ${var}` and exit without notifying.
- anything else → log `LAUNCH_DRAFT_BAD_VAR: ${var}` and exit without notifying.

When regenerating a single section/variant, read the existing target file (`articles/product-hunt-${today}.md` for PH, `articles/show-hn-${today}.md` for showhn/reddit) if present, replace ONLY the matching `##` block, and rewrite the file. If no file exists, generate just the requested section/variant — do NOT fabricate the others.

### C. Pull the source-of-truth inputs

Read in this order; any missing input is non-fatal — log the channel's missing-input code and proceed without it. The missing-input code is `PRODUCT_HUNT_LAUNCH_MISSING_INPUT: <name>` on the Product Hunt channel and `SHOW_HN_DRAFT_MISSING_INPUT: <name>` on the Show HN / Reddit channels.

| Input | Purpose |
|-------|---------|
| `README.md` | Headline framing, capability list, comparison table (Aeon vs Claude Code / Hermes / OpenClaw) |
| `SHOWCASE.md` | Active-fork count + concrete production-use examples + ecosystem comparison row |
| `skills.json` | Total skill count by category — the "what's in the box" inventory and the headline number |
| `aeon.yml` | Default-enabled vs `workflow_dispatch` mix (typically just `heartbeat`) — informs "configure once, walk away" claims |
| `articles/repo-article-*.md` (last 7 days) | Most concrete recent-ship moments to seed the lead / first-comment narrative |
| `articles/project-lens-*.md` (last 7 days) | Outside-the-repo framing — the angle that lands with someone (PH visitor / senior engineer) seeing Aeon for the first time |
| `memory/logs/*.md` (last 7 days) | Autonomous-behavior moments — specific PR numbers, what self-improve shipped, which PR was triaged in minutes |
| `memory/MEMORY.md` Skills Built table (last 14 days) | Concrete "the agent built X in Y days" examples |

For live repo stats, run:

```bash
gh api repos/aaronjmars/aeon --jq '{stars:.stargazers_count, forks:.forks_count, open_issues:.open_issues_count, default_branch:.default_branch}'
```

If `gh api` fails, fall through to the latest `articles/repo-pulse-*.md` for the most recent count and footnote the draft with `_<stars> stars at last repo-pulse run_`. Do NOT fabricate live numbers.

Then dispatch to the channel branch resolved in step B.

---

## Channel: Product Hunt (`${var}` empty or `producthunt[:section]`)

Target file: `articles/product-hunt-${today}.md`. If `section = all`, write all five sections plus the operator checklist. If `section` is a single slug, regenerate only that block (round-trip read → replace block → write).

### PH.1 — Pick the lead capability

Score each candidate "lead capability" on three signals — concreteness, recency, surprise — and pick the highest-scoring one as the spine of the tagline and first comment. Concreteness wins ties.

| Candidate | Concreteness | Recency | Surprise |
|-----------|-------------:|--------:|---------:|
| A specific autonomous behavior with a PR# (e.g. "merges its own PRs after CI passes") | high | check log dates | high |
| Skills-built count over a window (e.g. "shipped N skills in M days, all written by the agent") | medium | check Skills Built dates | medium |
| Self-healing event (skill-repair caught a failing skill, opened a fix PR) | high if PR# present | check log dates | high |
| GitHub Actions zero-infra story | medium | always recent | medium |
| File-based memory in git you can grep | medium | always recent | medium |

Do **not** lead with stars, token price, or "AI-powered." PH's audience scores those near zero. Lead with a concrete capability a builder would recognize as non-trivial.

### PH.2 — Write the tagline (≤60 chars)

Write to the `## Tagline` section.

**Hard constraint:** ≤60 characters. PH truncates at 60 in the front-page card — anything beyond gets cut.

**Shape:** one clause, plain English, names the non-obvious capability from PH.1. Examples to match in shape (do **not** copy verbatim):

- `An AI agent that ships its own PRs while you sleep`
- `Autonomous GitHub Actions agent — 90+ skills, no babysitting`
- `Your repo, but it merges its own pull requests`

**Banned words:** "AI-powered," "revolutionary," "next-gen," "game-changing," "leverages," "powerful," "framework" (saturated on PH). If a draft contains any of these, rewrite the draft.

Output the chosen tagline AND its character count on a footer line — the operator needs to see the count to verify the 60-char ceiling at a glance.

### PH.3 — Write the description (≤260 chars)

Write to the `## Description` section.

**Hard constraint:** ≤260 characters. PH truncates after 260 in the card body.

**Shape:** 2–3 sentences, plain English. Cover: what it is (one tight definition), what makes it different (one concrete capability), and what makes it credible (one number or proof point traceable to a file you read in step C).

Example shape (do **not** copy verbatim):

> Aeon is an autonomous agent that runs on GitHub Actions. It ships features, writes articles, and merges its own PRs from a file-based memory in your repo. 313 stars, 121 skills, zero infrastructure to babysit.

Output the chosen description AND its character count on a footer line.

### PH.4 — Write the first comment (≤500 chars)

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

### PH.5 — Write the maker comment (≤500 chars)

Write to the `## Maker Comment` section. This is the technical-depth reply pre-written for the inevitable "how does this differ from <X>" early comment thread.

**Voice:** technical, plain. Aimed at developers who scroll comments before clicking through.

**Required elements:**
- One concrete differentiation vs a named competitor or pattern (LangGraph / CrewAI / "auto-GPT" / "n8n with AI nodes" — pick what fits)
- One implementation detail that signals real engineering (Haiku-scored output per run, file-based memory in git, `autoresearch`-evolved prompts, MCP gateway, etc.)
- One honest tradeoff (rate limits, context-window pressure, why most skills ship `enabled: false`)

Example shape:

> Most agent frameworks are SDK wrappers — you instantiate, you orchestrate, you babysit. Aeon flips that: the runtime is GitHub Actions, the memory is markdown files in your repo, and a `skill-evals` skill grades production runs against assertions on a rolling window. The honest tradeoff: cron-driven means latency is minutes, not seconds. For interactive coding you still want Claude Code or Cursor — Aeon is for the recurring background work you've been doing yourself.

Output the maker comment AND its character count on a footer line.

### PH.6 — Write the six-bullet feature list

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

### PH.7 — Append the operator checklist

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

When regenerating a single PH section, leave an existing `## Operator Checklist` block untouched.

### PH.8 — Notify (Product Hunt)

Send via `./notify` with the tagline + first 200 chars of the description + the file path:

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

If only one section was regenerated (because `${var}` was `producthunt:<section>`), say `Section regenerated: ${section}` instead, and quote the regenerated section's first 200 chars.

---

## Channel: Show HN (`${var}` = `showhn`)

Preserves the Show HN post structure, title rules, and HN-specific guidance. Target file: `articles/show-hn-${today}.md`, `## Show HN` section. This file is shared with the Reddit channel — when writing it, ensure the `## Launch checklist` section (below) is present exactly once at the end (append if absent; leave it if already there), and do not disturb existing `## r/MachineLearning` / `## r/selfhosted` blocks.

### SH.1 — Pick the lead

Score each candidate "lead beat" on three signals — concreteness, recency, surprise — and pick the highest-scoring one as the cold-open of the Show HN body. Concreteness wins ties.

| Candidate | Concreteness | Recency | Surprise |
|-----------|-------------:|--------:|---------:|
| Specific autonomous behavior with a PR# (e.g. "the agent triaged its first external PR within 4 hours") | high | check log dates | medium |
| Skills-built count over a window (e.g. "shipped 14 skills in the last 14 days, all by the agent itself") | medium | check Skills Built dates | medium |
| A self-healing event (skill-repair caught a failing skill, opened a fix PR) | high if PR# present | check log dates | high |
| Token / market metric | low for HN audience | — | low |
| Star count alone | low | — | low |

Do **not** lead with stars or token price. HN's technical audience scores those near zero. Lead with a concrete autonomous-behavior moment that a senior engineer would recognize as non-trivial.

### SH.2 — Write the Show HN variant

Write to the `## Show HN` section of `articles/show-hn-${today}.md`.

**Title** — single line, ≤80 chars, follows HN convention `Show HN: <project>` + a one-clause hook. Examples to match in shape (do **not** copy verbatim):
- `Show HN: Aeon — an autonomous agent that runs on GitHub Actions and patches itself`
- `Show HN: I built an agent that ships its own PRs while I sleep — 195 skills, no babysitting`

Pick a title that names exactly **one** non-obvious capability. Avoid: "framework," "platform," "AI-powered," vague superlatives. The title must pass a sceptical-engineer test — would they click it?

**Body** — exactly 4 paragraphs, no markdown headers inside the body, plain prose:

1. **Cold open** — the lead beat from SH.1 in 2–3 sentences. Concrete, dated, with a PR or commit if available. No "I'm excited to share."
2. **What it actually does** — 4–6 sentences naming the capabilities a senior engineer would care about: schedule-driven runs on Actions, file-based memory in git, quality scoring per run, self-healing via skill-repair, MCP server. Reference the README comparison table — Aeon vs Claude Code / Hermes / OpenClaw — without re-pasting it. If there's room, name one capability the senior engineer would not have guessed: the onchain security layer (`vigil` + `wallet-risk` + `vigil-revoke` — detection through revoke, Bankr-gated), or the install ecosystem (three paths: clone, `install-skill-pack`, `install-from-atrium` — the last one onchain via the Atrium marketplace), or the external-contributor inflow (skill packs landed from Nurstar / vigilcodes / HoundFlow / signa / Careful Finance / Mneme in the last 30 days). Pick ONE; do not list all three.
3. **Honest scope** — 3–4 sentences. What it's good at (recurring background work). What it's NOT (interactive coding — keep using Claude Code for that). The "configure once, walk away" framing belongs here. Naming the boundary is what makes the rest credible.
4. **Pointer + ask** — repo URL `https://github.com/aaronjmars/aeon`, the install one-liner (`git clone https://github.com/aaronjmars/aeon && cd aeon && ./aeon`), and a specific question for HN comments — e.g. *"What's the worst recurring-task class you've automated and abandoned because the agent kept needing you?"* Specific questions get specific replies; "feedback welcome" gets nothing.

**Hard rules:**
- No emoji in the title or body. None.
- No `🧵`, no `[1/3]`, no marketing words ("revolutionary", "game-changing", "powerful", "leverages").
- One link maximum, in paragraph 4.
- Every concrete number (stars, forks, skills shipped, PR count) must be traceable to a file you read in step C. If the number isn't in a file, drop it — don't guess.
- Keep total body under 350 words. HN's first-screen attention is short.

### SH.3 — Launch checklist

Append a `## Launch checklist` section to `articles/show-hn-${today}.md` (once; see the file-sharing note above). Plain checklist for the operator — not for the agent. Do **not** post this to HN/Reddit; it lives in the draft file only.

```
## Launch checklist
- [ ] Star count check (rerun this skill if stars cross the next round number — 500, 750, 1000 — so titles update with the new milestone)
- [ ] No active known-broken skills (./scripts/skill-runs --hours 24 --failures shows clean)
- [ ] No pinned issues that contradict the post (open issues at `gh issue list -R aaronjmars/aeon --state open`)
- [ ] Final read-through for tone (anything that sounds like marketing → cut)
- [ ] Pick the slot: Tuesday–Thursday, 8–10 AM US Eastern is the empirical sweet spot for HN
- [ ] Have one concrete answer ready for "how does this differ from <X>" — pull from SHOWCASE.md comparison table
- [ ] Be in the comments for the first hour — non-responses to early questions kill the post
```

### SH.4 — Notify (Show HN)

Send via `./notify` with the Show HN title + Show HN paragraph 1 + the file path:

```
*Show HN draft — ${today}*

Title: ${show_hn_title}

${show_hn_paragraph_1}

—
Variants in file: ${variants_written} (show-hn, r/MachineLearning, r/selfhosted)
File: articles/show-hn-${today}.md
Stars: ${current_stars} | Forks: ${current_forks} | Skills: ${total_skills}

Operator: read the launch checklist at the bottom of the file before posting.
```

`${variants_written}` lists whichever `##` blocks currently exist in the file after this run (so it reflects reality when Show HN and Reddit were drafted in separate passes).

---

## Channel: Reddit (`${var}` = `reddit` or `reddit:<variant>`)

Target file: `articles/show-hn-${today}.md` (shared with the Show HN channel). `reddit` (section `all`) writes BOTH variants below; `reddit:r/MachineLearning` or `reddit:r/selfhosted` regenerates only that block (round-trip read → replace section → write). Ensure the `## Launch checklist` section (SH.3, identical) is present exactly once at the end; append if absent, leave if present. Do not disturb an existing `## Show HN` block.

Pick the lead beat with the same SH.1 scoring table (concreteness / recency / surprise; concreteness wins ties) — the cold-open framing seeds both Reddit variants.

### RD.1 — Write the r/MachineLearning variant

Write to the `## r/MachineLearning` section.

**Title** — ≤300 chars, follows r/MachineLearning convention `[Project] <Name>: <one-sentence description>`. Lead with the technical interest hook for ML-leaning readers — not "agent framework" (saturated) but the thing that's actually unusual: per-run quality scoring, self-healing prompts, file-based memory in version control, the autoresearch evolution loop.

**Body** — 6–10 sentences, plain prose, **no marketing tone**:

- Sentence 1–2: what Aeon is in one tight definition.
- Sentence 3–5: the part ML readers will engage with — Haiku-scored output per run with rolling 30-run history, `skill-evals` assertion-based regression tests, `autoresearch` evolving prompts based on production runs, model selection per skill (Sonnet vs Opus vs Haiku tradeoffs surfaced in `aeon.yml`).
- Sentence 6–8: limitations and tradeoffs — context-window pressure on long-running skills, rate limits, why not all skills are enabled by default.
- Sentence 9–10: link + an ML-shaped question (e.g. *"Curious whether anyone's using Haiku for self-grading runs of Sonnet/Opus output and how you handle scorer-vs-generator drift"*).

**Hard rules:** same as Show HN (no emoji, no marketing words, one link max in the closing sentences, every number traceable to a file). Plus: do not call it a "framework" — call it an autonomous agent running on GitHub Actions.

### RD.2 — Write the r/selfhosted variant

Write to the `## r/selfhosted` section.

**Title** — `<Name>: <what it self-hosts>` — lead with the operational angle: zero infra, runs on Actions minutes, file-based state in git you can grep.

**Body** — 4–6 sentences:

- The selfhosted angle: why this is operator-appealing — no Docker, no DB, no service to babysit, all state in a git repo, free on public repos via GitHub Actions minutes.
- One sentence on cost: token usage (`memory/token-usage.csv`), the optional Bankr LLM gateway for cheaper Opus.
- The notification stack: opt-in Telegram / Discord / Slack, no required external service.
- The boundaries: it needs a Claude API key or OAuth token; that's the only paid surface.
- Repo URL + ask (e.g. *"Anyone running scheduled agents like this on something other than Actions? Curious what the operator UX looks like"*).

**Hard rules:** same as Show HN. Plus: name the actual cost surface honestly — don't imply free total cost when the API key isn't free.

### RD.3 — Launch checklist

Same as SH.3 — ensure `## Launch checklist` is present exactly once at the end of `articles/show-hn-${today}.md`.

### RD.4 — Notify (Reddit)

Send via `./notify` with the leading Reddit variant's title + first paragraph + the file path:

```
*Reddit launch draft — ${today}*

Title: ${reddit_title}

${reddit_paragraph_1}

—
Variants in file: ${variants_written} (show-hn, r/MachineLearning, r/selfhosted)
File: articles/show-hn-${today}.md
Stars: ${current_stars} | Forks: ${current_forks} | Skills: ${total_skills}

Operator: read the launch checklist at the bottom of the file before posting.
```

`${reddit_title}` / `${reddit_paragraph_1}` come from the variant that ran: for `reddit` (both), quote `r/MachineLearning`; for `reddit:<variant>`, quote that variant. `${variants_written}` lists whichever `##` blocks currently exist in the file after this run.

---

## Log (all channels)

Append to `memory/logs/${today}.md` under a single `### product-hunt` heading (the health loop parses this shape), with a `Channel` discriminator naming the branch that ran:

```
### product-hunt
- **Channel**: ${channel}    (producthunt | showhn | reddit)
- **Sections/variants written**: ${list}
- **Lead picked**: ${one-line summary of the lead capability/beat}
- **Stars at draft time**: ${current_stars}
- **File**: ${target_file}    (articles/product-hunt-${today}.md | articles/show-hn-${today}.md)
- **Notification**: sent
- **Status**: ${status_code}
```

Channel-specific extras and status codes:

- **Product Hunt** — also log the character counts: `Tagline ${tagline_chars}/60`, `Description ${desc_chars}/260`, `First comment ${first_comment_chars}/500`, `Maker comment ${maker_comment_chars}/500`. Status ∈ `PRODUCT_HUNT_LAUNCH_OK | PRODUCT_HUNT_LAUNCH_PARTIAL | PRODUCT_HUNT_LAUNCH_BAD_VAR`. `PRODUCT_HUNT_LAUNCH_PARTIAL` means at least one source input was missing (logged in step C) or one section exceeded its character limit after best-effort tightening — the operator must verify the affected section before submitting.
- **Show HN / Reddit** — Status ∈ `SHOW_HN_DRAFT_OK | SHOW_HN_DRAFT_PARTIAL | SHOW_HN_DRAFT_BAD_VAR`. `SHOW_HN_DRAFT_PARTIAL` means at least one source input was missing (logged in step C) but the draft still wrote — the operator should sanity-check the affected section.
- **Dispatch bad var** — if `${var}` named an unrecognized channel, the run exits in step B after logging `LAUNCH_DRAFT_BAD_VAR: ${var}` (no notification, no draft file).

## Constraints (all channels)

- **Never invent numbers.** Every star count, fork count, skill count, PR number, or date must come from a file you read in step C (or `gh api`). If a number isn't sourced, drop the sentence.
- **Enforce the character ceilings.** On Product Hunt, 60 / 260 / 500 / 500 / 80 are PH's actual field limits — over-limit drafts force a 7:55 AM rewrite. On Show HN, title ≤80 and body <350 words; on Reddit, r/MachineLearning title ≤300. Count characters and shrink before writing.
- **Never write marketing.** These audiences have antibodies for it; the algorithms reward specificity. Strip every "powerful," "revolutionary," "leverages," "seamless," "next-gen," "game-changing," "best-in-class." Read your output; if a sentence sounds like a press release, rewrite it as plain English.
- **Never quote the soul files.** The voice should be Aeon's everyday voice — concrete, plain, no hype. The soul guide informs tone; it does not become content.
- **Don't promise unshipped features.** Only describe behaviors with a corresponding file in the repo or a logged event in the last 14 days. If something is "planned but not built," omit it.
- **Don't post.** This skill writes drafts. Submitting to Product Hunt / posting to HN or Reddit is the operator's call, gated by the checklist.

## Sandbox note

All inputs are local file reads or `gh api` (`gh` handles auth via the workflow's `GITHUB_TOKEN` — no env-var-in-headers curl). No external WebFetch needed; PH / HN / Reddit aren't queried because the draft writes outbound content, it doesn't read inbound. Notifications use `./notify` and fan out to every configured channel.

## Edge cases

### Product Hunt channel
- **Already-drafted-today rerun, `${var}` empty/`producthunt`** — overwrite the existing `articles/product-hunt-${today}.md`. Log a `_Regenerated: previous draft superseded_` line at the top of the new file. The previous draft is in git history if needed.
- **Already-drafted-today rerun, `${var}` set to one section** — patch only that section; preserve the others byte-for-byte (round-trip read → replace block → write). Recompute and emit the new section's character count in PH.8's notification.
- **Stars fetch failed AND no recent repo-pulse article** — set the headline number placeholder to `${current_stars}` literally and emit `PRODUCT_HUNT_LAUNCH_PARTIAL`. The operator must fill it before submitting; the checklist already covers this read-through.
- **Section exceeds its character ceiling after best-effort tightening** — keep the section in the file but mark it with a `> ⚠ over limit: ${count}/${ceiling}` blockquote above the offending block, and emit `PRODUCT_HUNT_LAUNCH_PARTIAL`. The operator can re-run with `${var}` = `producthunt:<section>` for a regeneration pass.
- **Empty `memory/logs/` (first-run fork)** — the lead capability falls through to README + skills.json material only. Tag the draft with a `_Note: this fork has no log history yet — the first comment is generic until the agent has run for ~7 days_` line at the top.

### Show HN / Reddit channels
- **Already-drafted-today rerun, single-channel** — the Show HN channel overwrites the `## Show HN` block; the Reddit channel overwrites the Reddit block(s). When overwriting the whole of its own block set, log a `_Regenerated: previous draft superseded_` line at the top of the file. The previous draft is in git history if needed.
- **Regenerating one variant** — patch only that section; preserve the others byte-for-byte (round-trip read → replace section → write).
- **Regenerating the full show-hn trio** — there is no single `${var}` for all three; run `showhn` (writes the Show HN post) and `reddit` (writes both Reddit variants) into the shared `articles/show-hn-${today}.md`. Each pass preserves the other's blocks and keeps `## Launch checklist` present exactly once.
- **Stars fetch failed AND no recent repo-pulse article** — set the headline number placeholder to `${current_stars}` literally and emit `SHOW_HN_DRAFT_PARTIAL`. The operator must fill it before posting; the launch checklist already covers this read-through.
- **Empty `memory/logs/` (first-run fork)** — the lead beat falls through to README + skills.json material. Tag the draft with a `_Note: this fork has no log history yet — the lead beat is generic until the agent has run for ~7 days_` line at the top.
- **Star count crossed the next round number since the last draft** (500, 750, 1000, …) — the Show HN title's hook line should reference the round number explicitly; the launch checklist's first item flags this as a re-run trigger. Don't auto-celebrate inside the body — that's `star-milestone`'s job, and `star-milestone` is what auto-dispatches this skill (with `channel=showhn`) at 500⭐.

## Summary of channels

| `${var}` | Channel | Output file | What it writes |
|----------|---------|-------------|----------------|
| `` / `producthunt` | Product Hunt | `articles/product-hunt-${today}.md` | tagline + description + first comment + maker comment + 6 bullets + operator checklist |
| `producthunt:<section>` | Product Hunt | same | one PH section regenerated |
| `showhn` | Show HN | `articles/show-hn-${today}.md` | Show HN title + 4-paragraph body (+ launch checklist) |
| `reddit` | Reddit | `articles/show-hn-${today}.md` | r/MachineLearning + r/selfhosted (+ launch checklist) |
| `reddit:r/MachineLearning` / `reddit:r/selfhosted` | Reddit | same | one Reddit variant regenerated |
