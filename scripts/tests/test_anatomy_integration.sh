#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd)
cd "$root"

for path in \
  skills/anatomy/SKILL.md \
  skills/anatomy/LICENSE \
  skills/anatomy/UPSTREAM.md \
  skills/anatomy/evals/evals.json \
  skills/anatomy/kit/iso-kit.mjs \
  skills/anatomy/scripts/capture.mjs \
  skills/anatomy/scripts/inline-kit.mjs \
  skills/anatomy/examples/dial-indicator/build.mjs; do
  test -f "$path" || {
    echo "missing $path" >&2
    exit 1
  }
done

# Generated example pages and upstream repo plumbing stay out of the vendored copy
# (rebuildable or restorable from upstream, see skills/anatomy/UPSTREAM.md).
tracked_html=$(git ls-files 'skills/anatomy/examples/*.html')
if [ -n "$tracked_html" ]; then
  echo "generated example pages must not be committed:" >&2
  echo "$tracked_html" >&2
  exit 1
fi
for path in skills/anatomy/.github skills/anatomy/CODE_OF_CONDUCT.md skills/anatomy/CONTRIBUTING.md skills/anatomy/SECURITY.md; do
  if [ -n "$(git ls-files "$path")" ]; then
    echo "upstream-only path is vendored again: $path" >&2
    exit 1
  fi
done

node - <<'NODE'
const fs = require('fs');
const evals = JSON.parse(fs.readFileSync('skills/anatomy/evals/evals.json', 'utf8'));
if (!Array.isArray(evals.evals) || evals.evals.length < 5) throw new Error('anatomy eval corpus is incomplete');
const skill = fs.readFileSync('skills/anatomy/SKILL.md', 'utf8');
for (const needle of ['title: Anatomy', 'category: dev', 'Aeon runtime integration']) {
  if (!skill.includes(needle)) throw new Error(`Aeon metadata missing: ${needle}`);
}
const start = skill.indexOf('## Aeon runtime integration');
const end = skill.indexOf('\n# Anatomy\n');
if (start < 0 || end < start) throw new Error('Aeon runtime integration section must come before the upstream body');
const aeon = skill.slice(start, end);
for (const needle of [
  'override', // Aeon rules win over the vendored text
  'ANATOMY_NO_VAR', // empty var exits clean
  'never ask', // headless
  'Figure', // size cap for the 50-minute job
  'RUNNER_TEMP', // build in a scratch copy
  'inside `skills/anatomy/`', // never write into the skill dir
  'output/anatomy/', // committed deliverable
  './notify', // operator notify
]) {
  if (!aeon.includes(needle)) throw new Error(`Aeon runtime integration lacks: ${needle}`);
}
const config = fs.readFileSync('aeon.yml', 'utf8');
if (!config.includes('anatomy: { enabled: false')) throw new Error('anatomy must remain disabled by default');
const catalog = JSON.parse(fs.readFileSync('catalog/skills.json', 'utf8'));
const entry = catalog.skills.find((item) => item.slug === 'anatomy');
if (!entry || entry.files < 1 || !entry.sha || !entry.updated) throw new Error('anatomy catalog entry is stale');
if (entry.name !== 'Anatomy') throw new Error('anatomy catalog name should come from metadata.title');
NODE

node scripts/validate-config.js >/dev/null
bash scripts/check-skill-categories.sh >/dev/null
node bin/generate-skill-icons --check >/dev/null

echo "anatomy integration: ok"
