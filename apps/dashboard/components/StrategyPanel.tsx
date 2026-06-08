'use client'

import { useState, useEffect } from 'react'
import { Scramble } from './ui/Animated'

interface StrategyPanelProps {
  content: string
  loading: boolean
  saving: boolean
  onSave: (content: string) => void
}

// It's imported into CLAUDE.md and rides along in every skill run, so flag when
// it's getting long enough to cost real tokens each time.
const SOFT_LIMIT = 2500

export function StrategyPanel({ content, loading, saving, onSave }: StrategyPanelProps) {
  const [draft, setDraft] = useState(content)
  useEffect(() => { setDraft(content) }, [content])

  const dirty = draft !== content
  const chars = draft.length
  const overLimit = chars > SOFT_LIMIT
  const unconfigured = /^> \*\*Status:\*\* unconfigured defaults/m.test(draft)

  return (
    <div className="max-w-5xl mx-auto pb-16 space-y-8">
      <section className="relative overflow-hidden border border-[rgba(250,250,250,0.10)] bg-aeon-panel">
        <div className="dither" aria-hidden="true" />
        <div className="relative z-10 px-8 pt-10 pb-8">
          <span className="text-[11px] font-mono uppercase tracking-[0.28em] text-aeon-red inline-flex items-center gap-3">
            <span className="w-7 h-px bg-aeon-red" />
            Direction · North Star
          </span>
          <h1 className="mt-4 font-display uppercase leading-[0.92] tracking-tight text-aeon-fg"
              style={{ fontSize: 'clamp(40px, 6.5vw, 88px)' }}>
            <Scramble text="STRA" />
            <span className="text-aeon-red"><Scramble text="TEGY" delay={160} /></span>
          </h1>
          <p className="mt-4 max-w-xl text-sm text-primary-70 leading-relaxed">
            One file every skill reads. It&apos;s imported into{' '}
            <span className="font-mono text-primary-100">CLAUDE.md</span>, so it sits in the context of
            every run — keep it tight: a north-star, a few priorities, the hard constraints.
          </p>
        </div>
      </section>

      <section className="border-t border-[rgba(250,250,250,0.10)] pt-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="font-display text-[13px] tracking-[0.18em] text-aeon-red">01 / STRATEGY.md</span>
          <span className="flex-1 h-px bg-[rgba(250,250,250,0.10)]" />
          {unconfigured
            ? <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-eva-orange">template defaults</span>
            : <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-eva-green">customized</span>}
        </div>

        {loading ? (
          <div className="text-xs font-mono text-primary-40 py-8">Loading…</div>
        ) : (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              rows={24}
              placeholder={'# Strategy\n\n## North-star metric\n…'}
              className="w-full bg-aeon-bg text-aeon-fg text-[13px] leading-relaxed px-4 py-3 border border-[rgba(250,250,250,0.10)] outline-none font-mono focus:border-aeon-red transition-colors resize-y"
            />
            <div className="flex items-center justify-between mt-3">
              <span className={`text-[11px] font-mono ${overLimit ? 'text-eva-orange' : 'text-primary-35'}`}>
                {chars} chars{overLimit ? ` · over ~${SOFT_LIMIT}, trim it — this loads every run` : ''}
              </span>
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
            <p className="mt-3 text-[11px] text-primary-35 font-mono">
              Save writes STRATEGY.md — then hit <span className="text-primary-70">Push</span> in the top bar to commit it to GitHub.
            </p>
          </>
        )}
      </section>
    </div>
  )
}
