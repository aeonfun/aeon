*Push Recap — 2026-05-06 (refresh)*
swarm-fund-mvp + aaronjmars/aeon — SHIPPING: paper_triage OLLAMA_LOCAL hatch + aeon star-momentum-alert + dashboard hardening

Shipped to users:
• paper_triage gets an OLLAMA_LOCAL escape hatch — when set, swarm-fund routes triage calls to local qwen2.5:7b instead of cloud Sonnet (lazy per-call resolver, monkeypatch-safe). First concrete cost lever after ADR-094; directly addresses the ~$2,696/mo overrun flag. (`42a5ba5`, +20/-2 in paper_triage.py + 48 lines of OLLAMA_LOCAL tests)
• aeon ships star-momentum-alert (#159, registered enabled:false): walks 14d of repo-pulse logs, projects next milestone crossing, alerts only when the crossing lands Tue–Wed–Thu 7-14d out → tells operator when to dispatch show-hn-draft (300⭐ ETA ~05-13).
• aeon hardens dashboard skills/run route (#158): execSync → execFileSync; closes the last user-input shell surface on the dashboard.

Under the hood:
• Phase G knowledge-base build on swarm-fund — kb_concepts embedding index (3446 concepts, BAAI/bge-small-en-v1.5), scripts/run_analogy_synthesis.py runner (155 lines, dry-run mode), MIT OCW harvest verified (10 math sources inserted), router_suggestions Telegram tests added.

Shape: 3 user-visible · 4 internal · 0 infra · 96 automation-only · 2 merged PRs
Volume: 8 files, +590/-9 lines

Open thread: paper_triage diff cites `ADR-NNN (2026-05-06)` — placeholder ADR number, no ADR file in the commit set yet. The 72h merge-cadence falsifier (next ADR by 2026-05-09) is now active.

Full recap: https://github.com/aeonframework/aeon/blob/main/articles/push-recap-2026-05-06.md
