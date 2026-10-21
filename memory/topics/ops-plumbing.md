---
title: Scheduler and notification plumbing state
description: What actually fires this agent's schedules, what "enabled" in aeon.yml does and does not prove, and the notification-format rules that supersede the old hand-formatting notes.
tags:
  - ops
  - runbook
  - scheduler
  - notify
timestamp: 2026-10-21T11:00:00Z
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

# Citations

- `gh run list` showing `scheduler: cron` with `event: schedule`, `success`, 2026-10-21T10:09:10Z.
- `scripts/notify_format.py` module docstring (channel limits + Markdown→HTML normalization).
- `CLAUDE.md` § Tools / § Network & Secrets.
