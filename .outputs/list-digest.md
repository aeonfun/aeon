## Summary

Ran `skills/list-digest/SKILL.md`. Per Step 1 of the skill, the `var` parameter must contain at least one X list ID — but `aeon.yml:89` declares `list-digest` without any `var:` field. The skill exits at `LIST_DIGEST_NO_CONFIG`, log only, no notification.

- **Status:** `LIST_DIGEST_NO_CONFIG`
- **Files modified:** `memory/logs/2026-04-27.md` (appended a `## list-digest` entry per skill Step 8)
- **Follow-up:** operator must add `var: "LIST_ID_1,LIST_ID_2[|topic]"` to the `list-digest` line in `aeon.yml` to enable real runs. This config gap is already tracked in `memory/topics/aeon-ops.md` and surfaced in MEMORY.md's "Next Priorities" section.
