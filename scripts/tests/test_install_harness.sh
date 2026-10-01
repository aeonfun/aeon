#!/usr/bin/env bash
# Tests for scripts/install-harness.sh — the shared CLI+auth staging used by BOTH
# aeon.yml and messages.yml.
#
# Fake `npm`/`pipx` on PATH record their argv instead of installing, and $HOME is
# a temp dir, so the real work under test is what this step actually gets wrong:
# the generated provider config, and the supply-chain version pins.
#
# The codex config is the sharp case. codex parses config as TOML and fails the
# whole run on a malformed one — and it removed wire_api="chat" as a hard
# config-load error, which reads as a dead model, not a config bug. That class of
# failure was previously only discoverable by dispatching a real run.
#
# Run: bash scripts/tests/test_install_harness.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
I="$ROOT/scripts/install-harness.sh"
fail=0
pass() { echo "ok   - $1"; }
bad()  { echo "FAIL - $1"; fail=1; }

BIN="$(mktemp -d)"
cleanup() { rm -rf "$BIN"; }
trap cleanup EXIT

for tool in npm pipx; do
  cat > "$BIN/$tool" <<EOF
#!/usr/bin/env bash
printf '%s\n' "\$@" >> "\$PKG_LOG"
EOF
  chmod +x "$BIN/$tool"
done
# fx / cursor / hermes are pinned downloads (curl -o, then a sha256 check), so a
# fake curl serves local fixtures instead of the network and records each URL.
FIX="$BIN/fixtures"; export FIX
mkdir -p "$FIX/fx" "$FIX/cursor/dist-package"
printf '#!/bin/sh\necho fake-fx\n' > "$FIX/fx/fx"
printf '#!/bin/sh\necho fake-cursor\n' > "$FIX/cursor/dist-package/cursor-agent"
chmod +x "$FIX/fx/fx" "$FIX/cursor/dist-package/cursor-agent"
tar -czf "$FIX/fx.tar.gz" -C "$FIX/fx" fx
tar -czf "$FIX/cursor.tar.gz" -C "$FIX/cursor" dist-package
# The fake hermes installer records its argv and which credentials it could see.
# It writes under $HOME because its env is scrubbed (no PKG_LOG in there).
cat > "$FIX/hermes-install.sh" <<'EOF'
echo "installer-args=$*" >> "$HOME/installer.log"
echo "installer-env=[${GH_GLOBAL:-}|${GH_SECRETS_PAT:-}|${GH_TOKEN:-}|${GITHUB_TOKEN:-}|${OPENROUTER_API_KEY:-}|${HERMES_AUTH:-}|${ANTHROPIC_API_KEY:-}]" >> "$HOME/installer.log"
EOF
cat > "$BIN/curl" <<'EOF'
#!/usr/bin/env bash
out="" url=""
while [ $# -gt 0 ]; do
  case "$1" in -o|--retry) [ "$1" = -o ] && out="$2"; shift 2 ;; -*) shift ;; *) url="$1"; shift ;; esac
done
printf 'curl %s\n' "$url" >> "$PKG_LOG"
case "$url" in
  https://releases.fx.sh/*) cp "$FIX/fx.tar.gz" "$out" ;;
  https://downloads.cursor.com/*) cp "$FIX/cursor.tar.gz" "$out" ;;
  https://raw.githubusercontent.com/NousResearch/hermes-agent/*/scripts/install.sh) cp "$FIX/hermes-install.sh" "$out" ;;
  *) exit 22 ;;
esac
EOF
chmod +x "$BIN/curl"
sha() { if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }
FX_SUM="FX_SHA256=$(sha "$FIX/fx.tar.gz")"
CURSOR_SUM="CURSOR_SHA256=$(sha "$FIX/cursor.tar.gz")"
HERMES_SUM="HERMES_INSTALLER_SHA256=$(sha "$FIX/hermes-install.sh")"

# run <harness> [env...] -> stages into a fresh $HOME; sets H_DIR and PKG_LOG
run() {
  local h="$1"; shift
  H_DIR="$(mktemp -d)"
  PKG_LOG="$H_DIR/pkg.log"; : > "$PKG_LOG"
  env PATH="$BIN:$PATH" HOME="$H_DIR" PKG_LOG="$PKG_LOG" GITHUB_PATH="" "$@" \
    bash "$I" "$h" >"$H_DIR/out.txt" 2>&1
  return $?
}

