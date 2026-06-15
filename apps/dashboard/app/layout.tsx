import type { Metadata } from 'next'
import { Dela_Gothic_One, Inter, Space_Mono } from 'next/font/google'
import './globals.css'

// Chunky uppercase display face - the signature voice of aeon.fun.
const dela = Dela_Gothic_One({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display-dela',
  display: 'swap',
})

// Clean neo-grotesque for body / labels.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans-inter',
  display: 'swap',
})

// Inline code tokens, log output, mono labels.
const mono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-mono-space',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'AEON HQ',
  description: 'Agent operations headquarters',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dela.variable} ${inter.variable} ${mono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  )
}
