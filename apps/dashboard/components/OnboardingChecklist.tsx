'use client'

import { useState } from 'react'
import { harnessName } from '../lib/connect-detect'
import { CountUp } from './glass/count-up'
import { ArrowUpRightLightIcon, CheckLightIcon } from './glass/d/icons'
import { ACTION, ActionButton, CARD, CHIP, CHIP_OFF, CHIP_ROW, LABEL, NewTab } from './glass/connect/ui'
import { cn } from '@/lib/cn'

// Setup checklist on HQ, shown until every row is done. Each row has one
// action that opens the flow that completes it. "Model" is done once a
// credential for the selected harness is saved; the first run uses it, and a
// failed run explains itself under Recent activity.

export interface ChecklistState {
  repo: string
  // null = could not tell (hosted mode, no admin read); shown as unknown.
  actionsEnabled: boolean | null
  harness: string
  hasModelKey: boolean
  // A skill is turned on in aeon.yml beyond the default heartbeat.
  skillsPicked: boolean
  notificationsSet: boolean
  firstRunDone: boolean
}

// The channels ./notify can deliver to; the row's chooser opens the first
// secret each one needs.
export type NotifyChannel = 'telegram' | 'discord' | 'slack' | 'email'
const CHANNELS: { id: NotifyChannel; label: string }[] = [
  { id: 'telegram', label: 'Telegram' },
  { id: 'discord', label: 'Discord' },
  { id: 'slack', label: 'Slack' },
  { id: 'email', label: 'Email' },
]

interface OnboardingChecklistProps extends ChecklistState {
  onConnect: () => void
  onPickSkills: () => void
  onNotifications: (channel: NotifyChannel) => void
  onFirstRun: () => void
}

type RowState = 'done' | 'todo' | 'unknown'

// The step marker: an orange numbered bead while it is still to do (the docs .g-steps bead),
// a smoke check once done, a quiet "?" when it could not be checked. The word comes with it.
function Bead({ state, n }: { state: RowState; n: number }) {
  if (state === 'done') {
    return (
      <span className="relative z-[1] grid size-[2.1rem] shrink-0 place-items-center rounded-full bg-[var(--foreground)] text-[var(--g-paper)] shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]">
        <CheckLightIcon className="size-4" />
      </span>
    )
  }
  if (state === 'unknown') {
    return (
      <span className="g-chip relative z-[1] grid size-[2.1rem] shrink-0 place-items-center rounded-full font-mono text-[13px] font-semibold text-muted-foreground">
        ?
      </span>
    )
  }
  return (
    <span className="c-bead relative z-[1] grid size-[2.1rem] shrink-0 place-items-center rounded-full font-mono text-[13px] font-semibold text-[var(--primary-foreground)]">
      {n}
    </span>
  )
}

const STATE_WORD: Record<RowState, string> = { done: 'Done', todo: 'To do', unknown: 'Not checked' }

export function checklistComplete(s: ChecklistState): boolean {
  return (
    Boolean(s.repo) &&
    s.actionsEnabled !== false &&
    s.hasModelKey &&
    s.skillsPicked &&
    s.notificationsSet &&
    s.firstRunDone
  )
}

