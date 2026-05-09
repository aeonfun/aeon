---
name: Auto-commit hook can capture mid-task edits under misleading labels
description: After multi-file edits, check git log before the next edit so you know whether the hook already absorbed your changes into someone else's commit
type: feedback
originSessionId: 3fc76560-2a26-447f-97c1-e477aa3b546e
---
The repo's auto-commit hook (see `.claude/settings.json`) can fire between tool calls and bundle your Python/code changes into a commit triggered by an unrelated MD edit. The resulting commit message describes the MD trigger, not your code.

**Why:** Observed 2026-04-22 — my `python/execution/polymarket_adapter.py` D9 slippage helper was captured into commit `b46da0c "docs: fix critique-review memo self-ref path"` alongside a one-line MD link fix. The adapter code was the bulk of the diff but the message didn't mention it. Downstream engineers reading `git log` will miss the change.

**How to apply:**
- After a multi-file Edit batch in a repo with auto-commit active, run `git log -1 --stat` before your next major edit in the same area.
- If the hook captured code you were about to bundle into your own commit: note it in your follow-up commit body with the rogue SHA so `git log` narrative still traces correctly ("Note: helper landed in commit X under a misleading docs: message").
- Alternative when scope is small: stage a placeholder .gitignore-ignored file first to keep the working tree dirty until you're ready for your own commit. Heavier; only worth it for tight multi-file changes where mislabel would really hurt.
- Don't amend the rogue commit — the hook may have already pushed, and amending-published-commits is on the "never without asking" list per global CLAUDE.md.
