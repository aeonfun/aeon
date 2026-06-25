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
const { analyzeCheckout } = require('./validate-config.js');

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
