'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  Skill, Run, Secret, SkillOutput, GatewayProvider, UploadFile, AnalyticsData,
  SkillsResponse, RunsResponse, SecretsResponse, SyncStatusResponse, McpResponse,
  OutputsResponse, StrategyResponse, SoulResponse, SyncResult, SoulExampleResponse,
  UploadResponse, ErrorResponse, PacksResponse,
} from '../lib/types'
import { postJson, putJson, patchJson, del, scheduleRunRefresh } from '../lib/api-client'
import { MODELS, AUTH_SECRETS, PACK_BY_KEY } from '../lib/constants'
import { displayName } from '../lib/utils'
import TargetCursor from '../components/ui/TargetCursor'
import { LoadingScreen } from '../components/LoadingScreen'
import { ErrorScreen } from '../components/ErrorScreen'
import { LeftSidebar } from '../components/LeftSidebar'
import { TopBar } from '../components/TopBar'
import { HQOverview } from '../components/HQOverview'
import { SkillDetail } from '../components/SkillDetail'
import { SecretsPanel } from '../components/SecretsPanel'
import { StrategyPanel, type StrategySources } from '../components/StrategyPanel'
import { SoulPanel, type SoulFile, type SoulSources } from '../components/SoulPanel'
import { McpPanel } from '../components/McpPanel'
import { PacksPanel } from '../components/PacksPanel'
import { RightPanel } from '../components/RightPanel'
import { ImportModal } from '../components/ImportModal'
import { AuthModal } from '../components/AuthModal'

