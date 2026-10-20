#!/usr/bin/env node
'use strict';

// validate-config.js — Deterministic structural validator for aeon.yml and the
// run workflow. One pass over the three invariant classes that have caused full
// outages; run in CI (and callable from any skill) so they don't have to be
// re-derived from inline snippets. Replaces the former config-validator skill.
//
// Checks:
//   1. Checkout ordering  — .github/workflows/aeon.yml must check out the repo
//      before the skill-run step, with a checkout whose condition covers the run
//      step's (unconditional, or the same if:), so the repo is never absent when
//      Run executes (checkout-ordering class).
//   2. Duplicate skill keys — a shadowed key in aeon.yml silently disables a skill
//      (duplicate-key class).
//   3. Skill-reference integrity — every skill named in aeon.yml resolves to a real
//      skills/<name>/SKILL.md (missing-file / dangling-reference class). Skills are
//      markdown with no compiler, so a reference left behind after a prune only
//      surfaces when a cron fires and the scheduler launches a skill that no longer
//      exists. This validates the full reference surface a forker edits by hand: the
//      whole skills: block (enabled or not, inline `{ }` or multi-line) AND every
//      skill wired into a chains: pipeline (parallel / skill / consume).
//   4. Reactive-trigger integrity - every target skill and `on:` source in the
//      reactive: block resolves to a real skill, and every `when:` parses to a
//      condition scripts/reactive_when.sh can evaluate (same dangling-reference /
//      dead-config class as 3, for the event-driven dispatch path).
//   5. Chain `when:` expression syntax - a chain step's routing condition
//      (`when: "score > 5"`) must be a well-formed <key> <op> <value> expression,
//      with ordering ops requiring an integer value, so an invalid expression is
//      caught at config time rather than when the chain runs.
//   6. Schedule format - every skill and chain `schedule:` is workflow_dispatch,
//      reactive, or a 5-field cron expression scripts/cron-due.sh accepts, so a
//      typo (`*/0`, `61`, a 6th field) fails CI instead of silently never firing.
//   7. Skill entry keys - every key on a skills: entry is one the repo reads
//      (enabled, schedule, var, model, harness, attest), with a did-you-mean hint
//      for a near miss, and an entry with `enabled: true` has a schedule:, a
//      reactive: target or a chain step. A misspelled key is dropped by every
//      reader, so the skill silently runs on defaults or never runs at all.
//
// Output contract:
//   - Exit 0 + only PASS lines  => CLEAN
//   - Exit 1 + FAIL: / WARN: lines on stdout => ISSUES
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
// Check 1 — checkout ordering.
// The run workflow has no single unconditional checkout by design: it checks out
// on the issues path ("Early checkout", if: issues) and again on the scheduled
// path ("Checkout repo", if: mode != ''), and the two steps that run before either
// checkout only read GitHub context — they never touch repo files. So the real
// invariant is not "checkout is unconditional and first" but: the skill-run step
// (id: run / name "Run") must be preceded by a checkout whose condition COVERS the
// run step's — i.e. the checkout is unconditional, or carries the exact same if:
// — so the repo can never be absent while Run executes. analyzeCheckout() is pure
// (takes the workflow YAML text) so it can be unit-tested against fixtures.
// ---------------------------------------------------------------------------
function parseSteps(text) {
  const lines = text.split('\n');
  let inSteps = false;
  const steps = [];
  let cur = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^\s{4,6}steps:/.test(line)) { inSteps = true; continue; }
    if (!inSteps) continue;
    // dedent back to a job-/top-level key (<=4 spaces) ends the steps block
    if (/^ {0,4}[A-Za-z]/.test(line)) { inSteps = false; cur = null; continue; }

    if (/^\s{6}- /.test(line)) {
      if (cur) steps.push(cur);
      cur = { lineNum: i + 1, name: null, id: null, isCheckout: false, ifCond: null };
      const nm = line.match(/^\s{6}-\s+name:\s*(.+?)\s*$/);
      if (nm) cur.name = nm[1].replace(/["']/g, '');
    }
    if (!cur) continue;

    // step-body fields live at 8 spaces (one level under the "- " marker); anchoring
    // to that indent avoids matching `name=`/`if [ ... ]` inside run: shell blocks.
    let m;
    if ((m = line.match(/^\s{8}name:\s*(.+?)\s*$/))) cur.name = m[1].replace(/["']/g, '');
    if ((m = line.match(/^\s{8}id:\s*(.+?)\s*$/))) cur.id = m[1].replace(/["']/g, '');
    if (/^\s{8}uses:\s*actions\/checkout/.test(line)) cur.isCheckout = true;
    if ((m = line.match(/^\s{8}if:\s*(.+?)\s*$/)) && cur.ifCond === null) cur.ifCond = m[1];
  }
  if (cur) steps.push(cur);

  // a step named "... checkout" (e.g. "Early checkout") is a checkout too
  steps.forEach((s) => { if (s.name && /checkout/i.test(s.name)) s.isCheckout = true; });
  return steps;
}

const normCond = (c) => (c == null ? null : c.trim().replace(/\s+/g, ' '));

// Pure: returns { ok, line } for the checkout-ordering invariant.
function analyzeCheckout(text) {
  const steps = parseSteps(text);

  const checkouts = steps.filter((s) => s.isCheckout);
  if (checkouts.length === 0) {
    return { ok: false, line: 'FAIL: no checkout step (actions/checkout) found in jobs.run.steps' };
  }

  const runIdx = steps.findIndex((s) => s.id === 'run' || (s.name && /^run$/i.test(s.name.trim())));
  if (runIdx === -1) {
    return { ok: false, line: 'FAIL: could not locate the skill-run step (expected `id: run` or a step named "Run") — checkout-ordering cannot be verified' };
  }
  const runStep = steps[runIdx];
  const runCond = normCond(runStep.ifCond);

  // A preceding checkout "covers" Run if it is unconditional, shares Run's exact
  // condition, or is the leading conjunct of it (`C && X`), so it can never be
  // skipped in a run where Run itself executes. An `||` on either side breaks that
  // implication (`C && X || Y` runs without C), so it never counts as a conjunct.
  const covering = checkouts.find((s) => {
    if (steps.indexOf(s) >= runIdx) return false;
    const c = normCond(s.ifCond);
    if (c === null || c === runCond) return true;
    return runCond !== null && !c.includes('||') && !runCond.includes('||')
      && runCond.startsWith(c + ' && ');
  });

  if (covering) {
    const how = covering.ifCond == null
      ? 'unconditional'
      : 'condition matches the run step (if: ' + covering.ifCond + ')';
    return { ok: true, line: 'PASS checkout: a checkout (line ' + covering.lineNum + ') precedes the skill-run step (line ' + runStep.lineNum + ') and is ' + how };
  }

  const preceding = checkouts.find((s) => steps.indexOf(s) < runIdx);
  if (!preceding) {
    return { ok: false, line: 'FAIL: skill-run step (line ' + runStep.lineNum + ') has no checkout step before it — repo would be absent when Run executes' };
  }
  return {
    ok: false,
    line: 'FAIL: the checkout before the skill-run step (line ' + preceding.lineNum + ', if: ' + (preceding.ifCond || 'none')
      + ') does not cover the run step condition (if: ' + (runStep.ifCond || 'none')
      + ') — checkout could be skipped while Run executes',
  };
}

function checkCheckoutOrdering() {
  if (!fs.existsSync(WORKFLOW)) {
    fail('FAIL: run workflow not found at .github/workflows/aeon.yml');
    return;
  }
  const res = analyzeCheckout(fs.readFileSync(WORKFLOW, 'utf8'));
  (res.ok ? pass : fail)(res.line);
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
    if ((m = raw.match(/(?:^|[\s-])skill:\s*["']?([a-z0-9-]+)/))) {
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
// Check 4 - reactive-trigger integrity. The `reactive:` block wires event-driven
// dispatch: a target skill fires when a `when:` condition holds for a source
// skill (scripts/reactive_when.sh evaluates the condition at scheduler time).
// Nothing validated these references before, so a reactive trigger naming a
// pruned skill, or a mistyped `when:`, was a silent no-op that only showed up as
// a dispatch that never happened. Mirror the skill-refs check for both the target
// and the `on:` source, and reject a `when:` the evaluator cannot parse.
// ---------------------------------------------------------------------------

// A `when:` the scheduler's evaluator (scripts/reactive_when.sh) can parse. Keep
// these three patterns in lockstep with that script.
function validateWhen(when) {
  const w = String(when).trim();
  return /^consecutive_failures\s*>=\s*\d+$/.test(w)
    || /^last_status\s*=\s*[a-z]+$/.test(w)
    || /^success_rate\s*(<=|>=|<|>)\s*[0-9]+(\.[0-9]+)?$/.test(w);
}

// Pure: returns { targets, sources, conditions }, each an array of {name/when, lineNum}.
// Skips comment lines so the documented (commented-out) example doesn't register.
function collectReactiveRefs(lines) {
  const targets = [];
  const sources = [];
  const conditions = [];
  for (const [i, raw] of blockLines(lines, 'reactive')) {
    if (/^\s*#/.test(raw)) continue;
    const line = stripYamlComment(raw).trimEnd();
    let m;
    // A target skill is a 2-space key with nothing after the colon, or a one-line
    // flow map (`repair: { trigger: [...] }`); `trigger:` is deeper-indented and
    // the `- { on:, when: }` rows carry no bare 2-space key.
    if ((m = line.match(/^ {2}([a-z][a-z0-9-]+):\s*(\{.*)?$/))) targets.push({ name: m[1], lineNum: i + 1 });
    if ((m = line.match(/\bon:\s*"?([a-zA-Z0-9_*-]+)"?/))) sources.push({ name: m[1], lineNum: i + 1 });
    if ((m = line.match(/\bwhen:\s*"([^"]+)"/))) conditions.push({ when: m[1], lineNum: i + 1 });
  }
  return { targets, sources, conditions };
}

function checkReactiveRefs(lines) {
  if (!fs.existsSync(SKILLS_DIR)) return; // checkSkillRefs already failed on this
  const { targets, sources, conditions } = collectReactiveRefs(lines);
  const problems = [];

  for (const t of targets) {
    if (!skillExists(t.name)) {
      problems.push('FAIL: aeon.yml reactive target "' + t.name + '" (line ' + t.lineNum + ') has no skills/' + t.name + '/SKILL.md');
    }
  }
  for (const s of sources) {
    if (s.name === '*') continue; // wildcard: any source skill
    if (!skillExists(s.name)) {
      problems.push('FAIL: aeon.yml reactive trigger on: "' + s.name + '" (line ' + s.lineNum + ') names no skills/' + s.name + '/SKILL.md');
    }
  }
  for (const c of conditions) {
    if (!validateWhen(c.when)) {
      problems.push('FAIL: aeon.yml reactive when: "' + c.when + '" (line ' + c.lineNum + ') is not a condition reactive_when.sh can evaluate (consecutive_failures >= N | last_status = <v> | success_rate <op> X)');
    }
  }

  if (problems.length > 0) {
    problems.forEach(fail);
  } else if (targets.length === 0) {
    pass('PASS reactive: no reactive triggers defined');
  } else {
    pass('PASS reactive: ' + targets.length + ' target(s), ' + sources.length + ' source ref(s), ' + conditions.length + ' condition(s) all valid');
  }
}

// ---------------------------------------------------------------------------
// Check 5 - chain `when:` expression syntax. A chain step can route on a score
// (`when: "score > 5"`, evaluated at runtime by scripts/chain_when.sh). Catch a
// malformed expression here, at config time, instead of when the chain runs at
// 3am. Grammar: <key> <op> <value>; ordering ops (< <= > >=) require an integer
// value so the runtime never string-compares "10" < "9".
// ---------------------------------------------------------------------------
function validateChainWhen(expr) {
  const m = String(expr).trim().match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*(==|!=|<=|>=|<|>)\s*(.+?)\s*$/);
  if (!m) return false;
  const op = m[2];
  const val = m[3].trim();
  if (['<', '<=', '>', '>='].includes(op)) return /^-?\d+$/.test(val);
  return val.length > 0;
}

function checkChainWhen(lines) {
  const problems = [];
  for (const [i, raw] of blockLines(lines, 'chains')) {
    if (/^\s*#/.test(raw)) continue;
    const m = raw.match(/when:\s*"([^"]+)"/);
    if (m && !validateChainWhen(m[1])) {
      problems.push('FAIL: aeon.yml chain when: "' + m[1] + '" (line ' + (i + 1) + ') is not a valid <key> <op> <value> expression (ordering ops < <= > >= require an integer value)');
    }
  }
  if (problems.length > 0) problems.forEach(fail);
  else pass('PASS chain-when: all chain when: expressions are well-formed');
}

// ---------------------------------------------------------------------------
// Check 6 - schedule format. scripts/cron-due.sh treats a malformed schedule as
// "never due" (with a stderr warning on every tick), so a typo silently stops a
// skill. Mirror its grammar here: 5 fields, each a comma list of `*`, `N` or
// `N-M`, optionally `/STEP` (STEP >= 1), numbers in the field's range; month and
// day-of-week names (JAN-DEC, SUN-SAT) are accepted.
// ---------------------------------------------------------------------------
const CRON_FIELDS = [
  ['minute', 0, 59], ['hour', 0, 23], ['day-of-month', 1, 31], ['month', 1, 12], ['day-of-week', 0, 7],
];
const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DOW_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// Pure: a day-of-week field with names turned into numbers, as scripts/cron-due.sh
// reads it. SUN closes a range as 7 (SAT-SUN is 6-7) unless the range also starts
// on Sunday: SUN-SUN and 0-SUN stay Sunday only. A bare SUN stays 0.
function dowToNumbers(field) {
  let out = String(field).toUpperCase().replace(/(^|,)(SUN|0+)-SUN/g, '$1$2-0').split('-SUN').join('-7');
  DOW_NAMES.forEach((n, i) => { out = out.split(n).join(String(i)); });
  return out;
}

// Pure: returns null when valid, else a short reason.
function validateSchedule(sched) {
  const s = String(sched).trim();
  if (s === 'workflow_dispatch' || s === 'reactive') return null;
  const fields = s.split(/\s+/);
  if (fields.length !== 5) return 'expected 5 cron fields, got ' + fields.length;
  for (let f = 0; f < 5; f++) {
    const [name, lo, hi] = CRON_FIELDS[f];
    let field = fields[f].toUpperCase();
    if (f === 3) MONTH_NAMES.forEach((n, i) => { field = field.split(n).join(String(i + 1)); });
    if (f === 4) field = dowToNumbers(field);
    for (const el of field.split(',')) {
      const m = el.match(/^(\*|(\d+)(?:-(\d+))?)(?:\/(\d+))?$/);
      if (!m) return 'bad ' + name + ' element "' + el + '"';
      if (m[4] !== undefined && Number(m[4]) < 1) return name + ' step must be >= 1';
      if (m[1] === '*') continue;
      const a = Number(m[2]);
      const b = m[3] !== undefined ? Number(m[3]) : a;
      if (a < lo || b > hi || a > b) return name + ' value out of range ' + lo + '-' + hi + ' in "' + el + '"';
    }
  }
  return null;
}

// Pure: every `schedule:` value in the skills: and chains: blocks, with line numbers.
function collectSchedules(lines) {
  const found = [];
  for (const header of ['skills', 'chains']) {
    for (const [i, raw] of blockLines(lines, header)) {
      if (/^\s*#/.test(raw)) continue;
      const m = raw.match(/\bschedule:\s*(?:"([^"]*)"|'([^']*)'|([^,}#]+))/);
      if (!m) continue;
      const v = (m[1] ?? m[2] ?? m[3] ?? '').trim();
      found.push({ schedule: v, lineNum: i + 1 });
    }
  }
  return found;
}

function checkSchedules(lines) {
  const problems = [];
  const all = collectSchedules(lines);
  for (const { schedule, lineNum } of all) {
    const why = validateSchedule(schedule);
    if (why) problems.push('FAIL: aeon.yml schedule "' + schedule + '" (line ' + lineNum + ') is not valid: ' + why);
  }
  if (problems.length > 0) problems.forEach(fail);
  else pass('PASS schedules: all ' + all.length + ' schedule: values are workflow_dispatch, reactive, or valid 5-field cron');
}

// ---------------------------------------------------------------------------
// Check 7 - skill entry keys. Every reader of a skills: entry looks keys up by
// exact name (scheduler via scripts/parse-aeon-config.sh: enabled, schedule, var;
// scripts/skill_entry.sh callers in resolve-harness.sh and the run workflow:
// model, harness, attest; the dashboard's parseConfig: the first five), so a
// misspelled key is silently dropped: `shedule:` leaves the skill unscheduled,
// `enabld:` leaves it off, `modle:` runs it on the default model.
// ---------------------------------------------------------------------------
const SKILL_ENTRY_KEYS = ['enabled', 'schedule', 'var', 'model', 'harness', 'attest'];

// Pure: strips a trailing `# comment` ('#' only opens one outside quotes and at
// the start or after whitespace, so a var like "fix #12" survives).
function stripYamlComment(s) {
  let quote = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === '\\' && quote === '"') i++;
      else if (c === "'" && quote === "'" && s[i + 1] === "'") i++; // '' is an escaped quote
      else if (c === quote) quote = null;
    } else if (c === '"' || (c === "'" && (i === 0 || /[\s{[,:]/.test(s[i - 1])))) {
      quote = c;
    } else if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) {
      return s.slice(0, i);
    }
  }
  return s;
}

// Pure: walks flow-collection text, calling visit(char, index, depth) for every
// character outside quotes. depth counts the open { and [ before the character.
function walkFlow(text, visit) {
  let quote = null;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\' && quote === '"') i++;
      else if (c === "'" && quote === "'" && text[i + 1] === "'") i++; // '' is an escaped quote
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || (c === "'" && (i === 0 || /[\s{[,:]/.test(text[i - 1])))) { quote = c; continue; }
    if (c === '}' || c === ']') depth--;
    visit(c, i, depth);
    if (c === '{' || c === '[') depth++;
  }
}

// Pure: net open braces left by one line of a flow map.
function flowDepth(text) {
  let net = 0;
  walkFlow(text, (c) => { if (c === '{') net++; else if (c === '}') net--; });
  return net;
}

const unquote = (v) => v.trim().replace(/^(["'])(.*)\1$/, '$2');

// Pure: the `key: value` items directly inside the outermost { } of flow text,
// each with the offset it starts at.
function flowItems(text) {
  const open = text.indexOf('{');
  const close = text.lastIndexOf('}');
  if (open === -1 || close < open) return [];
  const items = [];
  let start = open + 1;
  const push = (end) => {
    const raw = text.slice(start, end);
    const colon = raw.indexOf(':');
    if (colon !== -1 && raw.slice(0, colon).trim()) {
      items.push({ key: unquote(raw.slice(0, colon)), value: unquote(raw.slice(colon + 1)), offset: start + raw.search(/\S/) });
    }
  };
  walkFlow(text.slice(0, close), (c, i, depth) => {
    if (i > open && c === ',' && depth === 1) { push(i); start = i + 1; }
  });
  push(close);
  return items;
}

// Pure: every entry of the skills: block as { name, lineNum, keys: [{ key, value,
// lineNum }] }. Handles the three shapes skill_entry.sh reads: a one-line flow
// map, a flow map spread over several lines, and an indented block map.
function collectSkillEntries(lines) {
  const rows = [...blockLines(lines, 'skills')];
  const entries = [];
  for (let r = 0; r < rows.length; r++) {
    const [i, raw] = rows[r];
    const head = raw.match(/^ {2}([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!head) continue;
    const entry = { name: head[1], lineNum: i + 1, keys: [] };
    entries.push(entry);

    const body = [{ text: stripYamlComment(head[2]).trim(), lineNum: i + 1 }];
    let k = r + 1;
    if (body[0].text === '') {
      body.length = 0;
      for (; k < rows.length; k++) {
        const [j, l] = rows[k];
        if (/^\s*(#|$)/.test(l)) continue;
        if (!/^ {3,}/.test(l)) break;
        body.push({ text: stripYamlComment(l).trimEnd(), lineNum: j + 1 });
      }
    }
    if (body.length === 0) continue;
    if (body.length === 1 && body[0].text.startsWith('{') && flowDepth(body[0].text) > 0) {
      let depth = flowDepth(body[0].text);
      for (; k < rows.length && depth > 0; k++) {
        const [j, l] = rows[k];
        if (/^\s*(#|$)/.test(l)) continue;
        body.push({ text: stripYamlComment(l).trimEnd(), lineNum: j + 1 });
        depth += flowDepth(l);
      }
    }

    if (body[0].text.trim().startsWith('{')) {
      let joined = '';
      const starts = [];
      let depth = 0;
      for (const b of body) {
        starts.push({ offset: joined.length, lineNum: b.lineNum });
        joined += b.text.trim() + ' ';
        depth += flowDepth(b.text);
        if (depth <= 0) break;
      }
      for (const it of flowItems(joined)) {
        const at = [...starts].reverse().find((s) => s.offset <= it.offset);
        entry.keys.push({ key: it.key, value: it.value, lineNum: at.lineNum });
      }
    } else {
      const indent = body[0].text.match(/^ */)[0].length;
      for (const b of body) {
        const m = b.text.match(/^( *)([A-Za-z0-9_-]+):\s*(.*)$/);
        if (m && m[1].length === indent) entry.keys.push({ key: m[2], value: unquote(m[3]), lineNum: b.lineNum });
      }
    }
  }
  return entries;
}

// Pure: optimal-string-alignment distance (one swap of neighbours costs 1, so
// `modle` is one edit from `model`).
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// Pure: the known key closest to `key`, or null when nothing is a plausible typo.
function suggestSkillKey(key) {
  const lower = key.toLowerCase();
  let best = null;
  let bestDist = Infinity;
  for (const known of SKILL_ENTRY_KEYS) {
    const dist = editDistance(lower, known);
    if (dist < bestDist) { best = known; bestDist = dist; }
  }
  return bestDist <= (lower.length <= 4 ? 1 : 2) ? best : null;
}

// Pure: FAIL lines for the skills: block. An entry with `enabled: true` and no
// schedule: is skipped by the scheduler (empty schedule), so it only runs if a
// reactive: block or a chain dispatches it; `workflow_dispatch` is the explicit
// spelling of an on-demand skill and is not flagged.
function analyzeSkillKeys(lines) {
  const problems = [];
  const dispatched = new Set([
    ...collectReactiveRefs(lines).targets.map((t) => t.name),
    ...collectChainRefs(lines).map((r) => r.name),
  ]);
  for (const entry of collectSkillEntries(lines)) {
    for (const { key, lineNum } of entry.keys) {
      if (SKILL_ENTRY_KEYS.includes(key)) continue;
      const hint = suggestSkillKey(key);
      problems.push('FAIL: aeon.yml skills entry "' + entry.name + '" (line ' + lineNum + ') has unknown key "' + key + '"'
        + (hint ? ' (did you mean "' + hint + '"?)' : ' (known keys: ' + SKILL_ENTRY_KEYS.join(', ') + ')'));
    }
    const value = (name) => entry.keys.filter((k) => k.key === name).pop();
    const enabled = value('enabled');
    const schedule = value('schedule');
    if (enabled && enabled.value === 'true' && !(schedule && schedule.value) && !dispatched.has(entry.name)) {
      problems.push('FAIL: aeon.yml skills entry "' + entry.name + '" (line ' + entry.lineNum + ') is enabled: true but has no schedule:, reactive trigger or chain step, so it never runs (use schedule: "workflow_dispatch" for an on-demand skill)');
    }
  }
  return problems;
}

function checkSkillKeys(lines) {
  const problems = analyzeSkillKeys(lines);
  if (problems.length > 0) problems.forEach(fail);
  else pass('PASS skill-keys: all ' + collectSkillEntries(lines).length + ' skills entries use known keys (' + SKILL_ENTRY_KEYS.join(', ') + ') and every enabled one can run');
}

function main() {
  checkCheckoutOrdering();

  const lines = readAeonYml();
  if (lines === null) {
    fail('FAIL: aeon.yml not found at repo root');
  } else {
    checkDuplicateKeys(lines);
    checkSkillRefs(lines);
    checkReactiveRefs(lines);
    checkChainWhen(lines);
    checkSchedules(lines);
    checkSkillKeys(lines);
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

if (require.main === module) main();

module.exports = { analyzeCheckout, parseSteps, collectReactiveRefs, validateWhen, validateChainWhen, validateSchedule, dowToNumbers, collectSchedules, collectSkillEntries, analyzeSkillKeys, suggestSkillKey };
