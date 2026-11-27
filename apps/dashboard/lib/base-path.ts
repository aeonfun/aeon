// Optional sub-path mount, e.g. '/connect' when the dashboard is served from
// www.aeon.fun/connect through the website's rewrite (Next multi-zone). Empty
// when the app runs at a domain root. NEXT_PUBLIC_ so the value is inlined into
// the client bundle at build time; next.config.ts reads the same variable for
// `basePath`, so routing and these hand-built URLs always agree.
//
// Next only prefixes basePath on its own <Link>, router, and file-convention
// assets. Raw fetch() calls, <img src>, <a href>, <form action>, and
// window.location targets need it added by hand: use withBase().
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '')

export function withBase(path: string): string {
  return BASE_PATH + path
}

// The dashboard home. '/connect' rather than '/connect/' (Next redirects the
// trailing-slash form), '/' when mounted at the root.
export const HOME = BASE_PATH || '/'
