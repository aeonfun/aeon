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

# run_article_case <skill> <card> <article path> <article body> <untracked|committed>
# Same as run_case in a git repo holding the article: untracked = this run wrote
# it, committed = it was already on main before the run.
run_article_case() {
  local skill="$1" card="$2" article="$3" body="$4" how="$5" workdir
  workdir="$(mktemp -d "$TMP/case.XXXXXX")"
  mkdir -p "$workdir/output/.chains" "$workdir/$(dirname "$article")"
  printf '%s' "$card" >"$workdir/output/.chains/$skill.md"
  printf '%s' "$card" >"$workdir/skill-result.txt"
  git -C "$workdir" init -q
  git -C "$workdir" -c user.name=t -c user.email=t@example.invalid commit -q --allow-empty -m base
  printf '%s' "$body" >"$workdir/$article"
  if [ "$how" = committed ]; then
    git -C "$workdir" add -- "$article"
    git -C "$workdir" -c user.name=t -c user.email=t@example.invalid commit -q -m article
  fi
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

# token-report sends a 420-byte card with no source line; the article it wrote
# this run has the sources (2026-11-03: scored 2, unverifiable_claim, 4 days).
tr_card='*$AEON - CONSOLIDATING*
Price $0.00001845 (-2.8% 24h) | Liq $396.4K (-2.2%) | Vol $57.7K (1.18x 7d)'
tr_article='# $AEON - 2026-11-03
| Price | $0.00001845 | -2.8% |
Sources: gt=ok ds=ok xai=skip treasury=skip'
out="$(run_article_case token-report "$tr_card" output/articles/token-report-2026-11-03.md "$tr_article" untracked)"
[[ "$out" == 'Article written this run (output/articles/token-report-2026-11-03.md):'* ]]
[[ "$out" == *'Sources: gt=ok'* ]]
[[ "$out" == *'Notification:'* && "$out" == *'Liq $396.4K'* ]]
echo 'ok - an article this run wrote is graded next to its card'

out="$(run_article_case token-movers "$tr_card" output/articles/token-report-2026-11-03.md "$tr_article" untracked)"
[[ "$out" == *'Sources: gt=ok'* ]]
echo 'ok - an article named after another slug is still found'

out="$(run_article_case kpi-daily "$tr_card" output/articles/kpi-daily-2020-01-01.md "$tr_article" committed)"
[ "$out" = "$tr_card" ]
echo 'ok - an older committed article is not graded'

today_article="output/articles/token-report-$(date -u +%F).md"
out="$(run_article_case token-report "$tr_card" "$today_article" "$tr_article" committed)"
[[ "$out" == *'Sources: gt=ok'* && "$out" == *'Notification:'* ]]
echo "ok - today's <skill>-<date> article counts when the skill committed it itself"

out="$(run_article_case token-report "$tr_card" output/articles/token-report-2026-11-03.md "$tr_card" untracked)"
[ "$out" = "$tr_card" ]
echo 'ok - an article identical to the card is scored once'

out="$(run_article_case token-report "$long_card" output/articles/token-report-2026-11-03.md "$long_result" untracked)"
[[ "$out" == *'RESULT_START'* && "$out" == *'RESULT_END'* ]]
[[ "$out" == *'CARD_START'* && "$out" == *'CARD_END'* ]]
[ "$(printf '%s' "$out" | wc -c)" -lt 14200 ]
echo 'ok - article and card retain head and tail within the content budget'
