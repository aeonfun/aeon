#!/usr/bin/env bash
# The credential manifest (harness-adapter/harnesses.json `credentials` +
# `default_model`, and harness-adapter/gateways.json) is a read-only MIRROR of
# decisions that live in code. This suite fails the moment the mirror and the
# code disagree, so `aeon init`, bin/onboard and the dashboard can trust it.
#
# Held against, per harness:
#   1. scripts/resolve-harness.sh - credential precedence (parsed statically AND
#      exercised: each credential alone must yield its auth_mode, and a more
#      preferred one must win over a less preferred one), plus default_model.
#   2. apps/dashboard/lib/harness-auth.ts - authSecrets order and the OAuth
#      capture's secret + credPaths (read-only parse; that file is not edited here).
#   3. .github/workflows/aeon.yml - every credential is bound in the steps that
#      read it (Resolve harness, Install harness CLI / Run).
#   4. scripts/install-harness.sh + scripts/resolve-harness.sh - an
#      OPENROUTER_API_KEY entry exists only where a real OpenRouter path does.
#   5. the install sites - cli.min_version (and the pinned install command) match
#      the version the workflows actually install.
# And for the gateway cascade (gateways.json):
#   6. scripts/llm-gateway.sh - same ids in the default GATEWAY_ORDER, same
#      secret(s) per provider, a route arm for each, base URL host in that arm.
#   7. apps/dashboard/lib/gateway-registry.ts - same slugs, labels, secret names
#      and key prefixes; constants.ts CLAUDE_AUTH_SECRETS starts with claude's
#      own credentials in order.
#
# Run: bash scripts/tests/test_credential_manifest.sh
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)

python3 - "$ROOT" <<'PY'
import json
import os
import re
import subprocess
import sys
import tempfile
from urllib.parse import urlparse

import yaml

root = sys.argv[1]
read = lambda rel: open(os.path.join(root, rel), encoding="utf-8").read()

manifest = json.loads(read("harness-adapter/harnesses.json"))
gateways = json.loads(read("harness-adapter/gateways.json"))["gateways"]
H = {h["id"]: h for h in manifest["harnesses"]}
resolve_src = read("scripts/resolve-harness.sh")
install_src = read("scripts/install-harness.sh")
gateway_src = read("scripts/llm-gateway.sh")
harness_auth_src = read("apps/dashboard/lib/harness-auth.ts")
registry_src = read("apps/dashboard/lib/gateway-registry.ts")
constants_src = read("apps/dashboard/lib/constants.ts")
workflow = yaml.safe_load(read(".github/workflows/aeon.yml"))

errors = []
checks = 0


def check(ok, msg):
    global checks
    checks += 1
    if not ok:
        errors.append(msg)


def secrets_of(h):
    return [c["secret"] for c in H[h]["credentials"]]


def native_secrets_of(h):
    return [c["secret"] for c in H[h]["credentials"] if c["auth_mode"] != "openrouter"]


# --- 1a. resolve-harness.sh precedence, parsed --------------------------------
block = re.search(r'^AUTH_MODE="openrouter"\ncase "\$HARNESS" in\n(.*?)\n^esac', resolve_src, re.S | re.M)
check(block is not None, "resolve-harness.sh: could not find the AUTH_MODE case block")
order = {}
if block:
    body = block.group(1)
    arms = list(re.finditer(r'^  ([a-z]+)\)', body, re.M))
    for i, m in enumerate(arms):
        end = arms[i + 1].start() if i + 1 < len(arms) else len(body)
        arm = body[m.start():end]
        if m.group(1) == "claude":
            # Only the auto-pick secrets decide claude's label; the gateway pin is aeon.yml.
            at = arm.find('if [ "$GW_PROVIDER" = "auto" ]')
            check(at >= 0, "resolve-harness.sh: claude arm has no `if [ \"$GW_PROVIDER\" = \"auto\" ]` block")
            arm = arm[at:] if at >= 0 else ""
        names = []
        for n in re.findall(r'\$\{([A-Z][A-Z0-9_]*):-\}', arm):
            if n not in names:
                names.append(n)
        order[m.group(1)] = names
