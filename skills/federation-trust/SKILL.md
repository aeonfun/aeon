---
name: Federation Trust
description: Manage the operator's allowlist of trusted federated publishers
var: ""
tags: [meta]
---

> **${var}** — Format: `+@publisher[/skill]` to authorize, `-@publisher[/skill]` to revoke, `list` to dump current state. Examples: `+@bankr` (trust all bankr skills), `+@reg-terminal/regulatory-risk` (trust one skill), `-@bad-actor` (revoke).

Today is ${today}. Maintain the operator's federation allowlist in `memory/federation/authorized.json`.

## Steps

1. **Parse var.** If empty or `list`, dump current allowlist to notify; stop.

2. **Load state.** Read `memory/federation/authorized.json` (create empty `{ "publishers": {} }` if absent).

3. **Apply mutation.**
   - `+@publisher` → add publisher with `all_skills: true`.
   - `+@publisher/skill` → ensure publisher entry exists with `all_skills: false`; add skill to `authorized_skills`.
   - `-@publisher` → remove the publisher entry entirely.
   - `-@publisher/skill` → remove just the skill from `authorized_skills`; if list becomes empty and `all_skills: false`, remove the publisher.

4. **Refresh from registry.** For any newly-authorized publisher, fetch their current well-known manifest (via `federation-call` infrastructure or by reading from `memory/federation/registry.json`) to verify their `publisher_key` and skill set. Record key fingerprint in the allowlist entry.

5. **Log.** Append to `memory/logs/${today}.md`:
- SKILL_FEDERATION_TRUST_OK action=<add|revoke> target=<publisher[/skill]>

6. **Notify.** Send via `./notify` (max 600 chars):
Federation trust: <action> <target>. Current allowlist: <N> publishers.

## Sandbox note

Pure local file mutation. No outbound network even when fully active. The skill is safe to run inside the Sealed Sprint; nothing leaves the working tree.
