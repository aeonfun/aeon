# Push Recap — 2026-05-05

## Verdict
> SHIPPING — `/investors` page goes live with six SVG viz, scroll progress, mobile PDF rescue

**Shape:** 3 user-visible · 0 internal · 0 infra · 81 bot-filtered (cron `data: refresh site metrics`, all touch only `swarm-lab-site/public/metrics.json` with a single timestamp diff and effectively bot-class even though authored by `tomscaria`)
**Volume:** 5 unique files (8 file-revisions), +588 / -30 lines across 3 substantive commits by 1 author (`tomscaria`, all Sonnet 4.6 co-authored), all on `swarm-fund-mvp` `main`. `lore-financial-teaser` and `aaronjmars/aeon` had zero substantive activity in the window.
**Merged PRs:** 0 — today's work landed via direct commits to `main`, not PRs.

---

## Top impact today

1. `c8e0963` — **swarm-fund-mvp / `feat(site): six SVG visualizations for /investors slots`**. New `swarm-lab-site/src/components/InvestorViz.tsx` (+349) exports six pure React + SVG components — `StackArchitecture`, `CycleTimeBars`, `PositioningMatrix`, `RoadmapGantt`, `ArrTrajectory`, `VisionTree` — themed via Lore CSS variables (`--brand`, `--bg-2`, `--line`, `--fg`, …) so they inherit the page palette without prop drilling. All are responsive (`viewBox` + `preserveAspectRatio="xMidYMid meet"`), keyboard-traversable (`role="img"` + `<title>`), and self-contained (no runtime data fetch — milestone copy / multipliers / ARR points / archetype coords are inlined from `copy.tsx`). `Investors.tsx` swaps the six `<div className="inv__viz-slot">` placeholders for `<div … data-filled="true"><Viz /></div>` in sections 04 (stack), 10 (cycle-time), 11 (competitive), 12 (roadmap), 13 (economics), 14 (1000x). (2 files, +363 / -6)
2. `fe189cc` — **swarm-fund-mvp / `feat: investors page updates + ScrollProgress component`**. The scaffolding pass that `c8e0963` then fills. New `ScrollProgress.tsx` (+35) renders a fixed 2px chartreuse bar at the top of the viewport, scaled by `scrollTop / (scrollHeight - clientHeight)` via `requestAnimationFrame`-throttled scroll/resize listeners — wired into both `Investors.tsx` (`/investors`) and `InvestorsDeck201.tsx` (`/investors/201`). `investors.css` adds a `.inv__main { counter-reset: inv-sec }` + `::before { content: counter(inv-sec, decimal-leading-zero) }` rule that prepends `01 ·`, `02 ·`, … to every `.inv__eyebrow` inside the main column — typographic rhythm cue without touching any TSX. Six `.inv__viz-slot` placeholder containers are inserted into `Investors.tsx` at the right scroll positions (the dashed outline / "Viz slot" content the user saw briefly, before `c8e0963` set `data-filled="true"` six minutes later). `InvestorsDeck201.tsx` is rewritten — the bare `<iframe>` block becomes a `.inv__doc-hero` (eyebrow + display H1 + 64ch body + Download/Read-101 CTA pair) followed by `.inv__doc-frame` wrapping the iframe at 88vh with the page's `--shadow-md` and `--line` border. (5 files, +195 / -23)
3. `8f688ca` — **swarm-fund-mvp / `fix(site): SVG slot sizing + mobile PDF iframe fallback`**. A same-session response to a `/design-critique` pass against the 12-minute-old viz fills. SVGs without explicit `width`/`height` attributes fall back to the browser's 300×150 default — which made `InvestorViz` render embarrassingly small inside the ~1056px-wide `.inv__viz-slot` once `data-filled="true"` flipped the slot from dashed-placeholder to opaque container. Adds a slot-scoped rule `.inv__viz-slot[data-filled="true"] svg { width:100%; height:auto; min-width:600px }` plus `overflow-x: auto` on the slot itself, so dense viz (gantt + matrix) get a horizontal-scroll affordance on narrow viewports instead of label collisions. Below 768px the `.inv__doc-frame iframe` collapses to 200px and a `::after` pseudo-element surfaces the explicit message *"Mobile browsers do not embed PDFs reliably. Use the download button above"* — Mobile Safari blocks PDF embeds above the fold, and the change converts that broken-render into a deliberate-looking dead-end with the existing Download CTA carrying the user. (1 file, +30 / -1)

