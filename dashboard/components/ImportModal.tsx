'use client'

import { useState, useRef } from 'react'
import type { UploadFile } from '../lib/types'
import { displayName } from '../lib/utils'
import { inputCls } from '../lib/utils'

interface ImportModalProps {
  onClose: () => void
  onImport: (files: UploadFile[], name?: string) => Promise<void>
}

export function ImportModal({ onClose, onImport }: ImportModalProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
  const [uploadDragOver, setUploadDragOver] = useState(false)
  const [uploadName, setUploadName] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const readFilesFromInput = async (fl: FileList) => {
    const files: UploadFile[] = []
    for (let i = 0; i < fl.length; i++) {
      const f = fl[i]
      files.push({ path: (f as { webkitRelativePath?: string }).webkitRelativePath || f.name, content: await f.text() })
    }
    setUploadFiles(files)
    const sf = files.find(f => { const l = f.path.toLowerCase(); return l === 'skill.md' || l.endsWith('/skill.md') || l.endsWith('.skill') })
    if (sf) {
      const fm = sf.content.match(/^---\s*\n([\s\S]*?)\n---/)
      if (fm) { const n = fm[1].match(/name:\s*(.+)/); if (n) { const slug = n[1].trim().replace(/^['"]|['"]$/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); if (slug) setUploadName(slug) } }
    }
  }

  const handleUpload = async () => {
    if (!uploadFiles.length) return
    setImportLoading(true)
    try {
      await onImport(uploadFiles, uploadName || undefined)
      onClose()
    } finally {
      setImportLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white border-2 border-[rgba(10,10,10,0.08)] w-full max-w-md mx-4 p-[var(--space-lg)] shadow-2xl">
        <div className="flex items-center justify-between mb-[var(--space-md)]">
          <h2 className="font-display text-xl">Hire New Member</h2>
          <button onClick={onClose} className="text-primary-35 hover:text-primary-100 text-lg">&times;</button>
        </div>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && readFilesFromInput(e.target.files)} />
        <input ref={(el) => { if (el) el.setAttribute('webkitdirectory', '') }} type="file" className="hidden" id="folder-input" onChange={(e) => e.target.files && readFilesFromInput(e.target.files)} />
        <div onDragOver={(e) => { e.preventDefault(); setUploadDragOver(true) }} onDragLeave={() => setUploadDragOver(false)} onDrop={(e) => { e.preventDefault(); setUploadDragOver(false); if (e.dataTransfer.files.length > 0) readFilesFromInput(e.dataTransfer.files) }}
          className={`border-2 border-dashed p-8 text-center transition-colors ${uploadDragOver ? 'border-eva-orange bg-orange-50' : 'border-[rgba(10,10,10,0.12)] hover:border-[rgba(10,10,10,0.2)]'}`}>
          {!uploadFiles.length ? (<><div className="text-sm text-primary-50 font-display mb-3">Drop a skill folder here</div><div className="flex gap-2 justify-center"><button onClick={() => fileInputRef.current?.click()} className="bg-eva-gray text-primary-70 text-[11px] px-3 py-1.5 font-mono border-2 border-[rgba(10,10,10,0.08)] hover:border-[rgba(10,10,10,0.2)] transition-colors">Files</button><button onClick={() => document.getElementById('folder-input')?.click()} className="bg-eva-gray text-primary-70 text-[11px] px-3 py-1.5 font-mono border-2 border-[rgba(10,10,10,0.08)] hover:border-[rgba(10,10,10,0.2)] transition-colors">Folder</button></div><div className="text-[11px] text-primary-35 font-mono mt-3">Must include SKILL.md</div></>) : (<><div className="text-sm text-primary-70 font-display">{uploadFiles.length} file{uploadFiles.length !== 1 ? 's' : ''}</div><button onClick={() => { setUploadFiles([]); setUploadName('') }} className="text-[11px] text-primary-40 font-mono hover:text-eva-orange mt-2 transition-colors">Clear</button></>)}
        </div>
        {uploadFiles.length > 0 && (
          <div className="mt-[var(--space-md)] space-y-3">
            <input type="text" value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="team-member-name" className={inputCls} />
            <button onClick={handleUpload} disabled={importLoading} className="w-full bg-eva-black text-white text-sm py-3 font-mono uppercase tracking-[2px] hover:opacity-90 transition-opacity disabled:opacity-50">{importLoading ? 'Hiring...' : 'Add to Team'}</button>
          </div>
        )}
      </div>
    </div>
  )
}
