---
name: design_handoff_lore is the dashboard design-system source
description: Keep design_handoff_lore/ in the repo — it is the design-system source for the future Bloomberg-terminal-style dashboard, not dead weight
type: project
originSessionId: 7adc4f90-1a0c-4619-8257-9052ce344602
---
`design_handoff_lore/` at the repo root is the raw design handoff from Lore — fonts (Aeonik, LockSerif), brand assets, icon set (tsx + svg), color/type tokens, UI kit previews, and reference React components (Dashboard.jsx, Sidebar.jsx, etc.).

**Why:** Thomas plans to build Bloomberg-terminal-style advanced dashboard components for Swarm Fund off this design system. The folder is a source library, not a dead artifact.

**How to apply:**
- Do NOT delete `design_handoff_lore/`, even though it looks unused.
- The live site (`swarm-lab-site/`) does NOT import from this folder at runtime — fonts are already copied into `swarm-lab-site/public/fonts/lore/` and tokens into `swarm-lab-site/src/styles/lore-tokens.css`. The comment in [swarm-lab-site/src/styles/investors.css:1-2](swarm-lab-site/src/styles/investors.css) ("consumes design_handoff_lore tokens via lore-tokens.css") documents the lineage — the handoff was a one-time source drop.
- When new dashboard components are built, start from `design_handoff_lore/ui_kits/lore-app/*.jsx` and `design_handoff_lore/preview/finance-*.html` as references.
- Previously deleted (commit `173e92b` 2026-04-22), restored (`f2d8b47` 2026-04-22). If it appears deleted in a future session's git status, restore it rather than committing the deletion.
