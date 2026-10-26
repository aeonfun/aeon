#!/usr/bin/env bash
# Shared rebase + conflict-resolve + push retry loop for the post-run git steps
# in aeon.yml ("Commit results", "Commit read-only failure log") and
# messages.yml ("Commit results"), so every writer uses the same fleet-safe
# push path instead of drifting copies.
#
# Assumes the caller has already `git add`ed and `git commit`ed locally on
# the current branch - this script only gets that commit onto its remote
# counterpart under concurrent-writer contention (many skills push often).
#
# Conflict policy. During `pull --rebase`, stage 2 ("ours") is UPSTREAM (the
# commits other runs already pushed) and stage 3 ("theirs") is the LOCAL commit
# being replayed. A whole-file `checkout --theirs` keeps this run's copy and
# silently drops every concurrent upstream edit, so instead:
#   - output/.chains/<skill>.md: keep THIS run's copy (stage 3). It holds only the
#     latest run's output for the next chain step to read, so a union of two
#     runs is wrong: two concurrent runs of one skill left both versions
#     concatenated on main.
#   - append-only ledgers/logs (token-usage.csv, memory/logs, topics, MEMORY.md,
#     the rest of output/, dashboard outputs): union-merge, keeping both sides' lines.
#   - *.json (skill-health, cron-state, other state): 3-way merge with jq, so
#     the result is still valid JSON. skill-health also keeps both sides'
#     history entries (newest analysis wins the scalar fields).
#   - anything else: prefer upstream on the conflicting hunks only, keeping the
#     local commit's non-conflicting hunks.
set -uo pipefail

# Recursive 3-way JSON merge. Keys changed on one side only take that side;
# keys changed on both sides recurse into objects, union arrays (upstream order
# plus local additions), and otherwise prefer upstream.
JSON_MERGE='
def has_x($v): any(.[]; . == $v);
def m3($b; $o; $t):
  if ($o|type) == "object" and ($t|type) == "object" then
    ($b | if type == "object" then . else {} end) as $bb
    | reduce ((($o|keys) + ($t|keys)) | unique[]) as $k ({};
        if ($o|has($k)) and ($t|has($k)) then . + {($k): m3($bb[$k]; $o[$k]; $t[$k])}
        elif ($o|has($k)) then (if ($bb|has($k)) and $bb[$k] == $o[$k] then . else . + {($k): $o[$k]} end)
        else (if ($bb|has($k)) and $bb[$k] == $t[$k] then . else . + {($k): $t[$k]} end)
        end)
  elif $t == $b then $o
  elif $o == $b then $t
  elif ($o|type) == "array" and ($t|type) == "array" then
    ($b | if type == "array" then . else [] end) as $ba
    | $o + [$t[] | . as $x | select(($ba | has_x($x) | not) and ($o | has_x($x) | not))]
  else $o
  end;
