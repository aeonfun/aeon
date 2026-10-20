'use strict';

// Fixture tests for the checkout-ordering invariant in validate-config.js.
//   node --test scripts/validate-config.test.js
//
// The run workflow deliberately has no unconditional checkout (it checks out on
// the issues path and again on the scheduled path). These fixtures pin the real
// invariant: the skill-run step must be preceded by a checkout whose condition
// covers it — and guard against a regression to the old "unconditional & first"
// rule, which false-failed on the live workflow.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  analyzeCheckout, collectReactiveRefs, validateWhen, validateChainWhen, validateSchedule, dowToNumbers, collectSchedules, collectSkillEntries, analyzeSkillKeys, suggestSkillKey,
} = require('./validate-config.js');

// Wrap an indented steps body in a minimal single-job workflow.
const wf = (steps) => `name: run
on: { schedule: [{ cron: '0 * * * *' }] }
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
${steps}`;

test('PASS: conditional checkout covers a run step with the same condition', () => {
  const r = analyzeCheckout(wf(
`      - name: Determine skill
        id: skill
        run: echo hi
      - name: Checkout repo
        if: steps.work.outputs.mode != ''
        uses: actions/checkout@v7
      - name: Run
        id: run
        if: steps.work.outputs.mode != ''
        run: claude`));
  assert.equal(r.ok, true, r.line);
});

test("PASS: a checkout whose condition leads the run step's && chain covers it", () => {
  const r = analyzeCheckout(wf(
`      - name: Checkout repo
        if: steps.work.outputs.mode != ''
        uses: actions/checkout@v7
      - name: Run
        id: run
        if: steps.work.outputs.mode != '' && steps.idle.outputs.skip != 'true'
        run: claude`));
  assert.equal(r.ok, true, r.line);
});

test('FAIL: an || in the run condition breaks the conjunct cover', () => {
  const r = analyzeCheckout(wf(
`      - name: Checkout repo
        if: steps.work.outputs.mode != ''
        uses: actions/checkout@v7
      - name: Run
        id: run
        if: steps.work.outputs.mode != '' && inputs.a || inputs.b
        run: claude`));
  assert.equal(r.ok, false);
  assert.match(r.line, /does not cover/);
});

test('PASS: an unconditional checkout covers any run step', () => {
  const r = analyzeCheckout(wf(
`      - name: Checkout repo
        uses: actions/checkout@v7
      - name: Run
        id: run
        if: steps.work.outputs.mode != ''
        run: claude`));
  assert.equal(r.ok, true, r.line);
});

test("FAIL: the run step's condition is not covered by the preceding checkout", () => {
  const r = analyzeCheckout(wf(
`      - name: Checkout repo
        if: github.event_name == 'issues'
        uses: actions/checkout@v7
      - name: Run
        id: run
        if: steps.work.outputs.mode != ''
        run: claude`));
  assert.equal(r.ok, false);
  assert.match(r.line, /does not cover/);
});

test('FAIL: checkout appears after the run step (ordering)', () => {
  const r = analyzeCheckout(wf(
`      - name: Run
        id: run
        if: steps.work.outputs.mode != ''
        run: claude
      - name: Checkout repo
        if: steps.work.outputs.mode != ''
        uses: actions/checkout@v7`));
  assert.equal(r.ok, false);
  assert.match(r.line, /no checkout step before it/);
});

test('FAIL: no checkout step at all', () => {
  const r = analyzeCheckout(wf(
`      - name: Run
        id: run
        run: claude`));
  assert.equal(r.ok, false);
  assert.match(r.line, /no checkout step/);
});

test('FAIL: the skill-run step cannot be located', () => {
  const r = analyzeCheckout(wf(
`      - name: Checkout repo
        uses: actions/checkout@v7
      - name: Do a thing
        run: echo hi`));
  assert.equal(r.ok, false);
  assert.match(r.line, /could not locate the skill-run step/);
});

// Regression guard: the live workflow (two conditional checkouts by design) must
// PASS. The old "unconditional & first" rule false-failed here once the if:
// detection actually worked.
test('PASS: the live .github/workflows/aeon.yml', () => {
  const wfPath = path.resolve(__dirname, '..', '.github', 'workflows', 'aeon.yml');
  const r = analyzeCheckout(fs.readFileSync(wfPath, 'utf8'));
  assert.equal(r.ok, true, r.line);
});

// --- Check 4: reactive-trigger reference + condition parsing ---