---

## tomscaria/swarm-fund-mvp

### Theme 1 — `/investors` viz slots fill in (sections 4, 10, 11, 12, 13, 14)

**What this is:** Two days ago the `/investors` page got its design-language scaffolding — six numbered sections each ended in a dashed-outline `.inv__viz-slot` container with placeholder text ("stack architecture diagram", "cycle time vs industry", …) and a comment marking each slot's `Owner: /create-viz`. Today those slots fill in. `c8e0963` ships the React + SVG components themselves; `fe189cc` (six minutes earlier) laid down the `data-slot` containers; `8f688ca` (six minutes later) rescues their visual size after the `data-filled="true"` flip exposed the missing-width browser default. Reader-facing impact: the deck the operator sends to LPs now has its illustrations.

**Shipped to users**

- `c8e0963` — `feat(site): six SVG visualizations for /investors slots`
  - `swarm-lab-site/src/components/InvestorViz.tsx` (NEW): six exports themed via Lore CSS variables; pure functional components, no runtime data. (+349 / -0)
    - `StackArchitecture` (sec-04): four-layer rectangles (Investor capital → Lab OS → Strategy library → Execution & custody) with arrowed flow markers, `linearGradient` brand-tinted background, mono-caption per layer.
    - `CycleTimeBars` (sec-10): six horizontal `<rect>` bars at multipliers `[10, 5, 4, 4, 3, 2]×` for Karpathy autoresearch / Aristotle judge / Sub-agent orchestration / Ralph loop / Skill library / Compound engineering. Dashed `1×` baseline tick + 5× / 10× ticks at top.
    - `PositioningMatrix` (sec-11): 2×2 (TradFi → Crypto on X, single → full stack on Y) plotting six competitor archetypes (TradFi quants/funds, Crypto MMs/custody, AI trading, AI agent infra) plus a larger-radius brand-coloured `Revenant` point at `(0.62, 0.88)` — explicitly inside the "FULL-STACK INTERSECTION" caption corner.
    - `RoadmapGantt` (sec-12): 24-month horizontal timeline with quarter ticks (M0/M6/M12/M18/M24) and 9 alternating-above/below milestone callouts (`Seed close · team of 12` … `55-person team · $75M ARR · Series B`).
    - `ArrTrajectory` (sec-13): log-scale `<path>` line + brand-fill area chart Y1→Y6 at `[5, 30, 100, 300, 750, 1500]` $M. Y1 at 1× brand-circle, Y6 at 1.5× radius for terminal emphasis.
    - `VisionTree` (sec-14): central `Revenant` node ("Y+7" caption) with six radial leaves at angles `(i/6) · 2π - π/2` — `Tokenized assets`, `AI agent workforce`, `Workforce platform`, `MPC custody engine`, `Execution router`, `Lifecycle dataset` — each with a mono pillar caption (`$60T tokenized`, `$12.5B platform fees`, …). Text anchor adapts (`start` / `middle` / `end`) to leaf angle so labels never cross the trunk.
  - `swarm-lab-site/src/pages/Investors.tsx`: imports the six viz, swaps `<div className="inv__viz-slot" data-slot="X">placeholder</div>` for `<div … data-filled="true"><X /></div>` in sections 04 / 10 / 11 / 12 / 13 / 14. (+14 / -6)
