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
  # Try to push - if it fails, another job beat us, loop and re-pull
  if git push -u origin HEAD 2>/dev/null; then
    echo "Pushed successfully on attempt $i"
    bash scripts/audit.sh "git.push" "${GITHUB_REPOSITORY:-}@$(git rev-parse --abbrev-ref HEAD)" 0 "GH_GLOBAL" || true
    exit 0
  fi
  echo "Push attempt $i failed (ref moved), retrying in ${i}s..."
  sleep "$(( (RANDOM % 4) + i ))"  # jittered backoff - a deterministic sleep re-collides lockstep writers under push contention
done
echo "Failed to push after 10 attempts"
exit 1
