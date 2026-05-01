---
name: show-hn-draft
description: Draft a Show HN post (plus shorter Reddit r/MachineLearning + r/selfhosted variants) from the live repo state — README, SHOWCASE, recent repo-articles + project-lens, real autonomous behavior examples from logs, and current stars/forks/skill counts. Operator pastes; agent writes.
var: ""
tags: [dev]
---

> **${var}** — Optional. If empty: write the default trio (Show HN + r/MachineLearning + r/selfhosted). If set to one of `show-hn`, `r/MachineLearning`, `r/selfhosted`: regenerate that single variant only and overwrite that section in today's draft. Any other value: log `SHOW_HN_DRAFT_BAD_VAR` and exit.

Today is ${today}. Write a Show HN post — plus two shorter platform variants — that an operator can paste **as-is** at the moment the project is ready for a launch push. The point is to remove every text-authoring obstacle so that when timing is right (currently: ~12 days from the 300-star milestone at ~4/day momentum), the operator is not typing a 4-paragraph post in 10 minutes and shipping the worst version of it. **The agent writes the text now, under zero pressure, with full context. The operator edits and pastes.**

## Why this skill exists

Show HN is a one-shot moment. A front-page run for a project at this scale (~250 stars, growing autonomous-agent narrative) historically adds 50–200 stars in 48h — but the difference between front page and dead post is largely the title and the first 200 words. Those are exactly the parts that suffer when written last-minute. This skill is the inverse of `repo-article` (which turns one event into one article every day): it turns the entire project state into one launch post on demand, so the launch text is ready before the launch.

The Reddit variants exist because cross-posting verbatim from HN to r/MachineLearning or r/selfhosted reads as low-effort. Each subreddit has a different framing that lands; this skill writes both.

## Steps

### 1. Resolve the variant set

- `${var}` empty → generate all three: `show-hn`, `r/MachineLearning`, `r/selfhosted`.
- `${var}` = `show-hn` → regenerate the Show HN block only.
- `${var}` = `r/MachineLearning` or `r/selfhosted` → regenerate that block only.
- Any other value → log `SHOW_HN_DRAFT_BAD_VAR: ${var}` and exit without notifying.

When regenerating a single variant, read the existing `articles/show-hn-draft-${today}.md` if present, replace only the matching section, and rewrite the file. If no file exists, generate just the requested variant — do NOT fabricate the others.

### 2. Pull the source-of-truth inputs

Read in this order; any missing input is non-fatal — log `SHOW_HN_DRAFT_MISSING_INPUT: <name>` and proceed without it:

| Input | Purpose |
|-------|---------|
| `README.md` | Headline framing, comparison table, capability list |
| `SHOWCASE.md` | Active-fork count + ecosystem comparison row |
| `skills.json` | Total skill count for the headline number; categories breakdown |
| `aeon.yml` | Default-enabled skills (typically just `heartbeat`) |
| `articles/repo-article-*.md` (last 7 days) | Most concrete recent ship narratives |
| `articles/project-lens-*.md` (last 7 days) | Outside-the-repo framing — the angle that lands with engineers who haven't seen Aeon before |
| `memory/logs/*.md` (last 7 days) | Autonomous-behavior moments — which skill caught what, what self-improve shipped, which PR was triaged in minutes |
| `memory/MEMORY.md` Skills Built table (last 14 days) | Concrete "the agent built X" examples |

For repo stats, run:
```bash
gh api repos/aaronjmars/aeon --jq '{stars:.stargazers_count, forks:.forks_count, open_issues:.open_issues_count, default_branch:.default_branch}'
```
If `gh api` fails, fall through to scraping the latest `articles/repo-pulse-*.md` for the most recent count and footnote the draft with `_<stars> stars at last repo-pulse run_`. Do NOT fabricate live numbers.

### 3. Pick the lead

Score each candidate "lead beat" on three signals — concreteness, recency, surprise — and pick the highest-scoring one as the cold-open of the Show HN body. Concreteness wins ties.

| Candidate | Concreteness | Recency | Surprise |
|-----------|-------------:|--------:|---------:|
| Specific autonomous behavior with a PR# (e.g. "the agent triaged its first external PR within 4 hours") | high | check log dates | medium |
| Skills-built count over a window (e.g. "shipped 14 skills in the last 14 days, all by the agent itself") | medium | check Skills Built dates | medium |
| A self-healing event (skill-repair caught a failing skill, opened a fix PR) | high if PR# present | check log dates | high |
| Token / market metric | low for HN audience | — | low |
| Star count alone | low | — | low |

