---
name: VVVKernel Morning Brief
description: Daily AI-powered morning brief — onchain intel, growth pulse, and one narrative action item, all via Venice AI private inference
var: ""
tags: [crypto, productivity]
---

# VVVKernel Morning Brief

A single daily brief combining onchain intelligence + growth pulse + one narrative action. Runs every morning. No approval needed.

## Steps

1. Read project context from `memory/project-context.md` if exists

2. Run three parallel Venice queries:

**Query A — Onchain:**
```
POST https://vvvkernel.com/api/agent/chat
{
  "message": "Today is $today. Give me 3 bullet points: most important onchain event on Base today, one DeFi yield opportunity, one risk to watch. Be specific.",
  "expert_role": "onchain"
}
```

**Query B — Growth:**
```
POST https://vvvkernel.com/api/agent/chat
{
  "message": "Today is $today. What is the single highest-leverage growth action a crypto project should take today? One sentence, actionable, crypto-native.",
  "expert_role": "growth"
}
```

**Query C — Narrative:**
```
POST https://vvvkernel.com/api/agent/chat
{
  "message": "Today is $today. Give me one tweet-length narrative move a crypto project can make today that would resonate with the current market mood. Max 240 chars.",
  "expert_role": "narrative"
}
```

3. Combine into unified brief

4. Save to `memory/brief-$today.md`

5. Notify with full brief

6. Log:
   ```
   $today | morning-brief | done
   ```

## Output format

```
# Morning Brief · $today

## ⛓ Onchain
• <point 1>
• <point 2>
• <point 3>

## 📈 Growth Move
<one actionable sentence>

## 📢 Narrative
"<tweet-length content>"

---
_VVVKernel · Venice AI · private · Base_
```

## Sandbox note

Three sequential calls to `vvvkernel.com` — 3 queries deducted (daily or USDC). Total cost: 0.03 USDC or 3 daily queries. Designed for daily schedule: `0 7 * * *`.