// A reactive: block with one target, one wildcard source, and a valid condition.
const reactiveBlock = (body) => `reactive:
${body}
chains:
  # example
`.split('\n');

test('collectReactiveRefs: parses target, on: source, and when:', () => {
  const r = collectReactiveRefs(reactiveBlock(
`  skill-repair:
    trigger:
      - { on: "*", when: "consecutive_failures >= 3" }
  autoresearch:
    trigger:
      - { on: skill-health, when: "last_status = success" }`));
  assert.deepEqual(r.targets.map((t) => t.name), ['skill-repair', 'autoresearch']);
  assert.deepEqual(r.sources.map((s) => s.name), ['*', 'skill-health']);
  assert.deepEqual(r.conditions.map((c) => c.when), ['consecutive_failures >= 3', 'last_status = success']);
});

test('collectReactiveRefs: ignores commented-out example rows', () => {
  const r = collectReactiveRefs(reactiveBlock(
`  # skill-repair:
  #   trigger:
  #     - { on: "*", when: "consecutive_failures >= 3" }`));
  assert.equal(r.targets.length, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.conditions.length, 0);
});

test('validateWhen: accepts the three documented condition forms', () => {
  assert.equal(validateWhen('consecutive_failures >= 3'), true);
  assert.equal(validateWhen('last_status = success'), true);
  assert.equal(validateWhen('success_rate < 0.5'), true);
  assert.equal(validateWhen('success_rate >= 0.9'), true);
});

test('validateWhen: rejects malformed / unsupported conditions', () => {
  assert.equal(validateWhen('score > abc'), false);
  assert.equal(validateWhen('consecutive_failures > 3'), false); // only >= supported
  assert.equal(validateWhen('success_rate = 0.5'), false);       // no = for rate
  assert.equal(validateWhen('last_status = 5'), false);          // value not [a-z]+
  assert.equal(validateWhen(''), false);
});

// The live aeon.yml ships the reactive examples commented out, so it must parse to
// zero references (and therefore never fail the reactive check).
test('the live aeon.yml has no uncommented reactive references', () => {
  const ymlPath = path.resolve(__dirname, '..', 'aeon.yml');
  const lines = fs.readFileSync(ymlPath, 'utf8').split('\n');
  const r = collectReactiveRefs(lines);
  assert.equal(r.targets.length, 0, 'unexpected uncommented reactive target(s)');
});

// --- Check 5: chain when: expression syntax ---

test('validateChainWhen: accepts score ordering and string equality', () => {
  assert.equal(validateChainWhen('score > 5'), true);
  assert.equal(validateChainWhen('score <= 5'), true);
  assert.equal(validateChainWhen('score >= 10'), true);
  assert.equal(validateChainWhen('verdict == pass'), true);
  assert.equal(validateChainWhen('verdict != fail'), true);
});

test('validateChainWhen: rejects malformed and non-integer ordering', () => {
  assert.equal(validateChainWhen('score > abc'), false); // ordering needs integer
  assert.equal(validateChainWhen('score is big'), false); // no valid operator
  assert.equal(validateChainWhen('score >'), false);      // no value
  assert.equal(validateChainWhen('> 5'), false);          // no key
  assert.equal(validateChainWhen(''), false);
});

test('validateSchedule: accepts cron forms scripts/cron-due.sh can fire', () => {
  for (const ok of [
    'workflow_dispatch', 'reactive', '0 8 * * *', '*/30 * * * *', '15 6,14,18 * * *',
    '0 9-17/2 * * *', '0-10/5,30 9 * * *', '0 0 13 * 5', '0 10 * * 7', '05 08 * * *',
    '0 10 * * MON-FRI', '0 0 1 jul *', '0 9 * * SAT-SUN', '0 9 * * fri-sun', '0 9 * * SUN',
    '0 9 * * MON-SUN', '0 9 * * SUN-SUN', '0 9 * * 0-SUN', '0 9 * * SAT-SUN/1', '0 9 * * MON,SUN',
  ]) {
    assert.equal(validateSchedule(ok), null, ok);
  }
});

test('validateSchedule: rejects schedules cron-due.sh would never fire', () => {
  for (const bad of ['*/0 * * * *', '61 * * * *', '0 24 * * *', '0 0 0 * *', '0 0 * 13 *',
    '0 0 * * 8', '0 9 * * SUN-SAT-SUN', '0 0 * * * *', '0 8 * *', '0 x * * *', '10-5 * * * *', 'daily']) {
    assert.notEqual(validateSchedule(bad), null, bad);
  }
});

