*Repo Action Ideas — tomscaria/swarm-fund-mvp — 2026-05-05*
Last night's overnight commits left the investor page in an inconsistent state — six SVG components shipped in InvestorViz.tsx (c8e09632) but the matching slots added to Investors.tsx (fe189cc1) are still placeholder divs. Top pick is the import-and-replace wiring.

Top pick: Wire 6 InvestorViz components into the 6 unfilled data-slot placeholders in Investors.tsx (Content, Small, Priority HIGH)
 → Investor page flips from rendering 6 dashed-outline placeholders to 6 grant/LP-facing SVGs already on disk; closes the visible "unfinished" tell.

1. Wire 6 InvestorViz components into 6 unfilled data-slot placeholders (HIGH, Content, Small)
2. Add .github/workflows/site-build.yml running npm ci + npm run build on site PRs (HIGH, DX, Small)
3. Add python/tests/test_aeon_adapter_contract.py with committed JSON fixture (HIGH, DX, Small)
4. Switch swarm-lab-site/package.json build script to npm ci for learn-site/ (MED, DX, Small)
5. Add docs/12_operations/known_failure_modes.md documenting recurring Vercel-author-email pattern (MED, Content, Small)

Full details: https://github.com/aeonframework/aeon/blob/main/articles/repo-actions-2026-05-05.md
