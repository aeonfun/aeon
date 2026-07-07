'use client'

import { useState, useEffect } from 'react'
import { ServiceIcon } from './ui/ServiceIcon'

interface LangfuseRegionCardProps {
  // Whether both Langfuse keys are set — drives the "activate the keys" hint.
  keysSet: boolean
}

type Region = 'eu' | 'us' | 'custom'

const REGION_LABEL: Record<Region, string> = {
  eu: 'EU · cloud.langfuse.com',
  us: 'US · us.cloud.langfuse.com',
  custom: 'Custom (self-hosted)',
}

// Rendered as a row inside the Observability credentials list: a dropdown that
// writes the LANGFUSE_HOST repo variable (EU or US Langfuse cloud). Defaults to
// EU — the same default the shim (scripts/langfuse-otel.sh) uses when unset.
export function LangfuseRegionCard({ keysSet }: LangfuseRegionCardProps) {
  const [region, setRegion] = useState<Region>('eu')
  const [host, setHost] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/observability')
      .then(r => r.json())
      .then((d: { region?: Region; host?: string | null }) => {
        if (!alive) return
        if (d.region) setRegion(d.region)
        setHost(d.host ?? null)
      })
      .catch(() => { /* leave EU default */ })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const choose = async (next: Region) => {
    if (next === 'custom' || next === region) return
    setSaving(true); setSaved(false); setError(null)
    const prev = region
    setRegion(next)
    try {
      const res = await fetch('/api/observability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: next }),
      })
      const data = await res.json() as { ok?: boolean; host?: string; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to save region')
      setHost(data.host ?? null)
      setSaved(true)
      setTimeout(() => setSaved(false), 1600)
    } catch (e) {
      setRegion(prev)
      setError(e instanceof Error ? e.message : 'Failed to save region')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="group px-[var(--space-md)] py-[var(--space-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <ServiceIcon domain="langfuse.com" className="mt-0.5" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs">Langfuse region</span>
              <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-primary-35">LANGFUSE_HOST</span>
            </div>
            <div className="text-[11px] text-primary-40 font-mono">
              {loading
                ? 'Loading…'
                : region === 'custom'
                  ? `Self-hosted: ${host}. Pick EU/US to switch to Langfuse cloud.`
                  : keysSet
                    ? 'Where your traces are sent. Default is EU cloud.'
                    : 'Where traces will be sent once the keys above are set. Default is EU cloud.'}
            </div>
            {error && <div className="text-[11px] text-eva-orange font-mono mt-1">{error}</div>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saving && <span className="text-[10px] font-mono text-primary-35">saving…</span>}
          {saved && <span className="text-[10px] font-mono text-eva-green">saved ✓</span>}
          <select
            value={region}
            onChange={(e) => choose(e.target.value as Region)}
            disabled={loading || saving}
            title="Langfuse region"
            className="bg-aeon-panel text-primary-70 text-[11px] font-mono uppercase tracking-[0.14em] px-3 h-[32px] border border-[rgba(250,250,250,0.10)] outline-none cursor-pointer hover:border-[rgba(250,250,250,0.22)] transition-colors disabled:opacity-50"
          >
            <option value="eu">{REGION_LABEL.eu}</option>
            <option value="us">{REGION_LABEL.us}</option>
            {region === 'custom' && <option value="custom">{REGION_LABEL.custom}</option>}
          </select>
        </div>
      </div>
    </div>
  )
}
