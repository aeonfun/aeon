#!/usr/bin/env bash
# mcp-denied-tools.sh - print the MCP tools no skill run may call, as one
# comma-joined list in Claude's tool grammar (mcp__<server>__<tool>).
#
#   usage: bash scripts/mcp-denied-tools.sh [.mcp.json] [denied-tools.json]
#
# catalog/mcp-denied-tools.json maps a server URL to tool names that change
# state (e.g. the ICP server's canister_update_call). Matching is by URL, not by
# server name, so a server added under another name (icp-mcp) is still covered.
# The workflows pass the list to run-harness --disallowed-tools, which blocks
# the tools at run time instead of trusting the skill prompt. The same lists
# live on the dashboard catalog entries as deniedTools (a test keeps them equal).
# Prints nothing when no connected server has denied tools. Never fails the run.
set -uo pipefail

mcp="${1:-.mcp.json}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
deny="${2:-$here/../catalog/mcp-denied-tools.json}"
[ -f "$mcp" ] && [ -f "$deny" ] || exit 0

jq -r --slurpfile d "$deny" '
  def norm: sub("/+$"; "");
  ($d[0] | with_entries(.key |= norm)) as $map
  | [ .mcpServers // {} | to_entries[]
      | select(.value | type == "object" and (.url | type) == "string")
      | .key as $srv
      | ($map[.value.url | norm] // [])[]
      | "mcp__\($srv)__\(.)" ]
  | join(",")
' "$mcp" 2>/dev/null || true
