#!/bin/bash
set -e
BASE=/home/runner/work/aeon/aeon/.security-digest-tmp

# Filter KEV to last 7 days
jq --arg s "2026-04-25" '[.vulnerabilities[] | select(.dateAdded >= $s)]' "$BASE/kev.json" > "$BASE/kev_recent.json"
echo "Recent KEV count: $(jq 'length' "$BASE/kev_recent.json")"

# Fetch GitHub Advisories (critical and high, last 48h)
SINCE48="2026-04-30T14:34:00Z"
for SEV in critical high; do
  curl -sf --max-time 20 "https://api.github.com/advisories?type=reviewed&severity=${SEV}&published=${SINCE48}.." \
    -H "Accept: application/vnd.github+json" \
    ${GITHUB_TOKEN:+-H "Authorization: Bearer $GITHUB_TOKEN"} \
    > "$BASE/advisories_${SEV}.json" || echo "[]" > "$BASE/advisories_${SEV}.json"
  echo "advisories_${SEV}: $(jq 'length' "$BASE/advisories_${SEV}.json")"
done

# Combine
jq -s 'add' "$BASE/advisories_critical.json" "$BASE/advisories_high.json" > "$BASE/advisories.json"
echo "advisories total: $(jq 'length' "$BASE/advisories.json")"
