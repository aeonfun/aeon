# sns-digest

Digests Internet Computer governance — new/open **NNS** proposals and **SNS DAO**
proposals — so the operator sees what is up for a vote and what is closing soon.

**Fully public, no secret** (verified 2026-11-04):
- NNS: `https://ic-api.internetcomputer.org/api/v3/proposals`
- SNS list: `https://sns-api.internetcomputer.org/api/v1/snses`

`mode: read-only`. Fires only when there is something new/open; dedups against prior runs.

## Run

```bash
gh workflow run aeon.yml --ref main -f skill=sns-digest -f var=        # NNS + active SNS
gh workflow run aeon.yml --ref main -f skill=sns-digest -f var=nns     # NNS only
gh workflow run aeon.yml --ref main -f skill=sns-digest -f var=ALICE:open
```

## Dry-run evidence

```bash
curl -s "https://ic-api.internetcomputer.org/api/v3/proposals?limit=2" | jq '.data[] | {id, action, deadline_timestamp_seconds}'
curl -s "https://sns-api.internetcomputer.org/api/v1/snses?limit=2&offset=0" | jq '.data[] | {root_canister_id, name}'
```

Both return live public data with no key (confirmed 2026-11-04).
