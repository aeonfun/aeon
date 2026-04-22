---
name: onboard
description: One-shot setup validator — runs every check from the ./onboard CLI inside the workflow and sends the resulting checklist to the configured notification channel
var: ""
tags: [meta]
---

> **${var}** — Optional. Set to `--silent-on-pass` to suppress the notification when every required check passes (useful for nightly self-audits). Default: always notify.

Today is ${today}. Validate that this Aeon fork is correctly set up and report the result through the operator's configured notification channels. **The point of this skill is to convert a freshly-forked, half-configured repo into a known-working state in one notification — every gap must come with the exact command that fixes it.**

## When this skill runs

Two contexts:

1. **Manual dispatch (primary).** The operator just forked Aeon, set their secrets, and wants to confirm the agent is alive. They run `./onboard --remote` locally (or hit *Run workflow* in Actions) → this skill fires → checklist arrives in Telegram/Discord/Slack/Email.
2. **Scheduled self-audit (optional).** Operator pins this skill to a nightly cron with `var: "--silent-on-pass"` so they only hear about it when something breaks (e.g. a notification webhook stopped working, secrets got rotated and forgotten).

## Steps

### 1. Run the local validator

```bash
./onboard --json > .outputs/onboard.json
```

The CLI is the canonical source of truth — every check, fix string, and exit-code rule lives there. This skill only transforms the JSON output and routes it to the right places. If `./onboard` is missing, log `ONBOARD_MISSING_CLI: ./onboard not present in repo root` and stop with no notification (the operator hasn't synced from upstream).

The JSON shape:
```json
{
  "summary": { "pass": 6, "warn": 1, "fail": 1 },
  "checks": [
    { "status": "pass", "check": "workflow .github/workflows/aeon.yml", "detail": "present", "fix": "" },
    { "status": "fail", "check": "auth secret", "detail": "neither ANTHROPIC_API_KEY nor CLAUDE_CODE_OAUTH_TOKEN configured", "fix": "gh secret set ANTHROPIC_API_KEY ..." }
  ]
}
```

### 2. Decide whether to notify

- If `${var}` contains `--silent-on-pass` AND `summary.fail == 0` AND `summary.warn == 0` → log `ONBOARD_OK_SILENT` and skip the notification. Still write the log entry in step 5.
- Otherwise → continue to step 3.

### 3. Build the notification body

Group rows by status. Lead with the verdict so a reader who only sees the first line gets the answer.

```
*Aeon Onboarding — ${today}*
${verdict_one_liner}

✅ Passing (N)
${pass_lines}

⚠ Warnings (N)
${warn_lines_with_fix}

❌ Failing (N)
${fail_lines_with_fix}

Next: ${next_action}
```

Field rules:

- **`${verdict_one_liner}`** — one of:
  - `summary.fail == 0 && summary.warn == 0` → `"All set — Aeon will run on its next cron tick."`
  - `summary.fail == 0 && summary.warn > 0` → `"Aeon will run, but {N} optional piece(s) missing."`
  - `summary.fail > 0` → `"Setup incomplete — {N} required item(s) need attention before Aeon can run."`
- **`${pass_lines}`** — one bullet per pass. Format: `• {check} — {detail}`. Cap at 6; if more, collapse the tail into `• …and {K} more`.
- **`${warn_lines_with_fix}`** — one bullet per warning, two lines each: `• {check} — {detail}` then indented `    fix: {fix}`. Omit the section header entirely if N == 0.
- **`${fail_lines_with_fix}`** — same shape as warnings, omit if N == 0.
- **`${next_action}`** — derived from the highest-priority gap:
  - any `fail` → `"Fix the ❌ items above, then rerun ./onboard --remote."`
  - only `warn` → `"Optional improvements — Aeon will run regardless. Rerun ./onboard once addressed."`
  - all clean → `"Nothing — you're done. Trigger your first skill: gh workflow run aeon.yml -f skill=heartbeat"`

Hard cap the message at ~3500 chars (Telegram's safe limit). If exceeded, drop the `pass` section first (failures and warnings are more important).

### 4. Send via `./notify`

```bash
./notify "$(cat .outputs/onboard-message.md)"
```

`./notify` fans out to every configured channel. If no channel is configured, it silently no-ops — but in that case the checklist itself flagged it under "❌ Failing", so the operator will see it next time they check Actions logs.

### 5. Log to `memory/logs/${today}.md`

```
## Onboard Check
- **Skill**: onboard
- **Trigger**: ${manual|scheduled}
- **Verdict**: ${verdict_one_liner}
- **Pass / Warn / Fail**: $P / $W / $F
- **Failing checks**: ${comma_list_of_failing_check_names_or_"none"}
- **Notification sent**: ${yes|no — silent-on-pass|no — ./notify not configured}
- **Status**: ONBOARD_OK | ONBOARD_DEGRADED | ONBOARD_INCOMPLETE | ONBOARD_OK_SILENT | ONBOARD_MISSING_CLI
```

`ONBOARD_OK` = 0 fail / 0 warn. `ONBOARD_DEGRADED` = 0 fail / >0 warn. `ONBOARD_INCOMPLETE` = >0 fail.

### 6. Record state for trend tracking

Append a single line to `memory/topics/onboard-history.md` (create with `# Onboard History` header if missing):

```
- ${today}T${time}Z — pass=$P warn=$W fail=$F status=$STATUS
```

Used by `weekly-shiplog` and any future skill that wants to spot setup drift (e.g. "GH_GLOBAL was set last week, missing this week → operator rotated the PAT and forgot to re-add it").

## Edge cases

- **`./onboard` exits non-zero** — that's expected when failures are present. The CLI is designed to be parseable regardless of exit code; capture stdout, ignore the exit code, and continue. Only treat actual missing-file or permission errors as fatal.
- **JSON parse failure** — log `ONBOARD_PARSE_ERROR: <error>` and send a minimal notification with just the raw stdout (truncated to 2000 chars) plus a "validator output unparseable, raw text below — please run ./onboard locally for the full report" preamble.
- **`./notify` not present** — log `ONBOARD_NOTIFY_MISSING` and write the message body to `articles/onboard-${today}.md` so the operator can read it from the dashboard or repo.
- **Repeated failures across runs** — do not auto-file an issue under `memory/issues/`; this skill is operator-facing setup advice, not a degradation signal. The `skill-health` and `heartbeat` skills already cover ongoing runtime issues. Onboard's job ends at "told the operator clearly."

## Sandbox note

Pure local validation — no outbound network from the skill itself (other than the optional `gh secret list` calls inside `./onboard`, which use `gh`'s built-in auth via `GITHUB_TOKEN` and bypass the env-var-in-curl sandbox restriction). `./notify` and `./notify-jsonrender` route through the standard postprocess channel pattern (see CLAUDE.md), so messages send reliably even when the runtime sandbox blocks direct outbound network.

## Constraints

- **Never fabricate fixes.** If a check has no clean fix command, leave the `fix` field blank in `./onboard` rather than inventing one. False fixes burn trust faster than missing ones.
- **Do not auto-mutate repo state.** Onboard is read-only by design — it suggests `gh secret set`, `chmod`, etc., but never runs them. Operators stay in control.
- **Idempotent.** Running multiple times the same day overwrites `articles/onboard-${today}.md` and appends one line per run to `memory/topics/onboard-history.md`. The `memory/logs/${today}.md` entry is appended (multiple runs visible).
- **One notification max per run.** Even if both stdout and JSON parsing produce output, send at most one `./notify` call.
