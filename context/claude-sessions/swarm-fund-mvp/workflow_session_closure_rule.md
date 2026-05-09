---
name: Don't agree to close session without PR merged or feature abandoned
description: On any session-close request, check for outstanding work (uncommitted, unpushed, unmerged) and ASK before agreeing
type: feedback
originSessionId: d37891a9-a95b-408b-b17c-bc8bcfec1ad3
---
When the user says "close session" / "wrap up" / "we're done" or similar, do NOT just acknowledge and sign off. Run a quick sanity check first:

1. `git status --short` — any uncommitted local changes from this session?
2. `git log --oneline @{u}..HEAD` — local commits not yet pushed?
3. `gh pr list --search "head:<branch> state:open"` — open PRs not yet merged from this session's work?
4. Any background agents, scheduled tasks, or running processes started this session that should be reconciled?

**If anything is outstanding, ASK the user before agreeing to close.** Present the outstanding items concretely (file paths, PR URLs, branch names) and let them choose: ship it, abandon it, or hand it off.

**Only agree to close the session when one of these is true:**
- (a) The PR for the session's work is **merged** (not just open).
- (b) The user has explicitly stated the feature is **abandoned / gave up / parked**.
- (c) The session genuinely produced no work that needs shipping (read-only research, planning-only with plan file approved-and-saved, etc.).

**Why:** User explicitly corrected this behavior on 2026-05-01 after the Naval/hardware-moat session — agreed too easily to close while a doc edit (`docs/long_term_vision/README.md`) was uncommitted. Their words: "never agree to close the session unless a PR has been merged or we gave up on the feature. ask me." The repo workflow is shifting toward PR-based shipping (direct-to-main pushes are now gated by a permission rule), so "PR merged" is the right shipping signal.

**How to apply:** Run the sanity check silently. If clean, agree to close. If outstanding, surface the specifics and ask. Never use the phrase "session closed" until at least one of the three conditions above is met.
