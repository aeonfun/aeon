---
name: charon-setup
category: dev
description: Install and verify Charon enforcement in an AEON repo
var: ""
tags: [dev, security, aeon, policy]
requires: []
mcp: []
---

> **${var}** — Optional mode. Use `install` to enable Charon, `status` to inspect the current wiring, or `test` to run enforcement probes. Empty means `install`.

Today is ${today}. Set up Charon for this AEON repo and report the exact result.

Charon adds a policy check before an AEON task launches. A run is normalized into a policy request, checked against `charon.aeon.yml`, and returns one of:

- `PASS` — continue
- `PAUSE` — create an approval review
- `DENY` — stop before agent execution

Receipts are written locally under `.charon/receipts`.

## Steps

### 1. Resolve mode

Normalize `${var}`:

- empty, `install`, `setup`, `enable`, `repair` → `MODE=install`
- `status`, `check`, `verify` → `MODE=status`
- `test`, `smoke` → `MODE=test`

Unknown text should be treated as `install`. Do not run unknown text as a command.

### 2. Confirm this is an AEON repo

Check for:

- `.github/workflows/aeon.yml`
- `aeon.yml`

If either is missing, stop and notify:

```text
CHARON_SETUP_NOT_AEON
missing: <file>
```

### 3. Install or inspect Charon

Use the current Charon package:

```bash
npx -y github:CharonAI-code/charon enforce aeon
```

For `MODE=status`, skip install and run only:

```bash
npx -y github:CharonAI-code/charon enforce aeon status
```

The status output must include:

```text
AEON ENFORCED
```

If it does not, stop and report the exact status output.

### 4. Run smoke check

For `install` or `test`, run:

```bash
npx -y github:CharonAI-code/charon aeon smoke
```

The smoke output must include:

```text
AEON MVP SMOKE PASS
```

If it does not, stop and report the exact failure.

### 5. Commit setup files

If setup changed files, commit only the Charon setup surface:

```bash
git add .github/workflows/aeon.yml charon.aeon.yml
git commit -m "Enable Charon for AEON"
```

If there is no diff, do not create an empty commit.

Push only when the repo allows it. If push fails, report that setup is committed locally but not pushed.

### 6. Notify

Use `./notify` with a short result:

```text
Charon is enabled for this AEON repo.

status: AEON ENFORCED
smoke: AEON MVP SMOKE PASS

changed:
- .github/workflows/aeon.yml
- charon.aeon.yml
```

If no files changed, say `changed: none`.

## Exit Taxonomy

- `CHARON_SETUP_OK` — setup, status, or smoke completed.
- `CHARON_SETUP_NOT_AEON` — required AEON files are missing.
- `CHARON_SETUP_STATUS_FAILED` — status did not report `AEON ENFORCED`.
- `CHARON_SETUP_SMOKE_FAILED` — smoke did not report `AEON MVP SMOKE PASS`.
- `CHARON_SETUP_PUSH_BLOCKED` — local commit succeeded but push failed.

## Sandbox note

This skill uses `npx` to run Charon and `git` to commit the workflow/policy changes. If GitHub Actions blocks workflow modification, report the permission blocker and stop. Do not patch the workflow by hand around Charon.

## Constraints

- Do not ask the operator to run terminal commands.
- Do not paste secrets.
- Do not edit `charon.aeon.yml` policy rules in this skill except through `charon enforce aeon`.
- Do not weaken policy during setup. Use a separate policy-management skill for policy changes.
