// The two parts of Aaron's aeon mark, each on its own, for pages that use the star in one
// place and the ouroboros in another. Same exact paths as components/emblem-tile.tsx (no
// redraw); only the viewBox is cropped tight to each part so it can be sized and placed freely.
import { useId, type SVGProps } from 'react'

/** The logo's flat colors: the star's orange (under its metal, and before it loads), the ring's white. */
export const STAR_ORANGE = '#ff4a1c'
export const RING_WHITE = '#ffffff'

import { EMBLEM_PATHS, EMBLEM_TRANSFORMS } from '@/components/glass/d/emblem-tile'

type PartProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  /** Accessible name. Omit for decorative use (aria-hidden). */
  title?: string
}

function a11y(title?: string) {
  return { role: title ? 'img' : undefined, 'aria-label': title, 'aria-hidden': title ? undefined : true } as const
}

/** Glass for the logo parts: only fills and filters, laid on the exact paths (no redraw). The ring
 *  is a body of clear glass that runs smoke-grey through its turns, lit from the top left (a
 *  specular bevel), with a darker rim just inside its edge and a faint prismatic fringe just
 *  outside it. Its tones come from skin.css (--g-ring-*), clear on the night and smoke on paper. */
function GlassRingDefs({ id }: { id: string }) {
  const stop = (o: string, v: string, a: string) => (
    <stop offset={o} style={{ stopColor: `var(--g-ring-${v})`, stopOpacity: a }} />
  )
  return (
    <>
      <linearGradient id={`${id}-body`} x1="160" y1="90" x2="870" y2="940" gradientUnits="userSpaceOnUse">
        {stop('0', 'a', '0.96')}
        {stop('0.3', 'b', '0.8')}
        {stop('0.52', 'c', '0.78')}
        {stop('0.72', 'd', '0.9')}
        {stop('1', 'e', '0.88')}
      </linearGradient>
      <filter id={`${id}-glass`} x="-6%" y="-6%" width="112%" height="112%" colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation="9" result="soft" />
        <feSpecularLighting
          in="soft"
          surfaceScale="5"
          specularConstant="1.1"
          specularExponent="22"
          lightingColor="#fff"
          result="spec"
        >
          <feDistantLight azimuth="225" elevation="40" />
        </feSpecularLighting>
        <feComposite in="spec" in2="SourceAlpha" operator="in" result="shine" />
        <feMorphology in="SourceAlpha" operator="erode" radius="8" result="inner" />
        <feComposite in="SourceAlpha" in2="inner" operator="out" result="edge" />
        <feFlood style={{ floodColor: 'var(--g-ring-rim)' }} floodOpacity="0.6" />
        <feComposite in2="edge" operator="in" result="rim" />
        <feOffset in="SourceAlpha" dx="-9" dy="-6" result="o1" />
        <feFlood floodColor="#62d5ff" floodOpacity="0.5" />
        <feComposite in2="o1" operator="in" />
        <feComposite in2="SourceAlpha" operator="out" result="cool" />
        <feOffset in="SourceAlpha" dx="9" dy="6" result="o2" />
        <feFlood floodColor="#ff86d6" floodOpacity="0.42" />
        <feComposite in2="o2" operator="in" />
        <feComposite in2="SourceAlpha" operator="out" result="warm" />
        <feMerge>
          <feMergeNode in="cool" />
          <feMergeNode in="warm" />
          <feMergeNode in="SourceGraphic" />
          <feMergeNode in="rim" />
          <feMergeNode in="shine" />
        </feMerge>
      </filter>
    </>
  )
}

/** The star in glass: the same orange, lit from inside, brighter toward its upper center. */
function GlassStarDefs({ id }: { id: string }) {
  return (
    <radialGradient id={`${id}-star`} cx="0.46" cy="0.44" r="0.62">
      <stop offset="0" stopColor="#ffb48c" />
      <stop offset="0.38" stopColor="#ff6a3a" />
      <stop offset="1" stopColor="#f2380f" />
    </radialGradient>
  )
}

/** Star center inside StarMark's own box: use as transform-origin to turn it in place. */
export const STAR_ORIGIN = '50% 55.1%'

