# shellcheck shell=bash
# mcp-translate.sh — translate a Claude-style project .mcp.json for harnesses
# that don't read it natively.
#
#   claude   — reads it via --mcp-config (no translation)
#   grok     — discovers it natively incl. ${VAR} expansion (only needs allow rules)
#   codex    — no project .mcp.json support (openai/codex#13056): -> -c overrides
#   pi       - built-in MCP (0.99+) reads the same {mcpServers} shape from its
#              agent dir: mcp_to_pi_json drops what pi rejects, escapes the
#              values pi would re-expand, and declares tools directly

mcp_expand_vars() {
  # mcp_expand_vars IN OUT — expand ${VAR} refs from the environment into OUT.
  # Unset vars are LEFT AS-IS (unlike envsubst, which silently empties them);
  # their names are printed one per line so callers can warn.
  # Caveat: values containing double quotes would corrupt the JSON — secrets
  # virtually never do, but it's worth knowing.
  local in="$1" out="$2"
  perl -pe 's/\$\{([A-Z_][A-Z0-9_]*)\}/defined $ENV{$1} ? $ENV{$1} : "\${$1}"/ge' \
    < "$in" > "$out"
  grep -oE '\$\{[A-Z_][A-Z0-9_]*\}' "$out" 2>/dev/null | sed -E 's/[${}]//g' | sort -u || true
}

mcp_to_codex_flags() {
  # .mcp.json -> repeated `-c mcp_servers.<name>.<key>=<value>` overrides,
  # one argv token per line (read into an array with a while-read loop).
  # NOTE: codex parses -c values as TOML. JSON strings and arrays are valid TOML;
  # the env OBJECT is emitted as JSON and may need `key = value` inline-table
  # syntax on some codex versions — verify against your installed codex.
  #
  # Scalars and arrays round-trip as JSON because JSON strings/arrays ARE valid
  # TOML. OBJECTS do not: `{"Authorization":"Bearer x"}` is a JSON object, and
  # TOML wants an inline table `{ "Authorization" = "Bearer x" }` (`:` vs `=`).
  # Passing the JSON form makes codex refuse to load its config at all —
  #   Error loading config.toml: invalid type: string "{\"Authorization\":...}",
  #   expected a map in `mcp_servers.probe.http_headers`
  # — so the whole run dies before the model starts, not just MCP. Measured on
  # codex-cli 0.144.6 with an http server carrying an auth header (the shape
  # every real remote MCP server uses). Keys are emitted QUOTED so header names
  # like `X-Api-Key`, which are not TOML bare keys, stay valid.
  jq -r '
    def inline_table: "{ " + ([to_entries[] | "\(.key|tojson) = \(.value|tojson)"] | join(", ")) + " }";
    .mcpServers // {} | to_entries[] |
    .key as $k | .value as $s |
    ( if $s.command then
        ["mcp_servers.\($k).command=\($s.command | tojson)"]
        + (if $s.args then ["mcp_servers.\($k).args=\($s.args | tojson)"] else [] end)
        + (if $s.env then ["mcp_servers.\($k).env=\($s.env | inline_table)"] else [] end)
      elif $s.url then
        ["mcp_servers.\($k).url=\($s.url | tojson)"]
        + (if $s.headers then ["mcp_servers.\($k).http_headers=\($s.headers | inline_table)"] else [] end)
      else [] end
    ) | .[] | "-c", .' "$1"
}

mcp_to_vibe_toml() {
  # .mcp.json -> [[mcp_servers]] array-of-tables for Mistral Vibe's config.toml.
  # Vibe declares `mcp_servers = []` (an inline empty array); the adapter strips
  # that line before appending these tables, since TOML forbids extending an
  # inline-declared array with [[table]] syntax ("immutable namespace").
  # env/headers become TOML inline tables ({ K = "V" }), not JSON objects.
  jq -r '
    .mcpServers // {} | to_entries[] |
    (["", "[[mcp_servers]]", "name = \(.key|tojson)"] +
     ( if .value.command then
         ["transport = \"stdio\"", "command = \(.value.command|tojson)"]
         + (if .value.args then ["args = \(.value.args|tojson)"] else [] end)
         + (if .value.env then ["env = { \(.value.env|to_entries|map("\(.key) = \(.value|tojson)")|join(", ")) }"] else [] end)
       elif .value.url then
         ["transport = \"http\"", "url = \(.value.url|tojson)"]
         + (if .value.headers then ["headers = { \(.value.headers|to_entries|map("\(.key) = \(.value|tojson)")|join(", ")) }"] else [] end)
       else [] end)) | .[]' "$1"
}

