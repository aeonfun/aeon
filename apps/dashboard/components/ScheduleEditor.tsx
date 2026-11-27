'use client'

import { useId, useState } from 'react'
import { DAYS } from '../lib/constants'
import { parseCron, buildCron } from '../lib/utils'
import { Chip, CHIP_ROW, NumberField, PrimaryButton, SMALL_LABEL } from './glass/connect/ui'
import { SegmentedChoice } from './glass/connect/forms'
import { cn } from '@/lib/cn'

// Two ways to schedule a skill, each a row you pick by its radio (or by touching its fields):
// every N minutes or hours, or at a time of day on chosen days. Glass: the picked row sits on a
// g-chip card, the other is plain; numbers in small 16px pills; units and days as chips.
export function ScheduleEditor({ cron, onSave }: { cron: string; onSave: (c: string) => void }) {
  const parsed = parseCron(cron)
  const [mode, setMode] = useState<'interval' | 'time'>(parsed.mode)
  const [iv, setIv] = useState(parsed.mode === 'interval' ? parsed.value : 3)
  const [iu, setIu] = useState<'m' | 'h'>(parsed.mode === 'interval' ? parsed.unit : 'h')
  const [h12, setH12] = useState(parsed.mode === 'time' ? parsed.hour12 : 7)
  const [min, setMin] = useState(parsed.mode === 'time' ? parsed.minute : 0)
  const [ap, setAp] = useState<'AM' | 'PM'>(parsed.mode === 'time' ? parsed.ampm : 'AM')
  const [days, setDays] = useState<number[]>(parsed.mode === 'time' ? parsed.days : [-1])
  const toggleDay = (v: number) => {
    setMode('time')
    if (v === -1) {
      setDays([-1])
      return
    }
    const w = days.filter(d => d !== -1 && d !== v)
    setDays(days.includes(v) ? (w.length === 0 ? [-1] : w) : [...w, v])
  }
  const name = useId()

  const row = (on: boolean) =>
    cn(
      'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[18px] px-4 py-3 transition-[background-color,box-shadow] duration-150',
      on ? 'g-chip' : 'shadow-[inset_0_0_0_1px_var(--line)]',
    )
  const radio = 'size-4 shrink-0 cursor-pointer accent-[oklch(0.3_0.015_240)]'

  return (
    <div className="space-y-3">
      <div className={row(mode === 'interval')}>
        <label className="flex min-h-10 cursor-pointer items-center gap-2.5">
          <input
            type="radio"
            name={name}
            checked={mode === 'interval'}
            onChange={() => setMode('interval')}
            className={radio}
          />
          <span className="text-[15px] font-medium">Every</span>
        </label>
        <NumberField
          aria-label="Interval"
          min={1}
          max={iu === 'm' ? 59 : 24}
          value={iv}
          onFocus={() => setMode('interval')}
          onChange={e => {
            setIv(Math.max(1, parseInt(e.target.value) || 1))
            setMode('interval')
          }}
        />
        <SegmentedChoice
          variant="group"
          label="Interval unit"
          value={iu}
          options={[
            { id: 'm', label: 'min' },
            { id: 'h', label: 'hours' },
          ]}
          onChange={u => {
            setIu(u)
            setMode('interval')
          }}
        />
      </div>

      <div className={row(mode === 'time')}>
        <label className="flex min-h-10 cursor-pointer items-center gap-2.5">
          <input
            type="radio"
            name={name}
            checked={mode === 'time'}
            onChange={() => setMode('time')}
            className={radio}
          />
          <span className="text-[15px] font-medium">At</span>
        </label>
        <span className="flex items-center gap-1.5">
          <NumberField
            aria-label="Hour"
            min={1}
            max={12}
            value={h12}
            onFocus={() => setMode('time')}
            onChange={e => {
              setH12(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))
              setMode('time')
            }}
          />
          <span aria-hidden className="font-mono text-muted-foreground">
            :
          </span>
          <NumberField
            aria-label="Minute"
            min={0}
            max={59}
            value={String(min).padStart(2, '0')}
            onFocus={() => setMode('time')}
            onChange={e => {
              setMin(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))
              setMode('time')
            }}
          />
        </span>
        <SegmentedChoice
          variant="group"
          label="Morning or afternoon"
          value={ap}
          options={[
            { id: 'AM', label: 'AM' },
            { id: 'PM', label: 'PM' },
          ]}
          onChange={v => {
            setAp(v)
            setMode('time')
          }}
        />
      </div>

      {mode === 'time' && (
        <div>
          <p className={cn(SMALL_LABEL, 'mb-2 px-1')}>Days</p>
          <div className={CHIP_ROW} role="group" aria-label="Days">
            {DAYS.map(d => (
              <Chip
                key={d.value}
                on={d.value === -1 ? days.includes(-1) : days.includes(d.value)}
                onClick={() => toggleDay(d.value)}
                className="px-3.5"
              >
                {d.label}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end pt-1">
        <PrimaryButton onClick={() => onSave(buildCron(mode, iv, iu, h12, min, ap, days))}>Save</PrimaryButton>
      </div>
    </div>
  )
}
