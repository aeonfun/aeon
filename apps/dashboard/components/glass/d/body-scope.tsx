'use client'

import { useEffect } from 'react'

// Portaled overlays (sheets, dialogs, popovers) mount in <body>, outside the variation's
// [data-variant] wrapper, so they would lose its tokens and fonts. Mirror the variation's
// scope onto <body> while the variation is mounted.
export function BodyScope({ variant, className }: { variant: string; className: string }) {
  useEffect(() => {
    const body = document.body
    const classes = className.split(/\s+/).filter(Boolean)
    body.dataset.variant = variant
    // The glass skin's tokens and rules sit under [data-skin="glass"]; portals need it too.
    body.dataset.skin = 'glass'
    body.classList.add(...classes)
    // Only Chromium refracts a backdrop through an SVG filter; elsewhere the glass keeps its blur.
    const brands = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands
    if (brands?.some(b => b.brand === 'Chromium')) body.dataset.gRefract = ''
    return () => {
      delete body.dataset.gRefract
      if (body.dataset.variant === variant) delete body.dataset.variant
      if (body.dataset.skin === 'glass') delete body.dataset.skin
      body.classList.remove(...classes)
    }
  }, [variant, className])
  return null
}