check(set(order) == set(H), f"resolve-harness.sh AUTH_MODE arms {sorted(order)} != manifest harnesses {sorted(H)}")
for h in H:
    if h in order:
        check(native_secrets_of(h) == order[h],
              f"{h}: manifest credential order {native_secrets_of(h)} != resolve-harness.sh precedence {order[h]}")

# --- 1b. resolve-harness.sh precedence, exercised ------------------------------
ALL_CRED_VARS = sorted({c["secret"] for h in H.values() for c in h["credentials"]}
                       | {s for g in gateways for s in g["secrets"]})


def resolve(harness, env_extra):
    with tempfile.TemporaryDirectory() as ws:
        with open(os.path.join(ws, "aeon.yml"), "w") as f:
            f.write(f"model: claude-sonnet-5-5\nharness: {harness}\nskills:\n  heartbeat: {{ enabled: true }}\n")
        env = {k: v for k, v in os.environ.items() if k not in ALL_CRED_VARS
               and k not in ("INPUT_HARNESS", "INPUT_MODEL", "HARNESS_MODEL", "GATEWAY_ORDER")}
        env.update(env_extra)
        out = subprocess.run(["bash", os.path.join(root, "scripts/resolve-harness.sh")], cwd=ws, env=env,
                             capture_output=True, text=True, check=True).stdout
    return dict(line.split("=", 1) for line in out.splitlines() if "=" in line)


for h, spec in H.items():
    creds = spec["credentials"]
    for c in creds:
        got = resolve(h, {c["secret"]: "x"})["AUTH_MODE"]
        check(got == c["auth_mode"], f"{h}: {c['secret']} alone resolves AUTH_MODE={got}, manifest says {c['auth_mode']}")
    for i, a in enumerate(creds):
        for b in creds[i + 1:]:
            if a["auth_mode"] == b["auth_mode"]:
                continue
            got = resolve(h, {a["secret"]: "x", b["secret"]: "x"})["AUTH_MODE"]
            check(got == a["auth_mode"],
                  f"{h}: with {a['secret']} and {b['secret']} both set resolve picks {got}, but the manifest ranks {a['secret']} first")

# --- 1c. default_model mirrors DEFAULT_HM -------------------------------------
dcase = re.search(r'case "\$HARNESS" in\n(.*?)\nesac\nHM=', resolve_src, re.S)
check(dcase is not None, "resolve-harness.sh: could not find the DEFAULT_HM case block")
defaults = dict(re.findall(r'^\s*([a-z0-9]+)\)\s*DEFAULT_HM="([^"]+)"', dcase.group(1), re.M)) if dcase else {}
claude_default = re.search(r'CONFIG_MODEL:-(claude-[a-z0-9-]+)\}', resolve_src)
grok_default = re.search(r'case "\$MODEL" in claude-\*\|default\|""\) MODEL="([^"]+)"', read(".github/workflows/aeon.yml"))
for h, spec in H.items():
    want = spec["default_model"]
    if h in defaults:
        check(want == defaults[h], f"{h}: default_model {want} != resolve-harness.sh DEFAULT_HM {defaults[h]}")
    elif h == "claude":
        check(claude_default and want == claude_default.group(1),
              f"claude: default_model {want} != resolve-harness.sh claude fallback {claude_default and claude_default.group(1)}")
    elif h == "grok":
        # grok never consumes DEFAULT_HM: aeon.yml's Run step swaps a claude-* id
        # for grok's own default.
        check(grok_default and want == grok_default.group(1),
              f"grok: default_model {want} != aeon.yml grok fallback {grok_default and grok_default.group(1)}")
    else:
        # Not in the case block -> the generic fallback, which the harness never
        # consumes (MODEL_ARG stays empty), so the harness's own default runs.
        check(want == "default", f"{h}: has no DEFAULT_HM arm, so default_model must be 'default' (got {want})")
        for c in spec["credentials"]:
            check(resolve(h, {c["secret"]: "x"})["MODEL_ARG"] == "",
                  f"{h}: default_model is 'default' but resolve forwards a model with {c['secret']}")

