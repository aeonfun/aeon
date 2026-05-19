'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Skill, Run, Secret, SkillOutput } from '../lib/types'
import { MODELS } from '../lib/constants'
import { displayName } from '../lib/utils'
import TargetCursor from '../components/ui/TargetCursor'
import { LoadingScreen } from '../components/LoadingScreen'
import { ErrorScreen } from '../components/ErrorScreen'
import { LeftSidebar } from '../components/LeftSidebar'
import { TopBar } from '../components/TopBar'
import { HQOverview } from '../components/HQOverview'
import { SkillDetail } from '../components/SkillDetail'
import { SecretsPanel } from '../components/SecretsPanel'
import { RightPanel } from '../components/RightPanel'
import { ImportModal } from '../components/ImportModal'
import { AuthModal } from '../components/AuthModal'

export default function Dashboard() {
  const [view, setView] = useState<'hq' | 'secrets'>('hq')
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null)

  const [skills, setSkills] = useState<Skill[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [secrets, setSecrets] = useState<Secret[]>([])
  const [model, setModel] = useState('claude-sonnet-4-6')
  const [gateway, setGateway] = useState<'direct' | 'bankr'>('direct')
  const [repo, setRepo] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [toast, setToast] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [behind, setBehind] = useState(0)
  const [feedKey, setFeedKey] = useState(0)

  const [outputs, setOutputs] = useState<SkillOutput[]>([])
  const [feedLoading, setFeedLoading] = useState(false)
  const [analyticsData, setAnalyticsData] = useState<{ skills: Array<{ name: string; total: number; success: number; failure: number; cancelled: number; inProgress: number; successRate: number; lastRun: string | null; lastConclusion: string | null; avgDurationMin: number | null; streak: number }>; insights: Array<{ type: 'warning' | 'info' | 'success'; message: string }>; summary: { totalRuns: number; totalSuccess: number; totalFailure: number; overallSuccessRate: number; uniqueSkills: number; periodDays: number } } | null>(null)

  const [showImport, setShowImport] = useState(false)
  const [authStatus, setAuthStatus] = useState<{ authenticated: boolean } | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // --- API ---
  const fetchData = useCallback(async () => {
    try { const [sr, rr, secr] = await Promise.all([fetch('/api/skills'), fetch('/api/runs'), fetch('/api/secrets')]); if (sr.ok) { const d = await sr.json(); setSkills(d.skills); if (d.model) setModel(d.model); if (d.gateway?.provider) setGateway(d.gateway.provider); if (d.repo) setRepo(d.repo) }; if (rr.ok) setRuns((await rr.json()).runs); if (secr.ok) { const d = await secr.json(); if (d.secrets) setSecrets(d.secrets) } } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to connect') } finally { setLoading(false) }
    try { const r = await fetch('/api/sync'); if (r.ok) { const d = await r.json(); setHasChanges(d.hasChanges); if (typeof d.behind === 'number') setBehind(d.behind) } } catch {}
    try { const r = await fetch('/api/auth'); if (r.ok) setAuthStatus(await r.json()) } catch {}
  }, [])
  const refreshRuns = useCallback(async () => { try { const r = await fetch('/api/runs'); if (r.ok) setRuns((await r.json()).runs) } catch {} }, [])
  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { const id = setInterval(refreshRuns, 10_000); return () => clearInterval(id) }, [refreshRuns])
  useEffect(() => { setFeedLoading(true); fetch('/api/outputs').then(r => r.ok ? r.json() : { outputs: [] }).then(d => setOutputs(d.outputs || [])).finally(() => setFeedLoading(false)) }, [feedKey])

  const toggleSkill = async (n: string, en: boolean) => { setBusy(b => ({ ...b, [n]: true })); try { const r = await fetch('/api/skills', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n, enabled: en }) }); if (r.ok) { setSkills(s => s.map(sk => sk.name === n ? { ...sk, enabled: en } : sk)); flash(`${displayName(n)} ${en ? 'on duty' : 'off duty'}`); setHasChanges(true) } } finally { setBusy(b => ({ ...b, [n]: false })) } }
  const runSkill = async (n: string, v?: string, sm?: string) => { setBusy(b => ({ ...b, [`r-${n}`]: true })); try { const r = await fetch(`/api/skills/${n}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ var: v || '', model: sm || model }) }); if (r.ok) { flash(`${displayName(n)} started`); for (const d of [2000, 5000, 10000]) setTimeout(refreshRuns, d) } else { const d = await r.json(); flash(d.error || 'Failed') } } finally { setBusy(b => ({ ...b, [`r-${n}`]: false })) } }
  const updateSchedule = async (n: string, s: string) => { try { const r = await fetch('/api/skills', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n, schedule: s }) }); if (r.ok) { setSkills(sk => sk.map(x => x.name === n ? { ...x, schedule: s } : x)); flash('Shift updated'); setHasChanges(true) } } catch {} }
  const updateVar = async (n: string, v: string) => { try { const r = await fetch('/api/skills', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n, var: v }) }); if (r.ok) { setSkills(s => s.map(x => x.name === n ? { ...x, var: v } : x)); flash('Brief updated'); setHasChanges(true) } } catch {} }
  const updateSkillModel = async (n: string, m: string) => { try { const r = await fetch('/api/skills', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n, skillModel: m }) }); if (r.ok) { setSkills(s => s.map(x => x.name === n ? { ...x, model: m } : x)); flash('Capability updated'); setHasChanges(true) } } catch {} }
  const updateModel = async (m: string) => { setModel(m); try { await fetch('/api/skills', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: m }) }); flash(`Default: ${MODELS.find(x => x.id === m)?.label}`); setHasChanges(true) } catch {} }
  const deleteSkill = async (n: string) => { setBusy(b => ({ ...b, [`d-${n}`]: true })); try { const r = await fetch('/api/skills', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n }) }); if (r.ok) { setSkills(s => s.filter(x => x.name !== n)); setSelectedSkill(null); flash(`${displayName(n)} removed`); setHasChanges(true) } } finally { setBusy(b => ({ ...b, [`d-${n}`]: false })) } }
  const syncToGithub = async () => { setSyncing(true); try { const r = await fetch('/api/sync', { method: 'POST' }); if (r.ok) { flash('Synced'); setHasChanges(false) } } finally { setSyncing(false) } }
  const pullFromGithub = async () => { setPulling(true); try { const r = await fetch('/api/outputs', { method: 'POST' }); if (r.ok) { flash('Pulled'); setFeedKey(k => k + 1); fetchData() } } finally { setPulling(false) } }
  const setupAuth = async (key?: string) => { setAuthLoading(true); try { const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(key ? { key } : {}) }); if (r.ok) { flash('Authenticated'); setAuthStatus({ authenticated: true }); setShowAuthModal(false); fetchData() } else { const d = await r.json().catch(() => ({} as { error?: string })); const msg = typeof d?.error === 'string' ? d.error : (key ? 'Auth failed' : 'Auto-setup failed'); if (!key) setShowAuthModal(true); flash(msg) } } finally { setAuthLoading(false) } }
  const saveSecret = async (n: string, value: string) => { setBusy(b => ({ ...b, [`sec-${n}`]: true })); try { const r = await fetch('/api/secrets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n, value }) }); if (r.ok) { setSecrets(s => { const e = s.some(x => x.name === n); if (e) return s.map(x => x.name === n ? { ...x, isSet: true } : x); return [...s, { name: n, group: 'Skill Keys', description: 'Custom', isSet: true }] }); flash(`${n} saved`) } } finally { setBusy(b => ({ ...b, [`sec-${n}`]: false })) } }
  const deleteSecret = async (n: string) => { setBusy(b => ({ ...b, [`sec-${n}`]: true })); try { const r = await fetch('/api/secrets', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n }) }); if (r.ok) { setSecrets(s => s.map(x => x.name === n ? { ...x, isSet: false } : x)); flash(`${n} removed`) } } finally { setBusy(b => ({ ...b, [`sec-${n}`]: false })) } }
  const importSkill = async (files: Array<{ path: string; content: string }>, name?: string) => { const r = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files, name }) }); if (r.ok) { const d = await r.json(); flash(`${displayName(d.name)} hired`); fetchData() } }

  // --- Derived ---
  const skill = selectedSkill ? skills.find(s => s.name === selectedSkill) || null : null
  const enabledCount = skills.filter(s => s.enabled).length
  const workingCount = runs.filter(r => r.status === 'in_progress').length

  if (loading) return <LoadingScreen />
  if (error) return <ErrorScreen error={error} />

  return (
    <div className="h-screen flex bg-eva-white text-eva-black bg-grid">
      <TargetCursor />
      {toast && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-eva-black text-white px-5 py-2.5 text-xs font-mono tracking-wide shadow-xl">{toast}</div>}

      <LeftSidebar
        view={view} setView={(v) => { setView(v); setSelectedSkill(null) }}
        selectedSkill={selectedSkill} setSelectedSkill={setSelectedSkill}
        skills={skills} runs={runs} repo={repo}
        enabledCount={enabledCount} workingCount={workingCount}
        onSkillSelect={(name) => { setSelectedSkill(name); setView('hq') }}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          skill={skill} view={view} repo={repo} model={model} gateway={gateway}
          authStatus={authStatus} authLoading={authLoading}
          pulling={pulling} syncing={syncing} hasChanges={hasChanges} behind={behind}
          onSetupAuth={() => setupAuth()} onUpdateModel={updateModel}
          onShowImport={() => setShowImport(true)} onPull={pullFromGithub} onSync={syncToGithub}
        />

        <div className="flex-1 overflow-y-auto p-[var(--space-lg)]">
          {view === 'secrets' && !selectedSkill && (
            <SecretsPanel secrets={secrets} busy={busy} onSave={saveSecret} onDelete={deleteSecret} />
          )}
          {view === 'hq' && !selectedSkill && (
            <HQOverview skills={skills} runs={runs} enabledCount={enabledCount} workingCount={workingCount} onViewRun={() => {}} />
          )}
          {skill && (
            <SkillDetail
              skill={skill} runs={runs} model={model} gateway={gateway} busy={busy}
              onToggle={toggleSkill} onRun={runSkill} onDelete={deleteSkill}
              onUpdateSchedule={updateSchedule} onUpdateVar={updateVar} onUpdateModel={updateSkillModel}
              onViewRun={() => {}}
            />
          )}
        </div>
      </div>

      <RightPanel
        runs={runs} outputs={outputs} feedLoading={feedLoading} analyticsData={analyticsData}
        onViewRun={() => {}}
        onRefresh={() => { fetchData(); setFeedKey(k => k + 1); setAnalyticsData(null) }}
        onFetchAnalytics={() => { if (!analyticsData) fetch('/api/analytics').then(r => r.ok ? r.json() : null).then(d => { if (d) setAnalyticsData(d) }) }}
      />

      {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={importSkill} />}
      {showAuthModal && <AuthModal loading={authLoading} onClose={() => setShowAuthModal(false)} onAuth={(key) => setupAuth(key)} />}
    </div>
  )
}
