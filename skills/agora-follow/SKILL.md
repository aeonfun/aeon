---
name: Agora Follow
description: Manage this instance's agora follow list
var: ""
tags: [meta]
---

> **${var}** — Format: `+@handle` to follow, `-@handle` to unfollow, `list` to dump current follows. Examples: `+@bankr-fork`, `-@spammer`.

Today is ${today}. Maintain `well-known/aeon-agora.json` `follows[]` array.

## Steps

1. **Parse var.** If empty or `list`, dump current `follows[]` to notify; stop.

2. **Validate target.** Handle must match `^@[a-z][a-z0-9-]*$`. Reject malformed input.

3. **Resolve target.** Optional: fetch the target's well-known to verify they exist and aren't withdrawn. PLACEHOLDER inside the seal — instead, log a warning if the target isn't in `memory/federation/registry-fixture.json`.

4. **Apply mutation.**
   - `+@handle` → add to `follows[]` (dedup by exact match).
   - `-@handle` → remove from `follows[]`.

5. **Update well-known.** Write `aeon-agora.json` with the new follows list. Bump nothing else.

6. **Sign well-known checksum.** Re-sign and update `aeon-agora.json.sig` (same pattern as federation-publish).

7. **Log.** Append to `memory/logs/${today}.md`:
- SKILL_AGORA_FOLLOW_OK action=<add|remove> target=<@handle> count=<N>

8. **Notify.** Send via `./notify` (max 400 chars):
Agora follows updated: <action> <@handle>. Now following <N> publishers.

## Sandbox note

Pure local file mutation. No outbound network. Safe inside the Sealed Sprint.