# --- 2. harness-auth.ts authSecrets + OAuth capture ----------------------------
specs = re.search(r'const HARNESS_AUTH_SPECS = \{(.*?)\n\} satisfies', harness_auth_src, re.S)
check(specs is not None, "harness-auth.ts: could not find HARNESS_AUTH_SPECS")
covered = []
if specs:
    body = specs.group(1)
    entries = list(re.finditer(r'^  ([a-z]+): \{', body, re.M))
    for i, m in enumerate(entries):
        h = m.group(1)
        covered.append(h)
        end = entries[i + 1].start() if i + 1 < len(entries) else len(body)
        entry = body[m.start():end]
        auth = re.search(r'authSecrets: \[([^\]]*)\]', entry)
        ts_secrets = re.findall(r"'([A-Z0-9_]+)'", auth.group(1)) if auth else []
        check(h in H, f"harness-auth.ts covers {h}, which the manifest does not list")
        if h not in H:
            continue
        check(secrets_of(h) == ts_secrets, f"{h}: manifest credentials {secrets_of(h)} != harness-auth.ts authSecrets {ts_secrets}")
        oauth = re.search(r"oauth: \{.*?secret: '([A-Z0-9_]+)'", entry, re.S)
        paths = re.search(r"credPaths: \[([^\]]*)\]", entry)
        cap = [c for c in H[h]["credentials"] if c["kind"] == "oauth_capture"]
        check(bool(oauth) == bool(cap),
              f"{h}: harness-auth.ts {'has' if oauth else 'has no'} oauth capture but the manifest {'has' if cap else 'has no'} oauth_capture credential")
        if oauth:
            check(len(cap) == 1 and cap[0]["secret"] == oauth.group(1),
                  f"{h}: harness-auth.ts oauth secret {oauth.group(1)} is not the manifest's oauth_capture credential")
            if cap and paths:
                check(cap[0].get("cred_paths") == re.findall(r"'([^']+)'", paths.group(1)),
                      f"{h}: cred_paths {cap[0].get('cred_paths')} != harness-auth.ts credPaths")
check(sorted(covered) == sorted(set(H) - {"claude", "grok"}),
      f"harness-auth.ts covers {sorted(covered)}; expected every harness but claude/grok")

# --- 3. aeon.yml binds every credential where it is read -----------------------
steps = {}
for job in workflow["jobs"].values():
    for st in job.get("steps", []):
        if st.get("name") in ("Resolve harness", "Install harness CLI", "Run"):
            steps[st["name"]] = set((st.get("env") or {}).keys())
for name in ("Resolve harness", "Install harness CLI", "Run"):
    check(name in steps, f"aeon.yml: no '{name}' step")
for h, spec in H.items():
    for c in spec["credentials"]:
        s = c["secret"]
        if c["auth_mode"] != "openrouter":
            check(s in steps.get("Resolve harness", set()),
                  f"aeon.yml 'Resolve harness' env lacks {s} ({h} cannot be detected on it)")
        where = steps.get("Run", set()) if h == "claude" else steps.get("Install harness CLI", set()) | steps.get("Run", set())
        check(s in where, f"aeon.yml: {s} ({h}) is not bound in the step that stages/runs {h}")
        for aux in c.get("aux_secrets", []):
            check(aux in steps.get("Install harness CLI", set()),
                  f"aeon.yml 'Install harness CLI' env lacks {aux} ({h} {s} refresh)")
# Gateway secrets must reach the Run step, where llm-gateway.sh is sourced.
# Known gap, kept visible: XAI_API_KEY was dropped from the Run step's shared env
# (per-skill least privilege; it is injected only for skills that list it in
# `requires:`), so the `grok` GATEWAY resolves only for those skills. The grok
# HARNESS is unaffected (Install harness CLI binds it). This entry must be
# removed the day the binding comes back - the test fails if it does.
RUN_ENV_KNOWN_GAPS = {"XAI_API_KEY"}
for g in gateways:
    for s in g["secrets"]:
        if s in RUN_ENV_KNOWN_GAPS:
            check(s not in steps.get("Run", set()), f"aeon.yml Run env now binds {s}: drop it from RUN_ENV_KNOWN_GAPS")
            continue
        check(s in steps.get("Run", set()), f"aeon.yml 'Run' env lacks gateway secret {s} ({g['id']})")

