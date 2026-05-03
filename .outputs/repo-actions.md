*Repo Action Ideas — tomscaria/swarm-fund-mvp — 2026-05-03*
Two HIGH-priority autoresearch.yml fixes; top pick is a one-line YAML change closing the two-tree pytest footgun where it bites hardest (the unattended nightly).

Top pick: Drop the tests/test_strategies.py path arg in autoresearch.yml:86 so pytest honors pyproject testpaths (DX, Small, Priority HIGH)
 → Autoresearch nightly stops silently skipping ~313 of the suite; bad LLM variants fail the smoke gate at the bot step instead of post-merge.

1. Drop tests/test_strategies.py path arg in autoresearch.yml:86 (HIGH, DX, Small)
2. Add .github/dependabot.yml for pip + github-actions weekly (HIGH, Security, Small)
3. Add .github/PULL_REQUEST_TEMPLATE.md enforcing ADR-084 stats checklist (MED, DX, Small)
4. Notify Telegram on autoresearch.yml no-diff at line 95-96 (MED, DX, Small)
5. Replace autoresearch.yml inputs.strategy enum with type:string (MED, DX, Small)

Full details: https://github.com/tomscaria/aeon/blob/main/articles/repo-actions-2026-05-03.md
