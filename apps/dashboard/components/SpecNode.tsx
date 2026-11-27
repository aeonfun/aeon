'use client'

import type { SpecElement } from '../lib/types'
import { CountUp } from './glass/count-up'
import { ArrowUpRightLightIcon } from './glass/d/icons'
import {
  AttentionIcon,
  ATTN,
  CARD,
  DoneIcon,
  LINK,
  NewTab,
  SMALL_LABEL,
  TAG,
  TAG_ATTN,
  TAG_INK,
  TAG_MUTED,
} from './glass/connect/ui'
import { StarMark } from './glass/d/emblem-parts'
import { cn } from '@/lib/cn'

// Glass rendering of a skill's feed output (json-render spec): cards are g-chip cards, figures
// are Satoshi and count up when they are plain numbers, tags use the glass tones (no green or
// red: up is ink, down is deep orange, each with an arrow), alerts are callouts with an icon and
// a word.

// The feed panel is a fixed ~288px column. Two problems used to push content out
// of its card:
//  1. Long unbreakable strings (prices like 0.00002483, $268.0K, @handles, URLs)
//     have a min-content width wider than their track. `hard` (overflow-wrap:
//     anywhere) lets them break mid-token; `soft` (break-words) wraps ordinary
//     prose/labels at spaces only so words aren't split into "PRIC E".
//  2. A fixed N-column Grid of Stats can't fit N usable cells in 288px, so it
//     either overflowed (old bug) or crushed each cell to a sliver. The Grid is
//     now responsive: cells keep a usable min width and surplus columns wrap to
//     the next row. `min-w-0` on flex/grid items lets them shrink instead of
//     forcing the row wider than the card.
const hard = '[overflow-wrap:anywhere] break-words'
const soft = 'break-words'

// A figure that is a plain number ("7", "1,204", "3.5") counts up; anything else ("$268.0K",
// "0.00002483", "12%") shows as written.
function Figure({ value }: { value: string }) {
  const m = /^-?\d{1,3}(,\d{3})*(\.\d+)?$|^-?\d+(\.\d+)?$/.exec(value)
  if (!m || value.replace(/[^\d]/g, '').length > 9) return <>{value}</>
  const n = Number(value.replace(/,/g, ''))
  const decimals = value.includes('.') ? value.split('.')[1].length : 0
  return <CountUp to={n} decimals={decimals} duration={1.2} />
}

function Arrow({ up }: { up: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="size-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {up ? <path d="M8 13V3M4 7l4-4 4 4" /> : <path d="M8 3v10M4 9l4 4 4-4" />}
    </svg>
  )
}