Do **not** lead with stars or token price. HN's technical audience scores those near zero. Lead with a concrete autonomous-behavior moment that a senior engineer would recognize as non-trivial.

### 4. Write the Show HN variant

Write to the `## Show HN` section of `articles/show-hn-draft-${today}.md`.

**Title** — single line, ≤80 chars, follows HN convention `Show HN: <project>` + a one-clause hook. Examples to match in shape (do **not** copy verbatim):
- `Show HN: Aeon — an autonomous agent that runs on GitHub Actions and patches itself`
- `Show HN: I built an agent that ships its own PRs while I sleep — 90+ skills, no babysitting`

Pick a title that names exactly **one** non-obvious capability. Avoid: "framework," "platform," "AI-powered," vague superlatives. The title must pass a sceptical-engineer test — would they click it?

**Body** — exactly 4 paragraphs, no markdown headers inside the body, plain prose:

1. **Cold open** — the lead beat from step 3 in 2–3 sentences. Concrete, dated, with a PR or commit if available. No "I'm excited to share."
2. **What it actually does** — 4–6 sentences naming the capabilities a senior engineer would care about: schedule-driven runs on Actions, file-based memory in git, quality scoring per run, self-healing via skill-repair, MCP server + A2A gateway. Reference the README comparison table — Aeon vs Claude Code / Hermes / OpenClaw — without re-pasting it.
3. **Honest scope** — 3–4 sentences. What it's good at (recurring background work). What it's NOT (interactive coding — keep using Claude Code for that). The "configure once, walk away" framing belongs here. Naming the boundary is what makes the rest credible.
4. **Pointer + ask** — repo URL `https://github.com/aaronjmars/aeon`, the install one-liner (`git clone https://github.com/aaronjmars/aeon && cd aeon && ./aeon`), and a specific question for HN comments — e.g. *"What's the worst recurring-task class you've automated and abandoned because the agent kept needing you?"* Specific questions get specific replies; "feedback welcome" gets nothing.

**Hard rules:**
- No emoji in the title or body. None.
- No `🧵`, no `[1/3]`, no marketing words ("revolutionary", "game-changing", "powerful", "leverages").
- One link maximum, in paragraph 4.
- Every concrete number (stars, forks, skills shipped, PR count) must be traceable to a file you read in step 2. If the number isn't in a file, drop it — don't guess.
- Keep total body under 350 words. HN's first-screen attention is short.

### 5. Write the r/MachineLearning variant

Write to the `## r/MachineLearning` section of the draft file.

**Title** — ≤300 chars, follows r/MachineLearning convention `[Project] <Name>: <one-sentence description>`. Lead with the technical interest hook for ML-leaning readers — not "agent framework" (saturated) but the thing that's actually unusual: per-run quality scoring, self-healing prompts, file-based memory in version control, the autoresearch evolution loop.

**Body** — 6–10 sentences, plain prose, **no marketing tone**:

- Sentence 1–2: what Aeon is in one tight definition.
- Sentence 3–5: the part ML readers will engage with — Haiku-scored output per run with rolling 30-run history, `skill-evals` assertion-based regression tests, `autoresearch` evolving prompts based on production runs, model selection per skill (Sonnet vs Opus vs Haiku tradeoffs surfaced in `aeon.yml`).
- Sentence 6–8: limitations and tradeoffs — context-window pressure on long-running skills, rate limits, why not all skills are enabled by default.
- Sentence 9–10: link + an ML-shaped question (e.g. *"Curious whether anyone's using Haiku for self-grading runs of Sonnet/Opus output and how you handle scorer-vs-generator drift"*).

**Hard rules:** same as Show HN. Plus: do not call it a "framework" — call it an autonomous agent running on GitHub Actions.

### 6. Write the r/selfhosted variant

Write to the `## r/selfhosted` section of the draft file.

**Title** — `<Name>: <what it self-hosts>` — lead with the operational angle: zero infra, runs on Actions minutes, file-based state in git you can grep.

**Body** — 4–6 sentences:

- The selfhosted angle: why this is operator-appealing — no Docker, no DB, no service to babysit, all state in a git repo, free on public repos via GitHub Actions minutes.
- One sentence on cost: token usage (`memory/token-usage.csv`), the optional Bankr LLM gateway for cheaper Opus.
- The notification stack: opt-in Telegram / Discord / Slack, no required external service.
- The boundaries: it needs a Claude API key or OAuth token; that's the only paid surface.
- Repo URL + ask (e.g. *"Anyone running scheduled agents like this on something other than Actions? Curious what the operator UX looks like"*).

