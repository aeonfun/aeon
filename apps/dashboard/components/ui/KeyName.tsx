import { Fragment } from 'react'

/**
 * An env-style key name (CLAUDE_CODE_OAUTH_TOKEN) that wraps after its
 * underscores on narrow screens instead of mid-word. A single segment too long
 * for its line still breaks (overflow-wrap) rather than overflowing.
 */
export function KeyName({ name }: { name: string }) {
  const parts = name.split('_')
  return (
    <>
      {parts.map((part, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional and never reorder
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 && (
            <>
              _<wbr />
            </>
          )}
        </Fragment>
      ))}
    </>
  )
}
