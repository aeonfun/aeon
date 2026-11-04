# Submitting to `dfinity/icskills`

Status: **prepared and schema-valid, NOT yet submitted.** This records the exact
steps to submit, per [`dfinity/icskills` CONTRIBUTING.md](https://github.com/dfinity/icskills/blob/main/CONTRIBUTING.md),
and the one gate that must clear first.

## What is ready

Each of the four `SKILL.md` files here validates against
`dfinity/icskills/skills/skill.schema.json`:

- required `name`, `description`, `metadata{title, category}` present;
- `license: Apache-2.0` and a `compatibility:` line added;
- categories drawn from the ICP vocab (Auth/CloudEngine/Core/DeFi/Frontend/
  Governance/Infrastructure/Integration/Motoko/Security): Infrastructure (status,
  cycles), Governance (SNS digest), Security (deploy-check);
- no `additionalProperties` (no Aeon-only keys).

## The gate before a PR will be accepted

CONTRIBUTING.md is explicit: **"PRs without eval results will not be accepted."**
Submission therefore requires running DFINITY's evaluation harness and pasting the
results into the PR description — this has NOT been run here (it needs the
`skill-validator` binary plus a `claude-cli` judge run, and authored output/trigger
evals):

```bash
node -v                      # >= 22
npm ci
brew install skill-validator # or: go install github.com/agent-ecosystem/skill-validator/cmd/skill-validator@latest
npm run validate             # schema check (should pass — these files are schema-valid)
skill-validator score evaluate --provider claude-cli skills/<skill-name>   # novelty/quality
# + author output_evals and trigger_evals, run the full suite, paste results (collapsed) into the PR
```

## Submission procedure (one PR per skill)

CONTRIBUTING.md requires **one skill per PR** and **repo-admin approval**. So:

1. Fork `dfinity/icskills`; copy `docs/icp/contribution/icskills/<name>/SKILL.md`
   to `skills/<name>/SKILL.md` in the fork (name must match the directory).
2. `npm run validate` → green.
3. Run the eval suite; collect output-eval + trigger-eval results.
4. Open **one PR per skill** with: a brief description of what it covers and why,
   and the eval results in a collapsed `<details>` block.
5. A repo admin reviews and approves before merge.

Order suggestion: lead with `icp-deploy-check` (Security; complements the existing
`canister-security` skill), then the monitoring/governance three.

## Why these are separate from the Aeon runtime skills

The runnable versions live in Aeon (`skills/`) and can't be submitted as-is — their
`metadata` carries Aeon-only keys the icskills schema rejects. See
[`README.md`](README.md) and [`../../ICP-SKILLS-COMPATIBILITY.md`](../../ICP-SKILLS-COMPATIBILITY.md).
