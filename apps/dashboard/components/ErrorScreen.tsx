'use client'

import { Opener, OpenerHeader } from './glass/connect/opener'
import { PrimaryButton } from './glass/connect/ui'

// Full-screen load failure: the local dashboard could not read this agent repo. Says the
// error in words and offers a retry.
export function ErrorScreen({ error }: { error: string }) {
  return (
    <Opener className="min-h-[70svh]">
      <OpenerHeader title="Could not load this agent" sub="The dashboard could not read your agent repo.">
        <div className="g-glass mx-auto mt-7 max-w-[34rem] rounded-[24px] px-5 py-5 text-left">
          <div className="relative z-[1]">
            <p role="alert" className="flex items-start gap-3 font-mono text-[13px] leading-[1.6] break-words">
              <svg
                aria-hidden
                viewBox="0 0 16 16"
                className="mt-0.5 size-4 shrink-0 text-[oklch(0.55_0.2_33)]"
                fill="currentColor"
              >
                <circle cx="8" cy="8" r="7" />
                <path
                  d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8"
                  stroke="oklch(0.985 0.004 220)"
                  strokeWidth={1.7}
                  strokeLinecap="round"
                />
              </svg>
              <span className="min-w-0">
                <span className="font-sans font-semibold">Error: </span>
                {error}
              </span>
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <PrimaryButton onClick={() => window.location.reload()}>Try again</PrimaryButton>
            </div>
          </div>
        </div>
      </OpenerHeader>
    </Opener>
  )
}
