# sns-digest

Digests Internet Computer governance — new/open **NNS** proposals and **SNS DAO**
proposals — so the operator sees what is up for a vote and what is closing soon.

**Fully public, no secret** (verified 2026-11-07):
- NNS: `https://ic-api.internetcomputer.org/api/v3/proposals`
- SNS list: `https://sns-api.internetcomputer.org/api/v1/snses`

`mode: write`. Fires only when there is something new/open; dedups against prior runs.

## Run

```bash
gh workflow run aeon.yml --ref main -f skill=sns-digest -f var=        # NNS + active SNS
gh workflow run aeon.yml --ref main -f skill=sns-digest -f var=nns     # NNS only
gh workflow run aeon.yml --ref main -f skill=sns-digest -f var=ALICE
```

## Dry-run evidence

```bash
curl -s "https://ic-api.internetcomputer.org/api/v3/proposals?limit=2&include_status=OPEN" | jq '.data[] | {proposal_id, row_id:.id, status, action, deadline_timestamp_seconds}'
curl -s "https://sns-api.internetcomputer.org/api/v1/snses/oh4fn-kyaaa-aaaaq-aaega-cai/proposals?limit=2&include_status=OPEN" | jq '.data[] | {id, status, proposal_title, wait_for_quiet_state_current_deadline_timestamp_seconds}'
```

The NNS identifier is `proposal_id` (not the database row `id`); SNS proposals use
their `id`. `parse-proposals.mjs` validates and normalizes both proposal response
shapes and the active/enabled SNS list.
