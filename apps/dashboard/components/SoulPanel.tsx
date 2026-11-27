'use client'

import { useState, useEffect } from 'react'
import { SOUL_SCAFFOLD, STYLE_SCAFFOLD, ARCHETYPES } from '../lib/soul-templates'
import { cn } from '@/lib/cn'
import {
  ActionButton,
  CARD,
  Field,
  Loading,
  PageHeader,
  PanelHeader,
  PrimaryButton,
  SMALL_LABEL,
  TAG,
  TAG_ATTN,
  TAG_INK,
} from './glass/connect/ui'
import { EDITOR, ExternalLink, HINT, INLINE_CODE, SegmentedChoice, TemplateCard } from './glass/connect/forms'
import type { SoulSources, SoulExample, SoulExamplesResponse } from '../lib/types'
import { withBase } from '@/lib/base-path'

export type SoulFile = 'soul' | 'style'
export type { SoulSources }

interface SoulPanelProps {
  soul: string
  style: string
  loading: boolean
  saving: boolean
  building: boolean
  installing: string | null
  onSave: (file: SoulFile, content: string) => void
  onBuild: (sources: SoulSources) => void
  onInstallExample: (key: string) => void
}

const EXAMPLES_URL = 'https://github.com/aeonfun/soul.md/tree/main/examples'

// The examples route sends a local picture (public/souls) for known souls; unknown ones get initials.
function avatarFor(ex: SoulExample): string | undefined {
  return ex.avatar
}

// Strip HTML comments, headings and whitespace - what's left is real authored
// content. Empty means still the scaffold, so badge it "template".
function isBlank(md: string): boolean {
  return (
    md
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/^#.*$/gm, '')
      .replace(/^[-*]\s*$/gm, '')
      .trim().length === 0
  )
}

