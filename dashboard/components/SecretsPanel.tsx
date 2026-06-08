'use client'

import { useState } from 'react'
import type { Secret } from '../lib/types'
import { inputCls } from '../lib/utils'
import { Scramble } from './ui/Animated'

interface SecretsPanelProps {
  secrets: Secret[]
  busy: Record<string, boolean>
  onSave: (name: string, value: string) => void
  onDelete: (name: string) => void
}

export function SecretsPanel({ secrets, busy, onSave, onDelete }: SecretsPanelProps) {
  const [editingSecret, setEditingSecret] = useState<string | null>(null)
  const [secretValue, setSecretValue] = useState('')
  const [addingSecret, setAddingSecret] = useState(false)
  const [newSecretName, setNewSecretName] = useState('')

  const handleSave = (name: string) => {
    if (!secretValue.trim()) return
    onSave(name, secretValue.trim())
    setEditingSecret(null)
    setSecretValue('')
    setAddingSecret(false)
    setNewSecretName('')
  }

  return (
    <div className="max-w-5xl mx-auto pb-16 space-y-10">
      <section className="relative overflow-hidden border border-[rgba(250,250,250,0.10)] bg-aeon-panel">
        <div className="dither" aria-hidden="true" />
        <div className="relative z-10 px-8 pt-10 pb-8">
          <span className="text-[11px] font-mono uppercase tracking-[0.28em] text-aeon-red inline-flex items-center gap-3">
            <span className="w-7 h-px bg-aeon-red" />
            Credentials · Vault
          </span>
          <h1 className="mt-4 font-display uppercase leading-[0.92] tracking-tight text-aeon-fg"
              style={{ fontSize: 'clamp(40px, 6.5vw, 88px)' }}>
            <Scramble text="ACCESS" />{' '}
            <span className="text-aeon-red"><Scramble text="KEYS" delay={180} /></span>
          </h1>
          <p className="mt-4 max-w-xl text-sm text-primary-70 leading-relaxed">
            Set a secret, the channel turns on. Unset secrets are silently skipped — every channel is opt-in.
          </p>
        </div>
      </section>

      {['Core', 'Telegram', 'Discord', 'Slack', 'Email', 'Skill Keys'].map((group, gi) => {
        const gs = secrets.filter(s => s.group === group); if (!gs.length) return null
        return (
          <section key={group} className="border-t border-[rgba(250,250,250,0.10)] pt-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="font-display text-[13px] tracking-[0.18em] text-aeon-red">
                {String(gi + 1).padStart(2, '0')} / {group}
              </span>
              <span className="flex-1 h-px bg-[rgba(250,250,250,0.10)]" />
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-primary-35">
                {gs.filter(s => s.isSet).length} / {gs.length} set
              </span>
            </div>
            <div className="border border-[rgba(250,250,250,0.10)] divide-y divide-[rgba(250,250,250,0.08)]">
              {gs.map(secret => (
                <div key={secret.name} className="px-[var(--space-md)] py-[var(--space-sm)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2"><span className="font-mono text-xs">{secret.name}</span><span className={`w-2 h-2 rounded-full ${secret.isSet ? 'bg-eva-green' : 'bg-[rgba(250,250,250,0.15)]'}`} /></div>
                      <div className="text-[11px] text-primary-40 font-mono">{secret.description}</div>
                    </div>
                    <div className="flex gap-1.5">
                      {!secret.isSet && editingSecret !== secret.name && <button onClick={() => { setEditingSecret(secret.name); setSecretValue('') }} className="text-[11px] text-primary-40 font-mono hover:text-eva-orange transition-colors px-2 py-1">Set</button>}
                      {secret.isSet && <button onClick={() => onDelete(secret.name)} disabled={!!busy[`sec-${secret.name}`]} className="text-[11px] text-eva-red/50 hover:text-eva-red font-mono px-2 py-1 transition-colors">Remove</button>}
                    </div>
                  </div>
                  {editingSecret === secret.name && (
                    <div className="flex gap-2 mt-2">
                      <input type="password" value={secretValue} onChange={(e) => setSecretValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSave(secret.name)} placeholder="paste value..." autoFocus className={inputCls} />
                      <button onClick={() => handleSave(secret.name)} disabled={!secretValue.trim()} className="bg-eva-green text-white text-[11px] px-4 py-2 font-mono hover:opacity-90 transition-opacity disabled:opacity-50">Save</button>
                      <button onClick={() => { setEditingSecret(null); setSecretValue('') }} className="text-[11px] text-primary-40 font-mono px-2 py-2 hover:text-primary-70">Cancel</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )
      })}
      <div>{addingSecret ? (<div className="space-y-2"><input type="text" value={newSecretName} onChange={(e) => setNewSecretName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))} placeholder="SECRET_NAME" autoFocus className={inputCls} />{newSecretName && <div className="flex gap-2"><input type="password" value={secretValue} onChange={(e) => setSecretValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSave(newSecretName)} placeholder="value..." className={inputCls} /><button onClick={() => handleSave(newSecretName)} disabled={!secretValue.trim()} className="bg-eva-green text-white text-[11px] px-4 py-2 font-mono hover:opacity-90 disabled:opacity-50">Save</button></div>}<button onClick={() => { setAddingSecret(false); setNewSecretName(''); setSecretValue('') }} className="text-[11px] text-primary-40 font-mono hover:text-primary-70">Cancel</button></div>) : <button onClick={() => setAddingSecret(true)} className="text-[11px] text-primary-40 font-mono hover:text-eva-orange transition-colors">+ Add Credential</button>}</div>
    </div>
  )
}
