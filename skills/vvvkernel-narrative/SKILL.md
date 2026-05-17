---
name: VVVKernel Narrative
description: Generate tweets, threads, announcements, or long-form content for a crypto project using Venice AI Narrative Expert — private, no logs
var: "write a launch announcement thread for a new Base DeFi protocol"
tags: [social, crypto]
---

# VVVKernel Narrative

Generate polished content for a crypto project using VVVKernel's Narrative Expert on Venice AI.

## Input

`$var` is a content brief. Examples:
- `"write a launch announcement thread for <project>"`
- `"draft a whitepaper intro for <concept>"`
- `"write 5 tweet variations announcing <feature>"`
- `"create a Farcaster post about <milestone>"`

If project context exists at `memory/project-context.md`, prepend it automatically.

## Steps

1. Check for project context: `memory/project-context.md`
   - If exists, read it (max 2000 chars)
   - If not, proceed without it

2. Build enriched prompt:
   ```
   Context: <project-context if available>
   
   Task: $var
   
   Requirements:
   - Crypto-native tone, not corporate
   - Specific and direct — no vague buzzwords
   - If thread: number tweets, max 280 chars each
   - If announcement: punchy opening line, clear CTA at end
   - If long-form: structured with headers, technical where appropriate
   ```

3. Call VVVKernel:

```
POST https://vvvkernel.com/api/agent/chat
Content-Type: application/json

{
  "message": "<enriched prompt>",
  "expert_role": "narrative"
}
```

4. Parse and format output by content type detected:
   - Thread → number each tweet, show char count
   - Announcement → single block
   - Long-form → preserve headers

5. Save to `memory/narrative-$today.md`

6. Notify: "Narrative ready: <first line of output>"

7. Log to `memory/narrative-log.md`:
   ```
   $today | <first 60 chars of $var> | done
   ```

## Output format

```
# Narrative Output · $today
**Brief:** $var

---

<formatted content>

---
_VVVKernel Narrative Expert · Venice AI · private inference_
```

## Sandbox note

Single call to `vvvkernel.com`. All content generated privately — no prompt retention on Venice's infrastructure. 0.01 USDC per generation or 1 daily query from staking balance.
