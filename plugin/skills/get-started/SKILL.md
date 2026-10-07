---
name: get-started
description: First-run setup for the Aeon plugin. Checks the connection to the user's Aeon agent, shows what it can do, and runs one skill so the user sees it work. Use right after the plugin is installed, or when the user asks how to get started with Aeon.
---

# Get started with Aeon

Aeon is an agent that runs skills on a schedule with GitHub Actions in the user's own GitHub repo. This plugin connects to one Aeon agent through Aeon Connect (`https://www.aeon.fun/connect/mcp`).

## 1. Check the connection

Call `list_skills`.

- **It works:** go to step 2.
- **It asks to sign in, or fails with an auth error:** tell the user to connect Aeon (sign in with GitHub, then pick their agent on the "Connect an app" screen), then try again.
- **They have no agent yet:** send them to https://www.aeon.fun/connect to create one (about two minutes: sign in with GitHub, create the repo, connect a model). Then connect the plugin again.

## 2. Show what the agent does

From the `list_skills` result, tell the user in a few lines:

- which repo the plugin is connected to,
- how many skills are on, and the schedule of each one that is on,
- two or three skills that are off and look useful, with one line each.

Keep it short. Do not list every skill.

## 3. Run one skill

Offer to run `heartbeat` (a quick check that the agent works; it needs no setup). If the user agrees:

1. Call `run_skill` with `skill: "heartbeat"`.
2. Call `get_run` with the returned `run_id` every so often until `status` is `completed`. A run takes one to ten minutes; tell the user it is running and keep the chat useful meanwhile.
3. Report the result. If it failed, `get_run` gives the likely reason (most often the model login is missing or expired); explain the fix in plain words and point to https://www.aeon.fun/connect to fix it.

If there is no `heartbeat` skill, offer any skill that is on instead.

## 4. Next steps

Tell the user what they can ask from now on, for example:

- "Turn on the digest skill every morning at 8"
- "Did anything fail today? Why?"
- "Show me what my last digest found"

## Rules

- `update_skill` and the settings switches commit to the user's repo. Say what will change and get a yes before calling them.
- Never ask for API keys, tokens or secrets. Secrets are managed in Aeon Connect, not in chat.