# --- 1. claude is a no-op, unknown is fatal --------------------------------
# Callers may invoke this unconditionally, so claude must succeed and do nothing.
run claude && [ ! -e "$H_DIR/.codex" ] \
  && pass "claude: no-op, exit 0" || bad "claude should be a no-op"
if run banana; then bad "unknown harness must fail"; else
  grep -q "no install recipe" "$H_DIR/out.txt" \
    && pass "unknown harness exits non-zero with a named error" \
    || bad "unknown harness error message"
fi

# --- 2. codex config generation --------------------------------------------
run codex HM=openai/gpt-6-luna AUTH_MODE=openrouter OPENROUTER_API_KEY=sk-test
CFG="$H_DIR/.codex/config.toml"
if [ -f "$CFG" ]; then
  # wire_api MUST be "responses": codex 0.144.6 removed "chat" as a hard
  # config-load error, which kills the run before the model is ever reached.
  grep -q 'wire_api = "responses"' "$CFG" \
    && pass "codex/openrouter: wire_api is responses" || bad "codex wire_api"
  grep -q 'model = "openai/gpt-6-luna"' "$CFG" \
    && pass "codex/openrouter: HM lands in the config" || bad "codex model"
  # OpenRouter 400s a reasoning-disabled request to /responses.
  grep -q 'model_reasoning_effort' "$CFG" \
    && pass "codex/openrouter: reasoning effort set" || bad "codex reasoning effort"
  # TOML, not JSON: a JSON object here is what silently killed codex's MCP config.
  grep -q '^\[model_providers.openrouter\]' "$CFG" \
    && pass "codex/openrouter: provider is a TOML table" || bad "codex provider table"
else bad "codex/openrouter: no config written"; fi

run codex AUTH_MODE=native-key
CFG="$H_DIR/.codex/config.toml"
if [ -f "$CFG" ]; then
  # native-key uses codex's built-in openai provider — an OpenRouter block here
  # would override the operator's own account.
  grep -q 'openrouter' "$CFG" && bad "codex/native-key must not write an OpenRouter block" \
    || pass "codex/native-key: no OpenRouter block"
else bad "codex/native-key: no config written"; fi

# --- 3. kimi + vibe config generation --------------------------------------
run kimi HM=moonshotai/kimi-k2.6 AUTH_MODE=openrouter OPENROUTER_API_KEY=sk-test
CFG="$H_DIR/.kimi-code/config.toml"
if [ -f "$CFG" ]; then
  # kimi resolves --model through an ALIAS, so default_model must be the alias and
  # the real id lives under [models.<alias>]. run-harness then passes no --model.
  grep -q 'default_model = "or-cheap"' "$CFG" \
    && pass "kimi: default_model is the alias" || bad "kimi alias"
  grep -q 'model = "moonshotai/kimi-k2.6"' "$CFG" \
    && pass "kimi: HM lands under the alias" || bad "kimi model"
  # The config holds a live provider key.
  PERM=$(ls -l "$CFG" | cut -c1-10)
  [ "$PERM" = "-rw-------" ] \
    && pass "kimi: config is chmod 600 (holds a provider key)" || bad "kimi config perms ($PERM)"
else bad "kimi: no config written"; fi

# Moonshot key: the kimi-native alias pins Moonshot's own model id.
run kimi HM=moonshotai/kimi-k2.6 AUTH_MODE=native-key MOONSHOT_API_KEY=sk-test
CFG="$H_DIR/.kimi-code/config.toml"
{ grep -q 'default_model = "kimi-native"' "$CFG" && grep -q 'model = "kimi-k2.6"' "$CFG"; } 2>/dev/null \
  && pass "kimi/native-key: kimi-native alias pins kimi-k2.6" || bad "kimi native-key model"

run vibe HM=mistralai/mistral-medium-3-5 AUTH_MODE=openrouter OPENROUTER_API_KEY=sk-test
CFG="$H_DIR/.vibe/config.toml"
grep -q 'alias = "or-cheap"' "$CFG" 2>/dev/null \
  && pass "vibe/openrouter: alias config written" || bad "vibe openrouter config"
