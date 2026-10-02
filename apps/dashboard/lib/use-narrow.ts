'use client'

import { useSyncExternalStore } from 'react'

// True below Tailwind's `md` breakpoint (768px): phones, where the dashboard
// swaps its three columns for a top bar and two slide-in drawers.
const QUERY = '(max-width: 767px)'

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

export function useNarrow(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false)
}
