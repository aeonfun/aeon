#!/usr/bin/env bash
# skill_mode — capability tier resolution for a skill run (hardening §6).
#
# Two axes of capability: network (egress:, future proxy) and *write* (this).
# A skill declares its write tier in SKILL.md frontmatter:
#     mode: read-only      # may read repo + fetch web + notify; may NOT mutate the repo
#     mode: write          # full access (default, current behaviour)
#
# Default is `write` for backward compatibility: most skills legitimately write
# (create-skill, article, reflect…), so read-only is opt-in per SKILL.md.
#
# This script decides the TIER. It is not, by itself, the enforcement — see
# docs/CAPABILITIES.md for the full picture. The allowedTools string below is one
# of three layers: the tier also reaches `run-harness --mode`, which write-locks
# the workspace with an OS sandbox (harness-adapter/lib/sandbox.sh) on every
# harness, and a post-run guard in the workflow reverts anything that still
# landed. The allowlist alone was never sufficient — a shell redirection routes
# around it, and only claude and pi consume it at all.
#
# Usage:
#   scripts/skill_mode.sh mode <skill-name>     -> prints read-only | write
#   scripts/skill_mode.sh allowed-tools <mode>  -> prints the --allowedTools string
#   scripts/skill_mode.sh grok-run-env <skill>  -> prints `export GROK_*=…` lines
#   scripts/skill_mode.sh run-notes <mode>      -> prints standing notes for the tier
set -euo pipefail

# Tools every tier gets: read, search, notify, and read-only/local shell helpers.
# curl stays (network is the *other* axis, governed by egress:, not by mode).
#
# NOTE: `gh` is intentionally NOT in the read-only base — even `gh api` GET reads are
# excluded, because `gh` is also a write vector (issue/PR/commit/dispatch) and the tool
# grammar is coarse (Bash(gh:*) is all-or-nothing). A read-only skill that needs GitHub
# data should fetch it with WebFetch/curl against api.github.com, or stay `mode: write`.
# (Known degraders today: github-trending + security-digest use `gh api` only as a
# fallback behind a WebFetch/curl primary, so they degrade gracefully, not break.)
BASE_TOOLS="Read,Glob,Grep,WebFetch,WebSearch"
BASE_TOOLS="$BASE_TOOLS,Bash(curl:*),Bash(jq:*)"
BASE_TOOLS="$BASE_TOOLS,Bash(./notify:*),Bash(./notify-jsonrender:*),Bash(./secretcurl:*)"
BASE_TOOLS="$BASE_TOOLS,Bash(mkdir:*),Bash(ls:*),Bash(cat:*),Bash(chmod:*)"
# `cd` — several skills' own docs (skills/feature/SKILL.md, skills/changelog/
# SKILL.md) explicitly instruct agents to run `cd <dir>` as its OWN standalone
# Bash call, then each subsequent command as a separate call — the documented
# workaround for the sandbox's unconditional denial of `&&`/`||`/`;`/`|`
# command-chaining. With no grant here, that officially-recommended pattern
# itself fails: a standalone `cd` call has no more permission than a
# multi-line call that happens to start with one. A multi-line/compound Bash
# call is denied unless every sub-command in it is allowlisted, so `cd <dir>\n<real work>`
# denies the whole call, real work included, even when every command after
# the cd is itself allowlisted — live-observed on defi-overview/
# narrative-tracker (permission_denials on a cd-prefixed multi-line call).
# cd only changes the invoking shell's own cwd — no file/network effect of
# its own, the same risk class as ls/cat/mkdir already granted above.
BASE_TOOLS="$BASE_TOOLS,Bash(cd:*)"
BASE_TOOLS="$BASE_TOOLS,Bash(date:*),Bash(echo:*),Bash(node:*),Bash(npm:*),Bash(npx:*)"
BASE_TOOLS="$BASE_TOOLS,Bash(head:*),Bash(tail:*),Bash(wc:*),Bash(sort:*),Bash(grep:*)"
# base64 is a pure stdin-to-stdout filter like head/tail. Six write-tier skills
# (strategy-builder, article, fork-fleet, fleet-control, pr-review, aeon-update)
# read GitHub file contents via `gh api ... --jq .content | base64 -d`; without
# this grant the whole pipe is denied (live: strategy-builder on aeon-test lost
# the README and drafted from a partial read).
BASE_TOOLS="$BASE_TOOLS,Bash(base64:*)"
# The run-audit wrapper. skill-health documents ./scripts/skill-runs as a primary
# data source (so did several since-retired skills), but no tier granted it, so every documented call was denied. That was
# the trigger for ISS-001 on aeon-compute: skill-health, unable to reach its own
# data source, burned turns working around the denial and hit the 30m GH Actions
# job timeout on two consecutive runs. Safe in the base tier: the script only
# does `gh api` GET reads + jq + date (no repo/network mutation), and its inner
# `gh` runs inside the script's own subshell, so granting the wrapper does NOT
# re-open the broad `Bash(gh:*)` write vector that the read-only base
# deliberately withholds: a read-only skill gets audited GitHub run data with no
# write capability.
BASE_TOOLS="$BASE_TOOLS,Bash(./scripts/skill-runs:*)"
# Arc Studio CLI. The workflow installs the binary only when the running skill
# is arc-studio, before the harness starts. Other skills do not have it on
# PATH, so this grant is a no-op for them. It has to live on the read-only
# tier: arc-studio is mode read-only and must not gain Write/Edit.
BASE_TOOLS="$BASE_TOOLS,Bash(arc-studio:*)"