# --- 4. OPENROUTER_API_KEY only where a real OpenRouter path exists ------------
def install_arm(h):
    lines = install_src.split("\n")
    start = next((i for i, l in enumerate(lines) if re.match(rf'^  (?:[a-z|"]+\|)?{h}(?:\|[a-z|"]+)?\)', l)), None)
    if start is None:
        return ""
    out = []
    for l in lines[start + 1:]:
        if re.match(r'^  [a-z*|"]+\)', l) or l.startswith("esac"):
            break
        if not l.lstrip().startswith("#"):
            out.append(l)
    return "\n".join(out)


or_model = re.search(r'if \[ "\$AUTH_MODE" = "openrouter" \]; then\n  case "\$HARNESS" in\n(.*?)\n  esac', resolve_src, re.S)
or_model_harnesses = set(re.findall(r'^\s*([a-z]+)\)', or_model.group(1), re.M)) if or_model else set()
for h in H:
    has_or = "OPENROUTER_API_KEY" in secrets_of(h)
    real = bool(re.search(r'openrouter|OPENROUTER_API_KEY', install_arm(h))) or h in or_model_harnesses
    if h == "claude":
        real = False  # claude reaches OpenRouter as a gateway (gateways.json), not a credential
    check(has_or == real, f"{h}: manifest {'lists' if has_or else 'omits'} OPENROUTER_API_KEY but the install/resolve path {'has' if real else 'has no'} OpenRouter route")

# --- 5. CLI pins match the install sites ---------------------------------------
def first(pattern, text, group=1):
    m = re.search(pattern, text, re.M)
    return m.group(group) if m else None


pins = {
    "claude": first(r'@anthropic-ai/claude-code@([0-9][0-9.]*)', read(".github/workflows/aeon.yml")),
    "grok": first(r'^GROK_CLI_VERSION="\$\{GROK_CLI_VERSION:-([0-9][0-9.]*)\}"$', read("scripts/run-grok.sh")),
    "codex": first(r'@openai/codex@([0-9][0-9.]*)', install_src),
    "pi": first(r'@earendil-works/pi-coding-agent@([0-9][0-9.]*)', install_src),
    "kimi": first(r'@moonshot-ai/kimi-code@([0-9][0-9.]*)', install_src),
    "vibe": first(r'mistral-vibe==([0-9][0-9.]*)', install_src),
    "fx": first(r'^FX_PIN=v?([0-9][0-9.]*)', install_src),
    "cursor": first(r'^CURSOR_PIN=(\S+)', install_src),
    "hermes": first(r'^HERMES_PIN=\S+\s+# hermes-agent release v(\S+)', install_src),
}
for h, pin in pins.items():
    check(pin is not None, f"{h}: could not read the install pin")
    mv = H[h]["cli"]["min_version"]
    check(mv == pin, f"{h}: cli.min_version {mv} != install pin {pin}")
    inst = H[h]["cli"]["install"]
    check(bool(inst), f"{h}: cli.install is empty")
    if inst.startswith(("npm ", "pipx ")):
        check(inst.endswith(("@" + str(pin), "==" + str(pin))), f"{h}: cli.install '{inst}' is not pinned to {pin}")

# --- 6. gateways.json vs llm-gateway.sh ---------------------------------------
gw_ids = [g["id"] for g in gateways]
default_order = first(r'\$\{GATEWAY_ORDER:-([a-z ]+)\}', gateway_src)
check(default_order is not None and gw_ids == default_order.split(),
      f"gateways.json order {gw_ids} != llm-gateway.sh default GATEWAY_ORDER {default_order}")
