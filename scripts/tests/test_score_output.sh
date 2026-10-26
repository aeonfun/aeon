#!/usr/bin/env bash
# Run the real workflow's scorer-input selection against captured artifacts.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKFLOW="$ROOT/.github/workflows/aeon.yml"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

awk '
  /^      - name: Analyze skill output$/ { step=1 }
  step && /^          score_output_sample\(\) \{$/ { on=1 }
  on && /^          \[ -z "\$OUTPUT" \]/ { exit }
  on { sub(/^          /, ""); print }
' "$WORKFLOW" >"$TMP/select.sh"
grep -q '^score_output_sample() {' "$TMP/select.sh"
grep -q 'NOTIFY_SAMPLE=' "$TMP/select.sh"

python3 - "$TMP/select.sh" <<'PY'
import pathlib
import sys

p = pathlib.Path(sys.argv[1])
s = p.read_text()
assert s.count("/tmp/skill-result.txt") == 1
p.write_text(s.replace("/tmp/skill-result.txt", "skill-result.txt"))
PY

run_case() {
  local skill="$1" card="$2" result="$3" workdir
  workdir="$(mktemp -d "$TMP/case.XXXXXX")"
  mkdir -p "$workdir/output/.chains"
  printf '%s' "$card" >"$workdir/output/.chains/$skill.md"
  printf '%s' "$result" >"$workdir/skill-result.txt"
  (
    cd "$workdir"
    export SKILL="$skill"
    # shellcheck source=/dev/null
    source "$TMP/select.sh"
    printf '%s' "$OUTPUT"
  )
}

card='Changelog published: website PR #700.'
result='October 26 entry: token cache handling and clearer error reporting.
Source PRs: #1201 and #1202. Website PR: #700.'
out="$(run_case changelog "$card" "$result")"
[[ "$out" == *'Repository change result:'* ]]
[[ "$out" == *"$result"* ]]
[[ "$out" == *'Notification:'* ]]
[[ "$out" == *"$card"* ]]
echo 'ok - changelog keeps substantive result and short notification'

out="$(run_case kpi-daily 'Revenue: 15 USD, verified from the billing API.' 'Sent the card.')"
[ "$out" = 'Revenue: 15 USD, verified from the billing API.' ]
echo 'ok - other notification-first skills still grade the card alone'

out="$(run_case changelog "$card" '')"
[ "$out" = "$card" ]
echo 'ok - missing final result falls back to the notification'

out="$(run_case changelog '' "$result")"
[ "$out" = "$result" ]
echo 'ok - missing notification uses the final result without duplication'

out="$(run_case changelog "$result" "$result")"
[ "$out" = "$result" ]
echo 'ok - a copied final result is scored once'

out="$(run_case changelog '_No output captured._' "$result")"
[ "$out" = "$result" ]
echo 'ok - capture placeholder does not displace the final result'

out="$(run_case changelog '' '')"
[ -z "$out" ]
echo 'ok - empty artifacts leave the workflow no output to grade'

long_result="$(
  python3 - <<'PY'
print('RESULT_START\n' + 'x' * 25000 + '\nRESULT_END')
PY
)"
long_card="$(
  python3 - <<'PY'
print('CARD_START\n' + 'y' * 12000 + '\nCARD_END')
PY
)"
out="$(run_case changelog "$long_card" "$long_result")"
[[ "$out" == *'Repository change result:'* ]]
[[ "$out" == *'RESULT_START'* && "$out" == *'RESULT_END'* ]]
[[ "$out" == *'Notification:'* ]]
[[ "$out" == *'CARD_START'* && "$out" == *'CARD_END'* ]]
[ "$(printf '%s' "$out" | wc -c)" -lt 14200 ]
echo 'ok - both changelog artifacts retain head and tail within the content budget'

out="$(run_case github-trending "$long_result" 'Sent the card.')"
[[ "$out" == *'RESULT_START'* && "$out" == *'RESULT_END'* ]]
[[ "$out" != *'Sent the card.'* ]]
[ "$(printf '%s' "$out" | wc -c)" -lt 14100 ]
echo 'ok - other long cards retain the existing head and tail budget'
