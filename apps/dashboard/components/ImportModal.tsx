'use client'

import { useState, useRef } from 'react'
import type { UploadFile } from '../lib/types'
import { inputCls, slugify } from '../lib/utils'
import { CATEGORIES } from '../lib/constants'

interface ImportModalProps {
  onClose: () => void
  onImport: (files: UploadFile[], name?: string, category?: string) => Promise<void>
}

// Categories an imported skill can be filed into. `core`, `evolution`, and
// `basics` are the curated default-visible packs — imported community skills
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
    const sf = files.find(f => { const l = f.path.toLowerCase(); return l === 'skill.md' || l.endsWith('/skill.md') || l.endsWith('.skill') })
    if (sf) {
      const fm = sf.content.match(/^---\s*\n([\s\S]*?)\n---/)
      if (fm) { const n = fm[1].match(/name:\s*(.+)/); if (n) { const slug = slugify(n[1].trim().replace(/^['"]|['"]$/g, '')); if (slug) setUploadName(slug) } }
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
    <div onClick={onClose} className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} className="bg-aeon-panel border border-[rgba(250,250,250,0.10)] w-full max-w-md mx-4 p-[var(--space-lg)] shadow-2xl">
        <div className="flex items-center justify-between mb-[var(--space-md)]">
          <h2 className="font-display text-xl">Hire New Member</h2>
          <button onClick={onClose} className="text-primary-35 hover:text-primary-100 text-lg">&times;</button>
        </div>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && readFilesFromInput(e.target.files)} />
        <input ref={(el) => { if (el) el.setAttribute('webkitdirectory', '') }} type="file" className="hidden" id="folder-input" onChange={(e) => e.target.files && readFilesFromInput(e.target.files)} />
        <div onDragOver={(e) => { e.preventDefault(); setUploadDragOver(true) }} onDragLeave={() => setUploadDragOver(false)} onDrop={(e) => { e.preventDefault(); setUploadDragOver(false); if (e.dataTransfer.files.length > 0) readFilesFromInput(e.dataTransfer.files) }}
          className={`border-2 border-dashed p-8 text-center transition-colors ${uploadDragOver ? 'border-eva-orange bg-aeon-red/10' : 'border-[rgba(250,250,250,0.12)] hover:border-[rgba(250,250,250,0.2)]'}`}>
          {!uploadFiles.length ? (<><div className="text-sm text-primary-50 font-display mb-3">Drop a skill folder here</div><div className="flex gap-2 justify-center"><button onClick={() => fileInputRef.current?.click()} className="bg-aeon-bg text-primary-70 text-[11px] px-3 py-1.5 font-mono border border-[rgba(250,250,250,0.10)] hover:border-[rgba(250,250,250,0.2)] transition-colors">Files</button><button onClick={() => document.getElementById('folder-input')?.click()} className="bg-aeon-bg text-primary-70 text-[11px] px-3 py-1.5 font-mono border border-[rgba(250,250,250,0.10)] hover:border-[rgba(250,250,250,0.2)] transition-colors">Folder</button></div><div className="text-[11px] text-primary-35 font-mono mt-3">Must include SKILL.md</div></>) : (<><div className="text-sm text-primary-70 font-display">{uploadFiles.length} file{uploadFiles.length !== 1 ? 's' : ''}</div><button onClick={() => { setUploadFiles([]); setUploadName('') }} className="btn-mini mt-2">Clear</button></>)}
        </div>
        {uploadFiles.length > 0 && (
          <div className="mt-[var(--space-md)] space-y-3">
            <input type="text" value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="team-member-name" className={inputCls} />
            <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)} className={inputCls} title="Pack the skill joins">
              <option value="">Pack - auto (Lab until sorted)</option>
              {PACK_CATEGORIES.map(c => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
            <button onClick={handleUpload} disabled={importLoading} className="w-full bg-aeon-fg text-aeon-bg text-sm py-3 font-mono uppercase tracking-[2px] hover:opacity-90 transition-opacity disabled:opacity-50">{importLoading ? 'Hiring...' : 'Add to Team'}</button>
          </div>
        )}
      </div>
    </div>
  )
}
