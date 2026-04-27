*Repo Action Ideas — aaronjmars/aeon — 2026-04-27*
Three HIGH-priority structural gaps anchor this cycle, all in .github/. Top pick: TypeScript CI workflow — three TS subprojects ship to main with zero compile-time checks.

Top pick: typescript-check.yml workflow (DX, Small, HIGH)
 → Catches type errors in dashboard/, mcp-server/, a2a-server/ before they land on main.

1. typescript-check.yml workflow (HIGH, DX, Small)
2. PULL_REQUEST_TEMPLATE.md (HIGH, DX, Small)
3. release.yml for autogen notes (HIGH, DX, Small)
4. FUNDING.yml routing Bankr URL (MED, Growth, Small)
5. CodeQL JS/TS workflow (MED, Security, Small)

Full details: https://github.com/tomscaria/aeon/blob/main/articles/repo-actions-2026-04-27.md
