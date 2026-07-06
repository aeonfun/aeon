---
type: Skill
name: Verdikta Hunter
category: crypto
description: Hunt Verdikta AI-judged bounties on Base — discover open bounties, write rubric-targeted reports, and queue hard-capped on-chain submissions (signing happens post-run via scripts/postprocess-verdikta.sh, never in-skill)
var: ""
tags: [crypto, bounties, base, verdikta, web3]
requires: [VERDIKTA_API_KEY, VERDIKTA_WALLET_KEY?]
capabilities: [external_api, writes_external_host, onchain_writes, sends_notifications]
---

> **${var}** — Mode selector.
> - `` (empty) → **discover + settle**: rank open bounties, notify a shortlist, and queue finalize for any prior submissions ready to claim. Never queues a new submission — zero new spend. *[default]*
> - `hunt` / `hunt:<jobId>` → discover + settle, then pick the best-fit bounty (or the given `<jobId>`), write the report, and queue one on-chain submission for post-run execution.
> - `dry-run` / `dry-run:<jobId>` → same as `hunt` but the queued request is validation-only: the postprocess script calls the API's `/submit/dry-run` and sends **no transactions**.

## Goal

Earn ETH from [Verdikta](https://bounties.verdikta.org) bounties on Base: open bounties carry an escrowed ETH reward and a public rubric; two independent AI models score each submission against the rubric, and a submission at or above the bounty's threshold wins the escrow. This skill does the judgment work — choosing bounties worth attempting and writing reports that score well — while all authed API calls and transaction signing happen outside the sandbox in `scripts/prefetch-verdikta.sh` (before the run) and `scripts/postprocess-verdikta.sh` (after the run).

## Config

| Name | Kind | Default | Purpose |
|------|------|---------|---------|
| `VERDIKTA_API_KEY` | secret | required | Bot API key (`X-Bot-API-Key`) from `POST https://bounties.verdikta.org/api/bots/register` |
| `VERDIKTA_WALLET_KEY` | secret | — | Private key of a **dedicated** Base hot wallet. Only needed to submit (`hunt`); discover/settle-only and `dry-run` work without it |
| `VERDIKTA_MAX_SPEND_ETH` | repo var | `0.0005` | **Hard client-side cap** on the ETH value of any single transaction the postprocess script will sign, regardless of what the API returns |
| `VERDIKTA_MAX_SUBMISSIONS_PER_DAY` | repo var | `5` | Daily cap on new submissions (tracked in `memory/state/verdikta-hunter.json`) |
| `VERDIKTA_RPC_URL` | repo var | `https://mainnet.base.org` | Base JSON-RPC endpoint |

### Fund safety — read before enabling

This skill can spend real ETH. The safety envelope, enforced by `scripts/postprocess-verdikta.sh` (not by the model, and not by the remote API):

- **Dedicated wallet only.** Fund a fresh wallet with a small working balance (~0.005 ETH covers gas plus several oracle prepays) and use its key as `VERDIKTA_WALLET_KEY`. Never reuse a wallet that holds anything you can't lose.
- **Hard spend cap.** The oracle prepay (`ethMaxBudget`) comes from the API response, so the script treats it as untrusted: any transaction whose value exceeds `VERDIKTA_MAX_SPEND_ETH` is refused and logged, never signed. The real-world worst-case prepay is ~0.00024 ETH, so the 0.0005 default has headroom without meaningful blast radius. The prepay is escrow, not a fee — the unspent portion is refunded at finalize.
- **Pinned destination.** Transactions are only signed if `to` equals the known BountyEscrow contract `0x2Ae271f5E86bee449a36B943414b7C1a7b39772D` and `chainId` is 8453 (Base). A compromised API response cannot redirect funds elsewhere.
- **Rate limits.** At most one new submission per run, at most `VERDIKTA_MAX_SUBMISSIONS_PER_DAY` per UTC day, and a balance preflight before every transaction.
- **Deferred execution.** The skill itself only writes request files under `.pending-verdikta/`; if the run errors, the workflow drops the queue and nothing is sent. Start with `dry-run` until you trust the loop.

## Steps

### 0. Parse `${var}` and load context

- Parse the mode: empty → `MODE=discover`; `hunt[:<jobId>]` → `MODE=hunt`; `dry-run[:<jobId>]` → `MODE=hunt` with `DRY_RUN=true`. A trailing `<jobId>` pins the target bounty.
- Read `memory/MEMORY.md` and the last ~3 days of `memory/logs/` (don't re-report signals already sent).
- Read `memory/state/verdikta-hunter.json` if present — it tracks prior submissions (`jobId`, `submissionId`, tx hashes, status, spend) and the daily submission count. Bootstrap mentally with `{"submissions": {}, "daily": {}}` if absent; the postprocess script owns writes to this file.
- Read the prefetched cache: `.verdikta-cache/bounties.json` (open bounties), `.verdikta-cache/rubric-<jobId>.json` (per-bounty rubrics), `.verdikta-cache/submissions-<jobId>.json` (status of bounties we've submitted to). If `.verdikta-cache/` is missing or empty, `VERDIKTA_API_KEY` isn't configured or the prefetch failed — notify `VERDIKTA_HUNTER_ERROR — no cache; check VERDIKTA_API_KEY and prefetch logs`, log, and stop.

### 1. Settle prior submissions (every mode)

For each tracked submission in state, check its current status in `.verdikta-cache/submissions-<jobId>.json`:

- `ACCEPTED_PENDING_CLAIM` or `REJECTED_PENDING_FINALIZATION` → queue a finalize: write `.pending-verdikta/finalize-<jobId>-<subId>.json` containing `{"action": "finalize", "jobId": <n>, "submissionId": <n>}`. Finalize is **mandatory even after a pass** — payment is not automatic, and it's what refunds the unspent oracle prepay after a fail.
- `PENDING_EVALUATION` for more than ~30 minutes (compare state's `submittedAt` to now) → the oracle may be stuck; note it in the report and log. Timeout recovery is intentionally not automated — flag it for the operator with the manual command: `POST /api/jobs/<jobId>/submissions/<subId>/timeout`.
- `APPROVED` (paid) or `REJECTED` (settled) since last run → include the outcome in the notification: score vs threshold, and the payout tx if won.

### 2. Discover and rank open bounties

From `.verdikta-cache/bounties.json`, drop bounties that are: already submitted to by our wallet (in state), past or within ~24h of their `submissionDeadline`, targeted at another hunter (`targetHunter` set and not us), or in a creator-approval window flow (`creatorAssessmentWindowSize > 0`) — windowed bounties are out of scope for v1.

Score the rest on: reward (`payoutWei`) vs. effort implied by the rubric, threshold attainability (lower threshold = easier), competition (`submissions` count), and fit with `STRATEGY.md` priorities and our actual capabilities — **skip bounties requiring work we can't genuinely deliver** (e.g. deliverables needing binary assets, human accounts, or off-repo actions). For each surviving candidate read `.verdikta-cache/rubric-<jobId>.json`: `must: true` criteria are binary gates (fail one = score 0); weighted criteria sum to 1.0.

- `MODE=discover`: notify the top 3–5 as a shortlist (jobId, reward in ETH, threshold, submissions count, one-line rubric summary, deadline), log, and stop. If nothing is worth attempting and nothing settled, stay silent — no empty reports.
- `MODE=hunt`: pick the single best candidate (or the pinned `<jobId>` — but still refuse it if it fails the drop-filters above, and say why). If the daily count in state already meets `VERDIKTA_MAX_SUBMISSIONS_PER_DAY`, fall back to discover behaviour and note the cap in the notification.

### 3. Write the report

Write the deliverable to `.pending-verdikta/files/<jobId>/report.md` (plus extra files alongside it only if the rubric explicitly demands separate deliverables).

- Address **every** rubric criterion, in rubric order, under explicit headings — the AI jurors score criterion-by-criterion. Treat `must: true` criteria as pass/fail gates and satisfy them beyond doubt.
- Embed all evidence inline in markdown: fenced code blocks for data/commands, full URLs for sources, tx hashes where relevant. Verifiable beats voluminous.
- **Never** produce archives (`.zip`/`.tar`/`.gz`/`.rar`) — the oracle drops them as binary and the models see nothing. Prefer markdown; each uploaded file is forwarded to the jurors individually.
- No placeholders, no "TODO", no fabricated claims — an unverified claim that fails a must-pass gate burns the prepay and the reputation.

### 4. Queue the submission

Write `.pending-verdikta/submit-<jobId>.json`:

```json
{
  "action": "submit",
  "jobId": 97,
  "files": ["report.md"],
  "addendum": "",
  "alpha": 200,
  "maxOracleFee": "0.00002",
  "estimatedBaseCost": "0.00001",
  "maxFeeBasedScaling": 3,
  "dryRun": false
}
```

- `files` are names under `.pending-verdikta/files/<jobId>/`.
- `alpha` 200 favours quality over timeliness (range 0–1000; lower = quality-weighted).
- Keep the fee parameters at these defaults — they bound the oracle prepay by construction; raising them raises `ethMaxBudget`.
- Set `"dryRun": true` when `DRY_RUN` — the postprocess script then only calls `/submit/dry-run` (file readability + rubric shape validation, no gas, no transactions).

The postprocess script executes this after the run: upload → `prepareSubmission` tx (value 0) → confirm → cap-check → `startPreparedSubmission` tx (value = `ethMaxBudget`), then records tx hashes, `submissionId`, and spend into `memory/state/verdikta-hunter.json` and appends a `### verdikta-hunter (postprocess)` entry to today's log. **This run cannot see those results** — the next run reports them (step 1).

### 5. Notify

One `./notify -f` message per run with real signal, following soul/ voice if present. Write the message body to `.verdikta-cache/notify.md` (gitignored and regenerated each run — the harness can't `rm`, so scratch files anywhere else end up auto-committed):

- Settlements first: won (score, payout), lost (score vs threshold, one-line diagnosis from `.verdikta-cache/` evaluation data if available), finalizes queued.
- Then the action taken: shortlist (discover), or "queued submission to #<jobId> (<reward> ETH, threshold <t>%) — pending postprocess" (hunt), or dry-run verdict.
- Severity: `success` for a win, `warn` for a stuck/failed submission or refused cap, `info` otherwise.
- Nothing settled and nothing worth attempting → no notification.

### 6. Log

Append to `memory/logs/YYYY-MM-DD.md`:

```
### verdikta-hunter
- Mode: discover | hunt | dry-run
- Open bounties: N (M viable after filters)
- Settled: #97/0 finalize queued | #95/1 WON 0.002 ETH | none
- Queued: submit-97 (0.0015 ETH reward, threshold 80) | none
- Skipped: #98 (deadline <24h), #99 (windowed) — one line, only when relevant
- Notification sent: yes/no
```

## Key gotchas

1. **Always finalize.** Without `finalizeSubmission` the oracle prepay stays escrowed forever — even a winning submission isn't paid until finalize.
2. **`ethMaxBudget` is wei and comes from the API** (`/submit/bundle/complete` → `parsed.ethMaxBudget`). Never hand-decode the `SubmissionPrepared` event with a partial ABI — the budget is the *last* field after a dynamic string, and a truncated ABI reads the string-offset word (96) instead.
3. **must-pass criteria are binary.** `must: true` always has weight 0; failing any one scores the whole submission 0.
4. **Archives are invisible.** `.zip` and friends are dropped by the oracle pipeline; submit individual readable files.
5. **Two-model jury.** Independent AI models score and their weighted results are combined — write for a careful, literal reader, not for keyword-matching.
6. **The confirm call matters.** `POST /api/jobs/:id/submissions/confirm` (between prepare and start) registers the submission for backend tracking; the postprocess script does it — if you ever drive the flow manually, don't skip it.
7. **API statuses lag chain state** by a sync cycle. `GET /api/jobs/:id/onchain-status` is the ground truth when they disagree.
8. **Images cause 100% oracle timeout.** `.jpg`, `.png`, `.webp` — the oracle cannot process them. Submit only text/markdown/PDF/code. Embed screenshots as base64 in markdown or convert to PDF if needed. Verified: 3 consecutive timeouts with images, immediate success with markdown-only.
9. **Separate `.json` files also cause issues.** The oracle treats them as binary (same as images). Embed JSON data inline in fenced code blocks within the markdown report. Verified: submission with `report.md` + `raw_data.json` scored 0.
10. **Oracle intermittency is real.** Same report can score differently on retry due to different oracle node assignment. If a submission times out with NO images included, the fix is retry, not rewrite. Check `GET /api/jobs/admin/stuck` before submitting.
11. **Gas limits per TX type.** `prepareSubmission`: 1M/5gwei. `startPreparedSubmission`: 4M/0.5-5gwei. `finalizeSubmission`: 300K/5gwei. `failTimedOutSubmission`: 2M/**10gwei minimum** (5 gwei causes revert — verified 3 consecutive failures at 5 gwei, immediate success at 10 gwei).
12. **Balance preflight is mandatory.** Formula: `balance >= ethMaxBudget + (gas_limit * gas_price)`. If tight, reduce gas price — 0.5 gwei worked when 5 gwei caused insufficient funds.
13. **Never finalize already-finalized submissions.** Check `GET /api/jobs/:id/submissions` for status BEFORE sending finalize TXs. Reverts consume gas with zero benefit.
14. **Never send timeout TX without on-chain verification.** The API's `canTimeout` can return `true` while the contract rejects. Always simulate with `eth_call` first, wait 15+ minutes, then send at 10 gwei.
15. **Claude model name bug on some bounties.** Some creators set `claude-opus-4.6` (dot) but Anthropic expects `claude-opus-4-6` (dash). Causes 404 "model not found" — only GPT evaluates. Not fixable from hunter side.
16. **API calldata encoding bug (intermittent).** The `/submit/bundle` endpoint can return calldata with incorrect ABI encoding (extra bytes). Always compare API calldata length vs manual encoding. If different, use manual encoding with `eth_abi.encode()`.
17. **`hashlib.sha3_256` is NOT `keccak256`.** Python's `hashlib.sha3_256` produces NIST SHA3-256, which gives different output than Ethereum's keccak256. Always use `from Crypto.Hash import keccak` for function selectors.
18. **Evaluation endpoint can return binary data.** On some submissions, `GET /evaluation` returns a Buffer (byte array starting with `PK`) instead of JSON. Use the submissions list endpoint for scores instead.
19. **Windowed vs oracle-evaluated bounties.** Bounties with `creatorApproval: true` use direct creator review, not oracle consensus. They skip oracle prepay but may take longer. Detect via `creatorAssessmentWindowSize > 0`.
20. **WINNER status means bounty awarded.** When `GET /submissions` shows `status=WINNER`, the payout was processed. No need to finalize — check `awardTxHash` for payment proof.
21. **Base L2 RPC limitations.** `base.publicnode.com` — no archive requests. `1rpc.io/base` — limits `eth_getLogs` to 50 blocks. Use `base.blockscout.com` API for transaction history.
22. **Precision matters for `no_fabrication` bounties.** When breaking down categories, be EXACT. "87 solo bounties" is wrong if 10 have zero submissions and 77 have one hunter. Write "10 zero-submission + 77 one-hunter = 87 non-competitive."
23. **GPT-5.2 consistently scores lower** than Claude (~5-10% gap). Novel Research is GPT's biggest weakness (anonymous/unverifiable sources = penalty). Named, verifiable sources are critical for GPT.
24. **Clean submission files — no "meta" sections.** The oracle reads EVERYTHING as content. Sections like "Requirement Checklist" or "Proof Note" are interpreted as part of the deliverable. Words like "error", "failed" in meta sections can reduce quality scores.
25. **On-chain finalize can fail repeatedly.** The website's "Claim" button can succeed when on-chain finalize keeps reverting (verified: 3 failed on-chain attempts, 1 manual website claim = WINNER).

## API Reference

All endpoints at `https://bounties.verdikta.org/api` with header `X-Bot-API-Key: <key>`.

### Bounty Discovery

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/jobs?status=OPEN&limit=30` | GET | List open bounties with submission counts |
| `/jobs/<jobId>` | GET | Single bounty detail — 26 fields including `awardTxHash` |
| `/jobs/<jobId>/rubric` | GET | Rubric with weighted criteria + must-pass flags |
| `/jobs/<jobId>/evaluation-package` | GET | Full evaluation prompt sent to arbiters |
| `/jobs/admin/stuck` | GET | Submissions stuck in PENDING_EVALUATION (oracle health) |

### Submission Flow

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/jobs/<jobId>/submit/bundle` | POST | Upload files + get step 1 calldata |
| `/jobs/<jobId>/submit/bundle/complete` | POST | After step 1 TX — returns `ethMaxBudget` + step 2/3 calldata |
| `/jobs/<jobId>/submissions/confirm` | POST | **Required** between prepare and start |
| `/jobs/<jobId>/submissions` | GET | Status array per bounty |
| `/jobs/<jobId>/submissions/<subId>/evaluation` | GET | Per-model scores + justification |

### Response Shapes

```json
GET /jobs -> {success, jobs[], total, limit, offset}
GET /jobs/:id -> {success, job{...26 fields, submissions[{...23 fields}]}}
POST /submit/bundle -> {success, hunterCid, transactions[{to, data, value, chainId, gasLimit}]}
POST /submit/bundle/complete -> {success, parsed:{submissionId, evalWallet, ethMaxBudget}, transactions:[3]}
```

## On-Chain Submission Flow

3 transactions on Base (chainId 8453):

### Step 1: `prepareSubmission` (gas only, no value)

```
Selector: 0xfae4a73d | Gas: 1M / 5 gwei
```

Creates submission record. Parse `SubmissionPrepared` event: topics[1]=bountyId, topics[2]=submissionId, topics[3]=hunter.

### Step 2: `startPreparedSubmission` (value = ethMaxBudget)

```
Selector: 0xcb493514 | Gas: 4M / 0.5-5 gwei
```

Triggers oracle. Value from API's `parsed.ethMaxBudget` (wei). Balance check: `balance >= ethMaxBudget + (gas * gasPrice)`.

### Step 3: `finalizeSubmission` (gas only, no value)

```
Selector: 0x1485eb7a | Gas: 300K / 5 gwei
```

Claims reward or refunds escrow. **Mandatory** — escrow stays locked without this.

### Signing Pattern

```python
from eth_account import Account
from eth_abi import encode
from Crypto.Hash import keccak

k = keccak.new(digest_bits=256)
k.update(b"prepareSubmission(uint256,string,string,string,uint256,uint256,uint256,uint256)")
selector = bytes.fromhex(k.hexdigest()[:8])
encoded = encode(
    ['uint256', 'string', 'string', 'string', 'uint256', 'uint256', 'uint256', 'uint256'],
    [bounty_id, eval_cid, hunter_cid, addendum, alpha, max_oracle_fee, est_base_cost, max_fee_scaling]
)
calldata = selector + encoded
```

**Pitfall**: `hashlib.sha3_256` is NOT `keccak256`. Always use `from Crypto.Hash import keccak`.

## Sandbox note

The GitHub Actions sandbox blocks secret-bearing outbound calls from the skill itself, so this skill never talks to `bounties.verdikta.org` or signs anything directly:

- **Pre-fetch:** `scripts/prefetch-verdikta.sh` runs before the skill with full env access and caches open bounties, rubrics, and tracked-submission statuses into `.verdikta-cache/`.
- **Post-process:** the skill queues requests in `.pending-verdikta/`; `scripts/postprocess-verdikta.sh` runs after a **successful** run and performs the authed uploads plus the cap-checked signing/broadcast. A failed run drops the queue.
- Public reads that need no auth (e.g. spot-checking a bounty page) may use WebFetch, which bypasses the sandbox. Don't use curl for them.

## Exit codes

- `VERDIKTA_HUNTER_OK` — ran clean (shortlist, queue written, or silent no-op)
- `VERDIKTA_HUNTER_DRY_RUN` — dry-run queued, no transactions will be sent
- `VERDIKTA_HUNTER_CAPPED` — daily submission cap reached; fell back to discover
- `VERDIKTA_HUNTER_ERROR` — missing cache/key or malformed state; notified