export function OnboardingChecklist(props: OnboardingChecklistProps) {
  const { repo, actionsEnabled, harness, hasModelKey, skillsPicked, notificationsSet, firstRunDone } = props
  // Notifications row: "Set up" swaps the action for a pick-a-channel row.
  const [choosing, setChoosing] = useState(false)
  if (checklistComplete(props)) return null

  const rows: {
    label: string
    state: RowState
    detail: string
    action?: { label: string; onClick?: () => void; href?: string }
  }[] = [
    {
      label: 'Repo connected',
      state: repo ? 'done' : 'todo',
      detail: repo || 'The dashboard could not find your repo. Run gh auth login, then reload.',
    },
    {
      label: 'GitHub Actions enabled',
      state: actionsEnabled === true ? 'done' : actionsEnabled === false ? 'todo' : 'unknown',
      detail:
        actionsEnabled === true
          ? 'Skills can run.'
          : actionsEnabled === false
            ? 'Actions are off, so no skill can run.'
            : 'Could not check. Forks start with Actions off.',
      action:
        actionsEnabled === true || !repo
          ? undefined
          : { label: 'Open Actions', href: `https://github.com/${repo}/actions` },
    },
    {
      label: 'Model connected',
      state: hasModelKey ? 'done' : 'todo',
      detail: hasModelKey ? 'Key saved. The next run uses it.' : `No model connected for ${harnessName(harness)} yet.`,
      action: hasModelKey ? undefined : { label: 'Connect a model', onClick: props.onConnect },
    },
    {
      label: 'Skills picked',
      state: skillsPicked ? 'done' : 'todo',
      detail: skillsPicked ? 'Your agent has work to do.' : 'Turn on the skills you want from the packs.',
      action: skillsPicked ? undefined : { label: 'Pick skills', onClick: props.onPickSkills },
    },
    {
      label: 'Notifications set up',
      state: notificationsSet ? 'done' : 'todo',
      detail: notificationsSet ? 'Results reach you.' : 'Telegram, Discord, Slack, or email.',
      action: notificationsSet || choosing ? undefined : { label: 'Set up', onClick: () => setChoosing(true) },
    },
    {
      label: 'First skill run',
      state: firstRunDone ? 'done' : 'todo',
      detail: firstRunDone ? 'A skill finished successfully.' : 'Run any skill once to see it work end to end.',
      action: firstRunDone ? undefined : { label: 'Run now', onClick: props.onFirstRun },
    },
  ]
  const doneCount = rows.filter(r => r.state === 'done').length

  return (
    <section aria-labelledby="setup-title" className={cn(CARD, 'px-4 py-5 sm:px-6 sm:py-6')}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="setup-title" className={LABEL}>
          Setup
        </h2>
        <span className="font-mono text-[12px] text-muted-foreground tabular-nums">
          <CountUp to={doneCount} duration={1.2} /> of {rows.length} done
        </span>
      </div>
      <div aria-hidden className="mt-3 h-1 overflow-hidden rounded-full bg-[var(--muted)]">
        <div
          className="h-full rounded-full bg-[var(--foreground)] transition-[width] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]"
          style={{ width: `${(doneCount / rows.length) * 100}%` }}
        />
      </div>
      <ol className="mt-5">
        {rows.map((r, i) => (
          <li key={r.label} className="relative flex gap-4 pb-5 last:pb-0">
            {i < rows.length - 1 && (
              <span
                aria-hidden
                className="absolute top-[2.1rem] bottom-0 left-[calc(1.05rem-0.5px)] w-px bg-[linear-gradient(var(--line),transparent)]"
              />
            )}
            <Bead state={r.state} n={i + 1} />
            <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-4 gap-y-2.5 pt-1">
              <div className="min-w-0 flex-1 basis-[14rem]">
                <p
                  className={cn(
                    'text-[16px] leading-[1.35] font-medium',
                    r.state === 'done' && 'text-muted-foreground',
                  )}
                >
                  {r.label}
                  <span className="sr-only">: {STATE_WORD[r.state]}</span>
                </p>
                <p className="mt-0.5 text-[14px] leading-[1.5] text-muted-foreground [overflow-wrap:anywhere]">
                  {r.detail}
                </p>
              </div>
              {r.action &&
                (r.action.href ? (
                  <a href={r.action.href} target="_blank" rel="noopener noreferrer" className={cn(ACTION, 'shrink-0')}>
                    {r.action.label}
                    <ArrowUpRightLightIcon className="size-3.5" />
                    <NewTab />
                  </a>
                ) : (
                  <ActionButton onClick={r.action.onClick} className="shrink-0">
                    {r.action.label}
                  </ActionButton>
                ))}
              {r.label === 'Notifications set up' && !notificationsSet && choosing && (
                <div className={cn(CHIP_ROW, 'w-full')} role="group" aria-label="Pick a channel">
                  {CHANNELS.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => props.onNotifications(c.id)}
                      className={cn(CHIP, CHIP_OFF)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