test('dowToNumbers: SUN ends a range as 7 only when the range does not start on Sunday', () => {
  assert.equal(dowToNumbers('SAT-SUN'), '6-7');
  assert.equal(dowToNumbers('fri-sun'), '5-7');
  assert.equal(dowToNumbers('MON-SUN'), '1-7');
  assert.equal(dowToNumbers('SAT-SUN/1'), '6-7/1');
  assert.equal(dowToNumbers('SUN-SUN'), '0-0'); // Sunday only, not 0-7 (every day)
  assert.equal(dowToNumbers('0-SUN'), '0-0');   // Sunday only
  assert.equal(dowToNumbers('MON,SUN-SUN'), '1,0-0');
  assert.equal(dowToNumbers('SUN'), '0');
  assert.equal(dowToNumbers('MON,SUN'), '1,0');
  assert.equal(dowToNumbers('SUN-SAT'), '0-6');
});

test('collectSchedules: reads skills + chains schedules and skips comments', () => {
  const lines = [
    'skills:',
    '  a: { enabled: true, schedule: "0 8 * * *" }',
    '  b:',
    '    schedule: \'*/0 * * * *\'',
    'chains:',
    '  c:',
    '    schedule: "workflow_dispatch"',
    '  # d:',
    '  #   schedule: "bogus"',
    'model: x',
  ];
  assert.deepEqual(collectSchedules(lines).map((s) => s.schedule), ['0 8 * * *', '*/0 * * * *', 'workflow_dispatch']);
});

test('the live aeon.yml has only valid schedules', () => {
  const lines = fs.readFileSync(path.join(__dirname, '..', 'aeon.yml'), 'utf8').split('\n');
  const bad = collectSchedules(lines).filter((s) => validateSchedule(s.schedule) !== null);
  assert.deepEqual(bad, []);
});

// --- Check 7: skill entry keys ---

const skillsBlock = (body, tail = '') => `skills:
${body}
${tail}`;
const AEON_YML_PATH = path.resolve(__dirname, '..', 'aeon.yml');
const validatorPath = path.join(__dirname, 'validate-config.js');

test('FAIL: an unknown skill key names the key and suggests the near miss', () => {
  const problems = analyzeSkillKeys(skillsBlock('  digest: { enabld: true, schedule: "0 14 * * *" }').split('\n'));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /"digest" \(line 2\) has unknown key "enabld" \(did you mean "enabled"\?\)/);
});

test('FAIL: an unknown key with no close match lists the known keys instead', () => {
  const problems = analyzeSkillKeys(skillsBlock('  digest: { enabled: false, schedule: "0 14 * * *", timeout: 30 }').split('\n'));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /unknown key "timeout" \(known keys: enabled, schedule, var, model, harness, attest\)/);
});

test('suggestSkillKey: transposition and one-letter typos resolve, unrelated names do not', () => {
  assert.equal(suggestSkillKey('shedule'), 'schedule');
  assert.equal(suggestSkillKey('modle'), 'model');
  assert.equal(suggestSkillKey('vars'), 'var');
  assert.equal(suggestSkillKey('Enabled'), 'enabled');
  assert.equal(suggestSkillKey('timeout'), null);
});

test('PASS: known keys in one-line, multi-line flow and block entries', () => {
  const lines = skillsBlock(`  a: { enabled: true, schedule: "0 8 * * *", var: "x, y: {z} # not a comment" } # trailing
  b: { enabled: false,
       schedule: "0 9 * * *", model: "claude-haiku-5-5",
       harness: "grok" }
  c:
    enabled: true
    schedule: "0 10 * * *"
    attest: false`).split('\n');
  assert.deepEqual(analyzeSkillKeys(lines), []);
  const keys = collectSkillEntries(lines).map((e) => e.keys.map((k) => k.key));
  assert.deepEqual(keys, [['enabled', 'schedule', 'var'], ['enabled', 'schedule', 'model', 'harness'], ['enabled', 'schedule', 'attest']]);
});

test('an unknown key on a continuation line is reported on its own line', () => {
  const lines = skillsBlock(`  b: { enabled: false,
       schedule: "0 9 * * *",
       modle: "claude-haiku-5-5" }`).split('\n');
  const problems = analyzeSkillKeys(lines);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /\(line 4\) has unknown key "modle" \(did you mean "model"\?\)/);
});

