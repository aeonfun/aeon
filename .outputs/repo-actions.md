*Repo Action Ideas — aaronjmars/aeon — 2026-05-01*
PR #149 (smithery-manifest, today) created an aeon-mcp npm/Smithery surface that needs README, npm hygiene, and a smoke test before first publish; ahead of all of it is a 3-week-old shell-injection in dashboard/app/api/secrets/route.ts:96.

Top pick: Patch shell-injection at dashboard/app/api/secrets/route.ts:96 (Security, Small, Priority HIGH)
 → Eliminates an RCE path via execSync interpolation; closes the next ISS-016 candidate before skill-security-scan files it 2026-05-07.

1. Patch shell-injection at dashboard/app/api/secrets/route.ts:96 (HIGH, Security, Small)
2. Add mcp-server/README.md for npm + Smithery listing (HIGH, Content, Small)
3. Bundle npm-publish hygiene into mcp-server/ — prepublishOnly + metadata + LICENSE + files (MED, DX, Small)
4. Add mcp-server/test/smoke.test.ts + .github/workflows/mcp-smoke.yml (MED, DX, Medium)
5. Add .github/CODEOWNERS for path-routed PR review (MED, DX, Small)

Full details: https://github.com/tomscaria/aeon/blob/main/articles/repo-actions-2026-05-01.md
