#!/usr/bin/env bash
# install-harness — stage a harness CLI and its provider auth on the runner.
#
# Extracted from aeon.yml's "Install harness CLI" step so every workflow that
# launches an agent can stage any of the six. It was inline in aeon.yml, which is
# the only reason messages.yml supported just claude/grok: a repo configured for
# codex/pi/vibe/kimi had its inbound messages answered on claude, because nothing
# on that workflow could install the CLI. Same class of bug as the two-path grok
# trap (#784) — a capability that exists on one surface and silently doesn't on
# another. The logic lives here now; each workflow supplies its own `env:` block,
# since `secrets.*` only resolves inside a workflow.
#
# Usage:
#   bash scripts/install-harness.sh [harness]      # or set $H
#
# claude is a no-op: workflows install it themselves (pinned + npm-cached) and it
# needs no per-provider auth. Calling this with `claude` is therefore fine and
# does nothing, so a caller can invoke it unconditionally.
#
# Inputs (env):
#   H            harness name (or $1)
#   HM           harness model — the OpenRouter id baked into the staged config
#   AUTH_MODE    native-oauth | native-key | openrouter   (from resolve-harness.sh)
#   plus the provider credentials for that harness (see the cases below)
#
# Everything written lands in the runner's ephemeral $HOME and is never echoed.
set -euo pipefail

H="${1:-${H:-}}"
HM="${HM:-}"
AUTH_MODE="${AUTH_MODE:-openrouter}"

# Fail CLOSED on a missing provider credential, and say which one.
#
# Inside a workflow every key below is declared in the step's `env:` block, so it
# is always *bound* (empty when the secret is unset) and `set -u` never fires.
# Standalone — messages.yml, a local run, apps/mcp-server — an undeclared key is
# unbound, and under `set -u` the heredoc dies MID-EXPANSION: bash has already
# created the file, so the harness is left holding a 0-byte config.toml and the
# error names a shell variable rather than the missing secret. Check first.
need() {  # need VAR_NAME "what to set"
  local name="$1" hint="$2"
  if [ -z "${!name:-}" ]; then
    echo "::error::$H needs $name — $hint" >&2
    exit 1
  fi
}

# Third-party installers (fx, cursor, hermes) are not on a package registry, so
# they used to be `curl ... | bash`: whatever the vendor served that minute ran in
# a step whose env holds GH_GLOBAL / GH_SECRETS_PAT and the provider keys. Each
# is now PINNED to one release and its bytes are sha256-checked BEFORE anything
# is extracted or run, so a changed artifact fails closed with a named error
# instead of executing. fx and cursor are plain release tarballs (we unpack them
# the way the vendor script would, no vendor shell runs at all); hermes's
# installer is fetched from its pinned commit and run with --commit <pin>.
# Bump: download the new artifact, verify it, update the version + sha256 here.
# Same env-override shape as run-grok.sh's GROK_CLI_VERSION, but an override
# must also set the matching *_SHA256, or the guard refuses it.
FX_PIN=v0.0.12
CURSOR_PIN=2026.10.01-14929f9
HERMES_PIN=f97608f178d1ffeca59860195ab7da295f7c8e5f   # hermes-agent release v2026.9.24
FX_VERSION="${FX_VERSION:-$FX_PIN}"
CURSOR_VERSION="${CURSOR_VERSION:-$CURSOR_PIN}"
HERMES_COMMIT="${HERMES_COMMIT:-$HERMES_PIN}"

# pin_platform -> "<os> <arch>" as linux|darwin x86_64|aarch64, or fail closed.
pin_platform() {
  local os arch
  case "$(uname -s)" in Linux) os=linux ;; Darwin) os=darwin ;; *) os="" ;; esac
  case "$(uname -m)" in x86_64|amd64) arch=x86_64 ;; arm64|aarch64) arch=aarch64 ;; *) arch="" ;; esac
  if [ -z "$os" ] || [ -z "$arch" ]; then
    echo "::error::$H: no pinned build for $(uname -s)/$(uname -m)" >&2
    exit 1
  fi
  echo "$os $arch"
}

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1
  else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

