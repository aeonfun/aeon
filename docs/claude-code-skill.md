---
type: Reference
title: The /aeon Claude Code skill
description: The operator-facing Claude Code skill that sets up, schedules, edits, and debugs your Aeon instance from a chat — what it does, its modes, and how to install it.
---

# The `/aeon` Claude Code skill

Aeon ships a **[Claude Code](https://claude.com/claude-code) skill** that turns *"how do I set up / schedule / fix this?"* into a guided chat. It's the fastest way to drive your instance from your editor — you describe what you want in plain language and it runs the right `./aeon` commands for you, with the silent-failure traps already baked in.

> **This is not an Aeon skill.** The 62 skills under [`skills/`](../skills) run unattended on GitHub Actions. **This** one runs inside *your* Claude Code session on *your* machine — it's the operator's assistant for configuring the instance, not something that runs on a schedule. It doesn't appear in `aeon.yml`, the packs, or the catalog.

## What it does

You don't have to learn `aeon.yml`, cron syntax, or the CLI flags. Mention Aeon (or type `/aeon`) and it picks the right mode:

| Mode | Ask it when you want to… |
|---|---|
| **Start** | Stand up a brand-new instance and get one real notification on your phone, fast |
| **Reschedule** | Change when a skill runs, its cadence, or what it focuses on ("move the digest to 7am", "weekdays only") |
| **Unblock** | Figure out why a skill "didn't run" — it walks the ordered checklist (disabled? unquoted schedule? Actions off? wrong repo?) |
| **Chat → skill** | Turn something you just did in Claude Code into a scheduled skill |
| **Edit a skill** | Change what an existing skill does — a source, a filter, tone, length |
| **What to turn on** | Pick skills for what you care about, browse packs, install community packs |
| **Strategy & voice** | Set `STRATEGY.md` (the north star) and `soul/` (the voice every run speaks in) |

It knows the things that silently break an instance — an unquoted `schedule:` that never fires, `gh` pointed at the wrong repo, a missing secret — and it verifies as it goes instead of guessing. (The config-side of that knowledge is also enforced continuously by the [`aeon-doctor`](../skills/aeon-doctor/SKILL.md) skill.)

## Install

You need **[`gh`](https://cli.github.com/) authenticated** (`gh auth login`) — the skill drives everything through the GitHub CLI, same as the dashboard.

### Option A — it's already in your repo (zero-install) · recommended

Every Aeon instance ships this skill at [`.claude/skills/aeon/`](../.claude/skills/aeon). Claude Code auto-loads skills from a project's `.claude/skills/`, so there's nothing to install:

1. Open your Aeon repo folder in Claude Code — the [VS Code](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code) or JetBrains extension, or the `claude` CLI in that directory.
2. Type **`/aeon`** (or just mention Aeon / `aeon.yml` / "schedule a skill") and answer its questions.

### Option B — install it globally (use it from any folder)

Copy the skill into your personal skills directory so `/aeon` works in every Claude Code session:

```bash
cp -R .claude/skills/aeon ~/.claude/skills/aeon
```

Now open **any** directory in Claude Code and type `/aeon`; point it at your instance when it asks which repo.

## How it relates to the dashboard & CLI

Three front doors, one engine — all of them read and write the same `aeon.yml` + repo secrets:

- **Dashboard** (`./aeon` → `localhost:5555`) — click-driven setup, best for first run. See [Quick start](../.github/README.md#quick-start).
- **CLI** (`./aeon skills …`, `./aeon secrets …`) — scriptable, `--json`-friendly. See [Command line](../apps/cli/README.md).
- **This skill** (`/aeon` in Claude Code) — conversational; you say what you want, it runs the CLI and confirms the result.

Use whichever fits the moment — the skill is just the CLI with judgment on top.
