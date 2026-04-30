*Repo Action Ideas — aaronjmars/aeon — 2026-04-30*
Standard meta-file backlog already proposed across 04-25 → 04-29; today anchors on operational gaps the fleet actually hits — missing prefetch script, missing postprocess-notify, no skill template, no catalog-drift check, no CITATION.cff.

Top pick: Add scripts/prefetch-reddit.sh mirroring the prefetch-xai.sh case-dispatch pattern (DX, Medium, Priority HIGH)
 → Every fork that turns on reddit-digest stops emitting REDDIT_DIGEST_ERROR daily; xai-prefetch precedent already proves the convention.

1. Add scripts/prefetch-reddit.sh (HIGH, DX, Medium)
2. Add scripts/postprocess-notify.sh (HIGH, DX, Small)
3. Add CITATION.cff at repo root (MED, Community, Small)
4. Add skills/_template/SKILL.md scaffold (MED, DX, Small)
5. Add .github/workflows/skills-json-drift.yml (MED, DX, Medium)

Full details: https://github.com/tomscaria/aeon/blob/main/articles/repo-actions-2026-04-30.md
