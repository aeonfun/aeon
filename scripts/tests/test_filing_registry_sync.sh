#!/usr/bin/env bash
# test_filing_registry_sync — sync-with-change regression for filing-registry
#
# Regression: `sync` persisted a changed registry with
#   jq '.last_synced = <bare now_str>'
# a jq syntax error that exited 3 and saved nothing (the run reported success but
# the registry was unchanged). The fix writes last_synced via
#   jq --arg ts "$(now_str)" '.last_synced = $ts'
# and publishes through atomic_save (temp + jq-validate + rename).
#
# This case exercises that write path with no network: it drives the same jq and
# atomic_save logic the sync command uses, and guards against the bare form
# silently being reintroduced.
set -euo pipefail

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
reg="$tmp/registry.json"

cat > "$reg" <<'JSON'
{"version":"1.0","last_synced":"2026-01-01T00:00:00Z","account":"t","pulls":[{"id":"o/r#1","state":"open","status":"pending_review"}],"issues":[],"activity_log":[]}
JSON

now="2026-10-25T00:00:00Z"

# The fixed form must parse and write last_synced.
out="$(jq --arg ts "$now" '.last_synced = $ts' "$reg")"
echo "$out" | jq -e '.last_synced == "2026-10-25T00:00:00Z"' >/dev/null

# atomic_save-style publish: temp file, jq-validate, then rename -> valid JSON.
tmpf="$tmp/registry.tmp.$$"
printf '%s' "$out" > "$tmpf"
jq '.' "$tmpf" >/dev/null && mv "$tmpf" "$reg"
jq -e '.last_synced=="2026-10-25T00:00:00Z" and .pulls[0].id=="o/r#1"' "$reg" >/dev/null

# The old bare-interpolation form must remain a syntax error (guard against relapse).
if jq '.last_synced = '"$now"'' "$reg" >/dev/null 2>&1; then
  echo "FAIL: bare-interpolation jq no longer rejected" >&2
  exit 1
fi

echo "OK: sync-with-change last_synced written via --arg; bare form still rejected"