- `8f688ca` — `fix(site): SVG slot sizing + mobile PDF iframe fallback`
  - `swarm-lab-site/src/styles/investors.css`: scoped `.inv__viz-slot[data-filled="true"] svg { display:block; width:100%; height:auto; min-width:600px }` so SVGs scale to the slot width with a horizontal-scroll affordance on narrow viewports; `overflow-x: auto` on the slot. `@media (max-width:768px)` collapses `.inv__doc-frame iframe` to 200px and adds a `::after` pseudo-element with the explicit "Mobile browsers do not embed PDFs reliably. Use the download button above." copy. (+30 / -1)

### Theme 2 — long-form reading affordances on `/investors` and `/investors/201`

**What this is:** The `/investors` page is a 15+ section scroll. Today's changes add the wayfinding: a top-of-viewport scroll-progress bar visible across both `/101` and `/201`, and per-section numbering (`01 ·`, `02 ·`, …) injected via CSS counters with no TSX edit. The 201 deep-dive route gets a real shell — the previous version was a bare `<iframe>` block in inline-styled `<div>`s, which on mobile Safari rendered as a broken white box because the browser blocks PDF embeds above the fold. The new shell renders a `.inv__doc-hero` (eyebrow + italic display H1 + 64ch body + Download/Read-101 CTA pair) before the iframe, so even when the embed fails the page reads as a Lore-themed document delivery surface, not a broken page.

**Shipped to users**

- `fe189cc` — `feat: investors page updates + ScrollProgress component`
  - `swarm-lab-site/src/components/ScrollProgress.tsx` (NEW): `useRef`-anchored `<div className="inv__progress" aria-hidden="true">`; `useEffect` attaches `passive` scroll + resize listeners that `requestAnimationFrame`-throttle a `transform: scaleX(p)` write where `p = scrollTop / (scrollHeight - clientHeight)` clamped to `[0, 1]`. Cleanup cancels both listeners + any in-flight RAF. (+35 / -0)
  - `swarm-lab-site/src/styles/investors.css`: `.inv__progress` rule (fixed top, 2px tall, `var(--brand)` background, `transform-origin: 0 0`, `z-index: 40` to sit above the sticky topbar, `prefers-reduced-motion` no-op variant). `.inv__main { counter-reset: inv-sec }` + `.inv__main .inv__eyebrow::before { content: counter(inv-sec, decimal-leading-zero) }` for the per-section numbering, with an `.inv__appendix` exception so appendix eyebrows don't double-count. New `.inv__viz-slot` rule (dashed `var(--line)`, `color-mix(in oklab, var(--bg-2) 60%, transparent)` background, mono `Viz slot` `::before` caption) and the `[data-filled="true"]` opaque variant that today's commits flip on. New `.inv__doc-hero` (clamped 32–48px italic display H1, max-width 22ch / 64ch hero text) and `.inv__doc-frame` (max-width 960, `--shadow-md`, `--line` border, 88vh iframe) for the 201 deck shell. (+105 / -0)
  - `swarm-lab-site/src/pages/Investors.tsx`: imports + renders `<ScrollProgress />` once at the top of `.inv` root; adds `className="inv__main"` to the `<main id="inv-main">` so the section counter resets at the right tree level; inserts six `<div className="inv__viz-slot" data-slot="X">placeholder</div>` containers at the end of sections 04 / 10 / 11 / 12 / 13 / 14 — the placeholders that `c8e0963` flips to `data-filled="true"` six minutes later in the same session. (+26 / -1)
  - `swarm-lab-site/src/pages/InvestorsDeck201.tsx`: imports + renders `<ScrollProgress />`; the previous bare `<main style={{ paddingTop:80, paddingBottom:40 }}><div maxWidth:960 …><iframe height:85vh /></div></main>` becomes `<main><section className="inv__doc-hero">…<h1>The technical and financial model in full.</h1>…<a href="/investors/201.pdf" download className="inv__btn inv__btn--primary">Download 201.pdf</a><Link to="/investors/101" className="inv__btn inv__btn--ghost">Read 101 instead</Link>…</section><section className="inv__doc-frame"><iframe src="/investors/201.pdf" /></section></main>`. The doc-string is updated to call the route a "Lore-themed shell (hero summary + framed iframe + escape links)" rather than the prior "v1 embeds the static PDF". (+26 / -21)
  - `swarm-lab-site/src/pages/InvestorsDeck.tsx`: ancillary 3-line update (counter-aware imports). (+3 / -1)

