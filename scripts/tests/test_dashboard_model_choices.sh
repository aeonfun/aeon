#!/usr/bin/env bash
# Every model the dashboard can dispatch must be a valid workflow_dispatch
# `model` choice, and every per-harness runtime default must be one the
# dashboard offers.
#
# The dashboard dispatches `gh workflow run aeon.yml -f model=<id>` with an id
# from one of its per-harness lists in apps/dashboard/lib/constants.ts. aeon.yml's
# `model` input is a `choice`, so an id missing from its options is rejected with
# HTTP 422 at dispatch time. Separately, scripts/resolve-harness.sh carries a
# per-harness DEFAULT_HM that must be the first entry of that harness's dashboard
# list (the harness-switch snap writes list[0] into aeon.yml), and the workflows'
# grok fallback must be GROK_MODELS[0].
#
# Run: bash scripts/tests/test_dashboard_model_choices.sh
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)

python3 - "$ROOT" <<'PY'
import re
import sys

import yaml

root = sys.argv[1]
constants = open(f"{root}/apps/dashboard/lib/constants.ts", encoding="utf-8").read()
workflow = yaml.safe_load(open(f"{root}/.github/workflows/aeon.yml", encoding="utf-8"))
# PyYAML parses the bare `on:` key as boolean True.
dispatch = (workflow.get("on") or workflow.get(True))["workflow_dispatch"]["inputs"]
option_list = dispatch["model"]["options"]
options = set(option_list)
resolve = open(f"{root}/scripts/resolve-harness.sh", encoding="utf-8").read()

LISTS = {
    "MODELS": "claude",
    "GROK_MODELS": "grok",
    "KIMI_MODELS": "kimi",
    "CODEX_MODELS": "codex",
    "VIBE_MODELS": "vibe",
    "PI_MODELS": "pi",
    "CURSOR_MODELS": "cursor",
    "HERMES_MODELS": "hermes",
}

errors = []
lists = {}
dupes = sorted({o for o in option_list if option_list.count(o) > 1})
if dupes:
    errors.append(f"aeon.yml: duplicated workflow_dispatch model options: {', '.join(dupes)}")
for name in LISTS:
    m = re.search(rf"^export const {name} = \[(.*?)\]", constants, re.S | re.M)
    if not m:
        errors.append(f"constants.ts: could not find `export const {name} = [...]`")
        continue
    ids = re.findall(r"\bid:\s*'([^']+)'", m.group(1))
    if not ids:
        errors.append(f"constants.ts: {name} has no ids")
    lists[name] = ids
    for model_id in ids:
        if model_id not in options:
            errors.append(f"{name}: '{model_id}' is not a workflow_dispatch model option in aeon.yml (dispatch would 422)")

# Every harness that modelsForHarness() maps must be covered above.
fn = re.search(r"export function modelsForHarness\(.*?\n\}", constants, re.S)
if not fn:
    errors.append("constants.ts: could not find modelsForHarness()")
mapped = set(re.findall(r"if \(harness === '([a-z0-9]+)'\) return ([A-Z_]+)", fn.group(0) if fn else ""))
for harness, name in mapped:
    if LISTS.get(name) != harness:
        errors.append(f"modelsForHarness maps {harness} -> {name}, which this test does not check")

# resolve-harness.sh per-harness defaults: DEFAULT_HM must be that harness's
# dashboard default (list[0]).
case = re.search(r'case "\$HARNESS" in\n(.*?)\nesac\nHM=', resolve, re.S)
if not case:
    errors.append("resolve-harness.sh: could not find the DEFAULT_HM case block")
else:
    defaults = dict(re.findall(r'^\s*([a-z0-9]+)\)\s*DEFAULT_HM="([^"]+)"', case.group(1), re.M))
    for name, harness in LISTS.items():
        if harness in ("claude", "grok"):
            continue  # aeon-native ids; resolve-harness never consumes them
        ids = lists.get(name) or []
        if harness not in defaults:
            errors.append(f"resolve-harness.sh: no DEFAULT_HM for {harness}")
            continue
        if defaults[harness] not in ids:
            errors.append(f"resolve-harness.sh: {harness} default '{defaults[harness]}' is not in {name}")
        elif ids[0] != defaults[harness]:
            errors.append(f"resolve-harness.sh: {harness} default '{defaults[harness]}' is not {name}[0] ('{ids[0]}')")

# The workflows' grok fallback (a claude-* model on the grok harness) must be
# the grok dashboard default.
grok = (lists.get("GROK_MODELS") or [None])[0]
for wf in ("aeon.yml", "messages.yml"):
    text = open(f"{root}/.github/workflows/{wf}", encoding="utf-8").read()
    for fallback in re.findall(r'case "\$MODEL" in claude-\*[^)]*\) MODEL="([^"]+)"', text):
        if fallback != grok:
            errors.append(f"{wf}: grok fallback '{fallback}' is not GROK_MODELS[0] ('{grok}')")

if errors:
    print("dashboard model choice tests FAILED:", file=sys.stderr)
    for e in errors:
        print(f"  - {e}", file=sys.stderr)
    sys.exit(1)
total = sum(len(v) for v in lists.values())
print(f"dashboard model choice tests passed ({total} dashboard ids across {len(lists)} lists)")
PY
