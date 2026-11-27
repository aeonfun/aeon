import type { Metadata } from 'next'
import { BodyScope } from '@/components/glass/d/body-scope'
import { GlassFilters } from '@/components/glass/d/glass-filters'
import { Providers } from '@/components/glass/d/providers'
import { BodyType } from '@/components/glass/type/body-type'
import { typeScope, typeVars } from '@/components/glass/type/fonts'
import './globals.css'
import './theme.css'
import './skin.css'
import './v2-turn.css'
import '@/components/glass/type/type.css'
import '@/components/glass/v2.css'
import '@/components/glass/docs/docs.css'
import '@/components/glass/security/security.css'
import '@/components/glass/connect/connect.css'

export const metadata: Metadata = {
  // The dashboard sets per-view titles on the client ("Strategy · Aeon").
  title: { default: 'Aeon HQ', template: '%s · Aeon' },
  description: 'Your local Aeon dashboard: skills, runs, soul and keys for this agent repo.',
  // The tab icon is app/icon.png (the glass mark), added by Next; the files below are the
  // dashboard's own favicons for older browsers and home-screen installs.
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

// The glass scopes wrap every route: data-variant/data-skin + .v2-page for the tokens,
// surfaces and logo turn; data-type="b1" + the type faces; then the providers (reduced
// motion, pill shapes) and the grain. BodyScope/BodyType mirror them onto <body> for
// anything that renders outside this tree (portals, modals).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div
          data-variant="v94"
          data-skin="glass"
          className="v2-page min-h-dvh overflow-x-clip bg-background text-foreground antialiased"
        >
          <BodyScope variant="v94" className={typeScope} />
          <GlassFilters />
          <div data-type="b1" className={typeScope}>
            <BodyType type="b1" vars={typeVars} />
            <Providers>
              <div className="v94-grain">{children}</div>
            </Providers>
          </div>
        </div>
      </body>
    </html>
  )
}
