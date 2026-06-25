#!/usr/bin/env node
'use strict';

// validate-config.js — Shared structural validator for aeon.yml and the run
// workflow. This is the "fast path" the config-validator skill invokes
// (skills/config-validator/SKILL.md): one deterministic pass over the three
// invariant classes that have caused full outages, so the skill (and any future
// pre-merge CI) does not have to re-derive them from inline snippets.
//
// Checks:
//   1. Checkout ordering  — .github/workflows/aeon.yml must have a checkout step,
//      unconditional and ahead of any conditional step (checkout-ordering class).
//   2. Duplicate skill keys — a shadowed key in aeon.yml silently disables a skill
//      (duplicate-key class).
//   3. Skill-reference integrity — every skill named in aeon.yml resolves to a real
//      skills/<name>/SKILL.md (missing-file / dangling-reference class). Skills are
//      markdown with no compiler, so a reference left behind after a prune only
//      surfaces when a cron fires and the scheduler launches a skill that no longer
//      exists. This validates the full reference surface a forker edits by hand: the
//      whole skills: block (enabled or not, inline `{ }` or multi-line) AND every
//      skill wired into a chains: pipeline (parallel / skill / consume).
//
// Output contract (consumed by config-validator):
//   - Exit 0 + only PASS lines  => CLEAN  (no notification)
//   - Exit 1 + FAIL: / WARN: lines on stdout => ISSUES (skill notifies)
//
// Reads local files only — no network, no dependencies.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AEON_YML = path.join(ROOT, 'aeon.yml');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'aeon.yml');
const SKILLS_DIR = path.join(ROOT, 'skills');

const out = [];
let failed = false;
function pass(line) { out.push(line); }
function fail(line) { out.push(line); failed = true; }

// ---------------------------------------------------------------------------
// Check 1 — checkout ordering (mirrors skills/config-validator/SKILL.md step 1).
// The if-detection deliberately matches the established skill check so this
// shared validator reports identically to the inline fallback it replaces.
// ---------------------------------------------------------------------------
function checkCheckoutOrdering() {
  if (!fs.existsSync(WORKFLOW)) {
    fail('FAIL: run workflow not found at .github/workflows/aeon.yml');
    return;
  }
  const lines = fs.readFileSync(WORKFLOW, 'utf8').split('\n');

  let inSteps = false;
  const steps = [];
  let cur = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^\s{4,6}steps:/.test(line)) { inSteps = true; continue; }
    if (!inSteps) continue;
    if (/^\s{4,6}[a-z]/.test(line) && !/^\s{6,}/.test(line) && i > 0) { inSteps = false; continue; }

    if (/^\s{6}- /.test(line)) {
      if (cur) steps.push(cur);
      cur = { lineNum: i + 1, name: null, hasIf: false, isCheckout: false };
    }
    if (cur) {
      if (/name:/.test(trimmed)) cur.name = trimmed.replace(/^name:\s*/, '').replace(/["']/g, '');
      if (/uses:\s*actions\/checkout/.test(trimmed)) cur.isCheckout = true;
      if (/Early checkout/.test(trimmed)) cur.isCheckout = true;
      if (/^\s{6}if:/.test(line)) cur.hasIf = true;
    }
  }
  if (cur) steps.push(cur);

  const checkoutIdx = steps.findIndex((s) => s.isCheckout);
  if (checkoutIdx === -1) {
    fail('FAIL: No checkout step (actions/checkout or Early checkout) found in jobs.run.steps');
    return;
  }
  const cs = steps[checkoutIdx];
  if (cs.hasIf) {
    fail('FAIL: Checkout step at line ' + cs.lineNum + ' has an if: condition — must be unconditional');
    return;
  }
  const firstConditional = steps.findIndex((s) => s.hasIf);
  if (firstConditional !== -1 && firstConditional < checkoutIdx) {
    fail('FAIL: Checkout step appears after a conditional step at line ' + steps[firstConditional].lineNum);
    return;
  }
  pass('PASS checkout: checkout step is unconditional and first (line ' + cs.lineNum + ')');
}

// ---------------------------------------------------------------------------
// Shared aeon.yml block reader: returns the line indices (0-based) of the
// `skills:` and `chains:` blocks. A block runs until the next column-0 key.
// ---------------------------------------------------------------------------
function readAeonYml() {
  if (!fs.existsSync(AEON_YML)) return null;
  return fs.readFileSync(AEON_YML, 'utf8').split('\n');
}

