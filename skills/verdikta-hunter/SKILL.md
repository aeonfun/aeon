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
8. **Images cause ORACLE_TIMEOUT — every time.** Including `.jpg`, `.png`, or `.webp` files causes the oracle to time out with score 0 — it cannot process them. Submit only text/markdown/PDF/code. Embed screenshots as base64 in markdown or convert to PDF if needed. Verified: 3 consecutive timeouts with images, immediate success with markdown-only.
9. **Separate `.json` files also cause issues.** The oracle treats `.json` as binary data (same as images). Embed raw data inline using fenced code blocks within the markdown report. Verified: submission with `report.md` + a separate `raw_data.json` scored 0.
10. **`ethMaxBudget` is a STRING, not an integer.** The API returns it as a decimal string (e.g. `"240000000000000"`). Always `int()` it before comparison.
11. **Windowed (creator-approval) bounties are out of scope for v1.** These have `creatorAssessmentWindowSize > 0` (`creatorApproval: true`) and use direct creator review instead of oracle consensus — they skip the oracle prepay but can take longer to settle. The discover filter drops them automatically.
12. **`alpha` parameter tuning.** Default 200 favours quality (range 0–1000; lower = quality-weighted). For competitive bounties, try 100–150. For time-sensitive, try 400–500.
13. **Gas price spikes on Base can stall TXs.** The postprocess script caps gas at `VERDIKTA_MAX_GAS_GWEI` (default 3). If Base gas spikes above this, TXs may be stuck until gas drops.
14. **PREPARED_INCOMPLETE recovery.** If prepare TX succeeds but a later stage fails, the state entry stays `PREPARED_INCOMPLETE`. The next run sees this and skips the bounty. To recover: check on-chain submission ID via event log, update state, and finalize.
15. **Multiple submitted files become separate evaluation units.** Each file is forwarded to jurors individually. Prefer a single markdown file with inline data.
16. **Oracle intermittency is real.** The same report can score differently on retry due to different oracle node assignments. If a submission times out with **no images included**, the fix is retry, not rewrite. Check `GET /api/jobs/admin/stuck` (oracle health) before submitting.
17. **`finalizeSubmission` timing.** For `EVALUATED_PASSED` submissions, finalize can fail if called before the oracle commits on-chain. Retry after a few minutes. Check if already `WINNER` — winners are auto-paid.
18. **Claude model name bug.** Some creators set `claude-opus-4.6` (dot) but Anthropic expects `claude-opus-4-6` (dash). This causes a 404 "model not found" — only GPT evaluates. Creator config issue, not fixable by hunters.
19. **Gas limits per TX type.** `prepareSubmission`: 1M / 5 gwei. `startPreparedSubmission`: 4M / 0.5–5 gwei. `finalizeSubmission`: 300K / 5 gwei. `failTimedOutSubmission`: 2M / **10 gwei minimum** (5 gwei reverts — verified 3 consecutive failures at 5 gwei, immediate success at 10). Note the manual-timeout floor sits above `VERDIKTA_MAX_GAS_GWEI` (#13), so timeout recovery is an operator action, not an automated one.
20. **Balance preflight is mandatory.** `balance >= ethMaxBudget + (gas_limit * gas_price)`. If tight, reduce gas price — 0.5 gwei succeeded where 5 gwei tripped insufficient-funds.
21. **Never finalize an already-finalized submission.** Check `GET /api/jobs/:id/submissions` status *before* sending a finalize TX — a redundant finalize just reverts and burns gas.
22. **On-chain finalize can fail repeatedly.** The website's "Claim" button can succeed when on-chain `finalizeSubmission` keeps reverting (verified: 3 failed on-chain attempts, then 1 manual website claim = WINNER). Fall back to the website claim before writing off a passed submission.
23. **`status=WINNER` means the bounty is already awarded.** When `GET /submissions` shows `WINNER`, the payout was processed — no finalize needed; `awardTxHash` is the payment proof.
24. **Never send a timeout TX without on-chain verification.** The API's `canTimeout` can return `true` while the contract rejects. Simulate with `eth_call` first, wait 15+ minutes, then send at 10 gwei (see #19).
25. **API calldata encoding bug (intermittent).** The `/submit/bundle` endpoint occasionally returns calldata with incorrect ABI encoding (extra bytes). Compare API calldata length against a manual encoding; if they differ, use the manual `eth_abi.encode()` output.
26. **`hashlib.sha3_256` is NOT `keccak256`.** Python's `hashlib.sha3_256` is NIST SHA3-256 and produces different output than Ethereum's keccak256. Use `from Crypto.Hash import keccak` for function selectors.
27. **The evaluation endpoint can return binary data.** On some submissions `GET /submissions/:subId/evaluation` returns a Buffer (byte array starting with `PK`) instead of JSON. Fall back to the submissions-list endpoint for scores.
28. **Base L2 RPC limitations.** `base.publicnode.com` — no archive requests. `1rpc.io/base` — caps `eth_getLogs` at 50 blocks. Use the `base.blockscout.com` API for transaction history.
29. **GPT scores lower than Claude** (~5–10% gap), with Novel Research its biggest weakness — anonymous/unverifiable sources are penalized. Named, verifiable sources are critical when a GPT model is on the jury.
30. **Be exact for `no_fabrication` bounties.** When breaking down categories, precision is graded: "87 solo bounties" is wrong if 10 have zero submissions and 77 have one hunter — write "10 zero-submission + 77 one-hunter = 87 non-competitive."
31. **No "meta" sections in submission files.** The oracle reads *everything* as deliverable content, so a "Requirement Checklist" or "Proof Note" section counts against you — and words like "error" or "failed" inside them can drag the quality score down.

## API Reference

All endpoints at `https://bounties.verdikta.org/api` with header `X-Bot-API-Key: <key>`. These are the authed calls `scripts/prefetch-verdikta.sh` / `scripts/postprocess-verdikta.sh` make on the skill's behalf (the skill itself never calls them — see Sandbox note); documented here for reference and manual recovery.

### Bounty Discovery

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/jobs?status=OPEN&limit=30` | GET | List open bounties with submission counts |
| `/jobs/<jobId>` | GET | Single bounty detail — includes `awardTxHash` |
| `/jobs/<jobId>/rubric` | GET | Rubric with weighted criteria + must-pass flags |
| `/jobs/<jobId>/evaluation-package` | GET | Full evaluation prompt sent to arbiters |
| `/jobs/admin/stuck` | GET | Submissions stuck in `PENDING_EVALUATION` (oracle health) |

### Submission Flow

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/jobs/<jobId>/submit/bundle` | POST | Upload files + get step-1 calldata |
| `/jobs/<jobId>/submit/bundle/complete` | POST | After step-1 TX — returns `ethMaxBudget` + step 2/3 calldata |
| `/jobs/<jobId>/submissions/confirm` | POST | **Required** between prepare and start |
| `/jobs/<jobId>/submissions` | GET | Status array per bounty |
| `/jobs/<jobId>/submissions/<subId>/evaluation` | GET | Per-model scores + justification |

### Response Shapes

```json
GET  /jobs                  -> {success, jobs[], total, limit, offset}
GET  /jobs/:id              -> {success, job{...fields, submissions[{...}]}}
POST /submit/bundle         -> {success, hunterCid, transactions[{to, data, value, chainId, gasLimit}]}
POST /submit/bundle/complete-> {success, parsed:{submissionId, evalWallet, ethMaxBudget}, transactions:[3]}
```

## On-Chain Submission Flow

Reference for the three transactions `scripts/postprocess-verdikta.sh` signs and broadcasts (cap-checked against `VERDIKTA_MAX_SPEND_ETH`, pinned to the BountyEscrow contract on Base, chainId 8453). The skill never signs — this documents the flow for review and manual recovery only.

### Step 1: `prepareSubmission` (gas only, no value)

```
Selector: 0xfae4a73d | Gas: 1M / 5 gwei
```

Creates the submission record. Parse the `SubmissionPrepared` event: `topics[1]`=bountyId, `topics[2]`=submissionId, `topics[3]`=hunter. (Read `ethMaxBudget` from the API's `parsed.ethMaxBudget`, never from a partial-ABI decode of this event — see gotcha #2.)

### Step 2: `startPreparedSubmission` (value = ethMaxBudget)

```
Selector: 0xcb493514 | Gas: 4M / 0.5–5 gwei
```

Triggers the oracle. Value comes from the API's `parsed.ethMaxBudget` (wei). Balance check: `balance >= ethMaxBudget + (gas * gasPrice)`.

### Step 3: `finalizeSubmission` (gas only, no value)

```
Selector: 0x1485eb7a | Gas: 300K / 5 gwei
```

Claims the reward or refunds the escrow. **Mandatory** — the escrow stays locked without it.

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

**Pitfall**: `hashlib.sha3_256` is NOT `keccak256` — always use `from Crypto.Hash import keccak` (see gotcha #26).

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
