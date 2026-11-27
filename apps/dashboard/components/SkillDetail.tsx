'use client'

import { useState } from 'react'
import type { Skill, Run, Secret, SkillKeyRef, SkillMcpRef, McpServers } from '../lib/types'
import { modelsForHarness, pickerOptions, keyProvidedByHarness } from '../lib/constants'
import { MCP_BY_SLUG } from '../lib/mcp-catalog'
import { displayName, cronLabel, timeAgo } from '../lib/utils'
import { ScheduleEditor } from './ScheduleEditor'
import { KeyName } from './ui/KeyName'
import { McpLogo } from './ui/McpLogo'
import { Section } from './ui/Section'
import { ArrowRightLightIcon } from './glass/d/icons'
import { RunStatus, SkillRunTag, runState } from './glass/connect/run-status'
import {
  ActionButton,
  AttentionIcon,
  ATTN,
  Callout,
  CARD,
  DoneIcon,
  EmptyState,
  Field,
  FOCUS,
  LINK,
  LIST,
  PrimaryButton,
  ROW,
  Select,
  SMALL_LABEL,
  SUB,
  Switch,
  TAG,
  TAG_INK,
  TAG_MUTED,
  TITLE,
} from './glass/connect/ui'
import { cn } from '@/lib/cn'

interface SkillDetailProps {
  skill: Skill
  runs: Run[]
  model: string
  harness: string
  secrets: Secret[]
  mcpServers: McpServers
  busy: Record<string, boolean>
  onToggle: (name: string, enabled: boolean) => void
  onRun: (name: string, v?: string, m?: string) => void
  onDelete: (name: string) => void
  onUpdateSchedule: (name: string, schedule: string) => void
  onUpdateVar: (name: string, v: string) => void
  onUpdateModel: (name: string, m: string) => void
  onGoToSecret: (name: string) => void
  onGoToMcp: () => void
  // Opens a run's detail. Without it the activity rows are plain (not clickable).
  onViewRun?: (run: Run) => void
}

// Status of one declared requirement (a key or an MCP server): icon + word, never color alone.
// Satisfied = smoke check; a missing required one = orange attention mark; a missing optional
// one = quiet smoke ring.
function ReqState({
  ok,
  required,
  okLabel,
  missingLabel,
}: {
  ok: boolean
  required: boolean
  okLabel: string
  missingLabel: string
}) {
  if (ok)
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <DoneIcon className="size-3.5" />
        {okLabel}
      </span>
    )
  if (required)
    return (
      <span className={cn('inline-flex items-center gap-1.5', ATTN)}>
        <AttentionIcon className="size-3.5" />
        {missingLabel}
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span aria-hidden className="size-3 rounded-full shadow-[inset_0_0_0_1.5px_currentColor]" />
      {missingLabel}
    </span>
  )
}

// Phones: the pill drops under the text so the description keeps the full width.
const REQ_ROW = cn(ROW, 'group items-start gap-4 px-4 py-3.5 max-sm:flex-wrap max-sm:gap-y-3')
const REQ_META =
  'flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11.5px] font-medium tracking-[0.08em] uppercase'
// The pill on the right of a requirement row: what pressing the row does.
const REQ_GO =
  'g-chip mt-0.5 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full pr-3 pl-4 text-[13px] font-medium whitespace-nowrap transition-[background-color] duration-150 group-hover:bg-white'

