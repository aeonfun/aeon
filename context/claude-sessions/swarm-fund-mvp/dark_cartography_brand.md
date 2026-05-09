---
name: Dark Cartography Brand Direction
description: Brand visual identity decision (2026-03-31) — Dark Cartography replaces Icy Teal Futurism. Deep navy-black, topographic grids, Space Grotesk + IBM Plex Mono.
type: feedback
---

Brand visual identity is **Dark Cartography** — fund as a map of financial territory. Topographic maps, satellite imagery, military HUD aesthetic.

**Why:** User chose this from 3 proposed directions (Terminal Noir, Swiss Quant, Dark Cartography). "Data as topography" resonated — every chart should use contour/density encoding.

**How to apply:**
- **Background:** `#0a0e17` (deep navy-black), panels `#111825`, borders `#1e2d3d`
- **Accent:** `#2dd4bf` teal for signals/interactive, `#22c55e` profit, `#ef4444` loss, `#d97706` warning
- **Fonts:** Space Grotesk Variable (headings, `.font-sans`) + IBM Plex Mono (data, `.font-mono`)
- **Body:** coordinate grid at 48px intervals via `background-image` on `body`
- **Utilities:** `.topo-grid` (marketing hero), `.coord-grid` (dense operational), `.contour-line` (section dividers)
- **Glass:** `rgba(17, 24, 37, 0.8)` bg, `rgba(45, 212, 191, 0.08)` border
- **Brand tokens:** `--color-brand: #2dd4bf`, `--color-brand-light: #5eead4`, `--color-brand-dim: #1a9e94`
- **Anti-slop rules:** one accent color max, no gradients unless encoding data, no glass on operational pages, subtract don't add
- Replaces old `#00d4c8` / `rgba(0, 212, 200, ...)` everywhere — use `#2dd4bf` / `rgba(45, 212, 191, ...)`
- Old brand file `brand_aesthetic.md` is superseded by this one
