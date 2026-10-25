#!/usr/bin/env bash
# test_filing_registry_sync — end-to-end regression for `filing-registry sync`
#
# Original defect: `sync` persisted a changed registry with
#   jq '.last_synced = <bare now_str>'
# a jq compile error that exited 3, so the run printed "SYNC_DONE" but the
# registry was never written. The fix writes it via
#   jq --arg ts "$(now_str)" '.last_synced = $ts'
# and publishes through atomic_save.
#
# This drives the REAL `sync` command against a stubbed `gh` (no network) and
# asserts the write actually lands, instead of re-running the jq expression in
# isolation (which cannot catch a regression in the sync write path itself).
# It also pins two fail-closed invariants:
#   - a GitHub fetch failure must be reported, never treated as agreement
#   - `--item` naming a record the registry does not contain is an error, not
#     "0 items -> SYNC_OK" (a typo'd/stale id must not read as verified)
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
S="$here/skills/github-filing-registry/filing-registry"
[[ -f "$S" ]] || { echo "FAIL: $S missing" >&2; exit 1; }

T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
mkdir -p "$T/memory" "$T/bin"

# stub gh: pulls/1 is merged; every other call fails (simulates a fetch error).
cat > "$T/bin/gh" <<'SH'
#!/usr/bin/env bash
case "$2" in
  repos/o/r/pulls/1) echo '{"state":"closed","merged_at":"2026-10-25T00:00:00Z"}'; exit 0;;
  *) exit 1;;
esac
SH
chmod +x "$T/bin/gh"

seed() {
  cat > "$T/memory/filing-registry.json" <<'JSON'
{"version":"1.0","last_synced":"2026-01-01T00:00:00Z","account":"t",
 "pulls":[{"id":"o/r#1","repo":"o/r","number":1,"type":"pr","title":"x","state":"open","status":"pending_review","last_action":"2026-01-01T00:00:00Z"},
          {"id":"o/r#2","repo":"o/r","number":2,"type":"pr","title":"y","state":"open","status":"pending_review","last_action":"2026-01-01T00:00:00Z"}],
 "issues":[],"activity_log":[]}
JSON
}
run() { AEON_ROOT="$T" PATH="$T/bin:$PATH" bash "$S" "$@"; }

# --- Case A: real sync with a change lands the write (the original regression) ---
seed
run sync --item o/r#1 >/dev/null
jq -e '.pulls[]|select(.id=="o/r#1")|.state=="closed" and .status=="merged"' \
   "$T/memory/filing-registry.json" >/dev/null || {
  echo "FAIL: sync did not persist o/r#1 open->merged" >&2; exit 1; }
jq -e '.last_synced != "2026-01-01T00:00:00Z"' \
   "$T/memory/filing-registry.json" >/dev/null || {
  echo "FAIL: sync did not advance last_synced (the original bare-jq bug)" >&2; exit 1; }

# --- Case B: --item naming a record not in the registry fails closed ---
seed
set +e
out="$(run sync --item o/r#404 2>&1)"; rc=$?
set -e
[[ $rc -ne 0 ]] || { echo "FAIL: 'sync --item o/r#404' exited 0 (reports success for a nonexistent item)" >&2; exit 1; }
grep -q "SYNC_ITEM_NOT_FOUND" <<<"$out" || { echo "FAIL: no SYNC_ITEM_NOT_FOUND message; got: $out" >&2; exit 1; }

# --- Case C: a failed GitHub fetch fails closed ---
seed
set +e
out="$(run sync 2>&1)"; rc=$?   # #2's fetch fails -> run must not exit 0
set -e
[[ $rc -ne 0 ]] || { echo "FAIL: sync with a failing fetch exited 0 (treated failure as agreement)" >&2; exit 1; }
grep -q "SYNC_INCOMPLETE" <<<"$out" || { echo "FAIL: no SYNC_INCOMPLETE message; got: $out" >&2; exit 1; }

echo "OK: sync writes last_synced end-to-end; --item-not-found and fetch-failure both fail closed"