present = dict(re.findall(r'^    ([a-z]+)\)\s+(\[ -n .*?\]) ;;$', gateway_src, re.M))
route_at = gateway_src.find("# --- route")
check(route_at >= 0, "llm-gateway.sh: no '# --- route' section marker")
route = gateway_src[route_at:] if route_at >= 0 else ""
route_arms = list(re.finditer(r'^  ([a-z|"]+)\)', route, re.M))
for g in gateways:
    gid = g["id"]
    check(gid in present, f"llm-gateway.sh aeon_present has no arm for {gid}")
    if gid in present:
        check(re.findall(r'\$\{([A-Z][A-Z0-9_]*)', present[gid]) == g["secrets"],
              f"{gid}: gateways.json secrets {g['secrets']} != llm-gateway.sh aeon_present {present[gid]}")
    arm = next((m for m in route_arms if gid in m.group(1).split("|")), None)
    check(arm is not None, f"llm-gateway.sh has no route arm for {gid}")
    if arm and g["transport"] != "native":
        i = route_arms.index(arm)
        text = route[arm.start():route_arms[i + 1].start() if i + 1 < len(route_arms) else len(route)]
        check(urlparse(g["base_url"]).netloc in text, f"{gid}: base_url host {urlparse(g['base_url']).netloc} not in its llm-gateway.sh arm")
        sidecar = "start_ccr_sidecar" in text
        check(sidecar == (g["transport"] == "sidecar"), f"{gid}: transport {g['transport']} but sidecar={sidecar} in llm-gateway.sh")

# --- 7. gateways.json vs gateway-registry.ts + constants.ts --------------------
# Entries are `slug: { ...keys in any order, possibly over several lines... }`.
reg = {}
reg_body = re.search(r"GATEWAY_REGISTRY = \{(.*?)\n\} as const", registry_src, re.S)
check(reg_body is not None, "gateway-registry.ts: could not find GATEWAY_REGISTRY = { ... } as const")
for m in re.finditer(r"^  ([a-z0-9]+): \{(.*?)\}", reg_body.group(1) if reg_body else "", re.S | re.M):
    body = m.group(2)
    label = re.search(r"\blabel: '([^']+)'", body)
    secret = re.search(r"\bsecretName: '([A-Z0-9_]+)'", body)
    prefixes = re.search(r"\bprefixes: \[([^\]]*)\]", body, re.S)
    check(bool(label and secret and prefixes), f"gateway-registry.ts: entry {m.group(1)} lacks label/secretName/prefixes")
    reg[m.group(1)] = (label.group(1) if label else None, secret.group(1) if secret else None,
                       re.findall(r"'([^']*)'", prefixes.group(1)) if prefixes else None)
non_native = [g for g in gateways if g["transport"] != "native"]
check(set(reg) == {g["id"] for g in non_native},
      f"gateway-registry.ts slugs {sorted(reg)} != gateways.json non-native ids {sorted(g['id'] for g in non_native)}")
for g in non_native:
    if g["id"] in reg:
        label, secret, prefixes = reg[g["id"]]
        check(label == g["label"], f"{g['id']}: registry label '{label}' != gateways.json '{g['label']}'")
        check(secret == g["secrets"][0], f"{g['id']}: registry secretName {secret} != gateways.json {g['secrets'][0]}")
        check(prefixes == g["prefixes"], f"{g['id']}: registry prefixes {prefixes} != gateways.json {g['prefixes']}")
cas = first(r"^export const CLAUDE_AUTH_SECRETS = \[([^\]]*)\]", constants_src)
cas_literal = re.findall(r"'([A-Z0-9_]+)'", cas) if cas is not None else None
check(cas_literal == secrets_of("claude") and "...GATEWAY_SECRET_NAMES" in (cas or ""),
      f"constants.ts CLAUDE_AUTH_SECRETS should be claude's credentials {secrets_of('claude')} then ...GATEWAY_SECRET_NAMES (got literals {cas_literal})")
native = [g for g in gateways if g["transport"] == "native"]
check([s for g in native for s in g["secrets"]] == secrets_of("claude"),
      "gateways.json native tier must be exactly claude's own credentials, in order")

if errors:
    print("credential manifest tests FAILED:", file=sys.stderr)
    for e in errors:
        print(f"  - {e}", file=sys.stderr)
    sys.exit(1)
print(f"credential manifest tests passed ({checks} checks, {len(H)} harnesses, {len(gateways)} gateways)")
PY
