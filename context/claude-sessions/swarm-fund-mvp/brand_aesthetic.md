---
name: Brand Aesthetic — Icy Teal Futurism
description: Brand identity decision (2026-03-28) — teal/cyan architectural futurism replaces purple accent system across all UI
type: feedback
---

Brand visual identity is **icy teal/cyan architectural futurism** — inspired by Y2K-era clean-room aesthetics, glass surfaces, geometric minimalism.

**Why:** User explicitly chose this direction from reference videos (cool teal interiors, reflective glass, futuristic blue wash). "Let's own this."

**How to apply:**
- **Brand/marketing pages** (landing, future marketing): full aesthetic — glass morphism cards, layered teal radial glows, grid overlay, Inter typography, `--color-brand: #00d4c8`
- **Product UI** (dashboard): subtle adoption — colors auto-propagate via CSS vars, `font-sans` on headings, keep monospace for data. Don't overwhelm functional simplicity
- Primary accent: `#00d4c8` (teal), NOT `#7c5cff` (purple — old)
- Glass utilities: `.glass`, `.glass-hover` in globals.css
- Grid overlay: `.brand-grid` for marketing pages
- Brand tokens: `--color-brand`, `--color-brand-light`, `--color-brand-dim`, `--color-brand-glow`, `--color-glass`, `--color-glass-border`
- Never use hardcoded `#7c5cff` anywhere — always use CSS vars or the new `#00d4c8` value