**Hard rules:** same as Show HN. Plus: name the actual cost surface honestly — don't imply free total cost when the API key isn't free.

### 7. Append the launch checklist

Append a `## Launch checklist` section to `articles/show-hn-draft-${today}.md`. Plain checklist for the operator — not for the agent. Do **not** post this to HN/Reddit; it lives in the draft file only.

```
## Launch checklist
- [ ] Star count check (rerun this skill if stars > 300; titles update with the new round number)
- [ ] No active known-broken skills (./scripts/skill-runs --hours 24 --failures shows clean)
- [ ] No pinned issues that contradict the post (open issues at `gh issue list -R aaronjmars/aeon --state open`)
- [ ] Final read-through for tone (anything that sounds like marketing → cut)
- [ ] Pick the slot: Tuesday–Thursday, 8–10 AM US Eastern is the empirical sweet spot for HN
- [ ] Have one concrete answer ready for "how does this differ from <X>" — pull from SHOWCASE.md comparison table
- [ ] Be in the comments for the first hour — non-responses to early questions kill the post
```

### 8. Notify

Send via `./notify` with the Show HN title + Show HN paragraph 1 + the file path. Format:

```
*Show HN draft — ${today}*

Title: ${show_hn_title}

${show_hn_paragraph_1}

—
Variants in file: ${variants_written} (show-hn, r/MachineLearning, r/selfhosted)
File: articles/show-hn-draft-${today}.md
Stars: ${current_stars} | Forks: ${current_forks} | Skills: ${total_skills}

Operator: read the launch checklist at the bottom of the file before posting.
```

If only one variant was regenerated (because `${var}` was set), say `Variants regenerated: ${var}` instead, and quote the regenerated section's first paragraph instead of the Show HN one (so the operator can verify the change without opening the file).

### 9. Log

Append to `memory/logs/${today}.md`:

```
## Show HN Draft
- **Skill**: show-hn-draft
- **Variants written**: ${list}
- **Lead beat picked**: ${one-line summary of the lead from step 3}
- **Stars at draft time**: ${current_stars}
- **File**: articles/show-hn-draft-${today}.md
- **Notification**: sent
- **Status**: SHOW_HN_DRAFT_OK | SHOW_HN_DRAFT_PARTIAL | SHOW_HN_DRAFT_BAD_VAR
```

`SHOW_HN_DRAFT_PARTIAL` means at least one source input was missing (logged in step 2) but the draft still wrote — the operator should sanity-check the affected section.

## Constraints

- **Never invent numbers.** Every star count, fork count, skill count, PR number, or date must come from a file you read in step 2 (or `gh api`). If a number isn't sourced, drop the sentence.
- **Never write marketing.** Show HN readers have antibodies for it. The post fails on words like "powerful", "revolutionary", "leverages", "best-in-class". Read your output. If a sentence sounds like a press release, rewrite it as plain English.
- **Never quote the soul files.** The voice should be Aeon's everyday voice — concrete, plain, no hype. The soul guide informs tone; it does not become content.
- **Don't promise features that aren't shipped.** Only describe behaviors that have a corresponding file in the repo or a logged event in the last 14 days. If something is "planned but not built," omit it.
- **Don't post.** This skill writes drafts. Posting is the operator's call, gated by the launch checklist.

## Sandbox note

All inputs are local file reads or `gh api` (`gh` handles auth via the workflow's `GITHUB_TOKEN` — no env-var-in-headers curl). No external WebFetch needed; HN/Reddit aren't queried because the draft writes outbound content, it doesn't read inbound. Notifications use `./notify` and fan out to every configured channel.

## Edge cases

- **Already-drafted-today rerun, `${var}` empty** — overwrite the existing file. Log a `_Regenerated: previous draft superseded_` line at the top of the new file. The previous draft is in git history if needed.
- **Already-drafted-today rerun, `${var}` set to one variant** — patch only that section; preserve the others byte-for-byte (round-trip read → replace section → write).
- **Stars fetch failed AND no recent repo-pulse article** — set the headline number placeholder to `${current_stars}` literally and emit `SHOW_HN_DRAFT_PARTIAL`. The operator must fill it before posting; the launch checklist already covers this read-through.
- **Empty `memory/logs/` (first-run fork)** — the lead beat will fall through to README + skills.json material. Tag the draft with a `_Note: this fork has no log history yet — the lead beat is generic until the agent has run for ~7 days_` line at the top.
- **Star count crossed 300 since the last draft** — the title's hook line should reference the round number explicitly; the launch checklist's first item flags this as a re-run trigger. Don't auto-celebrate inside the body — that's `star-milestone`'s job.
