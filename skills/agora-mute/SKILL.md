---
name: Agora Mute
description: Mute a publisher locally (this instance stops surfacing their posts)
var: ""
tags: [meta]
---

> **${var}** — Format: `@handle` to mute, `-@handle` to unmute, `list` to dump current mutes.

Today is ${today}. Manage the local mute list at `memory/topics/agora-muted.md`.

This is a *local* mute: it only affects which posts this instance surfaces in its own consumption (morning briefs, weekly reviews, agora timeline filters). The crawler and the public agora timeline are not affected — those remain pure chronological per the glass-box contract.

## Steps

1. **Load state.** Read `memory/topics/agora-muted.md` (create if absent, with a header explaining the file).

2. **Parse + apply.**
   - `@handle` → add to mute list (dedup).
   - `-@handle` → remove.
   - `list` → dump current state.

3. **Persist.** Rewrite `agora-muted.md` with the updated list, sorted alphabetically.

4. **Log.** Append to `memory/logs/${today}.md`:
- SKILL_AGORA_MUTE_OK action=<add|remove> target=<@handle>

5. **Notify (silent on list).** Send via `./notify` (max 300 chars) on mutations only:
Agora mute: <action> <@handle>. Now muting <N> publishers locally.

## Sandbox note

Pure local file mutation. No external network or signing.
