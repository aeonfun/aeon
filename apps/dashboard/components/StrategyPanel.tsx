'use client'

import { useState, useEffect } from 'react'
import { STRATEGY_SCAFFOLD, ARCHETYPES } from '../lib/strategy-templates'
import { cn } from '@/lib/cn'
import {
  ActionButton,
  CARD,
  Field,
  LABEL,
  Loading,
  PageHeader,
  PanelHeader,
  PrimaryButton,
  TAG,
  TAG_ATTN,
  TAG_INK,
} from './glass/connect/ui'
import { EDITOR, HINT, INLINE_CODE, TemplateCard, TextArea } from './glass/connect/forms'
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

  useEffect(() => {
    setDraft(content)
  }, [content])

  const dirty = draft !== content
  const unconfigured = /^> \*\*Status:\*\* unconfigured defaults/m.test(draft)
  const blank =
    draft
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/^#.*$/gm, '')
      .replace(/^[-*\d.]+\s*$/gm, '')
      .trim().length === 0

  const applyTemplate = (next: string) => {
    if (!blank && !unconfigured && !window.confirm('Replace the current editor content with this template?')) return
    setDraft(next)
    setShowTemplates(false)
  }

  const canBuild = (goal.trim().length > 0 || repo.trim().length > 0 || links.trim().length > 0) && !building
  const build = () => {
    if (canBuild) onBuild({ goal: goal.trim(), repo: repo.trim(), links: links.trim() })
  }

  return (
    <div className="space-y-[clamp(36px,4vw,56px)] pb-4">
      <PageHeader
        title="Strategy"
        sub={
          <>
            One file every skill reads. It is imported into <code className={INLINE_CODE}>CLAUDE.md</code>, so it sits
            in the context of every run: keep it tight, with a north star, a few priorities and the hard limits.
          </>
        }
      />

      {/* Build my strategy */}
      <section aria-labelledby="strategy-build">
        <PanelHeader title={<span id="strategy-build">Build my strategy</span>} />
        <div className={cn(CARD, 'mt-3 px-4 py-5 sm:px-7 sm:py-7')}>
          <div className="space-y-4">
            <TextArea
              label="Goal or project"
              hint="What you are building and what winning looks like"
              value={goal}
              onChange={e => setGoal(e.target.value)}
              rows={3}
              textareaClassName="max-sm:min-h-[9rem]"
              spellCheck={false}
              placeholder="e.g. Growing my open-source agent framework. I want active contributors and a reputation for reliability, not just stars."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="GitHub repo (optional)"
                value={repo}
                onChange={e => setRepo(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') build()
                }}
                placeholder="owner/repo"
                spellCheck={false}
              />
              <Field
                label="Links, comma separated"
                value={links}
                onChange={e => setLinks(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') build()
                }}
                placeholder="yoursite.com, deck link"
                spellCheck={false}
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <PrimaryButton onClick={build} disabled={!canBuild}>
              {building ? 'Starting' : 'Build'}
            </PrimaryButton>
          </div>
        </div>
      </section>

      {/* Editor */}
      <section aria-labelledby="strategy-file">
        <div className="flex min-h-10 flex-wrap items-center gap-3">
          <h2 id="strategy-file" className={LABEL}>
            STRATEGY.md
          </h2>
          {unconfigured ? (
            <span className={cn(TAG, TAG_ATTN)}>Template defaults</span>
          ) : (
            <span className={cn(TAG, TAG_INK)}>Customized</span>
          )}
          <ActionButton
            onClick={() => setShowTemplates(v => !v)}
            aria-expanded={showTemplates}
            aria-controls="strategy-templates"
            className="ml-auto"
          >
            {showTemplates ? 'Close templates' : 'Templates'}
          </ActionButton>
        </div>

        {/* Template picker - two per row */}
        {showTemplates && (
          <div
            id="strategy-templates"
            className="mt-3 rounded-[22px] bg-[rgb(255_255_255/0.45)] p-4 shadow-[inset_0_0_0_1px_var(--line)] sm:p-5"
          >
            <p className={cn(HINT, 'max-w-[78ch]')}>
              Start from a scaffold, or an archetype that shows the shape of a sharp strategy. It replaces what is in
              the editor: edit the bracketed bits to make it yours.
            </p>
            <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <li className="flex">
                <TemplateCard
                  title="Blank scaffold"
                  blurb="Guided headings, no content"
                  onPick={() => applyTemplate(STRATEGY_SCAFFOLD)}
                />
              </li>
              {ARCHETYPES.map(a => (
                <li key={a.key} className="flex">
                  <TemplateCard title={a.label} blurb={a.blurb} onPick={() => applyTemplate(a.content)} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {loading ? (
          <Loading />
        ) : (
          <>
            <label htmlFor="strategy-editor" className="sr-only">
              STRATEGY.md
            </label>
            <textarea
              id="strategy-editor"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              spellCheck={false}
              rows={24}
              placeholder={STRATEGY_SCAFFOLD}
              className={cn(EDITOR, 'mt-3')}
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              {dirty && <ActionButton onClick={() => setDraft(content)}>Revert</ActionButton>}
              <PrimaryButton onClick={() => onSave(draft)} disabled={!dirty || saving}>
                {saving ? 'Saving' : 'Save'}
              </PrimaryButton>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