mcp_to_pi_json() {
  # mcp_to_pi_json IN OUT - Claude .mcp.json -> pi's mcp.json ({mcpServers:...}).
  # Prints one "<server>: <reason>" line per SKIPPED entry on stdout so the
  # caller can warn; never fails the run over a bad entry. Checks mirror pi
  # 0.99.2's validateMcpServerConfig (dist/core/mcp-servers.js:100):
  #   * name must match ^[A-Za-z0-9_-]+$; names equal after `-` -> `_` share a
  #     tool namespace, so the later one is skipped (pi would reject it too).
  #   * type "sse" is rejected (legacy transport); any type other than stdio,
  #     http, streamable-http is skipped. `url` (http/https) wins over `command`
  #     when both are present, as in pi.
  # Rewrites:
  #   * `exposure` defaults to "direct". pi's default ("codemode") hides MCP tools
  #     behind a codemode script, AND the startup wait before the first model
  #     request covers only servers with direct tools (dist/extensions/mcp/
  #     index.js:869-895); direct keeps `mcp__<server>__<tool>` declared like the
  #     other harnesses. An explicit exposure/toolExposure is kept as written.
  #   * env / headers / oauth.clientSecret values: run-harness already expanded
  #     ${VAR}s, but pi expands `$VAR`/`${VAR}` in these values AGAIN and runs a
  #     value that starts with `!` as a shell command
  #     (dist/core/resolve-config-value.js:61-66, :123-129). `$` -> `$$` and a
  #     leading `!` -> `$!` (pi's own escapes) keep each value exactly as
  #     run-harness produced it: a secret containing `$` stays intact and an unset
  #     ${VAR} stays literal instead of failing the server.
  local in="$1" out="$2" res
  res=$(jq -c '
    def esc: if type == "string" then gsub("\\$"; "$$") | (if startswith("!") then "$" + . else . end) else . end;
    def escmap: if type == "object" then map_values(esc) else . end;
    def why($n; $s):
      if ($n | test("^[A-Za-z0-9_-]+$") | not) then "invalid server name (pi allows letters, digits, _ and -)"
      elif ($s | type) != "object" then "entry is not an object"
      elif $s.type == "sse" then "legacy SSE transport is not supported by pi; use the server'"'"'s streamable HTTP URL"
      elif ($s.type != null and ([$s.type] | inside(["stdio", "http", "streamable-http"]) | not)) then "unsupported type \($s.type | tojson)"
      elif (($s.url | type) == "string" and ($s.type == null or $s.type == "http" or $s.type == "streamable-http")) then
        (if ($s.url | test("^https?://")) then null else "url must be http or https" end)
      elif (($s.command | type) == "string" and ($s.type == null or $s.type == "stdio")) then null
      else "needs \"command\" (stdio) or \"url\" (streamable HTTP)" end;
    reduce ((.mcpServers // {}) | to_entries[]) as $e ({servers: {}, ns: {}, skipped: []};
      why($e.key; $e.value) as $r
      | ($e.key | gsub("-"; "_")) as $ns
      | if $r != null then .skipped += ["\($e.key): \($r)"]
        elif .ns[$ns] != null then .skipped += ["\($e.key): name clashes with \(.ns[$ns] | tojson) (pi treats - and _ as the same)"]
        else .ns[$ns] = $e.key
          | .servers[$e.key] = ($e.value
              | (if has("exposure") or has("toolExposure") then . else .exposure = "direct" end)
              | (if has("env") then .env |= escmap else . end)
              | (if has("headers") then .headers |= escmap else . end)
              | (if (.oauth | type) == "object" and (.oauth | has("clientSecret")) then .oauth.clientSecret |= esc else . end))
        end)
    | {config: {mcpServers: .servers}, skipped: .skipped}' "$in") || return 1
  jq '.config' <<<"$res" > "$out"
  jq -r '.skipped[]' <<<"$res"
}
