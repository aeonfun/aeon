import { Opener, OpenerHeader } from './glass/connect/opener'
import { SMALL_LABEL } from './glass/connect/recipes'
import { cn } from '@/lib/cn'

// The dashboard while its first reads land: the same opener as every screen (sky, logo in its
// rings), the agent's name, and a quiet line saying what is happening.
export function LoadingScreen() {
  return (
    <Opener open className="min-h-[70svh]">
      <OpenerHeader title="Aeon">
        <p role="status" className={cn(SMALL_LABEL, 'mt-6 flex items-center justify-center gap-2.5')}>
          <span aria-hidden className="size-2 animate-pulse rounded-full bg-[var(--primary)]" />
          Loading your agent
        </p>
      </OpenerHeader>
    </Opener>
  )
}
