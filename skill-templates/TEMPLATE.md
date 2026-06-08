# Skill Templates

Six pre-built skill starters for the most common operator use cases. Each template is a complete, runnable `SKILL.md` with `[REPLACE: ...]` tokens for the parts you need to customise (topic, repo, channel, threshold, etc.).

## Available templates

| Template | What it does | Replace tokens |
|----------|--------------|----------------|
| [`crypto-tracker`](crypto-tracker/SKILL.md) | Daily price/volume report for one token, with anomaly alerts above a threshold. | `TOKEN_SYMBOL`, `COINGECKO_ID`, `ALERT_THRESHOLD_PCT` |
| [`research-digest`](research-digest/SKILL.md) | Daily digest of the most interesting new posts on a topic from RSS feeds and the open web. | `TOPIC`, `FEED_URLS`, `MAX_ITEMS` |
| [`code-reviewer`](code-reviewer/SKILL.md) | First-touch review of newly opened PRs on a watched repo (verdict + welcoming comment + label). | `WATCHED_REPO`, `REVIEW_FOCUS`, `MAX_PR_LINES` |
| [`social-monitor`](social-monitor/SKILL.md) | Daily mention/keyword sweep on X and Reddit, with sentiment summary and link list. | `KEYWORDS`, `LANGUAGE`, `MIN_LIKES` |
| [`deploy-watcher`](deploy-watcher/SKILL.md) | Watch Vercel project deploy status, alert on failures with last-success comparison. | `VERCEL_PROJECT`, `ALERT_ON`, `LOOKBACK_HOURS` |
| [`community-manager`](community-manager/SKILL.md) | Daily summary of activity in a Discord, Telegram, or Slack channel — top threads + open questions. | `CHANNEL_PLATFORM`, `CHANNEL_NAME`, `TOP_N_THREADS` |

## Install a template

Use `./new-from-template`:

```bash
./new-from-template crypto-tracker my-token-watcher \
  --var TOKEN_SYMBOL=ETH \
  --var COINGECKO_ID=ethereum \
  --var ALERT_THRESHOLD_PCT=10
```

That copies `templates/crypto-tracker/SKILL.md` → `skills/my-token-watcher/SKILL.md`, replaces every `[REPLACE: TOKEN_SYMBOL]` etc. with your value, and registers a disabled entry in `aeon.yml` so you can enable it from the dashboard or CLI when you're ready.

If you don't pass `--var` flags, the script copies the file verbatim and prints the list of tokens that still need replacement before the skill will run cleanly.

```bash
./new-from-template --list                    # print available templates
./new-from-template crypto-tracker --tokens   # print the tokens a template uses
```

## Template format

Every template is a single directory under `templates/` containing one `SKILL.md`. The SKILL.md follows the standard skill frontmatter contract:

```markdown
---
name: [REPLACE: SKILL_NAME]
description: One-line description of what this skill does
var: ""
tags: [...]
---
```

Replacement tokens use the form `[REPLACE: KEY]`. Keys are uppercase snake-case so they're easy to spot in a diff. The literal token `[REPLACE: SKILL_NAME]` is special — it's auto-set to the skill name passed to `./new-from-template` (the second positional argument).

## Adding a new template

1. Make a new directory under `templates/`.
2. Drop a `SKILL.md` inside, with `[REPLACE: KEY]` tokens for the operator-specific parts.
3. Add a row to the table at the top of this file.

That's it — `./new-from-template --list` discovers templates by scanning for `SKILL.md` files under `templates/`, so no registry update is required.
