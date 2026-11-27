'use client'

import { useState, useRef } from 'react'
import type { UploadFile } from '../lib/types'
import { slugify } from '../lib/utils'
import { cn } from '@/lib/cn'
import { CATEGORIES } from '../lib/constants'
import { GlassModal } from './glass/connect/modal'
import { ActionButton, Field, PrimaryButton, Select } from './glass/connect/ui'
import { HINT } from './glass/connect/forms'

interface ImportModalProps {
  onClose: () => void
  onImport: (files: UploadFile[], name?: string, category?: string) => Promise<void>
}

// Categories an imported skill can be filed into. `core`, `evolution`, and
// `basics` are the curated default-visible packs - imported community skills
// don't land there.
const CURATED_PACKS = new Set(['core', 'evolution', 'basics'])
const PACK_CATEGORIES = CATEGORIES.filter(c => !CURATED_PACKS.has(c.key))

export function ImportModal({ onClose, onImport }: ImportModalProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
  const [uploadDragOver, setUploadDragOver] = useState(false)
  const [uploadName, setUploadName] = useState('')
  const [uploadCategory, setUploadCategory] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const readFilesFromInput = async (fl: FileList) => {
    const files: UploadFile[] = []
    for (let i = 0; i < fl.length; i++) {
      const f = fl[i]
      files.push({ path: f.webkitRelativePath || f.name, content: await f.text() })
    }
    setUploadFiles(files)
    const sf = files.find(f => {
      const l = f.path.toLowerCase()
      return l === 'skill.md' || l.endsWith('/skill.md') || l.endsWith('.skill')
    })
    if (sf) {
      const fm = sf.content.match(/^---\s*\n([\s\S]*?)\n---/)
      if (fm) {
        const n = fm[1].match(/name:\s*(.+)/)
        if (n) {
          const slug = slugify(n[1].trim().replace(/^['"]|['"]$/g, ''))
          if (slug) setUploadName(slug)
        }
      }
    }
  }

  const handleUpload = async () => {
    if (!uploadFiles.length) return
    setImportLoading(true)
    try {
      await onImport(uploadFiles, uploadName || undefined, uploadCategory || undefined)
      onClose()
    } finally {
      setImportLoading(false)
    }
  }

  return (
    <GlassModal title="Add a skill" onClose={onClose} width="max-w-md">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={e => e.target.files && readFilesFromInput(e.target.files)}
      />
      <input
        ref={el => {
          if (el) el.setAttribute('webkitdirectory', '')
        }}
        type="file"
        className="hidden"
        id="folder-input"
        onChange={e => e.target.files && readFilesFromInput(e.target.files)}
      />
      <div
        onDragOver={e => {
          e.preventDefault()
          setUploadDragOver(true)
        }}
        onDragLeave={() => setUploadDragOver(false)}
        onDrop={e => {
          e.preventDefault()
          setUploadDragOver(false)
          if (e.dataTransfer.files.length > 0) readFilesFromInput(e.dataTransfer.files)
        }}
        className={cn(
          'rounded-[22px] border-[1.5px] border-dashed px-6 py-9 text-center transition-[background-color,border-color] duration-150',
          uploadDragOver
            ? 'border-[var(--foreground)] bg-[var(--hover)]'
            : 'border-[oklch(0.3_0.015_240/0.28)] bg-[rgb(255_255_255/0.45)]',
        )}
      >
        {!uploadFiles.length ? (
          <>
            <p className="font-display text-[1.25rem] leading-[1.25] font-light tracking-[-0.015em]">
              Drop a skill folder here
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <ActionButton onClick={() => fileInputRef.current?.click()}>Files</ActionButton>
              <ActionButton onClick={() => document.getElementById('folder-input')?.click()}>Folder</ActionButton>
            </div>
            <p className={cn(HINT, 'mt-3')}>Must include SKILL.md</p>
          </>
        ) : (
          <>
            <p className="font-display text-[1.25rem] leading-[1.25] font-light tracking-[-0.015em]">
              {uploadFiles.length} file{uploadFiles.length !== 1 ? 's' : ''} ready
            </p>
            <ActionButton
              onClick={() => {
                setUploadFiles([])
                setUploadName('')
              }}
              className="mt-3"
            >
              Clear
            </ActionButton>
          </>
        )}
      </div>
      {uploadFiles.length > 0 && (
        <div className="mt-6 space-y-4">
          <Field
            label="Skill name"
            value={uploadName}
            onChange={e => setUploadName(e.target.value)}
            placeholder="skill-name"
            spellCheck={false}
            autoComplete="off"
            inputClassName="font-mono"
          />
          <Select
            label="Pack"
            value={uploadCategory}
            onChange={e => setUploadCategory(e.target.value)}
            title="Pack the skill joins"
          >
            <option value="">Automatic (Lab until sorted)</option>
            {PACK_CATEGORIES.map(c => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </Select>
          <PrimaryButton onClick={handleUpload} disabled={importLoading} className="w-full">
            {importLoading ? 'Adding' : 'Add skill'}
          </PrimaryButton>
        </div>
      )}
    </GlassModal>
  )
}
