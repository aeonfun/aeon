---
name: Session archival workflow — git tag + session memory file
description: Standard end-of-session pattern that pairs commit boundary with mental-state boundary for clean cold-start resumes
type: feedback
originSessionId: 17f9b3b9-2b16-48d3-b970-60b2e5e996e9
---
At the end of any session with meaningful shipped work, archive it in two places:

**1. Git tag:** `session/YYYY-MM-DD-<theme>` pushed to origin
```bash
git tag -a "session/$(date +%Y-%m-%d)-<theme>" -m "Session: <one-line summary>"
git push origin --tags
```
Theme is a noun-phrase like `data-sink`, `chronos-integration`, `hf-publish`. Makes `git checkout session/<date>-<theme>` a one-command time-travel.

**2. Memory file:** `memory/session_YYYY-MM-DD_<theme>.md` (type: project)

Contents:
- Git tag name
- Ordered list of commits shipped (sha + one-line)
- Architecture decisions made
- What's build-complete + shipped
- What's pending manual work (cross-reference `manual_tasks_thomas.md`)
- Next session priorities in recommended order
- Literal resume-prompt for cold-start (quoted, copy-paste ready)

**Why:** Pairs the commit boundary (machine state) with the mental-state boundary (what was decided + what comes next). Future sessions can cold-start by reading just the session archive — no re-debate of decisions, no re-probing of already-known quirks.

**How to apply:**
- End of any session with 3+ substantive commits → archive
- Skip for tiny sessions (single commit, pure doc edit)
- Always also add to `MEMORY.md` Reference Files index so the archive is discoverable
- Next session's first message should literally be the resume-prompt from the archive

**Reference implementation:** `session_2026-04-17_data_sink.md` + tag `session/2026-04-17-data-sink`.
