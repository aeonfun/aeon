---
name: Config Validator
category: meta
description: Validate aeon.yml and .github/workflows/aeon.yml for structural invariants that have caused past outages — checkout step ordering, duplicate skill keys, missing skill files
tags: [meta, dev]
---

Today is ${today}. Your task is to validate the structural correctness of `aeon.yml` and `.github/workflows/aeon.yml`.

This skill exists because two incident classes have caused major outages:
- **Checkout-ordering class**: a repo-using step (the skill `Run`) executes without the repo checked out — checkout missing, ordered after `Run`, or gated behind a condition the run step does not share — can cause every skill to fail in a single run.
- **Duplicate-key class**: duplicate YAML keys in `aeon.yml` — silently disable any skill whose key is shadowed.

`scripts/validate-config.js` is the shared validator for these invariants (wiring it into a pre-merge CI workflow is a follow-up — adding the workflow needs a `workflows`-scoped token). This skill is the **weekly safety net** for state that drifts on `main` outside of PRs (manual edits, scheduled rewrites, post-process commits). Run all checks. Report findings. Alert if any fail.

### Fast path — invoke the shared validator

The fastest, most consistent way to run all three checks is the shared script:

```bash
node scripts/validate-config.js
```

Exit code 0 = CLEAN (no notification needed). Non-zero exit + `FAIL:` lines on stdout = ISSUES (skip to step 4).

If the script is unavailable for any reason, fall back to the manual checks in steps 1–3.

## Steps

### 1. Check workflow step ordering (checkout-ordering class)

Read `.github/workflows/aeon.yml`.

The canonical check is `scripts/validate-config.js` (the Fast path above). To keep a
second copy of the parser from drifting from the script, this manual fallback is a
*description* of the invariant, not a duplicate parser.

Find the `jobs.run.steps` array and verify the repo is always checked out before it
is used:

a. At least one checkout step (`uses: actions/checkout`, e.g. `Early checkout` /
   `Checkout repo`) exists.
b. The skill-run step (`id: run`, named `Run`) is preceded by a checkout whose `if:`
   **covers** it — the checkout is unconditional, or carries the *same* `if:`
   condition as the run step — so the repo can never be missing when `Run` executes.

The run workflow has no single unconditional checkout by design: it checks out on the
issues path (`Early checkout`, `if: github.event_name == 'issues'`) and again on the
scheduled path (`Checkout repo`, `if: steps.work.outputs.mode != ''`), and the steps
before either checkout only read GitHub context — they never touch repo files. A FAIL
is: no checkout precedes `Run`, or the preceding checkout's `if:` does not cover the
run step's.

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
