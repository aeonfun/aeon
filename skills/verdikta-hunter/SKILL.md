---
name: Verdikta Hunter
category: crypto
description: Hunt, evaluate, and submit to Verdikta AI bounties on Base blockchain — autonomous bounty discovery, report generation, and on-chain submission
var: ""
tags: [crypto, bounties, base, verdikta, web3]
requires: [VERDIKTA_API_KEY, BASE_WALLET_KEY]
---

## Goal

Automate the full Verdikta bounty hunting lifecycle: discover open bounties, evaluate rubrics, generate high-scoring reports, and submit on-chain with proper gas management.

## When to Use

- User asks to "check verdikta", "hunt bounties", or "submit to verdikta"
- Scheduled cron job for autonomous bounty monitoring
- User wants to earn ETH by completing AI-evaluated bounties on Base

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `VERDIKTA_API_KEY` | Bot API key from bounties.verdikta.org | Required |
| `BASE_WALLET_KEY` | Private key for Base L2 wallet (0x...) | Required |
| `BOUNTY_IDS` | Specific bounty IDs to target | Auto-discover open |
| `MIN_THRESHOLD` | Minimum score threshold to attempt | 75 |
| `MAX_GAS_GWEI` | Max gas price for submissions | 5 |
| `ALPHA` | Quality vs timeliness (lower = quality) | 200 |

## Outputs

- Bounty submission with on-chain TX hash
- Evaluation score and status
- ETH earnings to wallet

## Steps

### 1. Discover Open Bounties

```python
from verdikta_api import list_open_bounties, get_rubric

bounties = list_open_bounties(api_key)
for b in bounties:
    rubric = get_rubric(api_key, b["jobId"])
    print(f"#{b['jobId']} | {b['bountyAmount']} ETH | threshold: {b['threshold']}%")
    for c in rubric["criteria"]:
        must = "MUST-PASS" if c.get("must") else f"weight {c.get('weight')}"
        print(f"  [{must}] {c['id']}: {c['description'][:80]}")
```

### 2. Generate Report

Write a markdown report addressing every rubric criterion. For `must: true` criteria, these are binary gates — fail one = score 0.

**Critical rules:**
- NO images (.jpg/.png/.webp) — causes oracle timeout 100%
- NO .json files — oracle treats as binary
- Embed all raw data INLINE in markdown using fenced code blocks
- Include verifiable evidence: TX hashes, API responses, curl commands

### 3. Submit On-Chain

```python
from verdikta_onchain import submit_bounty

result = submit_bounty(
    api_key=api_key,
    priv_key=wallet_key,
    bounty_id=bounty_id,
    report_path="report.md",
    alpha=200,
    max_oracle_fee_wei=300000000000000,  # 0.0003 ETH
)
print(f"Submission ID: {result['submission_id']}")
print(f"TX Hash: {result['tx_hash']}")
```

### 4. Monitor and Finalize

```python
from verdikta_onchain import check_status, finalize_submission

status = check_status(api_key, bounty_id, submission_id)
if status == "EVALUATED_PASSED":
    finalize_submission(priv_key, bounty_id, submission_id)
elif status == "EVALUATED_FAILED":
    finalize_submission(priv_key, bounty_id, submission_id)  # reclaim ETH
```

## Key Gotchas

1. **Confirm step is MANDATORY** — between prepareSubmission and startPreparedSubmission, you MUST call `POST /api/jobs/:id/submissions/confirm`. Without it, the oracle never picks up the submission.

2. **ethMaxBudget is in WEI** — not ETH. 0.0036 ETH = 3600000000000000 wei.

3. **No .zip or .json files** — oracle treats them as binary. Embed data inline in markdown.

4. **Images cause ORACLE_TIMEOUT** — 100% failure rate. Use text/markdown/PDF only.

5. **must:true criteria are binary gates** — weight is always 0, but failing any = score 0.

6. **Always finalize** — without step 3, oracle prepay (~0.0036 ETH) stays escrowed forever.

7. **Gas limits matter** — prepareSubmission: 1M, startPreparedSubmission: 4M, finalizeSubmission: 300K.

8. **Check balance before TX** — need: ethMaxBudget + (gas_limit × gas_price). If low, reduce gas price.

9. **Two-model evaluation** — GPT-5.2 and Claude both evaluate. Final score = average of both weighted scores.

10. **API calldata may be buggy** — always compare API-returned calldata length vs manual encoding. Use API calldata when lengths match.

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/jobs?status=OPEN` | GET | List open bounties |
| `/api/jobs/:id` | GET | Bounty detail |
| `/api/jobs/:id/rubric` | GET | Evaluation rubric |
| `/api/jobs/:id/submit/bundle` | POST | Upload + prepare (bundle) |
| `/api/jobs/:id/submit/bundle/complete` | POST | Get step 2 calldata |
| `/api/jobs/:id/submissions/confirm` | POST | Confirm submission |
| `/api/jobs/:id/submissions` | GET | Check submission status |
| `/api/jobs/:id/submissions/:subId/evaluation` | GET | Get evaluation report |

Auth: `X-Bot-API-Key: YOUR_KEY` header
Chain: Base L2 (chainId 8453)
Contract: `0x2Ae271f5E86bee449a36B943414b7C1a7b39772D`