# fetch_pinned URL SHA256 DEST -> download, then fail closed unless the bytes match.
fetch_pinned() {
  local url="$1" want="$2" dest="$3" got
  if [ -z "$want" ]; then
    echo "::error::$H: no pinned sha256 for $url (set the matching *_SHA256 with any version override)" >&2
    exit 1
  fi
  curl -fsSL --retry 3 "$url" -o "$dest" || { echo "::error::$H: download failed: $url" >&2; exit 1; }
  got="$(sha256_of "$dest")"
  if [ "$got" != "$want" ]; then
    rm -f "$dest"
    echo "::error::$H: sha256 mismatch for $url (expected $want, got $got). Refusing to install an unverified artifact; if the vendor shipped a new release, verify it and bump the pin in scripts/install-harness.sh." >&2
    exit 1
  fi
}

PIN_TMP=""
pin_tmp() {
  PIN_TMP="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/install-harness.XXXXXX")"
  trap 'rm -rf "$PIN_TMP"' EXIT
}

# Run a third-party installer with a minimal env: none of them needs a GitHub
# token or a provider key to install, so neither GH_GLOBAL / GH_SECRETS_PAT nor
# OPENROUTER_API_KEY / CURSOR_API_KEY / HERMES_AUTH / ... reach vendor code.
clean_env() {
  local keep=() v
  for v in PATH HOME USER LOGNAME SHELL LANG LC_ALL TERM TMPDIR RUNNER_TEMP CI GITHUB_ACTIONS \
           HTTP_PROXY HTTPS_PROXY NO_PROXY http_proxy https_proxy no_proxy; do
    [ -n "${!v+x}" ] && keep+=("$v=${!v}")
  done
  env -i ${keep[@]+"${keep[@]}"} "$@"
}

# Each harness is configured for the provider AUTH_MODE selected:
#   native-oauth — restore the captured login (~/.codex, ~/.kimi-code); the
#                  harness then runs on its own default model.
#   native-key   — the provider's own API key (codex→OpenAI, kimi→Moonshot,
#                  vibe→Mistral, pi→Anthropic/OpenAI from env).
#   openrouter   — the shared OPENROUTER_API_KEY (the default; one key covers all
#                  four). $HM is the OpenRouter model here.
case "$H" in
  claude|"")
    # Installed by the workflow itself (pinned, npm-cached), no provider auth.
    echo "claude: installed by the workflow (no per-provider auth needed)"
    exit 0 ;;
  grok)
    # Install the pinned grok CLI + restore its auth (GROK_CREDENTIALS X-account
    # OAuth, or XAI_API_KEY). run-grok.sh's `setup` subcommand runs ONLY those two
    # steps and exits — the actual run then goes through run-harness grok, on
    # grok's own auth. Keeping the pin + restore in one place is why this shells
    # out rather than inlining an `npm install -g @xai-official/grok`.
    # run-grok.sh setup exits 0 even when the OAuth refresh degrades (a stale
    # on-disk token may still have some life), so its exit code cannot tell us
    # whether auth is healthy. Hand it a marker path instead: if it comes back
    # touched, the refresh failed and printing "auth staged" would be a lie.
    GROK_DEGRADED_MARKER="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/grok-auth-degraded.$$"
    export GROK_DEGRADED_MARKER
    rm -f "$GROK_DEGRADED_MARKER"
    bash "${GITHUB_WORKSPACE:-$(pwd)}/scripts/run-grok.sh" setup
    if [ -f "$GROK_DEGRADED_MARKER" ]; then
      rm -f "$GROK_DEGRADED_MARKER"
      echo "grok: CLI installed, auth DEGRADED (OAuth refresh failed; using the existing on-disk token, which may be expired) (auth: ${AUTH_MODE:-native})"
    else
      echo "grok: CLI + auth staged (auth: ${AUTH_MODE:-native})"
    fi ;;
  codex)
    # PINNED, like aeon pins claude-code. Unpinned, this step silently tracked
    # latest: two cells that passed on 2026-07-21 failed hours later with an
    # OpenRouter 400 and nothing in the repo had changed.
    # --ignore-scripts (same hardening as pi/kimi): codex ships its binary via
    # optional platform packages (@openai/codex-<os>-<arch>), NOT a postinstall
    # fetch, so blocking lifecycle scripts is safe and denies a compromised
    # release an auto-run install hook in the run's secret env. If a future pin
    # needs a postinstall binary fetch, drop this flag (keep the pin).
    npm install -g --ignore-scripts @openai/codex@0.144.6
    mkdir -p "$HOME/.codex"
    case "$AUTH_MODE" in
      native-oauth)
        # Restore the ChatGPT login captured by `aeon auth --harness codex`
        # (tar+base64 of ~/.codex/auth.json). codex refreshes the access token
        # from the refresh token at run start and uses its own default model —
        # no config needed, no OpenRouter.
        need CODEX_AUTH "the ChatGPT login capture from 'aeon auth --harness codex'"
        printf '%s' "$CODEX_AUTH" | base64 -d | tar xzf - -C "$HOME"
        chmod 600 "$HOME/.codex/auth.json" || true
        echo "codex: restored ChatGPT login" ;;
      native-key)
        # OPENAI_API_KEY in env → codex's built-in `openai` provider (its
        # default), on codex's default model. No OpenRouter block.
        cat > "$HOME/.codex/config.toml" <<'TOML'
