---
name: VVVKernel Query
description: Query any VVVKernel Venice AI expert — onchain, audit, growth, brand, narrative, community, or tier-design
var: "onchain: what are the best yield strategies on Base right now?"
tags: [crypto, research]
---

# VVVKernel Query

Route a query to the appropriate VVVKernel Venice AI expert and return the response.

## Input

`$var` format: `<expert>: <query>`

Supported experts: `onchain` · `audit` · `growth` · `brand` · `narrative` · `community` · `tier-design`

If no expert prefix is given, default to `onchain`.

## Steps

1. Parse `$var` to extract expert role and query text
2. Call VVVKernel MCP via WebFetch:

```
POST https://vvvkernel.com/api/agent/chat
Content-Type: application/json

{
  "message": "<query>",
  "expert_role": "<expert>"
}
```

3. If response is 402, note insufficient balance and notify
4. Extract `response` field from JSON
5. Format output as markdown with expert label
6. Save to `memory/vvvkernel-last.md`
7. Notify with first 280 chars of response

## Output format

```
## VVVKernel · <Expert> Expert

<response>

---
_via Venice AI · x402 · Base_
```

## Sandbox note

Calls `vvvkernel.com` — live API, x402 payments deducted automatically from configured wallet. No fallback if balance is zero.
