'use client'

import { useState, useEffect } from 'react'
import { Scramble } from './ui/Animated'
import { SOUL_SCAFFOLD, STYLE_SCAFFOLD, ARCHETYPES } from '../lib/soul-templates'

export type SoulFile = 'soul' | 'style'
export interface SoulSources { handle: string; name: string; links: string }

interface SoulPanelProps {
  soul: string
  style: string
  loading: boolean
  saving: boolean
  building: boolean
  onSave: (file: SoulFile, content: string) => void
  onBuild: (sources: SoulSources) => void
}

const EXAMPLES_URL = 'https://github.com/aaronjmars/soul.md/tree/main/examples'

// Strip HTML comments, headings and whitespace — what's left is real authored
// content. Empty ⇒ still the scaffold, so badge it "template".
function isBlank(md: string): boolean {
  return md
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^#.*$/gm, '')
    .replace(/^[-*]\s*$/gm, '')
    .trim().length === 0
}

const SOFT_LIMIT = 6000

export function SoulPanel({ soul, style, loading, saving, building, onSave, onBuild }: SoulPanelProps) {
  const [active, setActive] = useState<SoulFile>('soul')
  const [soulDraft, setSoulDraft] = useState(soul)
  const [styleDraft, setStyleDraft] = useState(style)
  const [handle, setHandle] = useState('')
  const [name, setName] = useState('')
  const [links, setLinks] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)

  useEffect(() => { setSoulDraft(soul) }, [soul])
  useEffect(() => { setStyleDraft(style) }, [style])

  const content = active === 'soul' ? soul : style
  const draft = active === 'soul' ? soulDraft : styleDraft
  const setDraft = active === 'soul' ? setSoulDraft : setStyleDraft
  const scaffold = active === 'soul' ? SOUL_SCAFFOLD : STYLE_SCAFFOLD

  const dirty = draft !== content
  const chars = draft.length
  const overLimit = chars > SOFT_LIMIT
  const blank = isBlank(draft)

  const applyTemplate = (next: string) => {
    if (!blank && !window.confirm('Replace the current editor content with this template?')) return
    setDraft(next)
    setShowTemplates(false)
  }
  const applyArchetype = (key: string) => {
    const a = ARCHETYPES.find(x => x.key === key)
    if (!a) return
    applyTemplate(active === 'soul' ? a.soul : a.style)
  }

  const cleanHandle = handle.trim().replace(/^@/, '').replace(/^https?:\/\/(x|twitter)\.com\//i, '').replace(/\/.*$/, '')
  const canBuild = (cleanHandle.length > 0 || name.trim().length > 0 || links.trim().length > 0) && !building
  const build = () => { if (canBuild) onBuild({ handle: cleanHandle, name: name.trim(), links: links.trim() }) }

  const inputCls = 'bg-aeon-bg text-aeon-fg text-[13px] px-3 py-2.5 border border-[rgba(250,250,250,0.10)] outline-none font-mono focus:border-aeon-red transition-colors placeholder:text-primary-35 cursor-target'

  return (
    <div className="max-w-5xl mx-auto pb-16 space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden border border-[rgba(250,250,250,0.10)] bg-aeon-panel">
        <div className="dither" aria-hidden="true" />
        <div className="relative z-10 px-8 pt-10 pb-8">
          <span className="text-[11px] font-mono uppercase tracking-[0.28em] text-aeon-red inline-flex items-center gap-3">
            <span className="w-7 h-px bg-aeon-red" />
            Identity · Voice
          </span>
          <h1 className="mt-4 font-display uppercase leading-[0.92] tracking-tight text-aeon-fg"
              style={{ fontSize: 'clamp(40px, 6.5vw, 88px)' }}>
            <Scramble text="SOUL" />
            <span className="text-aeon-red">.MD</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm text-primary-70 leading-relaxed">
            Who Aeon speaks as. Every content skill reads{' '}
            <span className="font-mono text-primary-100">soul/SOUL.md</span> and{' '}
            <span className="font-mono text-primary-100">soul/STYLE.md</span> to match your voice.
            Build it from your handle, name, or links — start from a template, or write it by hand.
          </p>
        </div>
      </section>

      {/* Build my soul */}
      <section className="border border-[rgba(250,250,250,0.10)] bg-aeon-panel p-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="font-display text-[13px] tracking-[0.18em] text-aeon-red">BUILD MY SOUL</span>
          <span className="flex-1 h-px bg-[rgba(250,250,250,0.10)]" />
        </div>
        <p className="text-[12px] text-primary-50 font-mono leading-relaxed mb-4">
          <span className="text-primary-80">Every field is optional — give just one, or stack all three.</span>{' '}
          The <span className="text-primary-80">soul-builder</span> agent reads whatever you provide, then drafts
          SOUL.md, STYLE.md and voice examples — committed straight to <span className="text-primary-80">soul/</span>.
          More signal → sharper soul.
        </p>

        <div className="grid sm:grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-primary-40">X / Twitter handle</span>
            <div className="flex items-center bg-aeon-bg border border-[rgba(250,250,250,0.10)] focus-within:border-aeon-red transition-colors">
              <span className="pl-3 text-primary-40 font-mono text-[13px] select-none">@</span>
              <input
                type="text" value={handle} onChange={(e) => setHandle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') build() }}
                placeholder="handle" spellCheck={false}
                className="bg-transparent text-aeon-fg text-[13px] px-2 py-2.5 outline-none font-mono w-full placeholder:text-primary-35 cursor-target"
              />
            </div>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-primary-40">Full name <span className="text-primary-30">· web search</span></span>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') build() }}
              placeholder="Jane Doe — founder of …" spellCheck={false}
              className={`${inputCls} w-full`}
            />
          </label>

          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-primary-40">Links <span className="text-primary-30">· LinkedIn, website, blog, Substack, GitHub — comma separated</span></span>
            <input
              type="text" value={links} onChange={(e) => setLinks(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') build() }}
              placeholder="linkedin.com/in/jane, janedoe.com, jane.substack.com" spellCheck={false}
              className={`${inputCls} w-full`}
            />
          </label>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={build} disabled={!canBuild}
            className="bg-aeon-red text-white text-[11px] font-mono uppercase tracking-[0.14em] px-5 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-40 cursor-target"
          >
            {building ? 'Dispatching…' : 'Build my soul'}
          </button>
          <span className="text-[10px] text-primary-35 font-mono">Any one field is enough — all optional.</span>
        </div>

        <p className="mt-3 text-[11px] text-primary-35 font-mono leading-relaxed">
          Runs as a GitHub Action — watch the feed for <span className="text-primary-70">soul-builder</span>, then hit{' '}
          <span className="text-primary-70">Pull</span> in the top bar to load the result. X reads are richest with{' '}
          <span className="text-primary-70">XAI_API_KEY</span> set; name + links use web search and work without it.
        </p>
      </section>

      {/* Editor */}
      <section className="border-t border-[rgba(250,250,250,0.10)] pt-6">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {/* File switcher */}
          <div className="flex">
            {([['soul', 'SOUL.md'], ['style', 'STYLE.md']] as [SoulFile, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActive(key)}
                className={`font-display text-[13px] tracking-[0.18em] px-3 py-1 border transition-colors ${
                  active === key
                    ? 'text-aeon-red border-aeon-red bg-aeon-red/10'
                    : 'text-primary-40 border-[rgba(250,250,250,0.12)] hover:text-primary-70'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="flex-1 h-px bg-[rgba(250,250,250,0.10)]" />
          {blank
            ? <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-eva-orange">empty</span>
            : <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-eva-green">configured</span>}
          <button
            onClick={() => setShowTemplates(v => !v)}
            className="text-[10px] font-mono uppercase tracking-[0.14em] px-2 py-1 border border-[rgba(250,250,250,0.12)] text-primary-50 hover:text-primary-100 hover:border-[rgba(250,250,250,0.22)] transition-colors cursor-target"
          >
            {showTemplates ? 'Close' : 'Templates'}
          </button>
        </div>

        {/* Template picker — two per row */}
        {showTemplates && (
          <div className="mb-4 border border-[rgba(250,250,250,0.10)] bg-aeon-panel p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] text-primary-50 font-mono">
                Start from a scaffold, or an archetype that shows the shape of a good {active === 'soul' ? 'SOUL.md' : 'STYLE.md'}.
                Replaces the current editor content.
              </p>
              <a
                href={EXAMPLES_URL} target="_blank" rel="noopener noreferrer"
                className="shrink-0 text-[10px] font-mono uppercase tracking-[0.14em] text-primary-50 hover:text-aeon-red transition-colors cursor-target whitespace-nowrap"
              >
                Real examples ↗
              </a>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => applyTemplate(scaffold)}
                className="text-left border border-[rgba(250,250,250,0.12)] hover:border-aeon-red px-3 py-2.5 transition-colors cursor-target"
              >
                <div className="text-[12px] text-primary-100 font-medium">Blank scaffold</div>
                <div className="text-[10px] text-primary-40 font-mono">Guided headings, no content</div>
              </button>
              {ARCHETYPES.map(a => (
                <button
                  key={a.key}
                  onClick={() => applyArchetype(a.key)}
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
              rows={26}
              placeholder={active === 'soul' ? SOUL_SCAFFOLD : STYLE_SCAFFOLD}
              className="w-full bg-aeon-bg text-aeon-fg text-[13px] leading-relaxed px-4 py-3 border border-[rgba(250,250,250,0.10)] outline-none font-mono focus:border-aeon-red transition-colors resize-y"
            />
            <div className="flex items-center justify-between mt-3">
              <span className={`text-[11px] font-mono ${overLimit ? 'text-eva-orange' : 'text-primary-35'}`}>
                {chars} chars{overLimit ? ` · over ~${SOFT_LIMIT}, this rides along in voice-matched runs` : ''}
              </span>
              <div className="flex items-center gap-2">
                {dirty && (
                  <button onClick={() => setDraft(content)}
                    className="text-[11px] text-primary-40 font-mono px-2 py-2 hover:text-primary-70 transition-colors">
                    Revert
                  </button>
                )}
                <button onClick={() => onSave(active, draft)} disabled={!dirty || saving}
                  className="bg-eva-green text-white text-[11px] px-4 py-2 font-mono hover:opacity-90 transition-opacity disabled:opacity-40 cursor-target">
                  {saving ? 'Saving…' : `Save ${active === 'soul' ? 'SOUL.md' : 'STYLE.md'}`}
                </button>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-primary-35 font-mono">
              Save writes <span className="text-primary-70">soul/{active === 'soul' ? 'SOUL.md' : 'STYLE.md'}</span> — then hit{' '}
              <span className="text-primary-70">Push</span> in the top bar to commit it to GitHub.
            </p>
          </>
        )}
      </section>
    </div>
  )
}