export function SpecNode({ id, elements }: { id: string; elements: Record<string, SpecElement> }) {
  const el = elements[id]
  if (!el) return null
  const p = (el.props || {}) as Record<string, string | number | boolean | string[][] | string[] | undefined>
  const kids = el.children?.map(cid => <SpecNode key={cid} id={cid} elements={elements} />)
  switch (el.type) {
    case 'Card':
      return (
        <div className={cn(CARD, 'min-w-0 overflow-hidden p-4')}>
          {(p.title || p.description) && (
            <div className="mb-3 min-w-0">
              {p.title && (
                <h3 className={`font-display text-[1.1875rem] leading-[1.3] font-light tracking-[-0.012em] ${soft}`}>
                  {String(p.title)}
                </h3>
              )}
              {p.description && (
                <p className={`mt-0.5 text-[14px] leading-[1.45] text-muted-foreground ${soft}`}>
                  {String(p.description)}
                </p>
              )}
            </div>
          )}
          <div className="min-w-0 space-y-3">{kids}</div>
        </div>
      )
    // A horizontal Stack of Stats must wrap, not crush: without this, three stats in
    // the 288px panel each shrink to a sliver and their labels shatter into vertical
    // letters. flex-wrap + a 7rem basis on the stat children makes surplus stats wrap
    // to the next row at a readable width. Vertical stacks keep min-w-0 so long
    // content wraps instead of overflowing.
    case 'Stack': {
      const horizontal = p.direction === 'horizontal'
      const gap = p.gap === 'lg' ? 'gap-[22px]' : p.gap === 'sm' ? 'gap-[6px]' : 'gap-[11px]'
      return (
        <div
          className={`flex min-w-0 ${gap} ${horizontal ? 'flex-row flex-wrap [&>[data-stat]]:basis-[7rem] [&>[data-stat]]:grow [&>[data-stat]]:shrink-0' : 'flex-col [&>*]:min-w-0'}`}
        >
          {kids}
        </div>
      )
    }
    // auto-fit + a min track width means the requested column count is a target, not
    // a mandate: cells that can't reach the min width wrap to a new row instead of
    // being crushed. The min is content-aware - driven by the widest Stat value in
    // the grid - so a row of long-number stats (e.g. $0.000002025) collapses to a
    // single full-width column where the value fits on one line, instead of three
    // narrow columns each wrapping the number one character per line. Short-value
    // grids keep their columns. `min(100%, …)` keeps a single wide child in-box.
    case 'Grid': {
      const cols = typeof p.columns === 'number' ? p.columns : 2
      // Width a cell needs so its Stat value fits (display font ~16px/char) and its
      // longest label word stays whole (label font ~10px/char). Sizing off the label
      // too is what stops short-value grids ("PRs 23 / COMMITS 41 / REPOS 4") from
      // staying three narrow columns whose labels shatter into vertical letters.
      let need = 0
      const visit = (cid: string) => {
        const c = elements[cid]
        if (!c) return
        if (c.type === 'Stat') {
          const cp = c.props as Record<string, unknown> | undefined
          const v = String(cp?.value ?? '')
          need = Math.max(need, v.length * 16)
          const word = String(cp?.label ?? '')
            .split(/\s+/)
            .reduce((m, w) => Math.max(m, w.length), 0)
          need = Math.max(need, word * 10)
        }
        c.children?.forEach(visit)
      }
      el.children?.forEach(visit)
      const base = cols >= 3 ? 112 : 120
      const min = Math.min(260, Math.max(base, need ? need + 32 : base))
      return (
        <div
          className="grid min-w-0 gap-[11px] [&>*]:min-w-0"
          style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))` }}
        >
          {kids}
        </div>
      )
    }
    case 'Heading': {
      const cls =
        p.level === 'h1'
          ? 'text-[1.625rem] leading-[1.15] tracking-[-0.025em]'
          : p.level === 'h2'
            ? 'text-[1.25rem] leading-[1.25] tracking-[-0.015em]'
            : 'text-[1rem] leading-[1.3] text-[var(--g-ink-soft)]'
      return <div className={`font-display font-light ${cls} ${soft}`}>{String(p.text || '')}</div>
    }
    case 'Text': {
      const cls =
        p.variant === 'caption'
          ? 'text-[12px] leading-[1.45] text-muted-foreground'
          : p.variant === 'muted'
            ? 'text-[14px] leading-[1.5] text-muted-foreground'
            : p.variant === 'lead'
              ? 'text-[16px] leading-[1.5] text-[var(--g-ink-soft)]'
              : 'text-[14px] leading-[1.5] text-[var(--g-ink-soft)]'
      return <p className={`${cls} ${soft}`}>{String(p.text || '')}</p>
    }
    case 'Badge': {
      const v = p.variant || 'default'
      const tone = v === 'destructive' ? TAG_ATTN : v === 'secondary' ? TAG_MUTED : TAG_INK
      return <span className={cn(TAG, 'max-w-full leading-[1.3]', tone, soft)}>{String(p.text || '')}</span>
    }
    case 'Table': {
      const columns = (p.columns || []) as string[]
      const rows = (p.rows || []) as string[][]
      return (
        <div className="overflow-x-auto rounded-[16px] bg-[rgb(255_255_255/0.55)] shadow-[inset_0_1px_0_#fff,0_0_0_1px_oklch(0.3_0.015_240/0.1)]">
          <table className="w-full text-[13px] leading-[1.45]">
            <thead>
              <tr>
                {columns.map((c, i) => (
                  <th
                    key={i}
                    className="px-3 py-2.5 text-left font-mono text-[11px] font-medium tracking-[0.08em] whitespace-nowrap text-muted-foreground uppercase"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className={`border-t border-[var(--line)] px-3 py-2 align-top ${hard}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    case 'Stat': {
      const trend = p.trend as string | undefined
      const value = String(p.value ?? '')
      return (
        <div data-stat className="min-w-0 overflow-hidden rounded-[16px] bg-[oklch(0.3_0.015_240/0.05)] px-3.5 py-3">
          {p.label && <div className={cn(SMALL_LABEL, 'mb-1.5', soft)}>{String(p.label)}</div>}
          <div
            className={`font-display text-[1.625rem] leading-[1.1] font-light tracking-[-0.03em] tabular-nums ${hard}`}
          >
            <Figure value={value} />
          </div>
          {p.delta && (
            <div
              className={cn(
                'mt-1 flex items-center gap-1 font-mono text-[12px]',
                trend === 'down' ? ATTN : trend === 'up' ? 'text-foreground' : 'text-muted-foreground',
                hard,
              )}
            >
              {(trend === 'up' || trend === 'down') && <Arrow up={trend === 'up'} />}
              {trend === 'up' && <span className="sr-only">Up </span>}
              {trend === 'down' && <span className="sr-only">Down </span>}
              {String(p.delta)}
            </div>
          )}
        </div>
      )
    }
    case 'Progress': {
      const pct = Math.min(100, (Number(p.value || 0) / Number(p.max || 100)) * 100)
      return (
        <div className="min-w-0">
          {p.label && <div className={cn(SMALL_LABEL, 'mb-1.5', soft)}>{String(p.label)}</div>}
          <div
            role="progressbar"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={p.label ? String(p.label) : undefined}
            className="h-1.5 overflow-hidden rounded-full bg-[var(--muted)]"
          >
            <div
              className="h-full rounded-full bg-[var(--foreground)] transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )
    }
    case 'TweetCard':
      return (
        <div className={cn(CARD, 'min-w-0 overflow-hidden rounded-[18px] p-3.5')}>
          {p.author && (
            <div className="mb-1 flex min-w-0 flex-wrap items-baseline gap-x-1.5">
              <span className={`text-[14px] font-medium ${soft}`}>{String(p.author)}</span>
              {p.handle && (
                <span className={`font-mono text-[12px] text-muted-foreground ${hard}`}>{String(p.handle)}</span>
              )}
            </div>
          )}
          <p className={`text-[14px] leading-[1.5] text-[var(--g-ink-soft)] ${soft}`}>{String(p.text || '')}</p>
          {(p.likes || p.retweets) && (
            <div className="mt-2 flex gap-3 font-mono text-[12px] text-muted-foreground">
              {p.likes && <span>{String(p.likes)} likes</span>}
              {p.retweets && <span>{String(p.retweets)} reposts</span>}
            </div>
          )}
        </div>
      )
    case 'StoryLink':
      return (
        <a
          href={String(p.href || '#')}
          target="_blank"
          rel="noopener noreferrer"
          className="group g-chip flex min-w-0 items-start gap-3 overflow-hidden rounded-[18px] p-3.5 outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--foreground)]"
        >
          <span className="min-w-0 flex-1">
            <span className={`block text-[14px] leading-[1.45] font-medium ${soft}`}>{String(p.title || '')}</span>
            <span className="mt-1 flex min-w-0 gap-2 font-mono text-[12px] text-muted-foreground">
              {p.source && <span className={hard}>{String(p.source)}</span>}
              {p.score && <span>{String(p.score)}</span>}
            </span>
          </span>
          <ArrowUpRightLightIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-[translate,color] duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
          <NewTab />
        </a>
      )
    case 'Link':
      return (
        <a
          href={String(p.href || '#')}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(LINK, 'block w-fit max-w-full font-mono text-[13px]', hard)}
        >
          {String(p.label || p.href || '')}
          <NewTab />
        </a>
      )
    case 'Alert': {
      const t = p.type || 'info'
      const attention = t === 'error' || t === 'warning'
      const word = t === 'error' ? 'Error' : t === 'warning' ? 'Warning' : t === 'success' ? 'Done' : null
      return (
        <div
          role={attention ? 'alert' : undefined}
          className={cn(
            'flex min-w-0 gap-2.5 overflow-hidden rounded-[16px] px-3.5 py-3',
            attention ? 'bg-[oklch(0.65_0.23_32/0.08)] shadow-[inset_0_0_0_1px_oklch(0.65_0.23_32/0.22)]' : 'g-chip',
          )}
        >
          {attention ? (
            <AttentionIcon className="mt-[0.15em]" />
          ) : t === 'success' ? (
            <DoneIcon className="mt-[0.15em]" />
          ) : (
            <StarMark aria-hidden className="mt-[0.2em] h-[0.95em] w-auto shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            {(word || p.title) && (
              <div className={cn('text-[14px] font-semibold', attention && ATTN, soft)}>
                {word && p.title ? `${word}: ${String(p.title)}` : (word ?? String(p.title))}
              </div>
            )}
            {p.message && (
              <div className={`mt-0.5 text-[13px] leading-[1.5] text-[var(--g-ink-soft)] ${soft}`}>
                {String(p.message)}
              </div>
            )}
          </div>
        </div>
      )
    }
    case 'Separator':
      return <hr className="my-1 border-0 border-t border-[var(--line)]" />
    default:
      return null
  }
}
