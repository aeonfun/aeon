---
name: VVVKernel Audit
description: Security review of a smart contract, repo URL, or code snippet via Venice AI Audit Expert — flags vulnerabilities, logic errors, and attack vectors
var: "https://github.com/owner/repo"
tags: [crypto, dev]
---

# VVVKernel Audit

Run a security audit on a smart contract or code using VVVKernel's Audit Expert on Venice AI.

## Input

`$var` can be:
- A GitHub URL (repo or specific file)
- A contract address on Base (`0x...`)
- A raw code snippet (paste directly)

## Steps

1. Determine input type from `$var`:
   - If starts with `https://github.com` → fetch raw file content via WebFetch
   - If starts with `0x` and is 42 chars → fetch contract source from Basescan API: `https://api.basescan.org/api?module=contract&action=getsourcecode&address=$var`
   - Otherwise → treat as raw code

2. If content exceeds 8000 chars, chunk into logical sections (by contract/file)

3. For each chunk, call VVVKernel:

```
POST https://vvvkernel.com/api/agent/chat
Content-Type: application/json

{
  "message": "You are a senior smart contract auditor. Review the following code for: (1) reentrancy vulnerabilities, (2) access control issues, (3) integer overflow/underflow, (4) front-running risks, (5) logic errors, (6) centralization risks, (7) any other critical or high severity findings. For each finding include: severity (CRITICAL/HIGH/MEDIUM/LOW/INFO), location (function/line), description, and recommended fix.\n\nCode:\n<content>",
  "expert_role": "audit"
}
```

4. Aggregate findings across chunks

5. Deduplicate and rank by severity: CRITICAL → HIGH → MEDIUM → LOW → INFO

6. Save full audit to `memory/audit-$today.md`

7. If any CRITICAL or HIGH findings → notify immediately with finding summary

8. Log to `memory/audit-log.md`:
   ```
   $today | $var | CRITICAL:<n> HIGH:<n> MEDIUM:<n>
   ```

## Output format

```
# Audit Report · $today
**Target:** $var

## Summary
- 🔴 Critical: <n>
- 🟠 High: <n>
- 🟡 Medium: <n>
- 🟢 Low: <n>
- ℹ️ Info: <n>

## Findings

### [CRITICAL] <title>
**Location:** <function/line>
**Description:** <description>
**Fix:** <recommendation>

### [HIGH] <title>
...

---
_VVVKernel Audit Expert · Venice AI · private inference_
```

## Sandbox note

Calls Basescan API (read-only, no key needed for source fetch) and `vvvkernel.com`. Multiple chunks = multiple x402 payments. Estimate 1 USDC per 10k lines of code.
