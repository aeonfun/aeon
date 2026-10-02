'use client'

import type { CheckResult } from '../lib/connect-check'
import { harnessName } from '../lib/connect-detect'

// Setup checklist on HQ, shown until every row is done. Each row has one
// action that opens the flow that completes it. "Model" only counts once the
// connect-check run proved the credential works from GitHub, not merely when a
// secret exists.

export interface ChecklistState {
  repo: string
  // null = could not tell (hosted mode, no admin read); shown as unknown.
  actionsEnabled: boolean | null
  harness: string
  hasModelKey: boolean
  check: CheckResult | null
  notificationsSet: boolean
  firstRunDone: boolean
}

interface OnboardingChecklistProps extends ChecklistState {
  onConnect: () => void
  onTest: () => void
  onNotifications: () => void
  onFirstRun: () => void
}

type RowState = 'done' | 'todo' | 'busy' | 'unknown'

function Dot({ state }: { state: RowState }) {
  if (state === 'done') {
    return <svg viewBox="0 0 16 16" className="w-4 h-4 text-aeon-green shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-label="done"><path d="M3 8.5l3 3 7-7" /></svg>
  }
  return <span aria-label={state} className={`w-2.5 h-2.5 mx-[3px] rounded-full shrink-0 ${state === 'busy' ? 'bg-aeon-red animate-pulse' : state === 'unknown' ? 'bg-[rgba(250,250,250,0.25)]' : 'border border-aeon-red'}`} />
}

export function checklistComplete(s: ChecklistState): boolean {
  return Boolean(s.repo) && s.actionsEnabled !== false && s.hasModelKey && s.check?.state === 'pass' && s.notificationsSet && s.firstRunDone
}

export function OnboardingChecklist(props: OnboardingChecklistProps) {
  const { repo, actionsEnabled, harness, hasModelKey, check, notificationsSet, firstRunDone } = props
  if (checklistComplete(props)) return null

  const testing = check?.state === 'queued' || check?.state === 'running'
  const modelState: RowState = hasModelKey && check?.state === 'pass' ? 'done' : testing ? 'busy' : 'todo'
  const modelDetail = !hasModelKey ? `No model key for the ${harnessName(harness)} harness yet.`
    : check?.state === 'pass' ? 'Verified from a GitHub runner.'
    : testing ? 'Test run in progress...'
    : check?.state === 'fail' ? `${check.reason ?? 'Last test failed.'} ${check.hint ?? ''}`
    : 'Key saved, not tested yet.'

  const rows: { label: string; state: RowState; detail: string; action?: { label: string; onClick?: () => void; href?: string } }[] = [
    { label: 'Repo connected', state: repo ? 'done' : 'todo', detail: repo || 'The dashboard could not find your repo. Run gh auth login, then reload.' },
    {
      label: 'GitHub Actions enabled',
      state: actionsEnabled === true ? 'done' : actionsEnabled === false ? 'todo' : 'unknown',
      detail: actionsEnabled === true ? 'Skills can run.' : actionsEnabled === false ? 'Actions are off, so no skill can run.' : 'Could not check. Forks start with Actions off.',
      action: actionsEnabled === true || !repo ? undefined : { label: 'Open Actions', href: `https://github.com/${repo}/actions` },
    },
    {
      label: 'Model connected and verified',
      state: modelState,
      detail: modelDetail,
      action: !hasModelKey ? { label: 'Connect', onClick: props.onConnect }
        : check?.state === 'pass' || testing ? undefined
        : check?.state === 'fail' ? { label: 'Fix', onClick: props.onConnect }
        : { label: 'Test', onClick: props.onTest },
    },
    {
      label: 'Notifications set up',
      state: notificationsSet ? 'done' : 'todo',
      detail: notificationsSet ? 'Results reach you.' : 'Telegram, Discord, Slack, or email.',
      action: notificationsSet ? undefined : { label: 'Set up', onClick: props.onNotifications },
    },
    {
      label: 'First skill run',
      state: firstRunDone ? 'done' : 'todo',
      detail: firstRunDone ? 'A skill finished successfully.' : 'Run any skill once to see it work end to end.',
      action: firstRunDone ? undefined : { label: 'Run one', onClick: props.onFirstRun },
    },
  ]
  const doneCount = rows.filter((r) => r.state === 'done').length

  return (
    <section aria-label="Setup checklist" className="border border-[rgba(250,250,250,0.10)] bg-aeon-panel">
      <div className="flex items-center gap-3 px-5 md:px-6 py-4 border-b border-[rgba(250,250,250,0.10)]">
        <span className="font-display text-[13px] tracking-[0.18em] text-aeon-red uppercase">Setup</span>
        <span className="flex-1 h-px bg-[rgba(250,250,250,0.10)]" />
        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-primary-35">{doneCount} / {rows.length} done</span>
      </div>
      <ul className="divide-y divide-[rgba(250,250,250,0.08)]">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-4 px-5 md:px-6 py-3">
            <Dot state={r.state} />
            <div className="min-w-0 flex-1">
              <div className={`text-xs font-mono uppercase tracking-[0.12em] ${r.state === 'done' ? 'text-primary-50' : 'text-aeon-fg'}`}>{r.label}</div>
              <div className="text-[11px] font-mono text-primary-40 truncate" title={r.detail}>{r.detail}</div>
            </div>
            {r.action && (r.action.href
              ? <a href={r.action.href} target="_blank" rel="noopener noreferrer" className="btn-mini shrink-0">{r.action.label}</a>
              : <button onClick={r.action.onClick} className="btn-mini-go shrink-0">{r.action.label}</button>)}
          </li>
        ))}
      </ul>
    </section>
  )
}
