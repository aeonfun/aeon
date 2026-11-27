import { Fragment } from 'react'

import { StarMark } from '@/components/glass/d/emblem-parts'

// Every "aeon" in the copy gets the logo star right after it (Aaron, 2026-10-20; moved after the word the same day). The star alone
// marks the name, so it sits on the text baseline at cap height. URLs (www.aeon.fun/...), "$aeon"
// and "Aeon Inc" are left alone: they are addresses and names, not the agent.
const AEON = /((?<![\w.$/@-])aeon(?![\w-])(?!\.\w)(?! Inc))/gi
// **word** in the copy is set bold (the one word a line leans on).
const BOLD = /\*\*(.+?)\*\*/g

function Bold({ text }: { text: string }) {
  const parts = text.split(BOLD)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 ? (
      <strong key={i} className="font-semibold">
        {part}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  )
}

/** `color` overrides the star's red, e.g. "currentColor" on the red buttons. */
export function Starred({ text, color }: { text: string; color?: string }) {
  const parts = text.split(AEON)
  if (parts.length === 1) return <Bold text={text} />
  // One wrapper, so a flex button (gap between children) keeps "Run aeon" as one label.
  return (
    <span>
      {parts.map((part, i) =>
        i % 2 ? (
          <span key={i} className="whitespace-nowrap">
            {part}
            <StarMark color={color} className="ml-[0.1em] inline-block h-[0.82em] w-auto align-[-0.06em]" />
          </span>
        ) : (
          <Bold key={i} text={part} />
        ),
      )}
    </span>
  )
}
