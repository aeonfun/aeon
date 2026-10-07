#!/usr/bin/env bash
# harness-adapter-snapshot.sh - copy harness-adapter/ out of the workspace and
# print the path of the copy's run-harness.
#
#   usage: RH=$(bash scripts/harness-adapter-snapshot.sh)   (before the skill runs)
#
# Why: bash reads a script as it executes it. A skill that rewrites
# harness-adapter/ while it runs (aeon-update syncing upstream into the
# workspace) leaves the running run-harness and adapter reading a file that
# changed under them: "unexpected EOF" once the agent exits, the attempt counts
# as a provider failure, and the gateway cascade re-runs the whole skill
# (aeon-agent run 37300267512). Running from a copy keeps the run on the
# harness it started with; the synced files land in the workspace as before.
#
# The copy lives under $HOME, not $RUNNER_TEMP or /tmp: those are writable
# inside the read-only sandbox (lib/sandbox.sh), and the unsandboxed scorer
# runs this same copy later. $HOME itself stays read-only there. Nothing in
# harness-adapter/ refers to paths outside its own folder, so the copy behaves
# the same.
set -euo pipefail

src="${GITHUB_WORKSPACE:-$(pwd)}/harness-adapter"
dst="${HOME}/.aeon-run/harness-adapter"

[ -f "$src/run-harness" ] || { echo "harness-adapter-snapshot: $src/run-harness missing" >&2; exit 1; }
rm -rf "$dst"
mkdir -p "$dst"
cp -a "$src/." "$dst/"
echo "$dst/run-harness"