($b[0]) as $b | ($o[0]) as $o | ($t[0]) as $t
| if $health then
    (if ($t.last_analyzed // "") > ($o.last_analyzed // "")
       then m3($b; $o; $t) * ($t | del(.history))
       else m3($b; $o; $t) end)
    | if (.history | type) == "array" then
        .history |= (unique | sort_by(.ts // .date) | .[-30:])
        | if (.history | length) > 0 then .avg_score = (([.history[].score] | add / length * 100 | round) / 100) else . end
      else . end
  else m3($b; $o; $t) end
'

resolve_conflict() {
  local f="$1" tmp has_up=0 has_local=0 rc=0
  tmp=$(mktemp -d)
  git show ":1:$f" > "$tmp/base" 2>/dev/null || : > "$tmp/base"
  git show ":2:$f" > "$tmp/up" 2>/dev/null && has_up=1
  git show ":3:$f" > "$tmp/local" 2>/dev/null && has_local=1

  if [ "$has_up" = 0 ] || [ "$has_local" = 0 ]; then
    # modify/delete: one side removed the file. Prefer upstream's side.
    if [ "$has_up" = 1 ]; then
      git checkout --ours -- "$f" && git add -- "$f"
    else
      git rm -q --cached -- "$f" 2>/dev/null || true
      rm -f -- "$f"
    fi
    rm -rf "$tmp"
    return
  fi

  if [[ "$f" == output/.chains/* ]]; then
    # Latest-run-only file: this run's copy wins whole. Stage 3 is the local
    # commit being replayed (the rebase inversion above), so take $tmp/local.
    cat "$tmp/local" > "$f"
  elif [[ "$f" == *.json ]]; then
    local health=false
    [[ "$f" == memory/skill-health/* ]] && health=true
    if jq -n --argjson health "$health" --slurpfile b "$tmp/base" \
         --slurpfile o "$tmp/up" --slurpfile t "$tmp/local" "$JSON_MERGE" > "$tmp/out" 2>/dev/null \
       && [ -s "$tmp/out" ]; then
      cat "$tmp/out" > "$f"
    else
      # A side that isn't valid JSON can't be merged structurally; upstream wins.
      git checkout --ours -- "$f"
    fi
  elif [[ "$f" == memory/token-usage.csv ]] || [[ "$f" == memory/logs/* ]] || [[ "$f" == memory/topics/* ]] || [[ "$f" == memory/MEMORY.md ]] || [[ "$f" == apps/dashboard/outputs/* ]] || [[ "$f" == output/* ]]; then
    git merge-file -p --union "$tmp/up" "$tmp/base" "$tmp/local" > "$tmp/out" 2>/dev/null || rc=$?
    if [ "$rc" = 0 ]; then cat "$tmp/out" > "$f"; else git checkout --ours -- "$f"; fi
  else
    git merge-file -p --ours "$tmp/up" "$tmp/base" "$tmp/local" > "$tmp/out" 2>/dev/null || rc=$?
    if [ "$rc" = 0 ]; then cat "$tmp/out" > "$f"; else git checkout --ours -- "$f"; fi  # binary: upstream wins
  fi
  git add -- "$f"
  rm -rf "$tmp"
}

rebase_in_progress() {
  [ -d "$(git rev-parse --git-path rebase-merge)" ] || [ -d "$(git rev-parse --git-path rebase-apply)" ]
}

# Push diagnostics can contain credential-bearing URLs or exported secrets.
# Follow audit.sh's raw/base64/URI redaction, and hide whole URLs so credentials
# in userinfo, paths, or query strings never reach the workflow log.
report_push_error() {
  local text="$1" name value encoded
  while IFS= read -r name; do
    case "$name" in
      *_KEY|*_TOKEN|*_SECRET|*_PAT|*_PASSWORD|*_PASS|*_WEBHOOK_URL|GH_GLOBAL) ;;
      *) continue ;;
    esac
    value="${!name-}"
    [ -n "$value" ] || continue
    text="${text//"$value"/REDACTED}"
    encoded="$(printf '%s' "$value" | base64 | tr -d '\n')"
    [ -z "$encoded" ] || text="${text//"$encoded"/REDACTED}"
    encoded="$(printf '%s' "$value" | jq -sRr @uri 2>/dev/null || true)"
    [ -z "$encoded" ] || text="${text//"$encoded"/REDACTED}"
  done < <(compgen -e)
  printf '%s\n' "$text" | sed -E 's#[[:alpha:]][[:alnum:]+.-]*://[^[:space:]]+#REDACTED_URL#g' >&2
}

retryable_push_rejection() {
  # Porcelain status records distinguish real rejected refs from arbitrary
  # remote diagnostics mentioning "non-fast-forward" or "fetch first".
  local line pattern inline_pattern stale_pattern update_pattern stale_ref=0 rejected_update=0
  pattern=$'^!\t[^\t]+\t\\[rejected\\] \\((non-fast-forward|fetch first|stale info)\\)$'
  stale_pattern="cannot lock ref '[^']+': is at [[:xdigit:]]+ but expected [[:xdigit:]]+"
  update_pattern=$'^!\t[^\t]+\t\\[remote rejected\\] \\(failed to update ref\\)$'
  # GitHub can also put the lock failure inside the status record itself.
  inline_pattern=$'^!\t[^\t]+\t\\[remote rejected\\] \\('"$stale_pattern"$'\\)$'
  while IFS= read -r line; do
    if [[ "$line" =~ $pattern ]] || [[ "$line" =~ $inline_pattern ]]; then
      return 0
    fi
    [[ "$line" =~ $stale_pattern ]] && stale_ref=1
    [[ "$line" =~ $update_pattern ]] && rejected_update=1
  done <<< "$1"
  [ "$stale_ref" -eq 1 ] && [ "$rejected_update" -eq 1 ]
}

for i in 1 2 3 4 5 6 7 8 9 10; do
  # Pull and rebase onto latest remote. --autostash: a caller may leave
  # unstaged files behind (the read-only failure path stages only its log),
  # and a dirty tree makes a plain `pull --rebase` refuse outright.
  if ! git pull --rebase --autostash origin "$(git branch --show-current)" 2>/dev/null; then
    echo "Rebase conflict on attempt $i, auto-resolving..."
    steps=0
    while rebase_in_progress && [ "$steps" -lt 200 ]; do
      steps=$((steps + 1))
      CONFLICTED=$(git diff --name-only --diff-filter=U) || true
      if [ -n "$CONFLICTED" ]; then
        while IFS= read -r f; do
          [ -n "$f" ] && resolve_conflict "$f"
        done <<< "$CONFLICTED"
      fi
      if git diff --cached --quiet; then
        git rebase --skip 2>/dev/null || true
      else
        GIT_EDITOR=true git rebase --continue 2>/dev/null || true
      fi
    done
    # Never leave a half-finished rebase behind: the next pull would refuse and
    # every remaining attempt would fail the same way.
    if rebase_in_progress; then
      echo "Rebase could not be completed on attempt $i, aborting it"
      git rebase --abort 2>/dev/null || true
    fi
  fi
  # Retry only concurrent ref updates, not authentication or server failures.
  push_output="$(LC_ALL=C git push --porcelain -u origin HEAD 2>&1)"
  push_status=$?
  if [ "$push_status" -eq 0 ]; then
    echo "Pushed successfully on attempt $i"
    bash "${AEON_AUDIT_SCRIPT:-scripts/audit.sh}" "git.push" "${GITHUB_REPOSITORY:-}@$(git rev-parse --abbrev-ref HEAD)" 0 "GH_GLOBAL" || true
    exit 0
  fi
  report_push_error "$push_output"
  if ! retryable_push_rejection "$push_output"; then
    echo "Push attempt $i failed (exit $push_status); not retrying." >&2
    exit "$push_status"
  fi
  if [ "$i" -lt 10 ]; then
    echo "Push attempt $i rejected (ref moved), retrying with backoff..."
    sleep "$(( (RANDOM % 4) + i ))"  # jitter prevents lockstep writers from colliding again
  fi
done
echo "Failed to push after 10 attempts"
exit 1
