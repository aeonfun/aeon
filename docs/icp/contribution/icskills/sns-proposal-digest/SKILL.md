---
name: sns-proposal-digest
description: Summarize Internet Computer governance - new and open NNS proposals and SNS DAO proposals - so a reviewer sees what is up for a vote without watching the dashboard.
license: Apache-2.0
compatibility: "network access to the IC dashboard + SNS API"
metadata:
  title: SNS Proposal Digest
  category: Governance
---

# SNS & NNS proposal digest

Produce a running digest of governance activity so nothing up for a vote is missed.

## Public, keyless sources

All governance data is public - no identity needed:

- **NNS proposals:** `https://ic-api.internetcomputer.org/api/v3/proposals`
  (filter by `status`/`topic`; each item has id, title, topic, status, deadline).
- **SNS list:** `https://sns-api.internetcomputer.org/api/v1/snses` enumerates the
  launched SNS DAOs; each SNS exposes its own proposals through its governance
  canister / the SNS aggregator.

## How to build the digest

1. Fetch open/recent NNS proposals and the SNS list.
2. For each watched SNS (or all of them), pull its open proposals.
3. Keep a seen-set so each proposal is reported once; emit only when something is
   new or newly open.
4. Summarize per proposal: id, DAO/topic, one-line intent, status, and voting
   deadline, with a link to the proposal.

## Why it matters

Governance deadlines are short and binding. A digest that fires only on genuinely
new or newly-open proposals keeps a neuron-holder or DAO participant ahead of a
vote without manual dashboard-watching.
