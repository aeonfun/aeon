// Type B1 "Launch grotesk": Satoshi (Fontshare, variable 300-900) for headlines and numerals, set
// heavy and tight; emphasis words go to its Black end instead of an italic (type.css). General Sans
// (Fontshare, variable 200-700) for body, Geist Mono for the tracked uppercase labels.
import { Geist_Mono as Mono } from 'next/font/google'
import localFont from 'next/font/local'

import { cn } from '@/lib/cn'

const display = localFont({
  src: './fonts/Satoshi-Variable.woff2',
  variable: '--font-display',
  weight: '300 900',
  display: 'swap',
})
const sans = localFont({
  src: './fonts/GeneralSans-Variable.woff2',
  variable: '--font-sans',
  weight: '200 700',
  display: 'swap',
})
// Mono only sets small labels and the command line, never the LCP text.
const mono = Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap', preload: false })

// The emphasis face is the display family itself (see type.css), so no italic file loads.
export const typeScope = cn(display.variable, sans.variable, mono.variable, 'font-sans')

// The same faces as plain values, for portals mounted in <body> outside the wrapper.
export const typeVars: Record<string, string> = {
  '--font-sans': sans.style.fontFamily,
  '--font-display': display.style.fontFamily,
  '--font-display-italic': display.style.fontFamily,
  '--font-mono': mono.style.fontFamily,
}