model_reasoning_effort = "medium"
TOML
        echo "codex: OpenAI API key" ;;
      *)
        # wire_api MUST be "responses": codex 0.144.6 removed "chat" ("no longer
        # supported", a hard config-load error), and OpenRouter does serve
        # /api/v1/responses. Both verified 2026-07-21.
        cat > "$HOME/.codex/config.toml" <<TOML
model = "$HM"
model_provider = "openrouter"
# OpenRouter rejects a reasoning-disabled request to this endpoint:
# 400 "Reasoning is mandatory for this endpoint and cannot be disabled."
model_reasoning_effort = "medium"

[model_providers.openrouter]
name = "OpenRouter"
base_url = "https://openrouter.ai/api/v1"
env_key = "OPENROUTER_API_KEY"
wire_api = "responses"
TOML
        echo "codex: OpenRouter" ;;
    esac
    ;;
  pi)
    # PINNED (like codex/claude): an unpinned `-g` install silently tracks latest
    # and would run whatever the registry serves in CI with the run's secrets in
    # env. 0.80.9 is the version verified live 2026-07-22.
    # --ignore-scripts: pi's postinstall is not needed headless.
    npm install -g --ignore-scripts @earendil-works/pi-coding-agent@0.80.9
    # pi picks its provider from whichever key is in env at RUN time
    # (ANTHROPIC_API_KEY / OPENAI_API_KEY native, else OPENROUTER_API_KEY with
    # --model openrouter/…). No config file either way.
    echo "pi: $AUTH_MODE (env-driven)"
    ;;
  kimi)
    # PINNED + --ignore-scripts: same supply-chain hardening as pi/codex. 0.28.0
    # is the version verified live 2026-07-22. If a future CI run shows kimi's
    # install needs a postinstall binary fetch, drop --ignore-scripts (keep the pin).
    npm install -g --ignore-scripts @moonshot-ai/kimi-code@0.28.0
    mkdir -p "$HOME/.kimi-code"
    case "$AUTH_MODE" in
      native-oauth)
        # Restore the Moonshot device login captured by `aeon auth --harness kimi`;
        # kimi then runs on Moonshot by default.
        need KIMI_AUTH "the Moonshot login capture from 'aeon auth --harness kimi'"
        printf '%s' "$KIMI_AUTH" | base64 -d | tar xzf - -C "$HOME"
        echo "kimi: restored Moonshot login" ;;
      native-key)
        # MOONSHOT_API_KEY → Moonshot provider. Model id is best-effort; adjust to
        # your Moonshot plan if it 404s.
        need MOONSHOT_API_KEY "a Moonshot API key (or use the OAuth capture)"
        cat > "$HOME/.kimi-code/config.toml" <<TOML
default_model = "kimi-native"

[providers.moonshot]
type = "openai"
base_url = "https://api.moonshot.ai/v1"
api_key = "$MOONSHOT_API_KEY"

[models.kimi-native]
provider = "moonshot"
model = "kimi-k2.6"
max_context_size = 131072
TOML
        chmod 600 "$HOME/.kimi-code/config.toml"
        echo "kimi: Moonshot API key" ;;
      *)
        # kimi resolves --model through ALIASES declared here and takes the
        # provider key inline. default_model set → run-harness passes no --model
        # at all, which is what we want.
        need OPENROUTER_API_KEY "the shared OpenRouter key (one covers all four)"
        cat > "$HOME/.kimi-code/config.toml" <<TOML
default_model = "or-cheap"

[providers.openrouter]
type = "openai"
base_url = "https://openrouter.ai/api/v1"
api_key = "$OPENROUTER_API_KEY"

