# Session 05 — Chat-First Operator Console

> **Goal:** Talk to your Aeon over Telegram/Discord/Slack with native commands. Replace daily dashboard visits with conversational ops.
>
> **Effort:** ~3 weeks.
> **Risk:** Low.
> **Author gate:** No.
> **Reference:** [`../09-EXPANSION-OPTIONS.md`](../09-EXPANSION-OPTIONS.md) Option #5.

---

## The prompt to paste

```
You are building the Chat-First Operator Console for the Aeon framework.
Read these dossier docs first:
  - docs/contributor-dossier/03-subsystems/notifications.md
  - docs/contributor-dossier/03-subsystems/runtime.md
  - docs/contributor-dossier/03-subsystems/memory.md

Your task: extend the existing inbound-message handler so operators can
issue ops commands via chat. Commands work across Telegram, Discord, and
Slack uniformly. Existing free-text messages (questions to the agent)
continue to work.

Command vocabulary (chat-friendly, no leading slash needed):

  status                    → heartbeat-style summary
  what did you do today     → today's logs summarized
  pause crypto              → disable all skills tagged 'crypto'
  resume crypto             → re-enable them
  run morning-brief         → workflow_dispatch the skill
  health <skill>            → skill-health for one skill
  remind me to <X> at <T>   → new scheduled note
  cost                      → token-usage rollup

Commands are detected via a prefix matcher in the messages.yml run job;
unmatched messages fall through to the existing Claude prompt path.

Constraints:
  - Commands operate per-channel scoped to the operator (sender check).
  - Reversible commands (pause/resume) write to memory/state/console.json.
  - Destructive commands (e.g. delete skill, change secret) are NOT
    exposed via chat — they require dashboard or repo edit.
  - Same conventions as skill prose: char-budget per channel; logging;
    notify confirmations.

Out of scope:
  - Voice (Session 08 territory).
  - Multi-tenant (one Aeon per operator).
  - A new chat platform.
```

## Punchlist

- [ ] Command parser in `messages.yml` run job: prefix match against canonical commands.
- [ ] Command implementations as skills under `skills/console-*/`:
  - `console-status`, `console-today`, `console-pause`, `console-resume`, `console-run`, `console-health`, `console-remind`, `console-cost`.
- [ ] Per-command authorization: matches sender chat-id against operator's `OPERATOR_CHAT_ID` secret.
- [ ] Command state: `memory/state/console.json` for paused-skill list, reminders, etc.
- [ ] Cron skill `console-reminders` fires at scheduled times; sends notification.
- [ ] Help command: `help` returns the command list.
- [ ] Telegram quick-replies / Discord buttons / Slack blocks: render command output with channel-native interactions where available.
- [ ] Doc: `docs/contributor-dossier/03-subsystems/console.md`.
- [ ] Operator runbook: how to discover available commands; how to add a custom one.

## Files touched

| Path | Action |
|---|---|
| `.github/workflows/messages.yml` | Add command parser; dispatch matched commands as skills |
| `skills/console-status/SKILL.md` | New |
| `skills/console-today/SKILL.md` | New |
| `skills/console-pause/SKILL.md` | New |
| `skills/console-resume/SKILL.md` | New |
| `skills/console-run/SKILL.md` | New |
| `skills/console-health/SKILL.md` | New |
| `skills/console-remind/SKILL.md` | New |
| `skills/console-reminders/SKILL.md` | New (cron) |
| `skills/console-cost/SKILL.md` | New |
| `memory/state/console.json` | New |
| `aeon.yml` | Register console skills |
| `docs/contributor-dossier/03-subsystems/console.md` | New |

## Dependencies

- **`OPERATOR_CHAT_ID`** per-channel secret (already exists for inbound polling — verify it's authoritative).
- No new external services.

## Risks

| Risk | Mitigation |
|---|---|
| Accidental destructive command via chat typo | Destructive commands NOT exposed; pause/resume + reminders only. |
| Command spoofing by another chat user | Sender check vs `OPERATOR_CHAT_ID`; reject silently otherwise. |
| Command syntax drift across channels | Single canonical parser; channel-specific rendering only. |
| Skill-vs-command collision (operator runs a skill called "status") | Commands prefixed with optional `aeon ` namespace; document precedence. |

## Doctor check

- ✓ `console-*` skills registered in aeon.yml
- ✓ `OPERATOR_CHAT_ID` set
- ✓ Sending "status" to the configured channel returns a response within 30s
- ✓ Unauthorized sender gets no response (silent reject)

## Related dossier docs

- [`../03-subsystems/notifications.md`](../03-subsystems/notifications.md) — the existing inbound pipeline
- [`../03-subsystems/runtime.md`](../03-subsystems/runtime.md) — how commands dispatch as skills
- [`../09-EXPANSION-OPTIONS.md`](../09-EXPANSION-OPTIONS.md) § Option #5
