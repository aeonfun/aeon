---
name: frontend-design skill location + design tokens
description: Where the ce-frontend-design skill lives locally, where the lore design system tokens live, and the established frontend stacks per surface
type: reference
originSessionId: b29a5b6c-a377-45ce-b776-5e71ac2eb951
---
## Frontend-design skill (installed 2026-04-25)

The `compound-engineering-plugin` from `EveryInc/compound-engineering-plugin` is cloned to:
- `/Users/stew/scaria/compound-engineering-plugin/`

The `ce-frontend-design` skill (the one CLAUDE.md routes dashboard UI work to) was copied to:
- `/Users/stew/.claude/skills/frontend-design/SKILL.md`

It encodes Module C (existing app — match the language) for any work in the swarm-fund-mvp dashboard, plus visual-thesis / content-plan / interaction-plan checklist before coding. Read it before starting any non-trivial frontend task.

## Design tokens — single source of truth per surface

- `swarm-lab-site/`: tokens at `src/styles/lore-tokens.css` (Aeonik fonts + Lore palette + 7 themes via `data-theme`). DO NOT modify; treat as immutable.
- `dashboard/`: tokens in `app/globals.css` under `:root` and `.dark` (Dark Cartography palette: `--primary` teal `#2dd4bf`, navy bg `#0a0e17`). Tailwind v4 inline `@theme` references these.
- `telegram-mini-app/`: tokens inline in `style.css` `:root` (intentionally aligned with the dashboard's Dark Cartography palette as of 2026-04-25, commit 89175cc).

## Frontend stacks (so you don't waste a query)

| Surface | Framework | Routing | Styling | State |
|---|---|---|---|---|
| swarm-lab-site | React 19 + Vite 8 | react-router-dom 7 | hand-written CSS, lore tokens | useState |
| dashboard | Next.js 16 (App Router) | file-based | Tailwind v4 + shadcn + base-ui | Zustand (`useSwarmStore`) |
| telegram-mini-app | Vanilla HTML/JS | n/a | inline CSS | none |

## Button component note (dashboard)

`@/components/ui/button` uses `@base-ui/react/button` and accepts a `render` prop, NOT `asChild`. Pattern:
```tsx
<Button render={<Link href="/foo" />}>Label</Button>
```
Same for `SidebarMenuButton`, `DialogTrigger`. Don't reach for `asChild` — it'll fail TS.

## Dashboard build verification

- `cd dashboard && ./node_modules/.bin/tsc --noEmit` — type-check
- `npm run build` — full production build (24 routes, all prerender)

## Site build verification

- `cd swarm-lab-site && npm run build` — Vite + tsc, ~450ms. Pre-existing chunk-size warning for TopoBackground (502KB) and Privy bundle (1.13MB).
