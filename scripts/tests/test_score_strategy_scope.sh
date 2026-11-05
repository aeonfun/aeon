#!/usr/bin/env bash
# Literal $ in patterns and SKILL.md fixtures is intended.
# shellcheck disable=SC2016
# The scorer grades a skill on its own SKILL.md job; STRATEGY.md joins the rubric
# only for a skill whose SKILL.md tells it to read STRATEGY.md. Runs the real
# workflow block against throwaway workspaces.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKFLOW="$ROOT/.github/workflows/aeon.yml"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

awk '
  /^      - name: Analyze skill output$/ { step=1 }
  step && /^          # Grade a skill on its own job first/ { on=1 }
  on && /^          ANALYSIS_PROMPT=/ { exit }
  on { sub(/^          /, ""); print }
' "$WORKFLOW" >"$TMP/scope.sh"
grep -q '^STRATEGY_BLOCK=""' "$TMP/scope.sh"
grep -q '\$SKILL_JOB' "$WORKFLOW"
grep -q '\$STRATEGY_BLOCK' "$WORKFLOW"
if grep -q '^          \$STRATEGY_CTX$' "$WORKFLOW"; then
  echo 'not ok - prompt still injects STRATEGY_CTX for every skill' >&2
  exit 1
fi

# run_case <skill> <SKILL.md body> -> prints "job=<SKILL_JOB>" and "strategy=<0|1>"
run_case() {
  local skill="$1" body="$2" workdir
  workdir="$(mktemp -d "$TMP/case.XXXXXX")"
  mkdir -p "$workdir/skills/$skill"
  printf '%s' "$body" >"$workdir/skills/$skill/SKILL.md"
  printf '# Strategy\n\nGrow framework stars.\n' >"$workdir/STRATEGY.md"
  (
    cd "$workdir"
    SKILL="$skill"
    # shellcheck disable=SC2034  # read by the sourced block
    SKILL_MD="skills/${SKILL}/SKILL.md"
    # shellcheck source=/dev/null
    source "$TMP/scope.sh"
    printf 'job=%s\n' "$SKILL_JOB"
    if [ -n "$STRATEGY_BLOCK" ]; then echo 'strategy=1'; else echo 'strategy=0'; fi
  )
}

out="$(run_case token-movers '---
name: token-movers
description: Daily market movers and single-token deep report
---
Read `memory/MEMORY.md` for the tracked token.
')"
[[ "$out" == *'job=Daily market movers and single-token deep report'* ]]
[[ "$out" == *'strategy=0'* ]]
echo 'ok - routine report is graded on its own description, no strategy block'

out="$(run_case idea-forge '---
name: idea-forge
description: Ideas from the operator worldview
---
Today is ${today}. **Read `soul/SOUL.md` + `soul/STYLE.md` + `STRATEGY.md` first.
')"
[[ "$out" == *'strategy=1'* ]]
echo 'ok - skill that reads STRATEGY.md gets the strategy block'

out="$(run_case aeon-update '---
name: aeon-update
description: Pull canon changes into an instance
---
- Never clobber operator config. `aeon.yml`, `STRATEGY.md`, `soul/` are instance-owned.
')"
[[ "$out" == *'strategy=0'* ]]
echo 'ok - a passing mention of STRATEGY.md is not a claim'

out="$(run_case bare 'no frontmatter here')"
[[ "$out" == *'job=(no description; infer the job from the output)'* ]]
[[ "$out" == *'strategy=0'* ]]
echo 'ok - missing description falls back cleanly'

echo 'scorer strategy scope tests passed'