# With a Mistral key, vibe's DEFAULT provider is already Mistral — writing an
# OpenRouter config would silently redirect the operator's own account.
run vibe AUTH_MODE=native-key
[ ! -f "$H_DIR/.vibe/config.toml" ] \
  && pass "vibe/native-key: no config (Mistral is vibe's default)" || bad "vibe native-key wrote a config"

# fx has no OpenRouter fallback (see resolve-harness.sh), so unlike every other
# harness here there's no config-generation branch to test — just: does the
# native-key path succeed and stage nothing, and does a missing credential fail
# closed instead of installing a CLI that's guaranteed to fail later.
if run fx AUTH_MODE=native-key AI_GATEWAY_API_KEY=sk-test "$FX_SUM"; then
  [ -x "$H_DIR/.local/bin/fx" ] \
    && pass "fx/native-key: verified binary installed to ~/.local/bin" || bad "fx binary not installed"
else
  bad "fx/native-key with AI_GATEWAY_API_KEY should succeed ($(tail -1 "$H_DIR/out.txt"))"
fi
if run fx AUTH_MODE=openrouter "$FX_SUM"; then
  bad "fx with no credential and no OpenRouter fallback should fail closed"
else
  grep -q "AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN" "$H_DIR/out.txt" \
    && pass "fx: missing credential fails closed, names both accepted vars" \
    || bad "fx missing-credential error message"
fi

# --- 4. supply-chain pins ---------------------------------------------------
# An unpinned `-g` install runs whatever the registry serves, in CI, with the
# run's secrets in env. Two codex cells already failed this way when unpinned.
run codex AUTH_MODE=openrouter OPENROUTER_API_KEY=sk-test
grep -q '@openai/codex@[0-9]' "$PKG_LOG" \
  && pass "codex: install is version-pinned" || bad "codex pin missing"
run pi AUTH_MODE=openrouter OPENROUTER_API_KEY=sk-test
grep -q '@earendil-works/pi-coding-agent@[0-9]' "$PKG_LOG" \
  && pass "pi: install is version-pinned" || bad "pi pin missing"
grep -qx -- '--ignore-scripts' "$PKG_LOG" \
  && pass "pi: --ignore-scripts (no postinstall)" || bad "pi --ignore-scripts missing"
run kimi AUTH_MODE=openrouter OPENROUTER_API_KEY=sk-test
grep -q '@moonshot-ai/kimi-code@[0-9]' "$PKG_LOG" \
  && pass "kimi: install is version-pinned" || bad "kimi pin missing"
grep -qx -- '--ignore-scripts' "$PKG_LOG" \
  && pass "kimi: --ignore-scripts (no postinstall)" || bad "kimi --ignore-scripts missing"
run vibe AUTH_MODE=native-key
grep -q 'mistral-vibe==[0-9]' "$PKG_LOG" \
  && pass "vibe: install is version-pinned" || bad "vibe pin missing"

# --- 5. missing credential fails closed, and names the secret ---------------
# Found writing these tests. `set -u` + an unbound key killed the script
# MID-HEREDOC: bash had already created config.toml, so the harness was left with
# a 0-byte config and an error naming a shell variable rather than the secret.
# Inside a workflow the `env:` block always binds these (empty when unset), so it
# never fired there — it only appears the moment this is callable standalone,
# which is exactly what this extraction makes it.
if run kimi AUTH_MODE=openrouter; then
  bad "kimi with no OPENROUTER_API_KEY should fail"
else
  grep -q "needs OPENROUTER_API_KEY" "$H_DIR/out.txt" \
    && pass "missing key: error names the secret" || bad "missing-key error should name the secret"
  [ ! -s "$H_DIR/.kimi-code/config.toml" ] 2>/dev/null && [ ! -f "$H_DIR/.kimi-code/config.toml" ] \
    && pass "missing key: no truncated config left behind" \
    || bad "missing key left a partial config.toml"
fi
if run codex AUTH_MODE=native-oauth; then
  bad "codex native-oauth with no CODEX_AUTH should fail"
else
  grep -q "needs CODEX_AUTH" "$H_DIR/out.txt" \
    && pass "missing OAuth capture: error names the secret" || bad "CODEX_AUTH error message"
fi

