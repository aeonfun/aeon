'use client'

import { useState, useEffect } from 'react'
import { Scramble } from './ui/Animated'
import { STRATEGY_SCAFFOLD, ARCHETYPES } from '../lib/strategy-templates'
import { editorCls, panelInputCls } from '../lib/utils'
import type { StrategySources } from '../lib/types'

export type { StrategySources }

interface StrategyPanelProps {
  content: string
  loading: boolean
  saving: boolean
  building: boolean
  onSave: (content: string) => void
  onBuild: (sources: StrategySources) => void
}

export function StrategyPanel({ content, loading, saving, building, onSave, onBuild }: StrategyPanelProps) {
  const [draft, setDraft] = useState(content)
  const [goal, setGoal] = useState('')
  const [repo, setRepo] = useState('')
  const [links, setLinks] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)

  useEffect(() => { setDraft(content) }, [content])

  const dirty = draft !== content
  const unconfigured = /^> \*\*Status:\*\* unconfigured defaults/m.test(draft)
  const blank = draft.replace(/<!--[\s\S]*?-->/g, '').replace(/^#.*$/gm, '').replace(/^[-*\d.]+\s*$/gm, '').trim().length === 0

  const applyTemplate = (next: string) => {
    if (!blank && !unconfigured && !window.confirm('Replace the current editor content with this template?')) return
    setDraft(next)
    setShowTemplates(false)
  }

  const canBuild = (goal.trim().length > 0 || repo.trim().length > 0 || links.trim().length > 0) && !building
  const build = () => { if (canBuild) onBuild({ goal: goal.trim(), repo: repo.trim(), links: links.trim() }) }

  return (
    <div className="max-w-5xl mx-auto pb-16 space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden border border-[rgba(250,250,250,0.10)] bg-aeon-panel">
        <div className="dither" aria-hidden="true" />
        <div className="relative z-10 px-8 pt-10 pb-8">
          <h1 className="font-display uppercase leading-[0.92] tracking-tight text-aeon-fg"
              style={{ fontSize: 'clamp(40px, 6.5vw, 88px)' }}>
            <Scramble text="STRA" />
            <span className="text-aeon-red"><Scramble text="TEGY" delay={160} /></span>
          </h1>
          <p className="mt-4 max-w-xl text-sm text-primary-70 leading-relaxed">
            One file every skill reads. It&apos;s imported into{' '}
            <span className="font-mono text-primary-100">CLAUDE.md</span>, so it sits in the context of
            every run - keep it tight: a north-star, a few priorities, the hard constraints.
          </p>
        </div>
      </section>

      {/* Build my strategy */}
      <section className="border border-[rgba(250,250,250,0.10)] bg-aeon-panel p-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="font-display text-[13px] tracking-[0.18em] text-aeon-red uppercase">BUILD MY STRATEGY</span>
          <span className="flex-1 h-px bg-[rgba(250,250,250,0.10)]" />
        </div>
        <p className="text-[12px] text-primary-50 font-mono leading-relaxed mb-4">
          <span className="text-primary-80">Every field is optional - give just one.</span>{' '}
          The <span className="text-primary-80">strategy-builder</span> agent reads what you give it (plus your repo
          README + memory), then drafts a tight STRATEGY.md - one north-star, a few priorities, the constraints -
          committed straight to <span className="text-primary-80">STRATEGY.md</span>.
        </p>

        <div className="space-y-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-primary-40">Goal / project <span className="text-primary-30">· what you&apos;re building + what winning looks like</span></span>
            <textarea
              value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} spellCheck={false}
              placeholder="e.g. Growing my open-source agent framework - I want active contributors and a reputation for reliability, not just stars."
              className={`${panelInputCls} w-full resize-y leading-relaxed`}
            />
          </label>
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-primary-40">GitHub repo <span className="text-primary-30">· optional</span></span>
              <input
                type="text" value={repo} onChange={(e) => setRepo(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') build() }}
                placeholder="owner/repo" spellCheck={false}
                className={`${panelInputCls} w-full`}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-primary-40">Links <span className="text-primary-30">· product, site, deck - comma separated</span></span>
              <input
                type="text" value={links} onChange={(e) => setLinks(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') build() }}
                placeholder="yoursite.com, …" spellCheck={false}
                className={`${panelInputCls} w-full`}
              />
            </label>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={build} disabled={!canBuild}
            className="bg-aeon-red text-white text-[11px] font-mono uppercase tracking-[0.14em] px-5 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-40 cursor-target"
          >
            {building ? 'Dispatching…' : 'Build my strategy'}
          </button>
          <span className="text-[10px] text-primary-35 font-mono">Any one field is enough - all optional.</span>
        </div>
      </section>

      {/* Editor */}
      <section className="border-t border-[rgba(250,250,250,0.10)] pt-6">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="font-display text-[13px] tracking-[0.18em] text-aeon-red uppercase">STRATEGY.md</span>
          <span className="flex-1 h-px bg-[rgba(250,250,250,0.10)]" />
          {unconfigured
            ? <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-eva-orange">template defaults</span>
            : <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-eva-green">customized</span>}
          <button
            onClick={() => setShowTemplates(v => !v)}
            className="text-[10px] font-mono uppercase tracking-[0.14em] px-2 py-1 border border-[rgba(250,250,250,0.12)] text-primary-50 hover:text-primary-100 hover:border-[rgba(250,250,250,0.22)] transition-colors cursor-target"
          >
            {showTemplates ? 'Close' : 'Templates'}
          </button>
        </div>

        {/* Template picker - two per row */}
        {showTemplates && (
          <div className="mb-4 border border-[rgba(250,250,250,0.10)] bg-aeon-panel p-4 space-y-3">
            <p className="text-[11px] text-primary-50 font-mono">
              Start from a scaffold, or an archetype that shows the shape of a sharp strategy.
              Replaces the current editor content - edit the bracketed bits to make it yours.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => applyTemplate(STRATEGY_SCAFFOLD)}
                className="text-left border border-[rgba(250,250,250,0.12)] hover:border-aeon-red px-3 py-2.5 transition-colors cursor-target"
              >
                <div className="text-[12px] text-primary-100 font-medium">Blank scaffold</div>
                <div className="text-[10px] text-primary-40 font-mono">Guided headings, no content</div>
              </button>
              {ARCHETYPES.map(a => (
                <button
                  key={a.key}
                  onClick={() => applyTemplate(a.content)}
                  className="text-left border border-[rgba(250,250,250,0.12)] hover:border-aeon-red px-3 py-2.5 transition-colors cursor-target"
                >
                  <div className="text-[12px] text-primary-100 font-medium">{a.label}</div>
                  <div className="text-[10px] text-primary-40 font-mono leading-snug">{a.blurb}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-xs font-mono text-primary-40 py-8">Loading…</div>
        ) : (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              rows={24}
              placeholder={STRATEGY_SCAFFOLD}
              className={editorCls}
            />
            <div className="flex items-center justify-end mt-3">
              <div className="flex items-center gap-2">
                {dirty && (
                  <button onClick={() => setDraft(content)}
                    className="text-[11px] text-primary-40 font-mono px-2 py-2 hover:text-primary-70 transition-colors">
                    Revert
                  </button>
                )}
                <button onClick={() => onSave(draft)} disabled={!dirty || saving}
                  className="bg-eva-green text-white text-[11px] px-4 py-2 font-mono hover:opacity-90 transition-opacity disabled:opacity-40">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