// A single declared credential. The whole row jumps to Keys → Access Keys, scrolled to this
// key with its input open, so the operator can paste the value in one click.
function KeyRow({
  kref,
  secret,
  harness,
  onGoTo,
}: {
  kref: SkillKeyRef
  secret?: Secret
  harness: string
  onGoTo: (name: string) => void
}) {
  const isSet = !!secret?.isSet
  // The harness may cover this key natively (Grok Build → XAI_API_KEY). Then the
  // row reads as satisfied even unset, but the key stays settable as an override
  // (it's what the Claude harness uses, and it also powers the grok gateway).
  const providedByHarness = !isSet && keyProvidedByHarness(kref.key, harness)
  const satisfied = isSet || providedByHarness
  const desc = secret?.description || 'Third-party credential referenced by this skill.'

  return (
    <li>
      <button type="button" onClick={() => onGoTo(kref.key)} title="Open in Keys to set this key" className={REQ_ROW}>
        <span className="min-w-0 flex-1 max-sm:basis-full">
          <span className="block font-mono text-[14px] font-medium [overflow-wrap:anywhere]">
            <KeyName name={kref.key} />
          </span>
          <span className={cn(REQ_META, 'mt-1.5')}>
            <ReqState
              ok={satisfied}
              required={!kref.optional}
              okLabel={isSet ? 'Set' : 'Covered by Grok Build'}
              missingLabel="Not set"
            />
          </span>
          <span className="mt-1.5 block text-[14px] leading-[1.5] text-muted-foreground">
            {providedByHarness
              ? 'Covered by the Grok Build harness via its built-in web search - set a key for the premium xAI x_search feed (used by both harnesses).'
              : desc}
          </span>
        </span>
        <span className={REQ_GO}>
          {isSet ? 'In vault' : providedByHarness ? 'Override' : 'Set key'}
          <ArrowRightLightIcon className="size-3.5 transition-[translate] duration-150 group-hover:translate-x-0.5" />
        </span>
      </button>
    </li>
  )
}

// A single declared MCP server. Mirrors KeyRow: logo + name + installed state, the whole row
// jumping to the MCP page to install it.
function McpRow({ mref, installed, onGoTo }: { mref: SkillMcpRef; installed: boolean; onGoTo: () => void }) {
  const entry = MCP_BY_SLUG[mref.slug]
  const name = entry?.name || mref.slug
  const url = entry?.url || ''
  const desc = entry?.description || 'MCP server this skill calls during a run.'

  return (
    <li>
      <button type="button" onClick={onGoTo} title="Manage on the MCP page" className={REQ_ROW}>
        <McpLogo src={entry?.logo} size={36} className="mt-0.5 size-9 rounded-[10px]" />
        <span className="min-w-0 flex-1 max-sm:basis-[calc(100%-3.25rem)]">
          <span className="block text-[15px] font-medium">{name}</span>
          <span className={cn(REQ_META, 'mt-1.5')}>
            <ReqState ok={installed} required={!mref.optional} okLabel="Installed" missingLabel="Not installed" />
          </span>
          {url && <span className="mt-1.5 block truncate font-mono text-[12px] text-muted-foreground">{url}</span>}
          <span className="mt-1 block text-[14px] leading-[1.5] text-muted-foreground">{desc}</span>
        </span>
        <span className={cn(REQ_GO, 'max-sm:ml-[3.25rem]')}>
          {installed ? 'Installed' : 'Install'}
          <ArrowRightLightIcon className="size-3.5 transition-[translate] duration-150 group-hover:translate-x-0.5" />
        </span>
      </button>
    </li>
  )
}

// Requirement group: "Required to run" / "Works better with", then the rows on one chip card.
function ReqGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={cn(SMALL_LABEL, 'mb-2 px-1')}>{title}</p>
      <ul className={cn(LIST, 'flex flex-col gap-0.5')}>{children}</ul>
    </div>
  )
}

