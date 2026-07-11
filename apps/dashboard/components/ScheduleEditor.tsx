'use client'

import { useState } from 'react'
import { DAYS } from '../lib/constants'
import { parseCron, buildCron } from '../lib/utils'

export function ScheduleEditor({ cron, onSave }: { cron: string; onSave: (c: string) => void }) {
  const parsed = parseCron(cron)
  const [mode, setMode] = useState<'interval' | 'time'>(parsed.mode)
  const [iv, setIv] = useState(parsed.mode === 'interval' ? parsed.value : 3)
  const [iu, setIu] = useState<'m' | 'h'>(parsed.mode === 'interval' ? parsed.unit : 'h')
  const [h12, setH12] = useState(parsed.mode === 'time' ? parsed.hour12 : 7)
  const [min, setMin] = useState(parsed.mode === 'time' ? parsed.minute : 0)
  const [ap, setAp] = useState<'AM' | 'PM'>(parsed.mode === 'time' ? parsed.ampm : 'AM')
  const [days, setDays] = useState<number[]>(parsed.mode === 'time' ? parsed.days : [-1])
  const toggleDay = (v: number) => { setMode('time'); if (v === -1) { setDays([-1]); return }; const w = days.filter(d => d !== -1 && d !== v); setDays(days.includes(v) ? (w.length === 0 ? [-1] : w) : [...w, v]) }

  const inputCls = "w-12 bg-aeon-panel text-aeon-fg text-xs px-2 py-1.5 border border-[rgba(250,250,250,0.10)] outline-none text-center font-mono focus:border-aeon-red transition-colors"

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" checked={mode === 'interval'} onChange={() => setMode('interval')} className="accent-[#d24b40] w-3.5 h-3.5" />
          <span className="text-xs text-primary-50">Every</span>
          <input type="number" min={1} max={iu === 'm' ? 59 : 24} value={iv}
            onFocus={() => setMode('interval')} onChange={(e) => { setIv(Math.max(1, parseInt(e.target.value) || 1)); setMode('interval') }}
            className={inputCls} />
          <div className="flex text-xs overflow-hidden border border-[rgba(250,250,250,0.10)]">
            {(['m', 'h'] as const).map(u => (
              <button key={u} onClick={() => { setIu(u); setMode('interval') }}
                className={`px-2.5 py-1.5 transition-colors font-mono ${iu === u ? 'bg-aeon-fg text-aeon-bg' : 'bg-aeon-panel text-primary-40 hover:text-primary-70'}`}>{u}</button>
            ))}
          </div>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" checked={mode === 'time'} onChange={() => setMode('time')} className="accent-[#d24b40] w-3.5 h-3.5" />
          <span className="text-xs text-primary-50">At</span>
          <input type="number" min={1} max={12} value={h12} onFocus={() => setMode('time')} onChange={(e) => { setH12(Math.max(1, Math.min(12, parseInt(e.target.value) || 1))); setMode('time') }} className={inputCls} />
          <span className="text-primary-35">:</span>
          <input type="number" min={0} max={59} value={String(min).padStart(2, '0')} onFocus={() => setMode('time')} onChange={(e) => { setMin(Math.max(0, Math.min(59, parseInt(e.target.value) || 0))); setMode('time') }} className={inputCls} />
          <div className="flex text-xs overflow-hidden border border-[rgba(250,250,250,0.10)]">
            {(['AM', 'PM'] as const).map(v => (
              <button key={v} onClick={() => { setAp(v); setMode('time') }}
                className={`px-2.5 py-1.5 transition-colors font-mono ${ap === v ? 'bg-aeon-fg text-aeon-bg' : 'bg-aeon-panel text-primary-40 hover:text-primary-70'}`}>{v}</button>
            ))}
          </div>
        </label>
      </div>
      {mode === 'time' && (
        <div className="flex gap-1">
          {DAYS.map(d => (
            <button key={d.value} onClick={() => toggleDay(d.value)}
              className={`text-xs px-2.5 py-1 transition-colors font-mono ${
                (d.value === -1 ? days.includes(-1) : days.includes(d.value))
                  ? 'bg-aeon-fg text-aeon-bg' : 'bg-aeon-panel text-primary-40 border border-[rgba(250,250,250,0.10)] hover:text-primary-70'
              }`}>{d.label}</button>
          ))}
        </div>
      )}
      <button onClick={() => onSave(buildCron(mode, iv, iu, h12, min, ap, days))}
        className="bg-aeon-fg text-aeon-bg text-xs px-5 py-2 font-mono uppercase tracking-[2px] hover:opacity-90 transition-opacity">
        Save
      </button>
    </div>
  )
}
