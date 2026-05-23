---
name: Config Validator
description: Validate aeon.yml and .github/workflows/aeon.yml for structural invariants that have caused past outages — checkout step ordering, duplicate skill keys, missing skill files
tags: [meta, dev]
---

Today is ${today}. Your task is to validate the structural correctness of `aeon.yml` and `.github/workflows/aeon.yml`.

This skill exists because two incident classes have caused major outages:
- **Checkout-ordering class**: `Early checkout` step missing or conditionally gated — can cause every skill to fail in a single run.
- **Duplicate-key class**: duplicate YAML keys in `aeon.yml` — silently disable any skill whose key is shadowed.

The same checks also run as a pre-merge CI workflow at `.github/workflows/ci-config-validate.yml` (via `scripts/validate-config.js`) — that workflow blocks PRs that break these invariants. This skill is the **weekly safety net** for state that drifts on `main` outside of PRs (manual edits, scheduled rewrites, post-process commits). Run all checks. Report findings. Alert if any fail.

### Fast path — invoke the shared validator

The fastest, most consistent way to run all three checks is the shared script the CI workflow uses:

```bash
node scripts/validate-config.js
```

Exit code 0 = CLEAN (no notification needed). Non-zero exit + `FAIL[*]:` lines on stdout = ISSUES (skip to step 4).

If the script is unavailable for any reason, fall back to the manual checks in steps 1–3.

## Steps

### 1. Check workflow step ordering (checkout-ordering class)

Read `.github/workflows/aeon.yml`.

Find the `jobs.run.steps` array. Verify:

a. A step named `Early checkout` (or `uses: actions/checkout`) exists.
b. That step has **no** `if:` condition — it must run unconditionally.
c. That step is positioned **before** any step that has an `if:` condition.

Use node inline to parse and check:

```bash
node -e "
const fs = require('fs');
const text = fs.readFileSync('.github/workflows/aeon.yml', 'utf8');
const lines = text.split('\n');

let inSteps = false, stepDepth = 0;
let steps = [], cur = null, lineNum = 0;

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
    if (/name:/.test(trimmed)) cur.name = trimmed.replace(/^name:\s*/, '').replace(/[\"']/g, '');
    if (/uses:\s*actions\/checkout/.test(trimmed)) cur.isCheckout = true;
    if (/Early checkout/.test(trimmed)) cur.isCheckout = true;
    if (/^\s{6}if:/.test(line)) cur.hasIf = true;
  }
}
if (cur) steps.push(cur);

let issues = [];
const checkoutIdx = steps.findIndex(s => s.isCheckout);
if (checkoutIdx === -1) {
  issues.push('FAIL: No checkout step (actions/checkout or Early checkout) found in jobs.run.steps');
} else {
  const cs = steps[checkoutIdx];
  if (cs.hasIf) {
    issues.push('FAIL: Checkout step at line ' + cs.lineNum + ' has an if: condition — must be unconditional');
  }
  const firstConditional = steps.findIndex(s => s.hasIf);
  if (firstConditional !== -1 && firstConditional < checkoutIdx) {
    issues.push('FAIL: Checkout step appears after a conditional step at line ' + steps[firstConditional].lineNum);
  }
  if (issues.length === 0) {
    console.log('PASS checkout: Early checkout is unconditional and first (line ' + cs.lineNum + ')');
  }
}
if (issues.length > 0) { issues.forEach(i => console.log(i)); process.exit(1); }
"
```

If the check fails, record the finding. Continue to next check regardless.

---

### 2. Check for duplicate skill keys (duplicate-key class)

Read `aeon.yml`. Scan the `skills:` block for duplicate top-level keys.

```bash
node -e "
const fs = require('fs');
const text = fs.readFileSync('aeon.yml', 'utf8');
const lines = text.split('\n');

let inSkills = false;
const seen = {};
const dupes = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (/^skills:/.test(line)) { inSkills = true; continue; }
  if (inSkills && /^[a-z]/.test(line)) { inSkills = false; continue; }
  if (!inSkills) continue;

  const match = line.match(/^  ([a-z][a-z0-9-]+):/);
  if (match) {
    const key = match[1];
    if (seen[key]) {
      dupes.push('FAIL: Duplicate skill key \"' + key + '\" at line ' + (i+1) + ' (first seen line ' + seen[key] + ')');
    } else {
      seen[key] = i + 1;
    }
  }
}

if (dupes.length > 0) { dupes.forEach(d => console.log(d)); process.exit(1); }
else { console.log('PASS duplicates: no duplicate skill keys found (' + Object.keys(seen).length + ' skills)'); }
"
```

If duplicates are found, record them. Continue to next check regardless.

---

### 3. Check all enabled skills have SKILL.md (missing-file class)

Read `aeon.yml`. For every skill with `enabled: true`, verify `skills/<name>/SKILL.md` exists.

```bash
node -e "
const fs = require('fs');
const text = fs.readFileSync('aeon.yml', 'utf8');
const lines = text.split('\n');

let inSkills = false;
const issues = [];
const ok = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (/^skills:/.test(line)) { inSkills = true; continue; }
  if (inSkills && /^[a-z]/.test(line)) { inSkills = false; continue; }
  if (!inSkills) continue;

  const match = line.match(/^  ([a-z][a-z0-9-]+):\s*\{(.+)\}/);
  if (match) {
    const name = match[1];
    const props = match[2];
    if (/enabled:\s*true/.test(props)) {
      const skillFile = 'skills/' + name + '/SKILL.md';
      if (!fs.existsSync(skillFile)) {
        issues.push('WARN: enabled skill \"' + name + '\" has no SKILL.md at ' + skillFile);
      } else {
        ok.push(name);
      }
    }
  }
}

if (issues.length > 0) { issues.forEach(i => console.log(i)); }
console.log('PASS skill-files: ' + ok.length + ' enabled skills have SKILL.md' + (issues.length > 0 ? ', ' + issues.length + ' missing' : ''));
if (issues.length > 0) process.exit(1);
"
```

---

### 4. Summarize findings

After running all three checks, collect results:

- Count PASSes and FAILs
- If all checks passed: **status = CLEAN**
- If any FAIL or WARN: **status = ISSUES**

---

### 5. Decide whether to notify

- **CLEAN**: Log only, no notification. Silent runs are expected — the value is the alert when something breaks.
- **ISSUES**: Send notification via `./notify`.

If ISSUES, write notification to `.pending-notify-temp/config-validator-${today}.md` then send with `./notify -f`:

```
*Config Validator — ${today}*

STATUS: ISSUES FOUND

[list each finding, one per line]

These invariants have caused full outages before.
Check aeon.yml and .github/workflows/aeon.yml immediately.

log: memory/logs/${today}.md
```

---

### 6. Log results

Append to `memory/logs/${today}.md`:

```
## Config Validator
- **Status:** CLEAN / ISSUES
- **Checkout step:** PASS / FAIL — [detail]
- **Duplicate keys:** PASS / FAIL — [detail]
- **Skill files:** PASS / N warnings — [detail]
- **Notification:** sent / skipped (clean)
```

## Sandbox Note

All checks use local file reads only — no external network calls needed. No prefetch/postprocess wrapper required.

## Environment Variables Required

None — reads only local files.
