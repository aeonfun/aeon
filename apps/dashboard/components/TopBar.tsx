import type { Skill, GatewayProvider, Harness, DashboardView } from '../lib/types'
import { HARNESSES, modelsForHarness, pickerOptions } from '../lib/constants'
import { ACTION, BEAD, FOCUS, PRIMARY, TAG, TAG_MUTED } from './glass/connect/recipes'
import { cn } from '@/lib/cn'
import { displayName } from '../lib/utils'

interface TopBarProps {
  repo: string
  model: string
  harness: Harness
  gateway: GatewayProvider
  hasModelKey: boolean
  pulling: boolean
  syncing: boolean
  hasChanges: boolean
  behind: number
  onSetupAuth: () => void
  onUpdateModel: (m: string) => void
  onUpdateHarness: (h: string) => void
  onPull: () => void
  onSync: () => void
  // Pull / Push / GitHub: in the nav on wide screens, here (under the selects) on phones.
  actions?: React.ReactNode
  // The view pills (HQ, Packs, Strategy...), the bar's first row.
  views?: React.ReactNode
  // Harness + model selects: in the nav on wide screens, here below lg.
  controls?: React.ReactNode
}

// The heading for the current screen: the phone-only MobileBar and the tab title use it.
export function viewTitle(skill: Skill | null, view: DashboardView, repo: string): string {
  if (skill) return displayName(skill.name)
  if (view === 'packs') return 'Packs'
  if (view === 'secrets') return 'Keys'
  if (view === 'strategy') return 'Strategy'
  if (view === 'mcp') return 'MCP'
  if (view === 'soul') return 'Soul'
  return repo ? (repo.split('/').pop() ?? 'Aeon') : 'Aeon'
}

// A glass select: a g-chip pill with a chevron, 16px text on phones (no iOS zoom). Sized to its
// longest option (native auto width), so the model's full name always shows; capped at the bar's
// width so a very long custom model id can never push the page sideways.
const NAV_SELECT = cn(
  'g-bead h-11 w-auto max-w-full min-w-0 cursor-pointer appearance-none rounded-full pr-8 pl-4 text-[15px] font-medium text-foreground',
  FOCUS,
)
const SELECT = cn(
  'g-chip h-10 w-auto max-w-full min-w-0 cursor-pointer appearance-none rounded-full pr-8 pl-4 text-[16px] font-medium text-foreground transition-[background-color] duration-150 hover:bg-white md:text-[14px]',
  FOCUS,
)

function Select({
  label,
  value,
  onChange,
  children,
  tone = 'paper',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
  tone?: 'nav' | 'paper'
}) {
  return (
    <label className="relative flex max-w-full min-w-0 items-center">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        title={label}
        className={tone === 'nav' ? NAV_SELECT : SELECT}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="pointer-events-none absolute right-3 size-3.5 text-muted-foreground"
      >
        <path
          d="M4 6l4 4 4-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </label>
  )
}

// The dashboard's controls, as a bar along the top of the main panel on every view: the model
// connection, harness and default model on the left, Pull / Push and the repo on GitHub on the
// right, over a soft rule. Phones wrap it to two rows (selects, then actions). The panels below
// render their own headings. Pull / Push / GitHub live in the nav on wide screens (RepoActions).
export function TopBar({ actions, views, controls }: Pick<TopBarProps, 'actions' | 'views' | 'controls'>) {
  return (
    <div
      role="group"
      aria-label="Agent controls"
      className="flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-[var(--line)] pb-4 sm:pb-5"
    >
      {views && <div className="w-full">{views}</div>}
      {controls && <div className="flex w-full flex-wrap items-center gap-2 lg:hidden">{controls}</div>}
      {actions && <div className="w-full lg:hidden">{actions}</div>}
    </div>
  )
}

interface RepoActionsProps {
  repo: string
  pulling: boolean
  syncing: boolean
  hasChanges: boolean
  behind: number
  onPull: () => void
  onSync: () => void
  // "nav": icon beads in the top menu bar, lg+ only (hidden while the site menu is open, whose own
  // GitHub bead then takes the same spot); "paper": labelled pills under the selects on phones.
  tone?: 'nav' | 'paper'
}

const NAV_BEAD = cn(
  'g-bead inline-grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-foreground transition-[scale] duration-150 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50',
  FOCUS,
)