/** The star alone. `gap` paints the thin cut around it; leave it off unless it overlaps something. */
export function StarMark({ color, gap, title, ...rest }: PartProps & { color?: string; gap?: string }) {
  const id = `star-${useId().replace(/:/g, '')}`
  return (
    <svg viewBox="66 72 895 853" xmlns="http://www.w3.org/2000/svg" {...a11y(title)} {...rest}>
      {color ? null : (
        <defs>
          <GlassStarDefs id={id} />
        </defs>
      )}
      <g transform={EMBLEM_TRANSFORMS.star}>
        <path
          d={EMBLEM_PATHS.star}
          fill={color ?? `url(#${id}-star)`}
          stroke={gap ?? 'none'}
          strokeWidth={gap ? 22 : 0}
          strokeLinejoin="miter"
          paintOrder="stroke"
        />
      </g>
    </svg>
  )
}

/** The logo without its tile: star and ouroboros together, in the mark's exact geometry. The eye,
 *  the scale gaps and the cut round the star are see-through, so it sits on any background. Turn or
 *  scale the whole svg; to animate the two parts separately, use StarMark + Ouroboros (starCut). */
export function BareMark({ star, snake, title, ...rest }: PartProps & { star?: string; snake?: string }) {
  const id = `mark-${useId().replace(/:/g, '')}`
  return (
    <svg viewBox="74 80 879 860" xmlns="http://www.w3.org/2000/svg" {...a11y(title)} {...rest}>
      <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
        <path d={EMBLEM_PATHS.snake} transform={EMBLEM_TRANSFORMS.snake} fill="#fff" />
        <path d={EMBLEM_PATHS.cut} transform={EMBLEM_TRANSFORMS.cut} fill="#000" />
        <g transform={EMBLEM_TRANSFORMS.star} className="d-mark-cut">
          <path d={EMBLEM_PATHS.star} fill="#000" stroke="#000" strokeWidth={22} strokeLinejoin="miter" />
        </g>
      </mask>
      <defs>
        <GlassRingDefs id={id} />
        <GlassStarDefs id={id} />
      </defs>
      <g filter={snake ? undefined : `url(#${id}-glass)`}>
        <rect width="1024" height="1024" fill={snake ?? `url(#${id}-body)`} mask={`url(#${id})`} />
      </g>
      <g transform={EMBLEM_TRANSFORMS.star}>
        <g className="d-mark-star">
          <path d={EMBLEM_PATHS.star} fill={star ?? `url(#${id}-star)`} />
        </g>
      </g>
    </svg>
  )
}

/** The ouroboros ring alone. The eye and the gaps between scales are see-through, so it sits on
 *  any background (gradient, image, shader) without patches.
 *  `starCut`: when the star lands in its home spot over the ring (the two parts forming the mark),
 *  turn this on and drop StarMark's `gap`. The ring then opens a see-through cut where the star
 *  sits, exactly like the mark's own star outline, so no solid outline color has to match the page.
 *  It fades in over `fade` ms (400), so it can switch on as the star arrives.
 *  `turnCut`: the cut follows a `.d-turn` parent instead (v2.css .d-mark-cut): it closes at once
 *  while the star turns under the pointer, so the ring shows whole, and opens again at rest. */
export function Ouroboros({
  color,
  starCut = false,
  turnCut = false,
  fade = 400,
  title,
  ...rest
}: PartProps & { color?: string; starCut?: boolean; turnCut?: boolean; fade?: number }) {
  const id = `ouro-${useId().replace(/:/g, '')}`
  return (
    <svg viewBox="92 86 844 854" xmlns="http://www.w3.org/2000/svg" {...a11y(title)} {...rest}>
      <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
        <path d={EMBLEM_PATHS.snake} transform={EMBLEM_TRANSFORMS.snake} fill="#fff" />
        <path d={EMBLEM_PATHS.cut} transform={EMBLEM_TRANSFORMS.cut} fill="#000" />
        <g
          transform={EMBLEM_TRANSFORMS.star}
          className={turnCut ? 'd-mark-cut' : undefined}
          style={turnCut ? undefined : { opacity: starCut ? 1 : 0, transition: `opacity ${fade}ms ease` }}
        >
          <path d={EMBLEM_PATHS.star} fill="#000" stroke="#000" strokeWidth={22} strokeLinejoin="miter" />
        </g>
      </mask>
      <defs>
        <GlassRingDefs id={id} />
      </defs>
      <g filter={color ? undefined : `url(#${id}-glass)`}>
        <rect width="1024" height="1024" fill={color ?? `url(#${id}-body)`} mask={`url(#${id})`} />
      </g>
    </svg>
  )
}
