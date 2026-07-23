# tools-grammar.sh — parse Claude Code's --allowedTools grammar and translate it
# into each harness's native permission shape.
#
# Claude grammar (the lingua franca): comma-separated tokens, e.g.
#   Read,Glob,Grep,WebFetch,Write,Edit,Bash(git:*),Bash(curl:*)
# Bash rules use colon-globs: Bash(cmd:*). Bare names allow the whole tool.

tools_has_write() {
  # exit 0 iff the toolset includes a repo-mutation tool (Write or Edit)
  case ",$1," in
    *,Write,* | *,Edit,*) return 0 ;;
  esac
  return 1
}

tools_bash_cmds() {
  # extract CMD from every Bash(CMD:*) token, one per line
  tr ',' '\n' <<<"$1" | sed -n 's/^Bash(\(.*\):\*)$/\1/p'
}

tools_to_opencode_permission() {
  # Claude allowedTools -> opencode.json "permission" object.
  # opencode semantics: last matching rule wins, so "*" (deny) must come FIRST.
  # Headless opencode auto-rejects "ask", so deny/allow are the only states we emit.
  local tools="$1" edit rules
  if tools_has_write "$tools"; then edit="allow"; else edit="deny"; fi
  rules=$(tools_bash_cmds "$tools" \
    | jq -Rn '[inputs | select(length > 0) | {key: (. + " *"), value: "allow"}] | from_entries')
  jq -cn --arg edit "$edit" --argjson rules "$rules" \
    '{read: "allow", grep: "allow", glob: "allow",
      webfetch: "allow", websearch: "allow",
      edit: $edit,
      bash: ({"*": "deny"} + $rules)}'
}

tools_to_pi_exclude() {
  # Claude allowedTools / mode -> pi --exclude-tools value. pi has no permission
  # system ("YOLO mode"); the only native lever is subsetting its toolset.
  # Prints nothing for write mode (pi keeps its full toolset).
  #
  # This USED TO emit `--tools read,grep,find,ls`, an allowlist. pi's built-ins
  # are read/bash/edit/write and it has NO web tool, so that allowlist dropped
  # `bash` — pi's only route to the network. Read-only skills then could not
  # fetch anything. Measured on a real aeon runner: pi ended github-trending
  # with "there is no network access available through the provided tools" and
  # delivered a menu of options instead of a report. That statement was
  # literally TRUE, and the cause was this function.
  #
  # read-only means "cannot MUTATE the workspace", not "cannot act". The
  # mutation guard is the dispatcher's wrapper OS sandbox (lib/sandbox.sh), as
  # adapters/pi.sh's own header says; dropping write/edit here is belt-and-braces
  # so the model is not even offered a tool that would fail. bash stays, so
  # curl — which aeon's read-only toolset explicitly grants as Bash(curl:*) —
  # keeps working, and any write attempted through it hits the sandbox.
  local tools="$1"
  if ! tools_has_write "$tools"; then
    echo "write,edit"
  fi
}