# --- 6. third-party installers: pinned, checksum-gated, credential-free -------
# fx / cursor / hermes are not on a registry; they used to be `curl | bash` of
# whatever the vendor served. Each must fetch ONE pinned artifact, refuse it on a
# sha256 mismatch (before extracting or running anything), and run vendor code
# with no GitHub token and no provider key in env.
run fx AI_GATEWAY_API_KEY=sk-test AUTH_MODE=native-key "$FX_SUM"
grep -Eq '^curl https://releases\.fx\.sh/v[0-9][^/]*/fx-(linux|macos)-(x86_64|aarch64)\.tar\.gz$' "$PKG_LOG" \
  && pass "fx: downloads a version-pinned release tarball" || bad "fx: not pinned ($(cat "$PKG_LOG"))"
run cursor CURSOR_API_KEY=ck-test "$CURSOR_SUM"
grep -Eq '^curl https://downloads\.cursor\.com/lab/[0-9]{4}\.[0-9]{2}\.[0-9]{2}-[0-9a-f]+/(linux|darwin)/(x64|arm64)/agent-cli-package\.tar\.gz$' "$PKG_LOG" \
  && pass "cursor: downloads a version-pinned build" || bad "cursor: not pinned ($(cat "$PKG_LOG"))"
[ -x "$H_DIR/.local/bin/agent" ] && "$H_DIR/.local/bin/agent" | grep -q fake-cursor \
  && pass "cursor: ~/.local/bin/agent links the verified build" || bad "cursor: agent link missing"
GH_ENV=(GH_GLOBAL=ghp_global GH_SECRETS_PAT=ghp_pat GH_TOKEN=ghs_tok GITHUB_TOKEN=ghs_wf ANTHROPIC_API_KEY=sk-ant)
if run hermes "${GH_ENV[@]}" OPENROUTER_API_KEY=sk-test AUTH_MODE=openrouter "$HERMES_SUM"; then
  pin=$(sed -n 's|^curl https://raw.githubusercontent.com/NousResearch/hermes-agent/\([0-9a-f]\{40\}\)/scripts/install.sh$|\1|p' "$PKG_LOG")
  [ -n "$pin" ] && pass "hermes: installer fetched from a pinned commit" || bad "hermes: installer not pinned ($(cat "$PKG_LOG"))"
  grep -q -- "^installer-args=--commit $pin " "$H_DIR/installer.log" \
    && pass "hermes: installer checks out that same commit (--commit)" || bad "hermes: --commit missing ($(cat "$H_DIR/installer.log"))"
  grep -qx 'installer-env=\[||||||\]' "$H_DIR/installer.log" \
    && pass "hermes: installer runs without GitHub or provider credentials" \
    || bad "hermes: installer saw a credential ($(grep installer-env "$H_DIR/installer.log"))"
else
  bad "hermes: install failed ($(tail -1 "$H_DIR/out.txt"))"
fi
# Fail closed: the fixtures are not the real artifacts, so the built-in pins
# reject them, nothing is installed or run, and the error says why.
for spec in "fx AI_GATEWAY_API_KEY=sk-test AUTH_MODE=native-key" "cursor CURSOR_API_KEY=ck-test" \
            "hermes OPENROUTER_API_KEY=sk-test AUTH_MODE=openrouter"; do
  read -r -a parts <<<"$spec"
  if run "${parts[0]}" "${parts[@]:1}"; then
    bad "${parts[0]}: installed an artifact whose sha256 does not match the pin"
  elif grep -q "sha256 mismatch" "$H_DIR/out.txt" && [ ! -e "$H_DIR/.local/bin/fx" ] \
       && [ ! -e "$H_DIR/.local/bin/agent" ] && [ ! -e "$H_DIR/installer.log" ]; then
    pass "${parts[0]}: changed artifact fails closed before install"
  else
    bad "${parts[0]}: mismatch not reported or something ran ($(tail -1 "$H_DIR/out.txt"))"
  fi
done
# A version override without its checksum is refused, not run unverified.
if run fx FX_VERSION=v9.9.9 AI_GATEWAY_API_KEY=sk-test; then
  bad "fx: version override without FX_SHA256 should fail"
else
  grep -q "no pinned sha256" "$H_DIR/out.txt" \
    && pass "fx: version override without a checksum is refused" || bad "fx override error ($(tail -1 "$H_DIR/out.txt"))"
fi

echo "---"
[ "$fail" = "0" ] && echo "ALL PASS" || echo "SOME FAILED"
exit "$fail"
