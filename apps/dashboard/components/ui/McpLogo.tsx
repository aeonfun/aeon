'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'

/** An MCP server's logo tile. A logo URL that dies (they are remote) falls back to a quiet
 *  "MCP" tile instead of a broken-image glyph. */
export function McpLogo({ src, size, className }: { src?: string; size: number; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (src && !failed)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className={cn('shrink-0 bg-white object-cover shadow-[0_0_0_1px_oklch(0.3_0.015_240/0.12)]', className)}
      />
    )
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center bg-[var(--muted)] font-mono text-[11px] text-muted-foreground',
        className,
      )}
    >
      MCP
    </span>
  )
}
