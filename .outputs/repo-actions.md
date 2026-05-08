*Repo Action Ideas — tomscaria/swarm-fund-mvp — 2026-05-08*
Four HIGH-priority ideas anchored to the post-ADR-095 head plus one .gitattributes cleanup. Top pick is a one-line edit that pre-empts the 2026-05-21 ADR-095 falsifier: `OLLAMA_FULL` is wired in router.py and tests but missing from .env.example.

Top pick: Add `OLLAMA_FULL=0` to `.env.example` (DX, Small, Priority HIGH)
 → Ten seconds of work neutralises the 13-day-out ADR-095 production-env-file falsifier.

1. Add `OLLAMA_FULL=0` to `.env.example` (HIGH, DX, Small)
2. Write `outputs/2026-05-06_adr095_ollama_routing_session_summary.md` (HIGH, Content, Small)
3. Add `python/tests/test_triage_prompt_drift.py` (HIGH, DX, Small)
4. Fill `[Unreleased]` block in `CHANGELOG.md` (HIGH, Content, Small)
5. Add `linguist-generated=true` to `.gitattributes` for autogen files (MED, DX, Small)

Full details: https://github.com/tomscaria/aeon/blob/main/articles/repo-actions-2026-05-08.md
