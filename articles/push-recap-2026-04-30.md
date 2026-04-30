# Push Recap — 2026-04-30

## Verdict
> SHIPPING — thread-formatter skill auto-drafts a 5-tweet thread from each day's logs.

**Shape:** 1 user-visible commit · 0 internal · 0 infra · 0 bot-filtered
**Volume:** 3 files changed, +203/-0 lines across 1 commit by 1 author
**Merged PRs:** 1 (#148 feat: thread-formatter — auto-format top daily event as 5-tweet thread)

---

## aaronjmars/aeon

### Social-publishing pipeline gets an inbound mouth

**What this is:** A new opt-in skill that reads `memory/logs/${today}.md`, scores the day's events on a fixed signal table (PR shipped +6, star milestone hit +5, ≥15% price move +5, skill built +4, notable PR merged +3, ≥20-like tweet +3, recognizable new fork +2), picks the single highest-signal event, and emits a paste-ready 5-tweet thread (hook → context A → context B → implication → CTA). The output is an article in `articles/thread-${today}.md` plus a notify dump that the operator can copy into X by hand. Quiet days exit silent — top score < 3 fires `THREAD_FORMATTER_NO_SIGNAL`, no article, no notification.

**Shipped to users**
- `f07d975` — feat: thread-formatter skill — auto-format top daily event as 5-tweet thread (#148)
  - `skills/thread-formatter/SKILL.md`: new 190-line skill spec. Defines the scoring table, 280-char-per-tweet hard limit, three-day topic-dedup against prior `articles/thread-*.md`, and a four-state exit taxonomy (`OK` / `NO_DATA` / `NO_SIGNAL` / `DEDUP`). Voice rules forbid hashtags, emojis, "🧵" prefix, "1/" numbering, financial-advice framing, and invented engagement numbers — only facts traceable to today's logs are allowed in the thread. Sandbox-safe: pure local file I/O, no curl, no env-var expansion. (+190/-0)
  - `aeon.yml`: registers `thread-formatter` at `30 17 * * *` UTC (right after the 17:00 social block: `fetch-tweets` / `write-tweet` / `tweet-roundup` / `agent-buzz`). Ships `enabled: false` so operators opt in. (+1/-0)
  - `skills.json`: catalog entry inserted alphabetically between `telegram-digest` and `token-alert`, category `social`, schedule `30 17 * * *`, install string `./add-skill aaronjmars/aeon thread-formatter`. (+12/-0)

---

## Developer notes
- **New dependencies:** none.
- **Breaking changes:** none. New skill defaults to `enabled: false`; existing schedules untouched.
- **New public surface:** `thread-formatter` slug in `skills.json` catalog, `thread-formatter` key in `aeon.yml` skills map, new `articles/thread-*.md` artifact pattern, four new exit taxonomy strings (`THREAD_FORMATTER_OK`, `THREAD_FORMATTER_NO_DATA`, `THREAD_FORMATTER_NO_SIGNAL`, `THREAD_FORMATTER_DEDUP`).
- **Tech debt added:** `skills.json` carries `"sha": "0000000"` and `"files": 0` placeholders for the new entry — likely backfilled by a downstream catalog-refresh skill, but the placeholder will surface in catalog tooling until then.

## Open threads
- The skill is `enabled: false` by default. Until an operator flips it on (or a chain consumer wires it in), it never runs. The 17:30 UTC slot it claims overlaps `rss-feed` (also `30 17 * * *`, also disabled) — both stay dormant on the same minute.
- PR body cites the 300-star milestone "in ~12 days at current ~4/day momentum" as one of the events the skill is built to amplify (close to the 2026-05-06 ETA in `memory/topics/milestones.md`). Skill must be enabled before that date to fire on the milestone.
- No companion `add-skill thread-formatter` invocation in this PR — operators need to run the install string manually for now.

## Sources
- aaronjmars/aeon: ok
- gh api events: ok
- gh api commits: ok
- gh pr list: ok
- bot-filtered: 0
- diff-truncated: 0