[models.or-cheap]
provider = "openrouter"
model = "$HM"
max_context_size = 400000
TOML
        chmod 600 "$HOME/.kimi-code/config.toml"
        echo "kimi: OpenRouter" ;;
    esac
    ;;
  vibe)
    # PINNED: 2.20.0 verified live 2026-07-22. (pipx/pip has no clean per-package
    # --ignore-scripts equivalent, so the pin is the guard here.)
    pipx install mistral-vibe==2.20.0
    [ -n "${GITHUB_PATH:-}" ] && echo "$HOME/.local/bin" >> "$GITHUB_PATH"
    if [ "$AUTH_MODE" = "native-key" ]; then
      # MISTRAL_API_KEY set → vibe's DEFAULT provider IS Mistral; it runs straight
      # off the env key, no config. (The config below only exists because vibe
      # hard-fails WITHOUT a Mistral key.)
      echo "vibe: Mistral API key (default provider)"
    else
      # vibe's ProviderConfig is generic (api_base + api_key_env_var + api_style),
      # so point it at OpenRouter.
      mkdir -p "$HOME/.vibe"
      cat > "$HOME/.vibe/config.toml" <<TOML
active_model = "or-cheap"

[[providers]]
name = "openrouter"
api_base = "https://openrouter.ai/api/v1"
api_key_env_var = "OPENROUTER_API_KEY"
api_style = "openai"