test('a block entry with a misspelled key is flagged', () => {
  const problems = analyzeSkillKeys(skillsBlock('  c:\n    enabled: true\n    shedule: "0 10 * * *"').split('\n'));
  assert.ok(problems.some((p) => /unknown key "shedule" \(did you mean "schedule"\?\)/.test(p)));
});

test('FAIL: enabled: true with no schedule and no other trigger never runs', () => {
  const problems = analyzeSkillKeys(skillsBlock('  digest: { enabled: true, var: "" }').split('\n'));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /"digest" \(line 2\) is enabled: true but has no schedule:/);
});

test('PASS: an enabled skill without a schedule is fine as a reactive target or chain step', () => {
  const lines = `skills:
  repair: { enabled: true }
  feature: { enabled: true }
  cold: { enabled: false }
reactive:
  repair:
    trigger:
      - { on: "*", when: "consecutive_failures >= 3" }
chains:
  ship:
    schedule: "workflow_dispatch"
    steps:
      - { skill: feature }`.split('\n');
  assert.deepEqual(analyzeSkillKeys(lines), []);
});

test('PASS: a quoted chain step, a commented reactive target and a flow-form target all count as triggers', () => {
  const lines = `skills:
  feature: { enabled: true }
  notify-operator: { enabled: true }
  repair: { enabled: true }
reactive:
  notify-operator:                 # any skill you want to run on failure
    trigger:
      - { on: digest, when: "consecutive_failures >= 1" }
  repair: { trigger: [ { on: "*", when: "consecutive_failures >= 3" } ] }
chains:
  ship:
    schedule: "workflow_dispatch"
    steps:
      - { skill: "feature" }`.split('\n');
  assert.deepEqual(analyzeSkillKeys(lines), []);
  const r = collectReactiveRefs(lines);
  assert.deepEqual(r.targets.map((t) => t.name), ['notify-operator', 'repair']);
  assert.deepEqual(r.sources.map((s) => s.name), ['digest', '*']);
});

test("PASS: a doubled '' inside a single-quoted var is an escaped quote, not the end of the string", () => {
  const lines = skillsBlock(`  a: { enabled: true, schedule: "0 8 * * *", var: 'it''s, x: y' }
  b: { enabled: true, schedule: "0 9 * * *", var: 'it''s #1' }
  c: { enabled: true, schedule: "0 10 * * *" }`).split('\n');
  assert.deepEqual(analyzeSkillKeys(lines), []);
  assert.deepEqual(collectSkillEntries(lines).map((e) => e.name), ['a', 'b', 'c']);
  assert.equal(collectSkillEntries(lines)[1].keys.find((k) => k.key === 'var').value, "it''s #1");
});

test('PASS: workflow_dispatch is the explicit on-demand spelling and is not flagged', () => {
  assert.deepEqual(analyzeSkillKeys(skillsBlock('  tx-explain: { enabled: true, schedule: "workflow_dispatch" }').split('\n')), []);
});

test('the real aeon.yml has no skill key problems', () => {
  const lines = fs.readFileSync(AEON_YML_PATH, 'utf8').split('\n');
  assert.deepEqual(analyzeSkillKeys(lines), []);
});

test('the real aeon.yml makes validate-config.js exit 0 with a skill-keys PASS line', () => {
  const r = spawnSync(process.execPath, [validatorPath], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /^PASS skill-keys: /m);
  assert.match(r.stdout, /config: CLEAN/);
});

// Reproduction of the reported bug: every key and value misspelled on the real
// auto-merge line used to leave the validator CLEAN while dropping the skill from
// the schedule.
test('FAIL: the misspelled real auto-merge entry names both bad keys', () => {
  const lines = fs.readFileSync(AEON_YML_PATH, 'utf8').split('\n');
  const at = lines.findIndex((l) => l.startsWith('  auto-merge:'));
  assert.notEqual(at, -1, 'auto-merge entry not found in aeon.yml');
  lines[at] = '  auto-merge: { enabld: true, shedule: "0 14 * * *", harness: "claud", model: "claude-sonet" }';
  const problems = analyzeSkillKeys(lines);
  assert.equal(problems.length, 2, problems.join('\n'));
  assert.match(problems[0], /"auto-merge" .* unknown key "enabld" \(did you mean "enabled"\?\)/);
  assert.match(problems[1], /"auto-merge" .* unknown key "shedule" \(did you mean "schedule"\?\)/);
});
