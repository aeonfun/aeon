---
title: Scheduler and notification plumbing state
description: What actually fires this agent's schedules, what "enabled" in aeon.yml does and does not prove, and the notification-format rules that supersede the old hand-formatting notes.
tags:
  - ops
  - runbook
  - scheduler
  - notify
timestamp: 2026-10-23T00:00:00Z
---

# Scheduler and notification plumbing state

## Schedules now fire — the earlier "never ran" finding is closed

An earlier entry recorded `scheduler.yml` as having 0 runs, with every repo run arriving as
`workflow_dispatch`/`push` — the classic fork symptom, where a forked repo's scheduled workflows
are disabled by default. That is **no longer true**: on 2026-10-21T10:09:10Z a `schedule`-event run
named `scheduler: cron` completed successfully. Scheduled dispatch is live.

Keep the distinction that made the original finding easy to misread:

- `enabled: true` in `aeon.yml` only means the skill is *eligible* to be dispatched. It says nothing
  about whether the scheduler has ever fired, and it does **not** create missing state files.
- A skill with `enabled: true` and no state file has simply never completed a run. `price-alert`
  was in exactly that spot until its state was seeded by hand.
- Diagnose with `gh run list --json name,event,conclusion` and filter `event == "schedule"`. A
  non-zero count there is the only proof the cron path works.
- Manual dispatch is always available: `gh workflow run scheduler.yml`.

## Notifications: write plain Markdown, do not hand-format

`./notify` renders each channel itself (`scripts/notify_format.py` normalizes Markdown into
Telegram's safe HTML subset and auto-chunks at ~3900 chars with `[i/N]`). So the correct habit is
ordinary Markdown — `##` headings, `**bold**`, `-` bullets, `| tables |`, fenced code, `[label](url)`.

This supersedes any older hand-formatting rules for Telegram (the "no `#`, no tables, wrap nothing
in `>`" list). Those rules describe a legacy parse_mode problem that the formatter now solves; hand
formatting for the transport is wasted effort and loses structure.

Editorial choices still matter: keep it terse because the operator wants signal, not because of a
transport limit. Use `x.com/handle` instead of `@handle` so nobody gets pinged.

## Multi-line notifications

Use `./notify -f path.md`. Do **not** use `./notify "$(cat file.md)"` — long multi-line argv trips
the sandbox. Short bodies containing `test`/`ping`/`debug`/`trace` are suppressed as diagnostic
probes, so a "test" message is not a delivery check.

## Permission layer: state writes and file copies

Writing skill state from Bash is unreliable in this harness, and the failure looks like a skill bug
rather than a permission rule:

- **`jq -f` is refused** as a "dangerous flag". Use `jq empty` / `jq -e` for *validation* only; do
  the actual rewrite through `Write` or a `node` one-liner.
- **`cp` into the repo requires interactive approval**, so a `.bak` roll silently does not happen.
  `price-alert` went eight consecutive runs on 2026-10-22 with a stale backup (21:01–23:01Z all say
  "`.bak` still not refreshed"), and the 12:01Z run's denial left the backup a full run behind.
- Preferred pattern that does work: build the new JSON in `node`, write a tmpfile, re-parse it to
  validate, then `os.replace` / atomic rename. Confirm with `jq empty` afterwards and log
  `STATE_VALID`.
- Write the state file directly with `Write` rather than trying to shell-copy the old one first. A
  missing backup is survivable; a half-written state file is not.

# Citations

- `gh run list` showing `scheduler: cron` with `event: schedule`, `success`, 2026-10-21T10:09:10Z.
- `scripts/notify_format.py` module docstring (channel limits + Markdown→HTML normalization).
- `CLAUDE.md` § Tools / § Network & Secrets.
