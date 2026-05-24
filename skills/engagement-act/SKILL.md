---
name: Engagement Act
description: Turn flagged engagement opportunities into ready-to-post replies — read recent logs, draft specific responses, send as copy-paste-ready output
schedule: "30 9 * * *"
commits: false
permissions: []
tags: [social, meta]
---

Read memory/MEMORY.md for context on active projects and open engagement follow-ups.
Read the last 7 days of memory/logs/ — look for engagement opportunities flagged by other skills (e.g. project-pulse, refresh-x, reply-maker, channel-recap) or noted in MEMORY.md Known Follow-ups.

Projects-of-interest list: if `memory/topics/projects-of-interest.md` exists, treat the project names listed there as the things to watch for mentions, cosigns, attributions, and fork moments. If the file is missing or empty, fall back to any project names that appear in recent logs or in MEMORY.md.

## Steps

1. **Collect unactioned engagement opportunities.** Read `memory/logs/` for the last 7 days.
   Look for:
   - Log entries flagging engagement opps (e.g. "Engagement opps: N flagged" with N > 0) — extract the named handles/accounts
   - Any person who cosigned, mentioned, or attributed one of the operator's projects-of-interest
   - GitHub attribution or fork moments not yet acknowledged
   - Entries in MEMORY.md "Known Follow-ups" explicitly flagging engagement opps
   - Cosigns or mentions surfaced in refresh-x, reply-maker, or channel-recap runs

   Build a list: `{ person/account, context, what_they_did, link_if_known, days_ago }`

2. **Filter and prioritize.** Apply these rules:
   - Drop any opp older than 14 days — window is likely closed
   - De-dupe: skip opps where recent logs already show "replied to @X" or "acknowledged" for that handle
   - Rank by: recency (fresher first) × leverage (high-follower or influential account first)
   - Cap at 5 opportunities

3. **Draft ready-to-post responses.** For each opportunity:
   - **Type**: X reply / X DM / GitHub comment / X post
   - **Target**: @handle or URL
   - **Draft text**: exact text, ready to copy-paste
   - Keep under 280 chars for X replies; longer is fine for DMs or GitHub comments
   - Voice: if `soul/SOUL.md` and `soul/STYLE.md` are populated, match that voice; otherwise use a clear, direct, neutral tone. Either way: acknowledge without groveling, no "thanks so much for the kind words!" — just the actual response.

4. **Check for staleness.** If any opportunity is 5+ days old, prepend `aging` to that entry in the output.

5. **Skip if empty.** If after filtering there are zero unactioned opps, log `ENGAGEMENT_ACT_SKIP: no unactioned opps` and exit without sending a notification.

6. **Write output to a temp file, then send via `./notify -f`**:
   ```
   *Engagement Act — ${today}*

   *1. @handle* (N days ago) — [one-line summary of what they did]
   link: [URL or "no link found"]
   type: [X reply / X post / DM / GitHub comment]
   draft: "[ready-to-post text]"

   *2. @handle* ...

   [if any opps are 5+ days old:]
   some opps aging — act or drop
   ```
   Write this to `/tmp/engagement-act-output.md` then run `./notify -f /tmp/engagement-act-output.md`.

7. **Log to memory/logs/${today}.md**:
   ```
   ## Engagement Act
   - **Opps found:** N unactioned (scanned last 7 days of logs)
   - **Drafted:** N responses
   - **Handles:** @handle1, @handle2, ...
   - **Notification sent:** yes
   - ENGAGEMENT_ACT_OK
   ```
   If skipped: `ENGAGEMENT_ACT_SKIP: <reason>`

## Sandbox Note

Reads only local memory files. No outbound network calls needed — no curl, no API.
`./notify -f` handles delivery reliably even when sandbox blocks curl (writes to `.pending-notify/` as fallback).

## No Environment Variables Required

Uses only built-in memory files and `./notify`.
