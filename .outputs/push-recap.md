*Push Recap — 2026-05-05*
swarm-fund-mvp — SHIPPING — /investors page goes live with six SVG viz, scroll progress, mobile PDF rescue

Shipped to users:
• `c8e0963` — six SVG viz fill the /investors slots: StackArchitecture (sec-04), CycleTimeBars (sec-10), PositioningMatrix (sec-11, Revenant in the full-stack quadrant), RoadmapGantt (24m), ArrTrajectory (Y1→Y6 log), VisionTree (six radial revenue legs). New InvestorViz.tsx (+349), pure React+SVG, themed via Lore CSS variables.
• `fe189cc` — ScrollProgress.tsx (fixed 2px chartreuse top bar, RAF-throttled), CSS-counter section numbering (`01 ·`, `02 ·`…), and a real 201 deck shell — bare iframe replaced with .inv__doc-hero (italic display H1 + 64ch body + Download/Read-101 CTAs) wrapping the PDF embed.
• `8f688ca` — same-session /design-critique fix: SVG width/height defaults were collapsing viz to 300×150 inside the ~1056px slots; scopes `svg { width:100%; height:auto; min-width:600px }` + slot `overflow-x: auto`. Mobile (<768px) collapses 201 iframe to 200px and surfaces explicit "Use the download button above" copy via ::after.

Shape: 3 user-visible · 0 internal · 0 infra · 81 bot-filtered · 0 merged PRs
Volume: 5 unique files, +588 / -30 lines, all on swarm-fund-mvp main (lore-financial-teaser + aaronjmars/aeon empty)

Full recap: https://github.com/tomscaria/aeon/blob/main/articles/push-recap-2026-05-05.md