/** Pull from GitHub, push to GitHub, and the repo on GitHub. */
export function RepoActions({
  repo,
  pulling,
  syncing,
  hasChanges,
  behind,
  onPull,
  onSync,
  tone = 'paper',
}: RepoActionsProps) {
  const nav = tone === 'nav'
  const btn = nav ? NAV_BEAD : cn(ACTION, 'relative flex-1 px-4')
  const bead = nav ? NAV_BEAD : BEAD
  // The nav shows the icons alone; the words stay for screen readers and the hover title.
  const word = (w: string) => (nav ? <span className="sr-only">{w}</span> : w)
  return (
    <div
      className={cn('items-center gap-2', nav ? 'hidden lg:flex lg:group-data-[menu-open]/nav:hidden' : 'flex w-full')}
    >
      <button
        type="button"
        onClick={onPull}
        disabled={pulling}
        title={pulling ? 'Pulling' : 'Pull from GitHub'}
        className={cn(btn, 'relative')}
      >
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="size-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 2.5v8m0 0L4.5 7M8 10.5 11.5 7M3 13.5h10" />
        </svg>
        {word(pulling ? 'Pulling' : 'Pull')}
        {behind > 0 && (
          <>
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 size-2.5 animate-pulse rounded-full bg-[var(--primary)] ring-2 ring-white motion-reduce:animate-none"
            />
            <span className="sr-only">: {behind} new on GitHub</span>
          </>
        )}
      </button>
      <button
        type="button"
        onClick={onSync}
        disabled={syncing || !hasChanges}
        title={syncing ? 'Pushing' : 'Push to GitHub'}
        className={cn(btn, 'relative')}
      >
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="size-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 13.5v-8m0 0L4.5 9M8 5.5 11.5 9M3 2.5h10" />
        </svg>
        {word(syncing ? 'Pushing' : 'Push')}
        {hasChanges && (
          <>
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-[var(--foreground)] ring-2 ring-white"
            />
            <span className="sr-only">: changes to push</span>
          </>
        )}
      </button>
      {repo && (
        <a
          href={`https://github.com/${repo}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub repository (opens in a new tab)"
          title="GitHub"
          className={bead}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-[18px]" aria-hidden="true">
            <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.2 3.44 9.61 8.21 11.17.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.72-4.04-1.6-4.04-1.6-.55-1.38-1.34-1.75-1.34-1.75-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 016.01 0c2.29-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.63-5.48 5.92.43.37.81 1.1.81 2.22 0 1.6-.01 2.89-.01 3.28 0 .32.22.69.83.57C20.57 21.9 24 17.49 24 12.29 24 5.78 18.63.5 12 .5z" />
          </svg>
        </a>
      )}
    </div>
  )
}

/** Connect a model (when none is set), the agent harness and the default model. */
export function ModelControls({
  model,
  harness,
  gateway,
  hasModelKey,
  onSetupAuth,
  onUpdateModel,
  onUpdateHarness,
  tone = 'paper',
}: Pick<
  TopBarProps,
  'model' | 'harness' | 'gateway' | 'hasModelKey' | 'onSetupAuth' | 'onUpdateModel' | 'onUpdateHarness'
> & { tone?: 'nav' | 'paper' }) {
  const modelOptions = pickerOptions(modelsForHarness(harness), model)
  return (
    <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
      {!hasModelKey && (
        <button
          type="button"
          onClick={onSetupAuth}
          title="Connect a model so skills can run"
          className={cn(PRIMARY, tone === 'nav' ? 'h-11 px-5' : 'h-10 px-5')}
        >
          Connect a model
        </button>
      )}
      <Select tone={tone} label="Agent harness" value={harness} onChange={onUpdateHarness}>
        {HARNESSES.map(h => (
          <option key={h.id} value={h.id}>
            {h.label}
          </option>
        ))}
      </Select>
      <Select tone={tone} label="Default model" value={model} onChange={onUpdateModel}>
        {modelOptions.map(m => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </Select>
      {harness === 'claude' && gateway !== 'direct' && gateway !== 'auto' && (
        <span title="Model gateway" className={cn(TAG, TAG_MUTED, 'h-7 px-2.5')}>
          <span className="sr-only">Gateway: </span>
          {gateway}
        </span>
      )}
    </div>
  )
}