function* blockLines(lines, header) {
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (new RegExp('^' + header + ':\\s*$').test(line)) { inBlock = true; continue; }
    if (inBlock && /^[A-Za-z]/.test(line)) { inBlock = false; }
    if (inBlock) yield [i, line];
  }
}

// ---------------------------------------------------------------------------
// Check 2 — duplicate skill keys (mirrors SKILL.md step 2).
// ---------------------------------------------------------------------------
function checkDuplicateKeys(lines) {
  const seen = {};
  let dupes = 0;
  for (const [i, line] of blockLines(lines, 'skills')) {
    const m = line.match(/^  ([a-z][a-z0-9-]+):/);
    if (!m) continue;
    const key = m[1];
    if (seen[key]) {
      fail('FAIL: Duplicate skill key "' + key + '" at line ' + (i + 1) + ' (first seen line ' + seen[key] + ')');
      dupes++;
    } else {
      seen[key] = i + 1;
    }
  }
  if (dupes === 0) {
    pass('PASS duplicates: no duplicate skill keys (' + Object.keys(seen).length + ' skills)');
  }
}

// ---------------------------------------------------------------------------
// Check 3 — skill-reference integrity (strengthened beyond SKILL.md step 3,
// which only covered enabled inline entries). Validates every reference in the
// skills: block (any enabled state, inline or multi-line) and every skill wired
// into a chains: pipeline.
// ---------------------------------------------------------------------------
function skillExists(name) {
  return fs.existsSync(path.join(SKILLS_DIR, name, 'SKILL.md'));
}

function collectChainRefs(lines) {
  const refs = [];
  const push = (name, lineNum) => {
    const n = String(name).trim().replace(/["']/g, '');
    if (n) refs.push({ name: n, lineNum });
  };
  for (const [i, raw] of blockLines(lines, 'chains')) {
    if (/^\s*#/.test(raw)) continue; // skip comments (the documented example is commented out)
    let m;
    if ((m = raw.match(/parallel:\s*\[([^\]]*)\]/))) {
      m[1].split(',').forEach((s) => push(s, i + 1));
    }
    if ((m = raw.match(/consume:\s*\[([^\]]*)\]/))) {
      m[1].split(',').forEach((s) => push(s, i + 1));
    }
    if ((m = raw.match(/(?:^|[\s-])skill:\s*([a-z0-9-]+)/))) {
      push(m[1], i + 1);
    }
  }
  return refs;
}

function checkSkillRefs(lines) {
  if (!fs.existsSync(SKILLS_DIR)) {
    fail('FAIL: skills/ directory not found at ' + SKILLS_DIR);
    return;
  }

  const dangling = [];
  let scheduled = 0;
  for (const [i, line] of blockLines(lines, 'skills')) {
    const m = line.match(/^  ([a-z][a-z0-9-]+):/);
    if (!m) continue; // section comments and nested props are skipped
    scheduled++;
    if (!skillExists(m[1])) {
      dangling.push('FAIL: aeon.yml skills entry "' + m[1] + '" (line ' + (i + 1) + ') has no skills/' + m[1] + '/SKILL.md');
    }
  }

  let chained = 0;
  for (const ref of collectChainRefs(lines)) {
    chained++;
    if (!skillExists(ref.name)) {
      dangling.push('FAIL: aeon.yml chain references skill "' + ref.name + '" (line ' + ref.lineNum + ') with no skills/' + ref.name + '/SKILL.md');
    }
  }

  if (dangling.length > 0) {
    dangling.forEach(fail);
  } else {
    pass('PASS skill-refs: all ' + scheduled + ' scheduled + ' + chained + ' chained skill references resolve to skills/<name>/SKILL.md');
  }
}

// ---------------------------------------------------------------------------
function main() {
  checkCheckoutOrdering();

  const lines = readAeonYml();
  if (lines === null) {
    fail('FAIL: aeon.yml not found at repo root');
  } else {
    checkDuplicateKeys(lines);
    checkSkillRefs(lines);
  }

  out.forEach((l) => console.log(l));
  if (failed) {
    console.log('');
    console.log('config: ISSUES — see FAIL lines above.');
    process.exit(1);
  }
  console.log('config: CLEAN — all structural invariants hold.');
  process.exit(0);
}

main();
