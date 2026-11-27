// Glass class recipes for the Connect dashboard (style guide sections 4-5), as plain strings in a
// module with no 'use client', so server components (Login, the consent page) get the strings
// themselves, not client references. Components that use them live in ./ui.tsx.
import { cn } from '@/lib/cn'

/* ── Class recipes (strings, so they also fit elements these components do not cover) ── */

/** Focus ring for custom controls (smoke on paper). */
export const FOCUS =
  'outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--foreground)]'
/** Label: Geist Mono caps (type.css renders the tracking at 0.08em). */
export const LABEL = 'font-mono text-[13px] font-medium tracking-[0.1em] text-muted-foreground uppercase'
/** Small label: sidebar groups, panel headers, table heads. */
export const SMALL_LABEL = 'font-mono text-[11.5px] font-medium tracking-[0.1em] text-muted-foreground uppercase'
/** Tag / badge. */
export const TAG =
  'inline-flex items-center rounded-full px-2 py-1 font-mono text-[10px] leading-none font-medium tracking-[0.08em] uppercase'
/** Filter / toggle chip, off and on (selected = smoke ink, never orange). */
export const CHIP = cn(
  'flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full px-4 font-mono text-[12px] font-medium tracking-[0.08em] uppercase transition-[background-color,color,box-shadow] duration-150',
  FOCUS,
)
export const CHIP_ON =
  'bg-[var(--foreground)] text-[var(--g-paper)] shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_6px_16px_-8px_oklch(0.3_0.015_240/0.6)]'
export const CHIP_OFF = 'g-chip text-foreground'
/** A row of chips that scrolls sideways on phones instead of stacking. */
export const CHIP_ROW =
  'flex gap-1.5 max-sm:-mx-1 max-sm:overflow-x-auto max-sm:px-1 max-sm:pb-1 max-sm:[scrollbar-width:none] sm:flex-wrap'
/** Small action pill (not the main CTA). */
export const ACTION = cn(
  'g-chip inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-[14px] font-medium whitespace-nowrap transition-[background-color,scale] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50',
  FOCUS,
)
/** The orange glass call to action (one per screen). */
export const PRIMARY = cn(
  'c-primary inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-6 text-[13px] font-semibold tracking-[0.07em] whitespace-nowrap uppercase transition-[filter,scale] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60',
  FOCUS,
)
/** Round icon button on paper. */
export const BEAD = cn(
  'g-chip inline-grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-foreground transition-[background-color,scale] duration-150 active:scale-[0.96]',
  FOCUS,
)
/** Big glass panel (cards, sheets, the main article). Children need relative z-[1]. */
export const PANEL = 'g-glass rounded-[28px]'
/** Small card on a panel (a g-chip, no backdrop). */
export const CARD = 'g-chip rounded-[22px]'
/** A list row that opens or goes somewhere. */
export const ROW = cn(
  'flex w-full cursor-pointer items-center gap-3 rounded-[14px] px-3 py-3 text-left transition-[background-color] duration-150 hover:bg-[var(--hover)]',
  FOCUS,
)

/* ── Added for the panels (P1 round) ── */

/** Ink for "needs attention" text and icons on paper: deep orange that passes 4.5:1. */
export const ATTN = 'text-[oklch(0.5_0.19_33)]'
/** Tag tones: ink (a fact, e.g. "Installed"), muted (quiet meta), attention (orange, e.g. "Required"). */
export const TAG_INK = 'bg-[oklch(0.32_0.022_245/0.86)] text-[var(--g-paper)]'
export const TAG_MUTED = 'bg-[var(--muted)] text-muted-foreground'
export const TAG_ATTN =
  'bg-[oklch(0.65_0.23_32/0.12)] text-[oklch(0.5_0.19_33)] shadow-[inset_0_0_0_1px_oklch(0.65_0.23_32/0.28)]'
/** Big figure (stat cards, counts): Satoshi 500, tight tracking, numbers line up. */
export const FIGURE =
  'font-display text-[clamp(2.25rem,4vw,3.5rem)] leading-[0.9] font-light tracking-[-0.05em] tabular-nums'
/** Page title inside the dashboard article (HQ size). */
export const TITLE =
  'font-display text-[clamp(2.5rem,5.2vw,4rem)] leading-[1.02] font-light tracking-[-0.04em] [overflow-wrap:anywhere]'
/** Card title (a pack, a server, a step). */
export const CARD_TITLE = 'font-display text-[1.1875rem] leading-[1.3] font-light tracking-[-0.012em]'
/** Sub-line / intro paragraph under a title. */
export const SUB = 'text-[16px] leading-[1.55] text-muted-foreground'
/** An inline text link or link-like button: ink with the prose underline that turns orange on hover. */
export const LINK = cn(
  'cursor-pointer rounded-[4px] text-foreground underline decoration-[oklch(0.7_0.17_42/0.55)] decoration-[1.5px] underline-offset-4 transition-[text-decoration-color] duration-150 hover:decoration-[var(--primary)]',
  FOCUS,
)
/** A quiet loading block (skeletons). */
export const SKELETON = 'rounded-full bg-[var(--muted)] motion-safe:animate-pulse'
/** A list of rows sitting on a chip card (runs, keys, servers). */
export const LIST = 'g-chip rounded-[22px] p-1.5'
