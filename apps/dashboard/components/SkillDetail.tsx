'use client'

import { useState } from 'react'
import type { Skill, Run, GatewayProvider } from '../lib/types'
import { MODELS, BANKR_EXTRA_MODELS, DEPARTMENTS } from '../lib/constants'
import { displayName, getSkillStatus, cronLabel, statusDot, inputCls } from '../lib/utils'
import { ScheduleEditor } from './ScheduleEditor'
import { timeAgo } from '../lib/utils'
import { Scramble } from './ui/Animated'

interface SkillDetailProps {
  skill: Skill
  runs: Run[]
  model: string
  gateway: GatewayProvider
  busy: Record<string, boolean>
  onToggle: (name: string, enabled: boolean) => void
  onRun: (name: string, v?: string, m?: string) => void
  onDelete: (name: string) => void
  onUpdateSchedule: (name: string, schedule: string) => void
  onUpdateVar: (name: string, v: string) => void
  onUpdateModel: (name: string, m: string) => void
  onViewRun: (run: Run) => void
}

function Section({ index, label, action, children }: { index: string; label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-t border-[rgba(250,250,250,0.10)] pt-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="font-display text-[13px] tracking-[0.18em] text-aeon-red">{index} / {label}</span>
        <span className="flex-1 h-px bg-[rgba(250,250,250,0.10)]" />
        {action}
      </div>
      {children}
    </section>
  )
}

