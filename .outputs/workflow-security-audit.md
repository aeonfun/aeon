*Workflow audit — 2026-05-03*
WORKFLOW_AUDIT_NEW_CRITICAL — 1 new critical finding (toJson-into-shell injection in messages.yml repository_dispatch path) plus 2 NEW High in chain-runner.yml.
Patch prepared (1C+2H, +8/-4 across 2 files), NOT applied — runner token still lacks workflow scope (same as PR #4).
Top chain: repository_dispatch payload escapes single-quoted shell, runs with full secret env (GH_GLOBAL, ANTHROPIC_API_KEY, bot tokens) — RCE on the runner.
Apply: `git checkout fix/workflow-security-audit-2026-05-03 && git am articles/0001-fix-security-workflow-audit-2026-05-03-NEW_CRITICAL.patch && git push` from a workflow-scoped token.
PR: https://github.com/tomscaria/aeon/pull/9
