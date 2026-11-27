// Form class recipes for the Connect dashboard, as plain strings in a module with no 'use client'
// so server components (the OAuth consent page) can use them on native inputs. Built from the
// website's only input, the rounded search field (style guide section 4, "Inputs"): g-chip,
// 16px text (no iOS zoom), a smoke focus ring. The components that use them live in ./forms.tsx.
import { cn } from '@/lib/cn'
import { FOCUS } from './recipes'

/** A multi-line field: the search field's chip with a softer radius. */
export const TEXTAREA = cn(
  'g-chip block w-full resize-y rounded-[20px] px-5 py-3.5 text-[16px] leading-[1.55] text-foreground outline-none placeholder:text-muted-foreground',
  'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--foreground)]',
)

/** The file editor (STRATEGY.md, SOUL.md): mono, roomy, 16px on phones. */
export const EDITOR = cn(
  TEXTAREA,
  'min-h-[22rem] rounded-[22px] px-5 py-4 font-mono text-[16px] leading-[1.7] sm:px-6 sm:text-[14px]',
)

/** Native radio on paper: a ring that fills with smoke ink when picked (selected = ink, never orange). */
export const RADIO = cn(
  'grid size-[18px] shrink-0 cursor-pointer appearance-none place-content-center rounded-full bg-white shadow-[inset_0_0_0_1.5px_oklch(0.3_0.015_240/0.45)] transition-[box-shadow] duration-150',
  'checked:shadow-[inset_0_0_0_5px_var(--foreground)]',
  FOCUS,
)

/** Native checkbox: the website's Audited box (rounded 4px, inset ring), checked = orange with a check. */
export const CHECKBOX = cn(
  'size-[18px] shrink-0 cursor-pointer appearance-none rounded-[5px] bg-white bg-center bg-no-repeat shadow-[inset_0_0_0_1.5px_oklch(0.3_0.015_240/0.45)] transition-[background-color,box-shadow] duration-150',
  'checked:bg-[var(--primary)] checked:shadow-[inset_0_1px_0_rgb(255_255_255/0.5)]',
  'checked:[background-image:url(data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2016%2016%27%3E%3Cpath%20d=%27M4%208.4l2.6%202.6L12%205.4%27%20fill=%27none%27%20stroke=%27%2310171c%27%20stroke-width=%271.8%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27/%3E%3C/svg%3E)]',
  FOCUS,
)

/** A pickable row that wraps a native radio (consent page targets, visibility). */
export const CHOICE_ROW = cn(
  'g-chip flex min-h-12 cursor-pointer items-center gap-3 rounded-[16px] px-4 py-3 text-[15px] transition-[background-color,box-shadow] duration-150',
  'has-[:checked]:shadow-[inset_0_0_0_1.5px_var(--foreground),0_6px_16px_-10px_oklch(0.3_0.015_240/0.4)]',
)

/** Body copy inside a panel or dialog. */
export const BODY = 'text-[15px] leading-[1.6] text-[var(--g-ink-soft)]'
/** Small print (hints under a field). */
export const HINT = 'text-[14px] leading-[1.55] text-muted-foreground'
/** Inline code / key names in running text. */
export const INLINE_CODE =
  'rounded-[7px] bg-[oklch(0.3_0.015_240/0.07)] px-[0.38em] py-[0.12em] font-mono text-[0.86em] text-foreground shadow-[inset_0_0_0_1px_oklch(0.3_0.015_240/0.08)] [overflow-wrap:anywhere]'

/** Outline tag for a neutral state (Not set, Automatic). The ink and attention tones are TAG_INK and
 *  TAG_ATTN in ./recipes. */
export const QUIET_TAG = 'text-muted-foreground shadow-[inset_0_0_0_1px_var(--line)]'