export function SkillDetail({
  skill,
  runs,
  model,
  harness,
  secrets,
  mcpServers,
  busy,
  onToggle,
  onRun,
  onDelete,
  onUpdateSchedule,
  onUpdateVar,
  onUpdateModel,
  onGoToSecret,
  onGoToMcp,
  onViewRun,
}: SkillDetailProps) {
  // Per-skill model-override options must track the active harness, like the
  // global picker (TopBar/page.tsx) - otherwise a non-claude harness only offers
  // Claude models here, so an operator can't pin a skill to e.g. kimi-k3 and
  // picking a Claude id would bake a mismatched `model:` into the skill.
  const modelOptions = modelsForHarness(harness)
  const [editingSchedule, setEditingSchedule] = useState(false)
  const [editingVar, setEditingVar] = useState(false)
  const [varDraft, setVarDraft] = useState('')

  const skillRuns = runs.filter(r => r.workflow.toLowerCase().includes(skill.name))
  // "On demand" skills carry no cron - they only fire on a manual Run now / dispatch.
  const isManual = skill.schedule === 'workflow_dispatch'

  // Join the skill's declared `requires` against the central credential registry
  // (the same list shown in Keys → Access Keys) for descriptions + set state.
  const secretByName = new Map(secrets.map(s => [s.name, s]))
  const requires = skill.requires ?? []
  const requiredKeys = requires.filter(r => !r.optional)
  const worksBetterKeys = requires.filter(r => r.optional)
  // A required key is only "missing" if it's neither set nor provided natively by
  // the active harness (Grok Build covers XAI_API_KEY via its built-in search_x).
  const missingRequired = requiredKeys.filter(
    r => !secretByName.get(r.key)?.isSet && !keyProvidedByHarness(r.key, harness),
  )

  // Join the skill's declared `mcp:` servers against the live .mcp.json config
  // (installed = its URL is present) and the MCP catalog for name/logo/url.
  const installedMcpUrls = new Set(
    Object.values(mcpServers ?? {})
      .map(s => s?.url)
      .filter((u): u is string => typeof u === 'string'),
  )
  const isMcpInstalled = (slug: string) => {
    const u = MCP_BY_SLUG[slug]?.url
    return !!u && installedMcpUrls.has(u)
  }
  const mcp = skill.mcp ?? []
  const requiredMcp = mcp.filter(m => !m.optional)
  const worksBetterMcp = mcp.filter(m => m.optional)
  const missingRequiredMcp = requiredMcp.filter(m => !isMcpInstalled(m.slug))

  const title = displayName(skill.name)
  const busyToggle = !!busy[skill.name]
  const busyRun = !!busy[`r-${skill.name}`]

  return (
    <div className="space-y-[clamp(36px,4vw,56px)]">
      <header className="max-sm:text-center">
        <h1 className={TITLE}>{title}</h1>
        {skill.description && (
          <p className={cn('mt-4 max-w-[78ch] text-pretty max-sm:mx-auto', SUB)}>{skill.description}</p>
        )}

        <div className="mt-7 flex flex-wrap items-center gap-x-8 gap-y-3 max-sm:justify-center">
          <Switch
            on={skill.enabled}
            disabled={busyToggle}
            onChange={next => {
              if (!busyToggle) onToggle(skill.name, next)
            }}
            label={busyToggle ? 'Saving...' : skill.enabled ? 'Enabled' : 'Disabled'}
            title={skill.enabled ? 'Enabled - click to disable' : 'Disabled - click to enable'}
          />
          <SkillRunTag skill={skill} runs={runs} />
          <PrimaryButton
            onClick={() => onRun(skill.name, skill.var, skill.model)}
            disabled={busyRun}
            className="sm:ml-auto"
          >
            {busyRun ? 'Starting...' : 'Run now'}
          </PrimaryButton>
        </div>
      </header>

      <Section
        label="Schedule"
        action={
          <ActionButton onClick={() => setEditingSchedule(!editingSchedule)} aria-expanded={editingSchedule}>
            {editingSchedule ? 'Cancel' : 'Change schedule'}
          </ActionButton>
        }
      >
        {editingSchedule ? (
          <div className={cn(CARD, 'p-4 sm:p-5')}>
            <ScheduleEditor
              cron={skill.schedule}
              onSave={c => {
                onUpdateSchedule(skill.name, c)
                setEditingSchedule(false)
              }}
            />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span
              className={cn(
                'font-display text-[clamp(1.75rem,3vw,2.25rem)] leading-[1.1] font-light tracking-[-0.03em]',
                !(skill.enabled && !isManual) && 'text-muted-foreground',
              )}
            >
              {cronLabel(skill.schedule)}
            </span>
            <span className={cn(TAG, !skill.enabled ? TAG_MUTED : isManual ? TAG_MUTED : TAG_INK)}>
              {!skill.enabled ? 'Disabled' : isManual ? 'Manual only' : 'Runs automatically'}
            </span>
          </div>
        )}
      </Section>

      {requires.length > 0 && (
        <Section label="API keys">
          <div className="space-y-5">
            {missingRequired.length > 0 && (
              <Callout
                attention
                role="status"
                title={`Missing ${missingRequired.length} required key${missingRequired.length > 1 ? 's' : ''}`}
              >
                This skill won&apos;t work until {missingRequired.length > 1 ? 'they are' : 'it is'} set:{' '}
                {missingRequired.map((r, i) => (
                  <span key={r.key}>
                    {i > 0 && ', '}
                    <button
                      type="button"
                      onClick={() => onGoToSecret(r.key)}
                      title="Open in Keys to set this key"
                      className={cn(LINK, 'font-mono text-[14px]')}
                    >
                      {r.key}
                    </button>
                  </span>
                ))}
              </Callout>
            )}
            {requiredKeys.length > 0 && (
              <ReqGroup title="Required to run">
                {requiredKeys.map(r => (
                  <KeyRow
                    key={r.key}
                    kref={r}
                    secret={secretByName.get(r.key)}
                    harness={harness}
                    onGoTo={onGoToSecret}
                  />
                ))}
              </ReqGroup>
            )}
            {worksBetterKeys.length > 0 && (
              <ReqGroup title="Works better with">
                {worksBetterKeys.map(r => (
                  <KeyRow
                    key={r.key}
                    kref={r}
                    secret={secretByName.get(r.key)}
                    harness={harness}
                    onGoTo={onGoToSecret}
                  />
                ))}
              </ReqGroup>
            )}
          </div>
        </Section>
      )}

      {mcp.length > 0 && (
        <Section label="MCP servers">
          <div className="space-y-5">
            {missingRequiredMcp.length > 0 && (
              <Callout
                attention
                role="status"
                title={`Missing ${missingRequiredMcp.length} required MCP server${missingRequiredMcp.length > 1 ? 's' : ''}`}
              >
                This skill won&apos;t work until {missingRequiredMcp.length > 1 ? 'they are' : 'it is'} installed from
                the{' '}
                <button type="button" onClick={onGoToMcp} className={LINK}>
                  MCP page
                </button>
                :{' '}
                <span className="font-medium text-foreground">
                  {missingRequiredMcp.map(m => MCP_BY_SLUG[m.slug]?.name || m.slug).join(', ')}
                </span>
              </Callout>
            )}
            {requiredMcp.length > 0 && (
              <ReqGroup title="Required to run">
                {requiredMcp.map(m => (
                  <McpRow key={m.slug} mref={m} installed={isMcpInstalled(m.slug)} onGoTo={onGoToMcp} />
                ))}
              </ReqGroup>
            )}
            {worksBetterMcp.length > 0 && (
              <ReqGroup title="Works better with">
                {worksBetterMcp.map(m => (
                  <McpRow key={m.slug} mref={m} installed={isMcpInstalled(m.slug)} onGoTo={onGoToMcp} />
                ))}
              </ReqGroup>
            )}
          </div>
        </Section>
      )}

      <Section label="Skill settings">
        {skill.varHint && (
          <p className="mb-3 max-w-[78ch] text-[15px] leading-[1.55] text-muted-foreground">{skill.varHint}</p>
        )}
        {editingVar ? (
          <div className="flex flex-wrap items-end gap-2">
            <Field
              label="Setting"
              hideLabel
              type="text"
              value={varDraft}
              onChange={e => setVarDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  onUpdateVar(skill.name, varDraft)
                  setEditingVar(false)
                }
              }}
              placeholder="e.g. AI, bitcoin, owner/repo"
              autoFocus
              className="min-w-0 flex-1 basis-[16rem]"
            />
            <div className="flex gap-2">
              <ActionButton onClick={() => setEditingVar(false)} className="h-12 px-5">
                Cancel
              </ActionButton>
              <PrimaryButton
                onClick={() => {
                  onUpdateVar(skill.name, varDraft)
                  setEditingVar(false)
                }}
                className="h-12 px-5"
              >
                Save
              </PrimaryButton>
            </div>
          </div>
        ) : skill.var ? (
          <button
            type="button"
            onClick={() => {
              setEditingVar(true)
              setVarDraft(skill.var)
            }}
            className={cn(
              'group flex max-w-full cursor-pointer items-center gap-3 rounded-[14px] py-1 text-left',
              FOCUS,
            )}
            title="Click to edit"
          >
            <span className="min-w-0 font-display text-[clamp(1.375rem,2.4vw,1.875rem)] leading-[1.2] font-light tracking-[-0.02em] [overflow-wrap:anywhere]">
              &ldquo;{skill.var}&rdquo;
            </span>
            <span className="g-chip inline-flex h-9 shrink-0 items-center rounded-full px-4 text-[13px] font-medium opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
              Edit
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditingVar(true)
              setVarDraft('')
            }}
            className={cn(
              'group flex w-full cursor-pointer items-center gap-3 rounded-[22px] px-5 py-4 text-left shadow-[inset_0_0_0_1px_var(--line)] transition-[background-color] duration-150 hover:bg-[var(--hover)]',
              FOCUS,
            )}
          >
            <span className="text-[15px] text-muted-foreground">No custom settings</span>
            <span className="g-chip ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium whitespace-nowrap">
              <svg
                aria-hidden
                viewBox="0 0 16 16"
                className="size-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
              >
                <path d="M8 3v10M3 8h10" />
              </svg>
              <span className="md:hidden">Set</span>
              <span className="hidden md:inline">Set var</span>
            </span>
          </button>
        )}
      </Section>

      <Section label="Capability level">
        <Select
          label="Model for this skill"
          hideLabel
          value={skill.model}
          onChange={e => onUpdateModel(skill.name, e.target.value)}
          className="max-w-md"
        >
          <option value="">Default ({modelOptions.find(m => m.id === model)?.label ?? model})</option>
          {pickerOptions(modelOptions, skill.model).map(m => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </Select>
      </Section>

      <Section
        label="Activity log"
        action={
          skillRuns.length > 10 ? (
            <span className="font-mono text-[12px] text-muted-foreground">Latest 10 of {skillRuns.length}</span>
          ) : undefined
        }
      >
        <div className={LIST}>
          {skillRuns.length ? (
            <ul className="flex flex-col gap-0.5">
              {skillRuns.slice(0, 10).map(run => {
                const state = runState(run)
                const rowCls = cn(
                  'flex min-h-12 w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left',
                  state === 'failed' && 'bg-[oklch(0.65_0.23_32/0.07)]',
                )
                const body = (
                  <>
                    <RunStatus run={run} className="w-[7.5rem] shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-[15px]">
                      {run.conclusion === 'success'
                        ? 'Task completed'
                        : run.conclusion === 'timed_out'
                          ? 'Timed out'
                          : run.conclusion === 'cancelled'
                            ? 'Cancelled'
                            : run.conclusion
                              ? 'Task failed'
                              : run.status === 'in_progress'
                                ? 'Working...'
                                : 'Queued'}
                    </span>
                    <time
                      dateTime={run.created_at}
                      className="shrink-0 font-mono text-[12px] text-muted-foreground tabular-nums"
                    >
                      {timeAgo(run.created_at)}
                    </time>
                  </>
                )
                return (
                  <li key={run.id}>
                    {onViewRun ? (
                      <button
                        type="button"
                        onClick={() => onViewRun(run)}
                        className={cn(
                          rowCls,
                          'cursor-pointer transition-[background-color] duration-150 hover:bg-[var(--hover)]',
                          FOCUS,
                        )}
                      >
                        {body}
                      </button>
                    ) : (
                      <div className={rowCls}>{body}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState title="No activity" />
          )}
        </div>
      </Section>

      {/* Danger zone: the one action that cannot be undone from here, kept away from Run now. */}
      <Section label="Danger zone">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[20px] px-5 py-4 shadow-[inset_0_0_0_1px_oklch(0.65_0.23_32/0.35)] max-sm:justify-center max-sm:text-center">
          <p className="min-w-0 flex-1 text-[15px] text-[var(--g-ink-soft)] max-sm:basis-full">
            Delete {displayName(skill.name)} from this repo.
          </p>
          <ActionButton
            onClick={() => {
              if (confirm(`Delete ${displayName(skill.name)}?`)) onDelete(skill.name)
            }}
            className={ATTN}
          >
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2.75 4.25h10.5M6.25 4.25V2.75h3.5v1.5M4 4.25l.6 8.4a1 1 0 0 0 1 .93h4.8a1 1 0 0 0 1-.93l.6-8.4M6.75 7v4M9.25 7v4" />
            </svg>
            Delete skill
          </ActionButton>
        </div>
      </Section>
    </div>
  )
}
