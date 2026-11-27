'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/cn'
import { Select, TAG } from './glass/connect/ui'
import { HINT, QUIET_TAG, StatusNote } from './glass/connect/forms'

interface LangfuseRegionCardProps {
  // Whether both Langfuse keys are set - drives the "activate the keys" hint.
  keysSet: boolean
}

type Region = 'eu' | 'us' | 'custom'

const REGION_LABEL: Record<Region, string> = {
  eu: 'EU: cloud.langfuse.com',
  us: 'US: us.cloud.langfuse.com',
  custom: 'Custom (self-hosted)',
}

// Rendered as a row inside the Observability credentials list: a dropdown that
// writes the LANGFUSE_HOST repo variable (EU or US Langfuse cloud). Defaults to
// EU - the same default the shim (scripts/langfuse-otel.sh) uses when unset.
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
      .catch(() => {
        /* leave EU default */
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const choose = async (next: Region) => {
    if (next === 'custom' || next === region) return
    setSaving(true)
    setSaved(false)
    setError(null)
    const prev = region
    setRegion(next)
    try {
      const res = await fetch('/api/observability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: next }),
      })
      const data = (await res.json()) as { ok?: boolean; host?: string; error?: string }
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
    <div className="px-3 py-4 sm:pl-[calc(22px+1.75rem)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-medium">Langfuse region</span>
            <span className={cn(TAG, QUIET_TAG)}>LANGFUSE_HOST</span>
          </p>
          <p className={cn(HINT, 'mt-1 max-w-[78ch]')}>
            {loading
              ? 'Loading'
              : region === 'custom'
                ? `Self-hosted: ${host}. Pick EU or US to switch to Langfuse cloud.`
                : keysSet
                  ? 'Where your traces are sent. Default is EU cloud.'
                  : 'Where traces will be sent once the keys above are set. Default is EU cloud.'}
          </p>
        </div>
        <Select
          label="Langfuse region"
          hideLabel
          value={region}
          onChange={e => choose(e.target.value as Region)}
          disabled={loading || saving}
          title="Langfuse region"
          className="w-full shrink-0 sm:w-[19rem]"
        >
          <option value="eu">{REGION_LABEL.eu}</option>
          <option value="us">{REGION_LABEL.us}</option>
          {region === 'custom' && <option value="custom">{REGION_LABEL.custom}</option>}
        </Select>
      </div>
      {saving && (
        <StatusNote tone="busy" className="mt-3">
          Saving the region
        </StatusNote>
      )}
      {saved && (
        <StatusNote tone="ok" className="mt-3">
          Saved
        </StatusNote>
      )}
      {error && (
        <StatusNote tone="error" className="mt-3">
          {error}
        </StatusNote>
      )}
    </div>
  )
}