# Write tier additionally gets repo-mutation tools + python (an interpreter is itself
# a write vector, so it stays out of the read-only base; skills' python helpers run here).
WRITE_TOOLS="Write,Edit,Bash(gh:*),Bash(git:*),Bash(python3:*),Bash(python:*)"
# Security-scanner bare-names for vuln-scanner (Arm A). The skill stages these in-run
# (`python3 -m pip install` for semgrep/slither, `curl -o … && chmod +x` for the Go
# binaries) and invokes them by bare name. Without this grant `claude -p` denies the
# invocation ("requires approval") and the scan arm silently degrades to manual review —
# a live-test showed the run logging that denial as "Blocked by sandbox". These are
# read-only static-analysis tools (no repo/network mutation of their own).
WRITE_TOOLS="$WRITE_TOOLS,Bash(semgrep:*),Bash(osv-scanner:*),Bash(trufflehog:*),Bash(slither:*)"
# Bounded scanner calls start with the wrapper, not the scanner's bare name.
# These can execute arbitrary commands, so grant them only in the write tier.
WRITE_TOOLS="$WRITE_TOOLS,Bash(timeout:*),Bash(gtimeout:*)"
# cargo (vuln-scanner Arm A, step A3.5 — dynamic testing). Staged by
# scripts/stage-vuln-scanner.sh (nightly toolchain + cargo-fuzz, workflow step,
# same reason as Foundry below — the sandbox denies toolchain installs in-run).
# Unlike the scanners above, this is not narrow: `cargo fuzz run` compiles and
# executes the cloned repo's own code, and `cargo` itself is a much wider surface
# than a single-purpose analyzer. Accepted deliberately — see A3.5 in
# skills/vuln-scanner/SKILL.md for the trust-boundary reasoning. The skill only
# reaches for it when the clone already ships fuzz/fuzz_targets; the guard lives
# in the skill, not here.
WRITE_TOOLS="$WRITE_TOOLS,Bash(cargo:*)"
# High/Critical code findings must pass this key-scrubbing, evidence-producing
# runner before vuln-scanner may claim the severity or route a disclosure.
WRITE_TOOLS="$WRITE_TOOLS,Bash(./scripts/vuln-poc-gate.sh:*)"
# feature asks GitHub whether an open PR already covers its work, and whether a
# "Closes #N" names a real open issue, before it opens or reports a PR. Read-only
# gh calls with validated arguments; the decision is the script's, not the model's.
WRITE_TOOLS="$WRITE_TOOLS,Bash(./scripts/feature-open-pr.sh:*)"
# pr-review asks GitHub whether it already reviewed a PR at its head commit, with
# the same receipt count the dev-loop gate uses, before posting another review.
WRITE_TOOLS="$WRITE_TOOLS,Bash(./scripts/dev-loop-review.sh:*)"
# Foundry bare-names + the key-safe runner for deploy-uni-hook. Foundry is staged by
# scripts/stage-deploy-uni-hook.sh (the sandbox denies in-run installs); the skill then
# builds/simulates/broadcasts by bare name. `./hook-deploy.sh` hides the deployer key
# from the command line (secretcurl pattern). Without this grant the invocation is denied.
WRITE_TOOLS="$WRITE_TOOLS,Bash(forge:*),Bash(cast:*),Bash(./hook-deploy.sh:*)"
# sc-audit's optional fuzz arm (SKILL.md S6.5) bare-names solc-select (pick the target
# pragma), crytic-compile (drives the build for slither/echidna/medusa), and the fuzzers
# themselves - medusa is invoked bare (`medusa init`), echidna runs under the timeout
# wrapper (already granted). Staged by scripts/stage-sc-audit.sh (the sandbox denies
# in-run binary installs). slither/forge/cast/timeout are already granted above. Without
# these the fuzz arm degrades to skipped and sc-audit falls back to the agentic pass.
WRITE_TOOLS="$WRITE_TOOLS,Bash(solc-select:*),Bash(crytic-compile:*),Bash(echidna:*),Bash(medusa:*)"