export function SkillDetail({ skill, runs, model, gateway, busy, onToggle, onRun, onDelete, onUpdateSchedule, onUpdateVar, onUpdateModel, onViewRun }: SkillDetailProps) {
  const modelOptions = gateway === 'bankr' ? [...MODELS, ...BANKR_EXTRA_MODELS] : MODELS
  const [editingSchedule, setEditingSchedule] = useState(false)
  const [editingVar, setEditingVar] = useState(false)
  const [varDraft, setVarDraft] = useState('')

  const dept = skill.tags?.[0] ? DEPARTMENTS[skill.tags[0]] : null
  const skillRuns = runs.filter(r => r.workflow.toLowerCase().includes(skill.name))
  const st = getSkillStatus(skill.name, skill.enabled, runs)

  return (
    <div className="max-w-5xl mx-auto pb-16 space-y-10">
      <section className="relative overflow-hidden border border-[rgba(250,250,250,0.10)] bg-aeon-panel">
        <div className="dither" aria-hidden="true" />
        <div className="relative z-10 px-8 pt-10 pb-8">
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <span className="text-[11px] font-mono uppercase tracking-[0.28em] text-aeon-red inline-flex items-center gap-3">
              <span className="w-7 h-px bg-aeon-red" />
              {dept ? dept.label : 'Skill'}
            </span>
            <span className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-primary-50">
              <span className={statusDot(st.color)} />
              {st.label}
            </span>
          </div>
          <h1 className="font-display uppercase leading-[0.92] tracking-tight text-aeon-fg break-words"
              style={{ fontSize: 'clamp(40px, 6.5vw, 88px)' }}>
            <Scramble key={skill.name} text={displayName(skill.name)} />
          </h1>
          {skill.description && (
            <p className="mt-4 max-w-2xl text-sm text-primary-70 leading-relaxed">{skill.description}</p>
          )}

          <div className="mt-7 flex items-center gap-3 flex-wrap">
            <button
              onClick={() => onToggle(skill.name, !skill.enabled)}
              disabled={!!busy[skill.name]}
              className={skill.enabled ? 'btn-ghost' : 'btn-solid'}
            >
              {skill.enabled ? 'Off Duty' : 'On Duty'}
            </button>
            <button
              onClick={() => onRun(skill.name, skill.var, skill.model)}
              disabled={!!busy[`r-${skill.name}`]}
              className="btn-solid disabled:opacity-50"
              style={{ background: 'var(--aeon-red)', borderColor: 'var(--aeon-red)', color: 'var(--aeon-fg-pure)' }}
            >
              {busy[`r-${skill.name}`] ? '…' : 'Run now'}
            </button>
            <button
              onClick={() => { if (confirm(`Remove ${displayName(skill.name)}?`)) onDelete(skill.name) }}
              className="text-[11px] text-eva-red/50 hover:text-eva-red font-mono px-3 py-2 ml-auto transition-colors uppercase tracking-[0.18em]"
            >
              Remove
            </button>
          </div>
        </div>
      </section>

      <Section
        index="01"
        label="Shift schedule"
        action={
          <button
            onClick={() => setEditingSchedule(!editingSchedule)}
            className="text-[11px] text-primary-40 font-mono uppercase tracking-[0.18em] hover:text-aeon-red transition-colors"
          >
            {editingSchedule ? 'Cancel' : 'Edit'}
          </button>
        }
      >
        {editingSchedule ? (
          <div className="border border-[rgba(250,250,250,0.10)] p-5 bg-aeon-panel">
            <ScheduleEditor cron={skill.schedule} onSave={(c) => { onUpdateSchedule(skill.name, c); setEditingSchedule(false) }} />
          </div>
        ) : (
          <div className="font-display uppercase tracking-tight text-aeon-fg" style={{ fontSize: 'clamp(24px, 3vw, 36px)' }}>
            {cronLabel(skill.schedule)}
          </div>
        )}
      </Section>

      <Section
        index="02"
        label="Assignment brief"
        action={
          <button
            onClick={() => { setEditingVar(!editingVar); setVarDraft(skill.var) }}
            className="text-[11px] text-primary-40 font-mono uppercase tracking-[0.18em] hover:text-aeon-red transition-colors"
          >
            {editingVar ? 'Cancel' : 'Edit'}
          </button>
        }
      >
        {editingVar ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={varDraft}
              onChange={(e) => setVarDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { onUpdateVar(skill.name, varDraft); setEditingVar(false) } }}
              placeholder="e.g. AI, bitcoin, owner/repo"
              className={inputCls}
            />
            <button onClick={() => { onUpdateVar(skill.name, varDraft); setEditingVar(false) }} className="btn-solid">Save</button>
          </div>
        ) : skill.var ? (
          <div className="font-display uppercase tracking-tight text-aeon-fg" style={{ fontSize: 'clamp(22px, 2.4vw, 30px)' }}>
            &ldquo;{skill.var}&rdquo;
          </div>
        ) : (
          <div className="text-sm text-primary-35 font-mono uppercase tracking-[0.18em]">No assignment — falls back to defaults</div>
        )}
      </Section>

      <Section index="03" label="Capability level">
        <select
          value={skill.model}
          onChange={(e) => onUpdateModel(skill.name, e.target.value)}
          className="bg-aeon-panel text-aeon-fg text-sm px-4 py-3 border border-[rgba(250,250,250,0.10)] outline-none font-mono w-full max-w-md cursor-pointer hover:border-[rgba(250,250,250,0.22)] focus:border-aeon-red transition-colors"
        >
          <option value="">Default ({modelOptions.find(m => m.id === model)?.label ?? model})</option>
          {modelOptions.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </Section>

      <Section index="04" label="Activity log">
        <div className="border border-[rgba(250,250,250,0.10)] divide-y divide-[rgba(250,250,250,0.08)]">
          {skillRuns.slice(0, 10).map(run => (
            <button
              key={run.id}
              onClick={() => onViewRun(run)}
              className="w-full flex items-center gap-4 px-5 py-3 hover:bg-aeon-panel transition-colors text-left group"
            >
              <span className={`text-sm w-4 shrink-0 ${run.conclusion === 'success' ? 'text-eva-green' : run.conclusion === 'failure' ? 'text-eva-red' : run.status === 'in_progress' ? 'text-eva-orange' : 'text-primary-35'}`}>
                {run.conclusion === 'success' ? '✓' : run.conclusion === 'failure' ? '✗' : run.status === 'in_progress' ? '◌' : '·'}
              </span>
              <span className="text-xs text-primary-70 truncate flex-1 font-mono group-hover:text-aeon-fg transition-colors">
                {run.conclusion === 'success' ? 'Task completed' : run.conclusion === 'failure' ? 'Task failed' : run.status === 'in_progress' ? 'Working…' : 'Queued'}
              </span>
              <span className="text-[10px] text-primary-35 font-mono tabular-nums uppercase tracking-[0.14em]">{timeAgo(run.created_at)}</span>
            </button>
          ))}
          {!skillRuns.length && (
            <div className="px-6 py-12 text-center">
              <p className="font-display uppercase text-aeon-fg text-xl tracking-wide">No activity</p>
              <p className="text-[11px] text-primary-40 font-mono mt-2 uppercase tracking-[0.18em]">This skill hasn&apos;t fired yet</p>
            </div>
          )}
        </div>
      </Section>
    </div>
  )
}