export function SoulPanel({
  soul,
  style,
  loading,
  saving,
  building,
  installing,
  onSave,
  onBuild,
  onInstallExample,
}: SoulPanelProps) {
  const [active, setActive] = useState<SoulFile>('soul')
  const [soulDraft, setSoulDraft] = useState(soul)
  const [styleDraft, setStyleDraft] = useState(style)
  const [handle, setHandle] = useState('')
  const [name, setName] = useState('')
  const [links, setLinks] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)
  const [examples, setExamples] = useState<SoulExample[]>([])

  useEffect(() => {
    setSoulDraft(soul)
  }, [soul])
  useEffect(() => {
    setStyleDraft(style)
  }, [style])
  // Ready-made souls from the soul.md gallery - installable into soul/ in one click.
  useEffect(() => {
    fetch(withBase('/api/soul/examples'))
      .then(r => (r.ok ? (r.json() as Promise<SoulExamplesResponse>) : { examples: [] }))
      .then(d => setExamples(d.examples || []))
      .catch(() => {})
  }, [])

  const installExample = (ex: SoulExample) => {
    if (installing) return
    if (!window.confirm(`Install ${ex.label}'s soul? This overwrites soul/SOUL.md and soul/STYLE.md on your repo.`))
      return
    onInstallExample(ex.key)
  }

  const content = active === 'soul' ? soul : style
  const draft = active === 'soul' ? soulDraft : styleDraft
  const setDraft = active === 'soul' ? setSoulDraft : setStyleDraft
  const scaffold = active === 'soul' ? SOUL_SCAFFOLD : STYLE_SCAFFOLD

  const dirty = draft !== content
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

  const cleanHandle = handle
    .trim()
    .replace(/^@/, '')
    .replace(/^https?:\/\/(x|twitter)\.com\//i, '')
    .replace(/\/.*$/, '')
  const canBuild = (cleanHandle.length > 0 || name.trim().length > 0 || links.trim().length > 0) && !building
  const build = () => {
    if (canBuild) onBuild({ handle: cleanHandle, name: name.trim(), links: links.trim() })
  }

  return (
    <div className="space-y-[clamp(36px,4vw,56px)] pb-4">
      <PageHeader
        title="Soul"
        sub={
          <>
            Who Aeon speaks as. Every content skill reads <code className={INLINE_CODE}>soul/SOUL.md</code> and{' '}
            <code className={INLINE_CODE}>soul/STYLE.md</code> to match your voice.
          </>
        }
      />

      {/* Build my soul */}
      <section aria-labelledby="soul-build">
        <PanelHeader title={<span id="soul-build">Build my soul</span>} />
        <div className={cn(CARD, 'mt-3 px-4 py-5 sm:px-7 sm:py-7')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="X handle"
              icon={<span className="font-mono text-[15px] leading-none">@</span>}
              value={handle}
              onChange={e => setHandle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') build()
              }}
              placeholder="handle"
              spellCheck={false}
              autoComplete="off"
            />
            <Field
              label="Full name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') build()
              }}
              placeholder="Jane Doe, founder of ..."
              spellCheck={false}
            />
            <Field
              label="Links, comma separated"
              className="sm:col-span-2"
              value={links}
              onChange={e => setLinks(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') build()
              }}
              placeholder="linkedin.com/in/jane, janedoe.com, jane.substack.com"
              spellCheck={false}
            />
            <p className={cn(HINT, '-mt-2 sm:col-span-2')}>LinkedIn, website, blog, Substack, GitHub.</p>
          </div>

          <div className="mt-6 flex justify-end">
            <PrimaryButton onClick={build} disabled={!canBuild}>
              {building ? 'Starting' : 'Build'}
            </PrimaryButton>
          </div>
        </div>
      </section>

      {/* Editor */}
      <section aria-labelledby="soul-file">
        <h2 id="soul-file" className="sr-only">
          Soul files
        </h2>
        <div className="flex min-h-10 flex-wrap items-center gap-3">
          {/* File switcher */}
          <SegmentedChoice
            label="File"
            value={active}
            options={
              [
                { id: 'soul', label: 'SOUL.md' },
                { id: 'style', label: 'STYLE.md' },
              ] as const
            }
            onChange={setActive}
            className="flex-nowrap"
            chipClassName="normal-case tracking-normal text-[13px]"
          />
          {blank ? <span className={cn(TAG, TAG_ATTN)}>Empty</span> : <span className={cn(TAG, TAG_INK)}>Written</span>}
          <ActionButton
            onClick={() => setShowTemplates(v => !v)}
            aria-expanded={showTemplates}
            aria-controls="soul-templates"
            className="ml-auto"
          >
            {showTemplates ? 'Close templates' : 'Templates'}
          </ActionButton>
        </div>

        {/* Template picker - two per row */}
        {showTemplates && (
          <div
            id="soul-templates"
            className="mt-3 rounded-[22px] bg-[rgb(255_255_255/0.45)] p-4 shadow-[inset_0_0_0_1px_var(--line)] sm:p-5"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <p className={cn(HINT, 'max-w-[78ch]')}>
                Start from a scaffold, or an archetype that shows the shape of a good{' '}
                {active === 'soul' ? 'SOUL.md' : 'STYLE.md'}. It replaces what is in the editor.
              </p>
              <span className={cn(HINT, 'shrink-0')}>
                <ExternalLink href={EXAMPLES_URL}>Real examples</ExternalLink>
              </span>
            </div>
            <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <li className="flex">
                <TemplateCard
                  title="Blank scaffold"
                  blurb="Guided headings, no content"
                  onPick={() => applyTemplate(scaffold)}
                />
              </li>
              {ARCHETYPES.map(a => (
                <li key={a.key} className="flex">
                  <TemplateCard title={a.label} blurb={a.blurb} onPick={() => applyArchetype(a.key)} />
                </li>
              ))}
            </ul>

            {/* Install a ready-made real soul straight into the repo */}
            {examples.length > 0 && (
              <div className="mt-5 border-t border-[var(--line)] pt-5">
                <p className={SMALL_LABEL}>Install a real soul</p>
                <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {examples.map(ex => {
                    const avatar = avatarFor(ex)
                    return (
                      <li key={ex.key} className="g-chip flex items-center gap-3 rounded-[18px] py-3 pr-3 pl-3">
                        {avatar ? (
                          <img
                            src={withBase(avatar)}
                            alt=""
                            width={44}
                            height={44}
                            loading="lazy"
                            className="size-11 shrink-0 rounded-full object-cover shadow-[0_0_0_1px_oklch(0.3_0.015_240/0.12)]"
                          />
                        ) : (
                          <span
                            aria-hidden
                            className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--hover)] font-mono text-[12px] font-semibold text-muted-foreground"
                          >
                            {ex.label.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[15px] font-medium">{ex.label}</div>
                          {ex.blurb && <p className="text-[13.5px] leading-[1.45] text-muted-foreground">{ex.blurb}</p>}
                        </div>
                        <ActionButton
                          onClick={() => installExample(ex)}
                          disabled={!!installing}
                          aria-label={`Install ${ex.label}'s soul`}
                          className="shrink-0"
                        >
                          {installing === ex.key ? 'Installing' : 'Install'}
                        </ActionButton>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <Loading />
        ) : (
          <>
            <label htmlFor="soul-editor" className="sr-only">
              {active === 'soul' ? 'SOUL.md' : 'STYLE.md'}
            </label>
            <textarea
              id="soul-editor"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              spellCheck={false}
              rows={26}
              placeholder={active === 'soul' ? SOUL_SCAFFOLD : STYLE_SCAFFOLD}
              className={cn(EDITOR, 'mt-3')}
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              {dirty && <ActionButton onClick={() => setDraft(content)}>Revert</ActionButton>}
              <PrimaryButton onClick={() => onSave(active, draft)} disabled={!dirty || saving}>
                {saving ? 'Saving' : 'Save'}
              </PrimaryButton>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
