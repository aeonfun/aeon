---
name: Skill Spotlight
description: Pick one skill from a rotation, ship a paste-ready feature tweet spotlighting it, then dispatch the picked skill so the chosen channel also gets the live outcome
var: ""
tags: [meta, social, content]
---

> **${var}** — Optional skill name to feature. Overrides the queue. If empty, picks the next uncovered skill from `memory/topics/skill-spotlight.md`.

Today is ${today}. Read `memory/MEMORY.md` for context.
Read `memory/topics/skill-spotlight.md` for the queue, the covered list, and the blocklist.
If `soul/` files exist, read them (`soul/SOUL.md`, `soul/STYLE.md`) to match the operator's voice. If `soul/` is empty or absent, use a clear, terse, neutral voice.

## Goal

A recurring content series around the framework's observable feature surface. Each run produces two notifications:

1. A paste-ready feature tweet (long-form X post) in the **Aeon skill spotlight** format — the operator copies this to X.
2. The picked skill's live outcome — delivered through that skill's own `./notify` after dispatch. The operator screenshots that outcome as the "Result ⤵️" body of the tweet.

Two separate notifications, not a combined message. Each notify stays under platform character limits, and the dispatched skill remains independently observable.

## Steps

### 1. Pick the featured skill

Priority order:

1. If `${var}` is non-empty and `skills/${var}/SKILL.md` exists, pick `${var}`.
2. Else read `memory/topics/skill-spotlight.md`. Pick the first entry under `## Queue` that is not under `## Covered (last 30 days)` and not under `## Blocklist`.
3. If the queue is exhausted, `ls skills/` and pick the first skill that has a `SKILL.md`, is not in the blocklist, and has not been covered in the last 30 days.

If nothing qualifies, send a single notification (`./notify "skill-spotlight: no candidates today — queue exhausted, all skills covered in last 30d"`) and exit. No filler post.

Let `${PICK}` be the chosen skill name (the kebab-case directory name).

### 2. Read the picked skill's SKILL.md

Parse the frontmatter and body:

- `name` (frontmatter) → use for the "▶️ Name" line. If absent, title-case the directory name.
- `description` (frontmatter) → ground-truth one-liner; rewrite in clear, concrete language for the "What is it about?" paragraph.
- `## Steps` body → source for the "How it works behind the scenes" bullets. Extract 5-7 real, concrete behaviors. Do not invent capabilities the skill does not have.

### 3. Compose the tweet draft

Write the following file: `.outputs/skill-spotlight.md`. Use **exactly** this shape:

```
The @aeonframework skill spotlight 🌟

🗓️ {ordinal} {Month}

▶️ Name: {Pretty-Name}

▶️ What is it about?

{2-3 sentence paragraph in operator voice. What it does, why it exists, the wedge it serves. No marketing fluff.}

▶️ How it works behind the scenes

✴️ It {verb}. {One concrete sentence about a real behavior in the SKILL.md.}

✴️ It {verb}. {Another one.}

✴️ It {verb}. {…}

✴️ It {verb}. {…}

✴️ It {verb}. {5-7 bullets total.}

▶️ Demo: {One-line setup of what the live run will show.}

Result ⤵️
```

Notes:

- The header line `The @aeonframework skill spotlight 🌟` is the brand of the series. Forks that want their own handle can edit this one string in the SKILL.md.
- Date formatting: English ordinal (`1st`, `2nd`, `3rd`, `4th`, …, `21st`, `22nd`, `23rd`, `31st`). Month is full name (`June`, not `Jun`). No year.
- Every `✴️` bullet starts with **`It {verb}.`** — keeps the cadence consistent across days and makes the series visually scannable.
- Each bullet must trace to a real behavior in the SKILL.md. If the skill genuinely has only 5 distinct behaviors, ship 5 bullets, not 7.
- No hashtags, no emoji other than what's in the template, no AI-tells ("dive in", "let's", "in summary", "robust", "seamless").
- Prefer concrete nouns (file paths, env vars, CLI flags, API endpoints) over abstractions.
- Don't quote the SKILL.md verbatim — paraphrase each bullet.
- Don't link to the SKILL.md from the tweet. The format keeps the bait — DMs and replies are the conversion signal.

### 4. Send the tweet to Telegram (or configured channels)

```bash
./notify "$(cat .outputs/skill-spotlight.md)"
```

If the file exceeds 4000 characters, trim bullets (drop the weakest first) until it fits. Telegram caps single messages at 4096.

### 5. Dispatch the picked skill (fire-and-forget)

```bash
gh workflow run aeon.yml -f skill="${PICK}"
```

Do not wait or poll. The dispatched skill's own `./notify` will deliver the outcome to the configured channels a few minutes later.

If `gh workflow run` fails (permission denied, rate limit, etc.), send a single follow-up notification and stop:

```bash
./notify "skill-spotlight: tweet drafted for ${PICK} but dispatch failed — run it manually: gh workflow run aeon.yml -f skill=${PICK}"
```

One attempt, one notification on failure. No retry loop.

### 6. Update queue state

Edit `memory/topics/skill-spotlight.md`:

- Append a line under `## Covered (last 30 days)`:
  ```
  - ${today} — ${PICK}
  ```
- If `${PICK}` appears under `## Queue` (i.e. it was picked via the queue, not via `var` override), remove that line from the queue.
- Prune entries older than 30 days from `Covered` so the section stays small.

### 7. Log

Append to `memory/logs/${today}.md`:

```markdown
### skill-spotlight

- Picked: ${PICK} (source: queue | var-override | catalog-fallback)
- Tweet draft: .outputs/skill-spotlight.md
- Dispatched run: <url or "FAILED — reason">
```

## Anti-patterns

- **Padding bullets.** Five real bullets beat seven generic ones.
- **Picking meta/internal skills.** They don't read as features. Keep them in `Blocklist`.
- **Picking the same skill in a 30-day window.** The `Covered` list enforces this; do not bypass it.
- **Dispatch-and-wait.** The dispatched skill is independently observable; polling here just burns runner minutes.
- **Linking the SKILL.md in the tweet.** Keeps the bait — DMs and replies are the conversion signal.
- **Auto-tweeting.** This skill produces a draft; the operator copies to X manually (the screenshot of the outcome goes into the tweet's "Result ⤵️" body).

## Sandbox note

`gh workflow run` works in the sandbox via the gh CLI (auth handled internally). `./notify` fans out to all configured channels. No prefetch needed.
