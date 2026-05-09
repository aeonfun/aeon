---
name: Classifier outage → hand user a shell script
description: When Bash mutations or MCP write tools keep failing with "claude-opus-4-7[1m] is temporarily unavailable", stop retrying after ~3 attempts and give the user a one-block shell script.
type: feedback
originSessionId: 80c99fc0-ff46-4db8-a02a-1541acdefd7c
---
When the write-side classifier (`claude-opus-4-7[1m] is temporarily unavailable, so auto mode cannot determine the safety of …`) fails three or more times in a row for the same intent (git commit/push, Vercel MCP deploy, any Bash mutation), **stop retrying**. Instead, hand the user a single copy-pasteable shell block with the exact commands.

**Why:** Retries during these outages burn tool calls against a per-session budget (the hook surfaces a warning around 150–200 calls). The outage window is routinely longer than a reasonable retry loop, so each additional attempt is pure waste and delays the user's ability to act manually. Verified 2026-04-22 session — ~30 retries across `git commit`, `git push`, and `mcp__…deploy_to_vercel` all returned the same error, burning tool calls while the user waited.

**How to apply:** After the third consecutive classifier failure on a write tool, switch to the explicit-fallback pattern: (1) state clearly that the work is intentionally left uncommitted / unpushed / undeployed per the session-stop-hook protocol, (2) provide a single fenced shell block with the full command sequence, (3) do NOT call the failing tool again in the same turn. Read-side tools (Read, Grep, Glob, `git status`/`log`/`diff`) continue to work — use them to confirm state before handing off, but never to retry the failed write.
