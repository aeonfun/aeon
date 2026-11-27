// The parts of the website's content/d-site.ts that the glass shell reads (nav, menu, footer,
// logo labels), adapted for Aeon Connect: every site link is absolute (https://www.aeon.fun/...),
// since this app is served from its own deployment or under www.aeon.fun/connect.

const REPO = 'https://github.com/aeonfun/aeon'
const SITE = 'https://www.aeon.fun'
const CONNECT = `${SITE}/connect`

export const site = {
  name: 'Aeon',
  tagline: 'Multiply yourself.',
  repo: REPO,
  url: SITE,

  cta: {
    primary: { label: 'Run Aeon', href: CONNECT },
  },

  social: {
    // count: @aeonframework followers, 2026-11-27: 133,016 (shown beside the X logo in the menu and footer).
    x: { label: 'Aeon on X', href: 'https://x.com/aeonframework', count: '+133K' },
    github: { label: 'Source on GitHub', href: REPO },
  },

  // The live site's menu, item for item: a full-screen field of tilted pills. tilt is in degrees, applied from 900px up;
  // rows says how many pills each desktop row holds.
  menu: {
    rows: [2, 1, 2],
    items: [
      { label: 'Docs', href: `${SITE}/docs`, tilt: -8 },
      { label: '$AEON', href: `${SITE}/transparency`, aria: '$AEON: the token page', tilt: 8 },
      { label: 'Security', href: `${SITE}/security`, tilt: 7 },
      { label: 'Blog', href: `${SITE}/blog`, tilt: 8 },
      { label: 'Highlights', href: `${SITE}/highlights`, tilt: -6 },
    ],
  },

  sections: {
    finalCta: {
      headline: ['One agent', 'was never enough.'],
      cta: { label: 'Run Aeon', href: CONNECT },
    },
    footer: {
      // The footer's line under the tagline; null = the close's headline. Empty, as on the live
      // site (its current copy, aeon-website content/copy-variants.ts round 7): the tagline alone.
      signoff: '' as string | null,
      columns: [
        {
          title: 'Explore',
          links: [
            { label: 'Run Aeon', href: CONNECT },
            { label: 'Docs', href: `${SITE}/docs` },
            { label: '$AEON', href: `${SITE}/transparency` },
            { label: 'Security', href: `${SITE}/security` },
            { label: 'Blog', href: `${SITE}/blog` },
            { label: 'Highlights', href: `${SITE}/highlights` },
            { label: 'Hooks', href: `${SITE}/hooks` },
            { label: 'Audits', href: `${SITE}/audits` },
            { label: 'Changelog', href: `${SITE}/changelog` },
          ],
        },
        {
          title: 'Build',
          links: [
            { label: 'Developers', href: `${SITE}/developers` },
            { label: 'Architecture', href: `${SITE}/architecture` },
            { label: 'Ecosystem', href: `${SITE}/ecosystem` },
          ],
        },
        {
          title: 'Company',
          links: [
            { label: 'About', href: `${SITE}/about` },
            { label: 'Contact', href: `${SITE}/contact` },
            { label: 'Privacy', href: `${SITE}/privacy` },
            { label: 'Terms', href: `${SITE}/terms` },
          ],
        },
      ],
      legal: '© 2026 Aeon Inc.',
    },
  },

  ui: {
    skipToContent: 'Skip to content',
    home: 'Aeon - home',
    beam: 'Send light out from the logo',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    menuPages: 'Site pages',
    sections: 'Sections',
    external: 'opens in a new tab',
    primaryNav: 'Primary',
    footerNav: 'Footer',
  },

  alt: {
    emblem: 'Aeon logo: an orange star inside a white ouroboros',
  } as Record<string, string>,
}

export type Site = typeof site
