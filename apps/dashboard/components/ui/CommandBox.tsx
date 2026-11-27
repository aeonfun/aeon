'use client'

import { useState } from 'react'
import { CheckLightIcon, CopyLightIcon } from '@/components/glass/d/icons'
import { cn } from '@/lib/cn'

// A command or snippet with a copy button: the docs code block (components/glass/docs/
// code-block.tsx) on clear glass, with the copy chip top right (always visible below md, on
// hover or focus above). `multiline` keeps line breaks and scrolls sideways (config files); a
// single command wraps anywhere so it never pushes the panel wider.
export function CommandBox({
  command,
  multiline = false,
  label,
}: {
  command: string
  multiline?: boolean
  label?: string
}) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard refused (no focus, no permission): the text stays selectable */
    }
  }
  return (
    <figure className="g-code c-code group/code min-w-0">
      {label && (
        <figcaption className="border-b border-[var(--line)] px-5 py-3 font-mono text-[12px] text-muted-foreground">
          {label}
        </figcaption>
      )}
      <pre className={cn('select-all', multiline ? 'whitespace-pre' : 'whitespace-pre-wrap [overflow-wrap:anywhere]')}>
        <code>{command}</code>
      </pre>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? 'Copied' : 'Copy'}
        title={copied ? 'Copied' : 'Copy'}
        className="g-chip absolute top-2 right-2 grid size-9 cursor-pointer place-items-center rounded-full text-muted-foreground transition-[background-color,color] duration-150 outline-none hover:text-foreground focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--foreground)]"
      >
        {copied ? <CheckLightIcon className="size-3.5" /> : <CopyLightIcon className="size-3.5" />}
      </button>
      <span role="status" className="sr-only">
        {copied ? 'Copied to the clipboard' : ''}
      </span>
    </figure>
  )
}
