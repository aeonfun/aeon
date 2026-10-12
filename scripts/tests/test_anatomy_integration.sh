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
  skills/anatomy/scripts/capture.mjs; do
  test -f "$path" || { echo "missing $path" >&2; exit 1; }
done

node - <<'NODE'
const fs = require('fs');
const evals = JSON.parse(fs.readFileSync('skills/anatomy/evals/evals.json', 'utf8'));
if (!Array.isArray(evals.evals) || evals.evals.length < 5) throw new Error('anatomy eval corpus is incomplete');
const skill = fs.readFileSync('skills/anatomy/SKILL.md', 'utf8');
if (!skill.includes('category: dev') || !skill.includes('Aeon runtime integration')) throw new Error('Aeon metadata missing');
const config = fs.readFileSync('aeon.yml', 'utf8');
if (!config.includes('anatomy: { enabled: false')) throw new Error('anatomy must remain disabled by default');
const catalog = JSON.parse(fs.readFileSync('catalog/skills.json', 'utf8'));
const entry = catalog.skills.find((item) => item.slug === 'anatomy');
if (!entry || entry.files < 1 || !entry.sha || !entry.updated) throw new Error('anatomy catalog entry is stale');
NODE

node scripts/validate-config.js >/dev/null
bash scripts/check-skill-categories.sh >/dev/null
node bin/generate-skill-icons --check >/dev/null

echo "anatomy integration: ok"