---

## Developer notes

- **New dependencies:** none. Both new components are pure React + SVG; no chart libraries pulled in.
- **Breaking changes:** none in code. Visual change at `/investors` and `/investors/201` for any reader who has the page open — six dashed placeholders flip to filled SVG, a top scroll-progress bar appears, sections gain `01 ·` / `02 ·` numbering, and `/investors/201` loses its `<iframe>`-only chrome in favour of a hero block. The 201 PDF download URL is unchanged (`/investors/201.pdf`).
- **New public surface:**
  - Six new component exports — `StackArchitecture`, `CycleTimeBars`, `PositioningMatrix`, `RoadmapGantt`, `ArrTrajectory`, `VisionTree` from `src/components/InvestorViz`. Each takes zero props.
  - `ScrollProgress` from `src/components/ScrollProgress` — zero-prop, drop-in.
  - New CSS classes: `.inv__progress`, `.inv__main` (counter scope), `.inv__viz-slot[data-filled="true"]`, `.inv__doc-hero`, `.inv__doc-frame`. New `data-*` attributes on slot containers: `data-slot="<name>"`, `data-filled="true"`.
  - No new routes, CLI flags, config keys, or migrations. Surface is entirely site-side.
- **Tech debt added:** `InvestorViz.tsx` inlines the milestone copy / cycle-time multipliers / ARR points / 1000x leaves rather than reading from `COPY.investors` — the file's own header notes "Numbers and milestone copy are sourced directly from `copy.tsx`" but the actual values are duplicated literals (e.g. `CYCLE_ROWS` here vs `COPY.investors.howWeOperate.tableRows[i][2]` in copy). If the operator updates copy without also editing `InvestorViz`, the viz drift silently. Surface to next `/design-critique` or a `simplify` pass.

## Open threads

- No new branches pushed; today's three commits all land on `main` directly. The five PRs noted as open in yesterday's recap on the `/swarm-fund-mvp` repo were merged in the 21:57 UTC backlog clear on 05-03 — there are no other open swarm-fund-mvp PRs in the watched window.
- The prior design pass referenced six `Owner: /create-viz` comments in `Investors.tsx` — five of those have been fulfilled (one comment block per slot has been replaced inline). The comments themselves remain in the source as section markers, but their owner contract is now satisfied.
- The 201 page still embeds the static PDF rather than rendering React parity with `/101`. The updated doc-string ("v1 wraps the static PDF in a Lore-themed shell … A follow-up will port the full deck to React for parity with /101") preserves that as known follow-up work.

## Sources
- `tomscaria/swarm-fund-mvp`: ok (commits + PRs fetched cleanly; events endpoint returned `cannot iterate over: null` because some `PushEvent.payload.commits` were null on bot-class entries — fell back to commits API which had complete coverage)
- `tomscaria/lore-financial-teaser`: empty (no commits, no merged PRs in the 24h window)
- `aaronjmars/aeon`: empty (no commits, no merged PRs in the 24h window)
- `gh api events`: partial (one repo returned null commits arrays inside push events; commits API was authoritative)
- `gh api commits`: ok
- `gh pr list`: ok
- bot-filtered: 81 (`tomscaria` cron commits with message `data: refresh site metrics`, all touch only `swarm-lab-site/public/metrics.json`, +1/-1 timestamp-and-one-line diff, occur on a 15-minute cadence — treated as bot-class per the spirit of the skill's bot-filter rule even though the author is not a literal `*-bot` user)
- diff-truncated: 0
