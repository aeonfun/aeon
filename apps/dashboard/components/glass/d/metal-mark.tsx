import Image from 'next/image'

import { Ouroboros, RING_WHITE } from '@/components/glass/d/emblem-parts'
import { cn } from '@/lib/cn'
import { withBase } from '@/lib/base-path'

// The logo at nav and footer size: the orange metal star (a still frame of the hero's shader,
// public/art/glass/mark-star-orange.webp) over the ouroboros in flat white with the star's cut open, in BareMark's
// box (viewBox 74 80 879 860), so it sits where BareMark sat. The star is its own layer, so it
// still turns under the pointer (.d-turn-mark, v2.css); while it turns the ring closes its cut and
// shows whole, like the hero logo. Decorative: the link names the mark.
const box = (x: number, y: number, w: number, h: number) => ({
  left: `${((x - 74) / 879) * 100}%`,
  top: `${((y - 80) / 860) * 100}%`,
  width: `${(w / 879) * 100}%`,
  height: `${(h / 860) * 100}%`,
})

export function MetalMark({ className }: { className?: string }) {
  return (
    // At this size the star needs more edge on the pale glass pill: deeper bands, and a hairline
    // of shadow round the whole mark, which also holds it on the night before the pill turns to glass.
    <span
      aria-hidden
      className={cn('relative grid place-items-center drop-shadow-[0_0.5px_1px_rgb(20_24_30/0.45)]', className)}
    >
      <span className="relative aspect-[879/860] w-full">
        <Ouroboros
          turnCut
          color={RING_WHITE}
          className="absolute drop-shadow-[0_1px_2px_rgb(20_24_30/0.35)]"
          style={box(92, 86, 844, 854)}
        />
        <span className="d-turn-mark absolute block" style={{ ...box(66, 72, 895, 853), transformOrigin: '50% 55.1%' }}>
          <Image
            src={withBase('/art/glass/mark-star-orange.webp')}
            alt=""
            width={204}
            height={194}
            unoptimized
            className="block size-full [filter:contrast(1.35)_brightness(0.92)]"
          />
        </span>
      </span>
    </span>
  )
}
