---
name: VVVKernel Growth
description: Weekly growth analysis — monitor project metrics, holder counts, social sentiment, and get actionable growth recommendations via Venice AI
var: ""
tags: [crypto, research]
---

# VVVKernel Growth

Run a weekly growth analysis for a crypto project using VVVKernel's Growth Expert on Venice AI.

## Input

Reads project config from `memory/project-context.md`. Must include at minimum:
- Token contract address
- Project name
- Twitter/X handle (optional)
- Key metric goals (optional)

## Steps

1. Read `memory/project-context.md` — abort with notify if missing

2. Fetch on-chain metrics via WebFetch:
   - Holder count: `https://api.basescan.org/api?module=token&action=tokenholderlist&contractaddress=<CA>&page=1&offset=1`
   - Recent transfers count (last 7 days)

3. Fetch social metrics if Twitter handle available:
   - Search recent mentions via WebSearch: `"<project>" site:x.com since:$yesterday`

4. Build growth brief:

```
POST https://vvvkernel.com/api/agent/chat
Content-Type: application/json

{
  "message": "You are a crypto growth strategist. Analyze the following data for <project> and provide: (1) key growth observations this week, (2) top 3 actionable growth moves for next 7 days, (3) community/narrative opportunities to exploit, (4) any risks to growth momentum. Data: <metrics>",
  "expert_role": "growth"
}
```

5. Structure output into sections

6. Compare with last week's report at `memory/growth-last-week.md` if exists — flag improvements or declines

7. Save to `memory/growth-$today.md`
   Copy to `memory/growth-last-week.md` (overwrite)

8. Notify with top 3 actions

9. Log:
   ```
   $today | growth-analysis | holders:<n> | done
   ```

## Output format

```
# Growth Report · $today
**Project:** <name>

## 📈 This Week
<observations>

## 🎯 Top 3 Actions (Next 7 Days)
1. <action>
2. <action>
3. <action>

## 💬 Narrative Opportunities
<opportunities>

## ⚠️ Risks
<risks>

---
_VVVKernel Growth Expert · Venice AI_
```

## Sandbox note

Calls Basescan API (read-only), WebSearch, and `vvvkernel.com`. Designed for weekly schedule: `0 9 * * 1` (Monday 9am).