export default function Dashboard() {
  const [view, setView] = useState<'hq' | 'packs' | 'secrets' | 'strategy' | 'mcp' | 'soul'>('hq')
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null)
  const [secretFocus, setSecretFocus] = useState<string | null>(null)
  // Shared with the sidebar's category chips - HQ category cards toggle it too.
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const mainScrollRef = useRef<HTMLDivElement>(null)

  const [skills, setSkills] = useState<Skill[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [secrets, setSecrets] = useState<Secret[]>([])
  const [model, setModel] = useState('claude-sonnet-4-6')
  const [gateway, setGateway] = useState<GatewayProvider>('auto')
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
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)

  const [packs, setPacks] = useState<PacksResponse | null>(null)
  const [packsLoaded, setPacksLoaded] = useState(false)
  // Which packs are *visible* across the dashboard. A pack is a visibility lens:
  // by default only Core shows everywhere; enabling a pack reveals its skills in
  // the sidebar + HQ. Pure client-side view preference - it never changes what
  // runs (that's the per-skill `enabled` toggle in aeon.yml). Persisted below.
  const [enabledPacks, setEnabledPacks] = useState<string[]>(['core'])

  const [showImport, setShowImport] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)

  const [strategy, setStrategy] = useState('')
  const [strategyLoaded, setStrategyLoaded] = useState(false)
  const [strategySaving, setStrategySaving] = useState(false)
  const [strategyBuilding, setStrategyBuilding] = useState(false)
  const [mcpServers, setMcpServers] = useState<Record<string, Record<string, unknown>>>({})
  const [mcpLoaded, setMcpLoaded] = useState(false)
  const [mcpSaving, setMcpSaving] = useState(false)
  const [soul, setSoul] = useState('')
  const [soulStyle, setSoulStyle] = useState('')
  const [soulLoaded, setSoulLoaded] = useState(false)
  const [soulSaving, setSoulSaving] = useState(false)
  const [soulBuilding, setSoulBuilding] = useState(false)
  const [soulInstalling, setSoulInstalling] = useState<string | null>(null)

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }
  // Config writes auto-commit+push in local mode (no-op in hosted mode). Reflect
  // the result: clear the "needs Sync" nudge on success, raise it only if the
  // push failed (e.g. behind origin/main → resolve via the manual Sync button).
  const flashSynced = (base: string, d: { synced?: boolean }) => {
    const failed = d?.synced === false
    setHasChanges(failed)
    flash(failed ? `${base} · saved locally, not pushed` : base)
  }

  // --- API ---
  const fetchData = useCallback(async () => {
    try { const [sr, rr, secr] = await Promise.all([fetch('/api/skills'), fetch('/api/runs'), fetch('/api/secrets')]); if (sr.ok) { const d = await sr.json() as SkillsResponse; setSkills(d.skills); if (d.model) setModel(d.model); if (d.gateway?.provider) setGateway(d.gateway.provider); if (d.repo) setRepo(d.repo) }; if (rr.ok) setRuns((await rr.json() as RunsResponse).runs); if (secr.ok) { const d = await secr.json() as SecretsResponse; if (d.secrets) setSecrets(d.secrets) } } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to connect') } finally { setLoading(false) }
    try { const r = await fetch('/api/sync'); if (r.ok) { const d = await r.json() as SyncStatusResponse; setHasChanges(d.hasChanges); if (typeof d.behind === 'number') setBehind(d.behind) } } catch {}
    // Preload MCP servers so each skill's "MCP servers" panel can show install state.
    try { const r = await fetch('/api/mcp'); if (r.ok) { const d = await r.json() as McpResponse; setMcpServers(d.servers || {}); setMcpLoaded(true) } } catch {}
  }, [])
  const refreshRuns = useCallback(async () => { try { const r = await fetch('/api/runs'); if (r.ok) setRuns((await r.json() as RunsResponse).runs) } catch {} }, [])
  useEffect(() => { fetchData() }, [fetchData])
  // Restore the operator's enabled-pack selection from a prior visit (Core is
  // always on, so it's merged in even if absent from storage).
  useEffect(() => { try { const raw = localStorage.getItem('aeon.enabledPacks'); if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr)) setEnabledPacks(Array.from(new Set(['core', ...arr.filter((k: unknown): k is string => typeof k === 'string')]))) } } catch {} }, [])
  useEffect(() => { const id = setInterval(refreshRuns, 10_000); return () => clearInterval(id) }, [refreshRuns])
  useEffect(() => { setFeedLoading(true); fetch('/api/outputs').then(r => r.ok ? r.json() as Promise<OutputsResponse> : { outputs: [] }).then(d => setOutputs(d.outputs || [])).finally(() => setFeedLoading(false)) }, [feedKey])
  useEffect(() => { if (view === 'strategy' && !strategyLoaded) { fetch('/api/strategy').then(r => r.ok ? r.json() as Promise<StrategyResponse> : null).then(d => { if (d) { setStrategy(d.content || ''); setStrategyLoaded(true) } }).catch(() => {}) } }, [view, strategyLoaded])
  useEffect(() => { if (view === 'mcp' && !mcpLoaded) { fetch('/api/mcp').then(r => r.ok ? r.json() as Promise<McpResponse> : null).then(d => { if (d) { setMcpServers(d.servers || {}); setMcpLoaded(true) } }).catch(() => {}) } }, [view, mcpLoaded])
  useEffect(() => { if (view === 'soul' && !soulLoaded) { fetch('/api/soul').then(r => r.ok ? r.json() as Promise<SoulResponse> : null).then(d => { if (d) { setSoul(d.soul?.content || ''); setSoulStyle(d.style?.content || ''); setSoulLoaded(true) } }).catch(() => {}) } }, [view, soulLoaded])
  useEffect(() => { if (view === 'packs' && !packsLoaded) { fetch('/api/packs').then(r => r.ok ? r.json() as Promise<PacksResponse> : null).then(d => { if (d) { setPacks(d); setPacksLoaded(true) } }).catch(() => {}) } }, [view, packsLoaded])
  // Reset the main content scroll to the top whenever the active view or the
  // selected skill changes, so each screen (Soul, Strategy, a skill, …) opens at the top.
  useEffect(() => { mainScrollRef.current?.scrollTo({ top: 0 }) }, [view, selectedSkill])

  const toggleSkill = async (n: string, en: boolean) => { setBusy(b => ({ ...b, [n]: true })); try { const { ok, data } = await patchJson<SyncResult>('/api/skills', { name: n, enabled: en }); if (ok) { setSkills(s => s.map(sk => sk.name === n ? { ...sk, enabled: en } : sk)); flashSynced(`${displayName(n)} ${en ? 'on duty' : 'off duty'}`, data) } else { flash(`${displayName(n)} update failed`) } } catch { flash('Network error') } finally { setBusy(b => ({ ...b, [n]: false })) } }
  const runSkill = async (n: string, v?: string, sm?: string) => { if (!secrets.some(s => s.isSet && AUTH_SECRETS.includes(s.name))) { flash('No provider key set - add one in Settings before running skills'); return } setBusy(b => ({ ...b, [`r-${n}`]: true })); try { const { ok, data } = await postJson<ErrorResponse>(`/api/skills/${n}/run`, { var: v || '', model: sm || model }); if (ok) { flash(`${displayName(n)} started`); scheduleRunRefresh(refreshRuns) } else { flash(data.error || 'Failed') } } finally { setBusy(b => ({ ...b, [`r-${n}`]: false })) } }
  const updateSchedule = async (n: string, s: string) => { try { const { ok, data } = await patchJson<SyncResult>('/api/skills', { name: n, schedule: s }); if (ok) { setSkills(sk => sk.map(x => x.name === n ? { ...x, schedule: s } : x)); flashSynced('Shift updated', data) } } catch {} }
  const updateVar = async (n: string, v: string) => { try { const { ok, data } = await patchJson<SyncResult>('/api/skills', { name: n, var: v }); if (ok) { setSkills(s => s.map(x => x.name === n ? { ...x, var: v } : x)); flashSynced('Brief updated', data) } } catch {} }
  const updateSkillModel = async (n: string, m: string) => { try { const { ok, data } = await patchJson<SyncResult>('/api/skills', { name: n, skillModel: m }); if (ok) { setSkills(s => s.map(x => x.name === n ? { ...x, model: m } : x)); flashSynced('Capability updated', data) } } catch {} }
  const updateModel = async (m: string) => { setModel(m); try { const { data } = await patchJson<SyncResult>('/api/skills', { model: m }); flashSynced(`Default: ${MODELS.find(x => x.id === m)?.label}`, data) } catch {} }
  const deleteSkill = async (n: string) => { setBusy(b => ({ ...b, [`d-${n}`]: true })); try { const { ok, data } = await del<SyncResult>('/api/skills', { name: n }); if (ok) { setSkills(s => s.filter(x => x.name !== n)); setSelectedSkill(null); flashSynced(`${displayName(n)} removed`, data) } else { flash(`${displayName(n)} removal failed`) } } catch { flash('Network error') } finally { setBusy(b => ({ ...b, [`d-${n}`]: false })) } }
  const syncToGithub = async () => { setSyncing(true); try { const { ok } = await postJson('/api/sync'); if (ok) { flash('Synced'); setHasChanges(false) } else { flash('Sync failed') } } catch { flash('Network error') } finally { setSyncing(false) } }
  // Pull rebases origin/main onto the working tree, so the whole dashboard can be
  // stale afterward. Refetch core data + the feed, and drop cached panel state so
  // strategy/soul/mcp/analytics reload from the freshly-pulled files.
  const pullFromGithub = async () => { setPulling(true); try { const { ok, data } = await postJson<ErrorResponse>('/api/outputs'); if (ok) { flash('Pulled - refreshing'); setAnalyticsData(null); setStrategyLoaded(false); setMcpLoaded(false); setSoulLoaded(false); setFeedKey(k => k + 1); await fetchData() } else { flash(data.error || 'Pull failed') } } finally { setPulling(false) } }
  const setupAuth = async (auth?: string | { key: string, baseUrl?: string, provider?: string }) => { setAuthLoading(true); try { const body = typeof auth === 'string' ? { key: auth } : (auth || {}); const { ok, data } = await postJson<ErrorResponse>('/api/auth', body); if (ok) { flash('Authenticated'); setShowAuthModal(false); fetchData() } else { const msg = typeof data?.error === 'string' ? data.error : (auth ? 'Auth failed' : 'Auto-setup failed'); if (!auth) setShowAuthModal(true); flash(msg) } } finally { setAuthLoading(false) } }
  const saveSecret = async (n: string, value: string) => { setBusy(b => ({ ...b, [`sec-${n}`]: true })); try { const { ok } = await postJson('/api/secrets', { name: n, value }); if (ok) { setSecrets(s => { const e = s.some(x => x.name === n); if (e) return s.map(x => x.name === n ? { ...x, isSet: true } : x); return [...s, { name: n, group: 'Skill Keys', description: 'Custom', isSet: true }] }); flash(`${n} saved`) } } finally { setBusy(b => ({ ...b, [`sec-${n}`]: false })) } }
  const deleteSecret = async (n: string) => { setBusy(b => ({ ...b, [`sec-${n}`]: true })); try { const { ok } = await del('/api/secrets', { name: n }); if (ok) { setSecrets(s => s.map(x => x.name === n ? { ...x, isSet: false } : x)); flash(`${n} removed`) } } finally { setBusy(b => ({ ...b, [`sec-${n}`]: false })) } }
  const importSkill = async (files: UploadFile[], name?: string, category?: string) => { const { ok, data } = await postJson<UploadResponse>('/api/upload', { files, name, category }); if (ok) { flash(`${displayName(data.name)} hired`); fetchData() } }
  // Enable/disable a pack's *visibility* (not its skills). Core is always on.
  // Toggling reveals or hides the pack's skills across the sidebar + HQ; it's a
  // view preference, persisted to localStorage, with zero effect on what runs.
  const togglePack = (key: string) => {
    if (key === 'core') return
    setEnabledPacks(prev => {
      const has = prev.includes(key)
      const next = has ? prev.filter(k => k !== key) : [...prev, key]
      try { localStorage.setItem('aeon.enabledPacks', JSON.stringify(next.filter(k => k !== 'core'))) } catch {}
      flash(`${PACK_BY_KEY[key]?.label || key} ${has ? 'hidden' : 'revealed'}`)
      return next
    })
  }
  const saveStrategy = async (content: string) => { setStrategySaving(true); try { const { ok, data } = await putJson<SyncResult>('/api/strategy', { content }); if (ok) { setStrategy(content); flashSynced('Strategy saved', data) } else { flash('Save failed') } } finally { setStrategySaving(false) } }
  const buildStrategy = async (sources: StrategySources) => { setStrategyBuilding(true); try { const { ok, data } = await postJson<ErrorResponse>('/api/strategy/build', { ...sources, model }); if (ok) { flash('Strategy-builder started'); scheduleRunRefresh(refreshRuns) } else { flash(data.error || 'Build failed to dispatch') } } finally { setStrategyBuilding(false) } }
  const saveMcp = async (servers: Record<string, Record<string, unknown>>) => { setMcpSaving(true); try { const { ok, data } = await putJson<SyncResult>('/api/mcp', { servers }); if (ok) { setMcpServers(servers); flashSynced('MCP servers saved', data) } else { flash('Save failed') } } finally { setMcpSaving(false) } }
  const saveSoul = async (file: SoulFile, content: string) => { setSoulSaving(true); try { const { ok, data } = await putJson<SyncResult>('/api/soul', { file, content }); if (ok) { if (file === 'soul') setSoul(content); else setSoulStyle(content); flashSynced(`${file === 'soul' ? 'SOUL.md' : 'STYLE.md'} saved`, data) } else { flash('Save failed') } } finally { setSoulSaving(false) } }
  const buildSoul = async (sources: SoulSources) => { setSoulBuilding(true); try { const { ok, data } = await postJson<ErrorResponse>('/api/soul/build', { ...sources, model }); if (ok) { const label = sources.handle ? `@${sources.handle}` : sources.name || 'your links'; flash(`Soul-builder started for ${label}`); scheduleRunRefresh(refreshRuns) } else { flash(data.error || 'Build failed to dispatch') } } finally { setSoulBuilding(false) } }
  const installSoulExample = async (key: string) => { setSoulInstalling(key); try { const { ok, data } = await postJson<SoulExampleResponse>('/api/soul/examples', { example: key }); if (ok) { setSoul(data.soul || ''); setSoulStyle(data.style || ''); setSoulLoaded(true); flashSynced(`Installed ${key} soul`, data) } else { flash(data.error || 'Install failed') } } finally { setSoulInstalling(null) } }

  // Jump from a skill's API-keys panel straight to Settings → Access Keys,
  // scrolled to the chosen key with its input open and ready to paste.
  const goToSecret = (name: string) => { setSelectedSkill(null); setView('secrets'); setSecretFocus(name) }
  const goToMcp = () => { setSelectedSkill(null); setView('mcp') }

  // --- Derived ---
  const skill = selectedSkill ? skills.find(s => s.name === selectedSkill) || null : null
  // Any model/provider key set means Aeon can authenticate - the "Auth" CTA hides.
  // Derived from live `secrets` so it reacts the instant a key is saved or removed.
  const hasModelKey = secrets.some(s => s.isSet && AUTH_SECRETS.includes(s.name))
  // Skills visible across the dashboard = those in an enabled pack (Core always
  // on). The sidebar + HQ render this; the Packs view keeps the full roster so
  // you can enable more. Counts track what's visible, so the UI stays consistent.
  const visibleSkills = skills.filter(s => enabledPacks.includes(s.pack || 'lab'))
  const enabledCount = visibleSkills.filter(s => s.enabled).length
  const workingCount = runs.filter(r => r.status === 'in_progress').length

  if (loading) return <LoadingScreen />
  if (error) return <ErrorScreen error={error} />

  return (
    <div className="h-screen flex bg-aeon-bg text-aeon-fg">
      <TargetCursor />
      {toast && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-aeon-fg text-aeon-bg px-5 py-2.5 text-xs font-mono uppercase tracking-[0.18em] shadow-xl">{toast}</div>}

      <LeftSidebar
        view={view} setView={(v) => { setView(v); setSelectedSkill(null) }}
        selectedSkill={selectedSkill} setSelectedSkill={setSelectedSkill}
        skills={visibleSkills} runs={runs} secrets={secrets} repo={repo}
        enabledCount={enabledCount} workingCount={workingCount}
        categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter}
        onSkillSelect={(name) => { setSelectedSkill(name); setView('hq') }}
        onShowImport={() => setShowImport(true)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          skill={skill} view={view} repo={repo} model={model} gateway={gateway}
          hasModelKey={hasModelKey} authLoading={authLoading}
          pulling={pulling} syncing={syncing} hasChanges={hasChanges} behind={behind}
          onSetupAuth={() => setShowAuthModal(true)} onUpdateModel={updateModel}
          onPull={pullFromGithub} onSync={syncToGithub}
        />

        <div ref={mainScrollRef} className="flex-1 overflow-y-auto p-[var(--space-lg)]">
          {view === 'secrets' && !selectedSkill && (
            <SecretsPanel secrets={secrets} skills={skills} busy={busy} repo={repo} focusKey={secretFocus} onFocusHandled={() => setSecretFocus(null)} onSave={saveSecret} onDelete={deleteSecret} onSelectSkill={(name) => { setSelectedSkill(name); setView('hq') }} onConnectClaude={() => setupAuth()} connecting={authLoading} />
          )}
          {view === 'strategy' && !selectedSkill && (
            <StrategyPanel content={strategy} loading={!strategyLoaded} saving={strategySaving} building={strategyBuilding} onSave={saveStrategy} onBuild={buildStrategy} />
          )}
          {view === 'mcp' && !selectedSkill && (
            <McpPanel servers={mcpServers} loading={!mcpLoaded} saving={mcpSaving} secrets={secrets} busy={busy} onSave={saveMcp} onSetSecret={saveSecret} onDeleteSecret={deleteSecret} />
          )}
          {view === 'soul' && !selectedSkill && (
            <SoulPanel soul={soul} style={soulStyle} loading={!soulLoaded} saving={soulSaving} building={soulBuilding} installing={soulInstalling} onSave={saveSoul} onBuild={buildSoul} onInstallExample={installSoulExample} />
          )}
          {view === 'hq' && !selectedSkill && (
            <HQOverview skills={visibleSkills} runs={runs} enabledCount={enabledCount} workingCount={workingCount} categoryFilter={categoryFilter} onCategoryClick={(key) => setCategoryFilter(categoryFilter === key ? null : key)} onViewRun={() => {}} />
          )}
          {view === 'packs' && !selectedSkill && (
            <PacksPanel firstParty={packs?.firstParty ?? []} community={packs?.community ?? []} skills={skills} enabledPacks={enabledPacks} loading={!packsLoaded} busy={busy} onTogglePack={togglePack} onToggleSkill={toggleSkill} onSelectSkill={(name) => { setSelectedSkill(name); setView('hq') }} />
          )}
          {skill && (
            <SkillDetail
              skill={skill} runs={runs} model={model} secrets={secrets} mcpServers={mcpServers} busy={busy}
              onToggle={toggleSkill} onRun={runSkill} onDelete={deleteSkill}
              onUpdateSchedule={updateSchedule} onUpdateVar={updateVar} onUpdateModel={updateSkillModel}
              onGoToSecret={goToSecret} onGoToMcp={goToMcp}
              onViewRun={() => {}}
            />
          )}
        </div>
      </div>

      <RightPanel
        runs={runs} outputs={outputs} feedLoading={feedLoading} analyticsData={analyticsData}
        onViewRun={() => {}}
        onRefresh={() => { fetchData(); setFeedKey(k => k + 1); setAnalyticsData(null) }}
        onFetchAnalytics={() => { if (!analyticsData) fetch('/api/analytics').then(r => r.ok ? r.json() as Promise<AnalyticsData> : null).then(d => { if (d) setAnalyticsData(d) }) }}
      />

      {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={importSkill} />}
      {showAuthModal && <AuthModal loading={authLoading} onClose={() => setShowAuthModal(false)} onAuth={(auth) => setupAuth(auth)} />}
    </div>
  )
}
