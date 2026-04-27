Skill executed and exited at step 1 per its `LIST_DIGEST_NO_CONFIG` branch. No notification sent (correct per the skill's exit-mode taxonomy).

## Summary

**What I did:** Read `skills/list-digest/SKILL.md` and `memory/MEMORY.md`, parsed step 1's config check, and exited without notifying because the skill's required `${var}` is empty.

**Why the skill aborted:**
- `aeon.yml` has `list-digest: { enabled: true, schedule: "0 17 * * *" }` with no `var:` field.
- Step 1 mandates: empty `var` → log `LIST_DIGEST_NO_CONFIG`, exit 0, no notify.
- This is a recurring config-gap already tracked in `memory/MEMORY.md` "Next Priorities" and `memory/topics/aeon-ops.md`. Today's log already had the full no-config block at line 329; PR `tomscaria/aeon#1` (still open ~32h) is the operator-side fix to disable the skill until configured.

**Files modified:**
- `memory/logs/2026-04-27.md` — appended a one-line `LIST_DIGEST_NO_CONFIG` re-run marker referencing the existing detailed entry at line 329.

**Follow-up (operator action — already on the config-gap list):**
- Add `var: "LIST_ID_1,LIST_ID_2[|topic_filter]"` to the `list-digest` entry in `aeon.yml`. List IDs are the numeric IDs in `https://x.com/i/lists/<ID>`.
- Or merge/close PR `tomscaria/aeon#1` which disables this skill (and `channel-recap`) until configured.