[[models]]
name = "$HM"
provider = "openrouter"
alias = "or-cheap"
TOML
      echo "vibe: OpenRouter"
    fi
    ;;
  fx)
    # Native binary (Zig, ~10MB), no package manager. fx.sh/setup.sh only maps
    # the platform and unpacks releases.fx.sh/<version>/fx-<os>-<arch>.tar.gz
    # into ~/.local/bin, so do that directly from the pinned release instead of
    # running the vendor script. Checksums = the vendor's published *.sha256.
    plat="$(pin_platform)"; read -r os arch <<<"$plat"
    [ "$os" = darwin ] && os=macos
    fx_sha=""
    case "$os-$arch" in
      linux-x86_64)   fx_sha=c510956b92404a00f3054b4be0d378188f9f5217497555048de353b8f0e52d80 ;;
      linux-aarch64)  fx_sha=7265ecebf881ec4050d24fa4fac660ed86dfd11395fcde47b491dc084be1e61e ;;
      macos-x86_64)   fx_sha=bca035a0ff0239e983e12b0131f6962bbe3b85ad86576a10297eb8bf1000d7ef ;;
      macos-aarch64)  fx_sha=c59dae590fd1244af5f02d3bfaf86a83f9d738e1f3dfb8d0bfab7ff15fb8ce20 ;;
    esac
    [ "$FX_VERSION" = "$FX_PIN" ] || fx_sha=""
    pin_tmp
    fetch_pinned "https://releases.fx.sh/$FX_VERSION/fx-$os-$arch.tar.gz" \
      "${FX_SHA256:-$fx_sha}" "$PIN_TMP/fx.tar.gz"
    tar -xzf "$PIN_TMP/fx.tar.gz" -C "$PIN_TMP" fx
    mkdir -p "$HOME/.local/bin"
    mv "$PIN_TMP/fx" "$HOME/.local/bin/fx"
    chmod +x "$HOME/.local/bin/fx"
    echo "fx: installed $FX_VERSION (sha256 verified)"
    [ -n "${GITHUB_PATH:-}" ] && echo "$HOME/.local/bin" >> "$GITHUB_PATH"
    # fx has NO OpenRouter path (confirmed: no mention anywhere in its docs —
    # see resolve-harness.sh's fx case for the same note). Every other harness
    # here falls back to the shared OPENROUTER_API_KEY when its own native
    # credential is missing; fx has nothing to fall back to. So this fails
    # closed here rather than staging a CLI that's guaranteed to fail later
    # inside the actual agent run with a less obvious error.
    if [ -n "${AI_GATEWAY_API_KEY:-}" ] || [ -n "${VERCEL_OIDC_TOKEN:-}" ]; then
      echo "fx: Vercel AI Gateway / OIDC key staged via env (fx reads it directly, no config file needed)"
    else
      echo "::error::fx needs AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN — it has no OpenRouter fallback, unlike every other harness here" >&2
      exit 1
    fi
    ;;
  cursor)
    # cursor.com/install hardcodes one build per day and downloads
    # downloads.cursor.com/lab/<version>/<os>/<arch>/agent-cli-package.tar.gz
    # (older builds stay downloadable), then links agent + cursor-agent into
    # ~/.local/bin. Do exactly that from a pinned build. Cursor publishes no
    # checksum, so these are the sha256s of the build as downloaded 2026-10-01.
    plat="$(pin_platform)"; read -r os arch <<<"$plat"
    cur_arch=""; cur_sha=""
    case "$os-$arch" in
      linux-x86_64)   cur_arch=x64;   cur_sha=ba9a855f8f813c91b9f2707127572d2dc9ae5a62818e1c36719625d0fb8bd452 ;;
      linux-aarch64)  cur_arch=arm64; cur_sha=c31ef0ba6b827fdf8053919de57abae4a7bd71afefdf2cab061e276faac42b3a ;;
      darwin-x86_64)  cur_arch=x64;   cur_sha=8930008f9902a4d02d3185c0d34071e0536bac3426439b55bcfd48b78765a3dd ;;
      darwin-aarch64) cur_arch=arm64; cur_sha=778d04e542adc5c8b6760fda3ebe0757f903b1764f2792c232ef9a35e6e2151b ;;
    esac
    [ "$CURSOR_VERSION" = "$CURSOR_PIN" ] || cur_sha=""
    pin_tmp
    fetch_pinned "https://downloads.cursor.com/lab/$CURSOR_VERSION/$os/$cur_arch/agent-cli-package.tar.gz" \
      "${CURSOR_SHA256:-$cur_sha}" "$PIN_TMP/cursor.tar.gz"
    cur_dir="$HOME/.local/share/cursor-agent/versions/$CURSOR_VERSION"
    rm -rf "$cur_dir"
    mkdir -p "$cur_dir" "$HOME/.local/bin"
    tar --strip-components=1 -xzf "$PIN_TMP/cursor.tar.gz" -C "$cur_dir"
    [ -x "$cur_dir/cursor-agent" ] || { echo "::error::cursor: cursor-agent missing from the $CURSOR_VERSION package" >&2; exit 1; }
    ln -sf "$cur_dir/cursor-agent" "$HOME/.local/bin/agent"
    ln -sf "$cur_dir/cursor-agent" "$HOME/.local/bin/cursor-agent"
    echo "cursor: installed $CURSOR_VERSION (sha256 verified)"
    [ -n "${GITHUB_PATH:-}" ] && echo "$HOME/.local/bin" >> "$GITHUB_PATH"
    need CURSOR_API_KEY "a Cursor API key for headless CLI runs"
    echo "cursor: API key staged via CURSOR_API_KEY" ;;
  hermes)
    # hermes-agent.nousresearch.com/install.sh serves main's installer, which
    # clones main HEAD. Instead take scripts/install.sh from the pinned release
    # commit (a commit-addressed URL, plus our own sha256 check) and pass
    # --commit so the checkout it installs is that same commit. --skip-setup:
    # the setup wizard is interactive (it already self-skipped with no TTY).
    hermes_sha=2017ddf0cc7bc6cfb70d40dc9fba1d916f47dbcccf5fe73bdee2cf93a11262af
    [ "$HERMES_COMMIT" = "$HERMES_PIN" ] || hermes_sha=""
    pin_tmp
    fetch_pinned "https://raw.githubusercontent.com/NousResearch/hermes-agent/$HERMES_COMMIT/scripts/install.sh" \
      "${HERMES_INSTALLER_SHA256:-$hermes_sha}" "$PIN_TMP/hermes-install.sh"
    clean_env bash "$PIN_TMP/hermes-install.sh" --commit "$HERMES_COMMIT" --skip-setup </dev/null
    [ -n "${GITHUB_PATH:-}" ] && echo "$HOME/.local/bin" >> "$GITHUB_PATH"
    mkdir -p "$HOME/.hermes"
    if [ "$AUTH_MODE" = "native-oauth" ]; then
      need HERMES_AUTH "the Nous Portal capture from 'hermes auth --harness hermes'"
      printf '%s' "$HERMES_AUTH" | base64 -d | tar xzf - -C "$HOME"
      chmod 600 "$HOME/.hermes/auth.json" 2>/dev/null || true
      echo "hermes: restored Nous Portal login"
    else
      need OPENROUTER_API_KEY "the shared OpenRouter key (or capture HERMES_AUTH for Nous Portal)"
      echo "hermes: OpenRouter fallback via OPENROUTER_API_KEY"
    fi
    ;;
  *)
    echo "::error::no install recipe for harness '$H'"; exit 1 ;;
esac
echo "installed harness CLI: $H  (auth: $AUTH_MODE)"