resolve_mode() {
  # var (the runtime selector, e.g. SKILL_VAR from aeon.yml/mcp-server) is
  # optional and checked first: vuln-scanner's shadow/compare evaluation
  # forces read-only regardless of the skill's own mode: frontmatter. This is
  # the one place that check lives - every dispatch surface (aeon.yml via
  # resolve-riva-capabilities.sh, apps/mcp-server/src/skill-executor.ts) must
  # call in here rather than keep its own copy of the selector pattern.
  local skill="$1" var="${2:-}"
  if is_shadow_selector "$skill" "$var"; then
    echo "read-only"
    return
  fi
  # `mode:` frontmatter scalar via the shared _fm reader (strips inline comment,
  # quotes, and surrounding ws); absent file/field -> "" -> the write default.
  local m
  m=$(_fm "$skill" mode)
  case "$m" in
    read-only|readonly|read_only) echo "read-only" ;;
    write|"")                     echo "write" ;;
    *) echo "write" ;;  # unknown value -> safe default, never silently over-restrict
  esac
}

is_shadow_selector() {
  local skill="$1" var="${2:-}"
  [ "$skill" = "vuln-scanner" ] || return 1
  case "$var" in
    shadow|shadow:*|compare|compare:*) return 0 ;;
    *) return 1 ;;
  esac
}

# Write tier = base tools + the repo-mutation tools.
write_tools() { echo "$BASE_TOOLS,$WRITE_TOOLS"; }

# --- Standing notes for a read-only run --------------------------------------
# Several read-only skills (aeon-doctor, github-trending's long slate, and every
# skill whose SKILL.md says `./notify -f <file>`) tell the model to write the
# notify body to a scratch file first. On the claude harness that cannot work:
# this tier has no Write tool and Claude Code refuses shell redirection into a
# file, so the model ends the run with "No pending notifications" while the run
# stays green (live-observed on github-trending, claude-code 2.1.287). The fix
# keeps the tier exactly as narrow as it is: ./notify reads its body from stdin
# (`-f -`), and a quoted heredoc into ./notify is a single Bash(./notify:*) call,
# which the allowlist above already permits. This note tells the model so up
# front, because the skills themselves still say "scratch file". aeon.yml (and
# scripts/dry-run.sh) pass it as --append-system-prompt on read-only runs.
read_only_run_notes() {
  cat <<'NOTES'
This run is read-only. Do not create a scratch file just to hold a ./notify body, even when the skill says to write one and send it with `-f <file>`: pass the body on stdin instead, in ONE Bash call with a quoted heredoc, other ./notify flags first:
./notify --title "Title" -f - <<'NOTIFY_EOF'
message body
NOTIFY_EOF
NOTES
}

# Write tier: Claude Code refuses shell redirection into a file (`>>` a log line,
# `cat > f <<EOF`) even though Bash(cat:*)/Bash(echo:*) are granted, so a model
# that appends memory/logs through the shell burns a denied call and retries with
# Write (live-observed on heartbeat, claude-code 2.1.287). Say so up front.
write_run_notes() {
  cat <<'NOTES'
Write files only with Write/Edit: Write for a new file or a full rewrite, Edit to append or change (Read the file first). Never write files from Bash: `cat > f`, `cat >> f`, `echo ... >> f`, `printf ... > f`, `tee f` and heredocs redirected into a file are always refused in this run and waste a turn. This holds even where a skill's own example shows a shell redirect: make the same write with Write/Edit instead. Pipes between commands are fine.
NOTES
}

