'use client'

import { useEffect } from 'react'

// Portaled overlays (the menu) mount in <body>, outside the type wrapper: give <body> the same
// faces (inline, so they win over the default font classes the layout mirrors there) and the
// data-type hook type.css keys on.
export function BodyType({ type, vars }: { type: string; vars: Record<string, string> }) {
  useEffect(() => {
    const body = document.body
    body.dataset.type = type
    for (const [k, v] of Object.entries(vars)) body.style.setProperty(k, v)
    return () => {
      if (body.dataset.type === type) delete body.dataset.type
      for (const k of Object.keys(vars)) body.style.removeProperty(k)
    }
  }, [type, vars])
  return null
}