# --- Why there is no grok permission mapping here ---------------------------
# There used to be a `grok-args` subcommand that emitted grok's own permission
# grammar (`--allow 'Bash(git *)'` rules plus `--sandbox read-only`) as this
# script's grok-side mirror of allowedTools. It is DELETED, not merely unused,
# and it should not come back in that shape — both halves of it were wrong:
#
#   * The `--allow` rules never gated anything. grok aborts its ENTIRE turn on a
#     denied tool (stopReason=Cancelled) rather than degrading, and skills are
#     authored for Claude Code, so they reach for tools no allowlist predicted.
#     harness-adapter/adapters/grok.sh therefore runs --permission-mode
#     bypassPermissions and carries NO allowlist and NO --deny rules, on purpose.
#   * grok's own `--sandbox read-only` is silently ignored on grok 0.2.101 (writes
#     still land) and nest-conflicts with the wrapper sandbox.
#
# So read-only on grok - as on all nine harnesses - is enforced by the dispatcher's
# OS sandbox (harness-adapter/lib/sandbox.sh: bwrap / sandbox-exec write-locks the
# workspace) plus the workflow's post-run revert. Nothing about that is expressible
# in this file, which is why the mapping is gone instead of rewritten.

# --- Grok Build run-shaping: frontmatter -> GROK_* env -----------------------
# Map optional per-skill frontmatter to the env vars harness-adapter's grok
# adapter reads, so a
# skill can opt into grok's newer headless features without any workflow change:
#
#   effort: high            # low|medium|high|xhigh|max  -> --effort
#   reasoning_effort: high  # same set                   -> --reasoning-effort
#   max_turns: 60           # agentic-turn cap           -> --max-turns
#   best_of_n: 3            # was --best-of-n; grok 1.x removed it (adapter ignores, with a notice)
#   verify: true            # was --check; grok 1.x removed it (adapter ignores, with a notice)
#
# Output is `export GROK_X=...` lines for exactly the fields present, so unset
# fields fall through to the adapter's defaults. aeon.yml's grok branch evals this.
# (This note used to reserve GROK_JSON_SCHEMA for the scorer. The scorer never
# set it and now goes schema-less deliberately, so the knob is gone.)
# read one frontmatter scalar (first '---' block), stripping inline # comment,
# quotes and surrounding whitespace. Prints nothing if absent.
_fm() {
  local skill="$1" key="$2" f="skills/$1/SKILL.md"
  [ -f "$f" ] || return 0
  awk -v k="$key" '
    /^---$/{n++; next}
    n!=1{next}
    /^[^ \t]/{inmeta=0}
    /^metadata:/{inmeta=1}
    # legacy top-level scalar, or the Agent Skills spec form nested under metadata:
    $0 ~ "^"k":" || (inmeta && $0 ~ "^[ \t]+"k":") {
      v=$0; sub("^[ \t]*"k":[ \t]*","",v); sub(/[ \t]*#.*$/,"",v);
      gsub(/^[ \t"'"'"']+|[ \t"'"'"']+$/,"",v); print v; exit
    }' "$f"
}
grok_run_env() {
  local skill="$1" v
  v=$(_fm "$skill" effort);           [ -n "$v" ] && printf 'export GROK_EFFORT=%q\n' "$v"
  v=$(_fm "$skill" reasoning_effort); [ -n "$v" ] && printf 'export GROK_REASONING_EFFORT=%q\n' "$v"
  v=$(_fm "$skill" max_turns);        [ -n "$v" ] && printf 'export GROK_MAX_TURNS=%q\n' "$v"
  v=$(_fm "$skill" best_of_n);        [ -n "$v" ] && printf 'export GROK_BEST_OF_N=%q\n' "$v"
  v=$(_fm "$skill" verify);           [ -n "$v" ] && printf 'export GROK_CHECK=%q\n' "$v"
}

case "${1:-}" in
  mode)          resolve_mode "${2:?skill name required}" "${3:-}" ;;
  allowed-tools)
    case "${2:-write}" in
      read-only|readonly|read_only) echo "$BASE_TOOLS" ;;
      *)                            write_tools ;;
    esac ;;
  grok-run-env)  grok_run_env "${2:?skill name required}" ;;
  run-notes)
    case "${2:-write}" in
      read-only|readonly|read_only) read_only_run_notes ;;
      *)                            write_run_notes ;;
    esac ;;
  is-shadow)
    if is_shadow_selector "${2:?skill name required}" "${3:-}"; then echo true; else echo false; fi ;;
  *) echo "usage: skill_mode.sh {mode <skill> [var]|allowed-tools <mode>|grok-run-env <skill>|run-notes <mode>|is-shadow <skill> [var]}" >&2; exit 2 ;;
esac
