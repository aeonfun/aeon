'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { postJson } from '../lib/api-client'
import type { Harness } from '../lib/types'
import { detectPaste, providersForHarness, acceptsOpenRouter, harnessName, type Detection } from '../lib/connect-detect'
import { guideFor, captureCommand, canDriveLogin, type Os } from '../lib/connect-commands'
import { ActionButton, Field, LINK, PrimaryButton, Select, SMALL_LABEL } from './glass/connect/ui'
import { CommandBox } from './ui/CommandBox'
import { BODY, ExternalLink, HINT, INLINE_CODE, SegmentedChoice, StatusNote, StepLabel } from './glass/connect/forms'
import { GlassModal } from './glass/connect/modal'

// One modal to connect any harness to a model, command first:
//   Step 1  run this on your computer (copy button), or get a key
//   Step 2  paste the result into ONE box; we show what it is before saving
// There is no test run: the next skill run uses the credential, and a failed
// run says why on HQ (lib/run-diagnosis.ts). Options under that: one-click OpenRouter (any harness that takes
// OPENROUTER_API_KEY), and, only when the dashboard runs locally, "Do it for
// me" (drives the CLI login here) and "Found on this machine".

export interface SavedCredential {
  secret: string
  label?: string
  harness?: Harness
  synced?: boolean
}

interface ConnectModalProps {
  harness: Harness
  // GH_SECRETS_PAT / GH_GLOBAL set: grok's X-account session can persist rotations.
  patSet: boolean
  onClose: () => void
  // Saved: the page records it (and the harness, when a login capture switched it).
  onSaved: (c: SavedCredential) => void
  onGoToSecret: (name: string) => void
}

function DetectionLine({ d }: { d: Detection }) {
  if (d.state === 'empty') return null
  // Orange (attention) for "can't save" and for a warning; smoke for a clean match or a pending check.
  const attention = d.state === 'error' || !!d.warn || !!d.needsProvider
  return (
    <div className="mt-3 space-y-1" aria-live="polite">
      <StatusNote
        tone={d.state === 'error' ? 'error' : attention ? 'warn' : d.state === 'pending' ? 'busy' : 'ok'}
        live={false}
      >
        {d.state === 'error' ? 'Not savable: ' : 'Detected: '}
        <span className="font-medium text-foreground">{d.label}</span>
        {d.secret && (
          <>
            {' '}
            {'->'} <code className={INLINE_CODE}>{d.secret}</code>
          </>
        )}
      </StatusNote>
      {d.note && (
        <p className={cn(HINT, 'pl-6', (d.state === 'error' || d.warn) && 'text-[oklch(0.5_0.19_33)]')}>{d.note}</p>
      )}
    </div>
  )
}

// What was saved. No test run follows: the next skill run uses it.
function SavedPanel({ saved, harness, onClose }: { saved: SavedCredential; harness: Harness; onClose: () => void }) {
  return (
    <div>
      <div className="g-chip flex items-start gap-3 rounded-[18px] px-4 py-4">
        <svg
          viewBox="0 0 16 16"
          className="mt-0.5 size-5 shrink-0 text-foreground"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="6.25" />
          <path d="M5.4 8.2 7.2 10l3.4-3.8" />
        </svg>
        <div className="min-w-0 space-y-1">
          <p className="text-[15px] leading-[1.5] font-medium">
            Saved {saved.secret || saved.label || 'the credential'}. The next run uses it.
          </p>
          {saved.harness && saved.harness !== harness && (
            <p className={HINT}>Saving also selected the {harnessName(saved.harness)} harness.</p>
          )}
          <p className={HINT}>If a run fails, HQ says why and what to do next.</p>
        </div>
      </div>
      <PrimaryButton onClick={onClose} className="mt-6 w-full">
        Done
      </PrimaryButton>
    </div>
  )
}

export function ConnectModal({ harness, patSet, onClose, onSaved, onGoToSecret }: ConnectModalProps) {
  const guide = guideFor(harness)
  // Set once a credential is saved; the modal then shows what was saved.
  const [saved, setSaved] = useState<SavedCredential | null>(null)
  const [os, setOs] = useState<Os>(() =>
    typeof navigator !== 'undefined' && !/Mac|iPhone|iPad/.test(navigator.userAgent) ? 'linux' : 'mac',
  )
  const [value, setValue] = useState('')
  const [provider, setProvider] = useState('')
  const [showProvider, setShowProvider] = useState(false)
  // Server answer for a pasted capture, keyed by the exact paste it describes.
  const [serverDetection, setServerDetection] = useState<{ key: string; d: Detection } | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [local, setLocal] = useState(false)
  const [found, setFound] = useState<{ id: string; label: string; secret: string }[]>([])
  const [orLink, setOrLink] = useState('')
  // The OpenRouter wait (message listener + status poll) outlives the click,
  // so it is torn down on unmount and never sets state after close.
  const mounted = useRef(true)
  const stopOpenRouter = useRef<(() => void) | null>(null)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      stopOpenRouter.current?.()
    }
  }, [])

  useEffect(() => {
    let live = true
    fetch(`/api/connect/found?harness=${harness}`)
      .then(r => r.json())
      .then((d: { local?: boolean; items?: { id: string; label: string; secret: string }[] }) => {
        if (!live) return
        setLocal(Boolean(d.local))
        setFound(d.items ?? [])
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [harness])

  const localDetection = detectPaste(value, harness, provider)
  // Captures are opened server-side; debounce the round-trip while typing.
  const detectKey = `${harness}|${provider}|${value}`
  useEffect(() => {
    if (localDetection.state !== 'pending') return
    const t = setTimeout(async () => {
      const { data } = await postJson<{ detection?: Detection }>('/api/connect/detect', { harness, value, provider })
      if (data.detection) setServerDetection({ key: detectKey, d: data.detection })
    }, 300)
    return () => clearTimeout(t)
  }, [value, harness, provider, detectKey, localDetection.state])
  const detection =
    localDetection.state === 'pending' && serverDetection?.key === detectKey ? serverDetection.d : localDetection
  const providerOptions = providersForHarness(harness)

  const done = (c: SavedCredential) => {
    onSaved(c)
    setValue('')
    setProvider('')
    setError('')
    setSaved(c)
  }

  const save = async () => {
    if (detection.state !== 'ok') return
    setBusy('save')
    setError('')
    try {
      const { ok, data } = await postJson<SavedCredential & { error?: string }>('/api/connect', {
        harness,
        value,
        provider,
      })
      if (ok) done(data)
      else setError(data.error || 'Save failed')
    } finally {
      setBusy('')
    }
  }

  // "Do it for me": the existing machine-bound CLI flows.
  const driveLogin = async () => {
    setBusy('drive')
    setError('')
    try {
      const [url, body] =
        harness === 'claude'
          ? ['/api/auth', {}]
          : harness === 'grok'
            ? ['/api/grok-auth', {}]
            : ['/api/harness-auth', { harness }]
      const { ok, data } = await postJson<SavedCredential & { error?: string }>(url, body)
      if (ok) done({ secret: data.secret || '', harness: data.harness, synced: data.synced })
      else setError(data.error || 'Login failed')
    } finally {
      setBusy('')
    }
  }

  const pickFound = async (id: string) => {
    setBusy(id)
    setError('')
    try {
      const { ok, data } = await postJson<SavedCredential & { error?: string }>('/api/connect/found', { id, harness })
      if (ok) done(data)
      else setError(data.error || 'Could not use it')
    } finally {
      setBusy('')
    }
  }

  // OpenRouter OAuth in a popup. Open the window synchronously (popup blockers
  // only allow it inside the click), then point it at the authorize URL.
  const connectOpenRouter = async () => {
    setBusy('openrouter')
    setError('')
    setOrLink('')
    stopOpenRouter.current?.()
    const popup = window.open('', 'aeon-openrouter', 'width=520,height=760')
    const { ok, data } = await postJson<{ url?: string; state?: string; error?: string }>('/api/openrouter-auth', {
      harness,
    })
    if (!mounted.current) {
      popup?.close()
      return
    }
    if (!ok || !data.url || !data.state) {
      popup?.close()
      setBusy('')
      setError(data.error || 'Could not start OpenRouter connect')
      return
    }
    if (popup) popup.location.href = data.url
    else setOrLink(data.url)
    const state = data.state
    let finished = false
    const stop = () => {
      finished = true
      window.removeEventListener('message', onMessage)
      clearInterval(timer)
      if (stopOpenRouter.current === stop) stopOpenRouter.current = null
    }
    const finish = (status: string, err?: string) => {
      if (finished) return
      stop()
      if (!mounted.current) return
      setBusy('')
      if (status === 'done') done({ secret: 'OPENROUTER_API_KEY', label: 'OpenRouter key' })
      else setError(err || 'OpenRouter connect failed')
    }
    const check = async () => {
      if (finished) return
      try {
        const d = (await (await fetch(`/api/openrouter-auth?state=${encodeURIComponent(state)}`)).json()) as {
          status: string
          error?: string
        }
        if (d.status !== 'pending') finish(d.status, d.error)
      } catch {
        /* keep waiting */
      }
    }
    const onMessage = (e: MessageEvent) => {
      const m = e.data as { type?: string; state?: string } | null
      if (m?.type === 'aeon-openrouter' && m.state === state) check()
    }
    window.addEventListener('message', onMessage)
    const started = Date.now()
    const timer = setInterval(() => {
      if (Date.now() - started > 10 * 60_000) finish('error', 'OpenRouter connect timed out. Start again.')
      else check()
    }, 2000)
    stopOpenRouter.current = stop
  }

  const step1 = captureCommand(harness, os) ?? guide.login
  const isCapture = Boolean(captureCommand(harness, os)) && harness !== 'claude'

  return (
    <GlassModal title={`Connect ${harnessName(harness)}`} onClose={onClose} dismissible={false}>
      {saved ? (
        <SavedPanel saved={saved} harness={harness} onClose={onClose} />
      ) : (
        <>
          <p className={cn(BODY, 'mb-6')}>
            Give Aeon a model to run on. It is saved as an encrypted GitHub secret, and the next run uses it.
          </p>

          {/* Step 1 */}
          <StepLabel n={1}>{step1 ? 'Run this on your computer' : 'Get a key'}</StepLabel>
          {step1 ? (
            <>
              {isCapture && (
                <SegmentedChoice
                  label="Your computer"
                  value={os}
                  options={
                    [
                      { id: 'mac', label: 'macOS' },
                      { id: 'linux', label: 'Linux' },
                    ] as const
                  }
                  onChange={setOs}
                  className="mb-2.5"
                  chipClassName="h-9 px-3.5 text-[11.5px]"
                />
              )}
              <CommandBox command={step1} />
              {(harness === 'claude' || isCapture || guide.cli) && (
                <p className={cn(HINT, 'mt-2')}>
                  {harness === 'claude' ? (
                    <>
                      Signs in with your Claude plan and prints a token that starts with{' '}
                      <span className="whitespace-nowrap">sk-ant-oat</span>.
                    </>
                  ) : isCapture && os === 'mac' ? (
                    'Logs in, then copies the saved login to your clipboard.'
                  ) : isCapture ? (
                    'Logs in, then prints the saved login. Copy the whole line it prints.'
                  ) : (
                    ''
                  )}
                  {guide.cli && (
                    <>
                      {' '}
                      Inside your Aeon folder? <code className={cn(INLINE_CODE, 'whitespace-nowrap')}>{guide.cli}</code>{' '}
                      does it all.
                    </>
                  )}
                </p>
              )}
            </>
          ) : null}
          {guide.keys.length > 0 && (
            <p className={cn(HINT, 'mt-2.5')}>
              {step1 ? 'Or use an API key: ' : 'Get one: '}
              {guide.keys.map((k, i) => (
                <span key={k.url}>
                  {i > 0 && ', '}
                  <ExternalLink href={k.url}>{k.label}</ExternalLink>
                </span>
              ))}
            </p>
          )}

          {/* Step 2 */}
          <StepLabel n={2} className="mt-7">
            Paste the result
          </StepLabel>
          <Field
            label="Paste your token, key, or login"
            hideLabel
            type="password"
            value={value}
            autoComplete="off"
            spellCheck={false}
            onChange={e => {
              setValue(e.target.value)
              setError('')
            }}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder="Paste here"
          />
          {/* The full hint sits under the field: as a placeholder it clipped in the pill. */}
          {!value.trim() && <p className={cn(HINT, 'mt-2 px-1')}>{guide.pasteHint}</p>}
          <DetectionLine d={detection} />
          {value.trim() && providerOptions.length > 1 && (detection.needsProvider || showProvider || provider) ? (
            <Select
              label="Provider"
              hideLabel
              value={provider}
              onChange={e => setProvider(e.target.value)}
              className="mt-3"
            >
              <option value="">Provider: detect automatically</option>
              {providerOptions.map(p => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          ) : value.trim() &&
            providerOptions.length > 1 &&
            detection.state !== 'pending' &&
            !detection.captureHarness ? (
            <button
              type="button"
              onClick={() => setShowProvider(true)}
              className={cn(LINK, 'mt-2 cursor-pointer text-[14px] text-muted-foreground')}
            >
              Wrong provider? Pick it
            </button>
          ) : null}
          {harness === 'claude' && (
            <p className={cn(HINT, 'mt-3')}>If a run fails, HQ says why. An API key or OpenRouter also works.</p>
          )}
          {harness === 'grok' && !patSet && (
            <p className={cn(HINT, 'mt-3')}>
              An X-account login rotates on every run and needs a secrets PAT to keep working past about 6 hours:{' '}
              <button
                type="button"
                onClick={() => onGoToSecret('GH_SECRETS_PAT')}
                className={cn(LINK, 'cursor-pointer')}
              >
                set GH_SECRETS_PAT
              </button>
              . An xAI key needs nothing extra.
            </p>
          )}
          <PrimaryButton onClick={save} disabled={detection.state !== 'ok' || !!busy} className="mt-6 w-full">
            {busy === 'save' ? 'Saving' : detection.secret ? `Save as ${detection.secret}` : 'Save'}
          </PrimaryButton>
          {error && (
            <StatusNote tone="error" className="mt-3">
              {error}
            </StatusNote>
          )}

          {/* Options */}
          {(acceptsOpenRouter(harness) || (local && (canDriveLogin(harness) || found.length > 0))) && (
            <div className="mt-7 space-y-3 border-t border-[var(--line)] pt-6">
              <p className={SMALL_LABEL}>Other ways</p>
              {acceptsOpenRouter(harness) && (
                <>
                  <ActionButton onClick={connectOpenRouter} disabled={!!busy} className="h-11 w-full">
                    {busy === 'openrouter' ? 'Waiting for OpenRouter' : 'Connect OpenRouter in one click'}
                  </ActionButton>
                  {orLink && (
                    <p className={HINT}>
                      <ExternalLink href={orLink}>Popup blocked: open OpenRouter</ExternalLink>
                    </p>
                  )}
                </>
              )}
              {local && canDriveLogin(harness) && (
                <ActionButton
                  onClick={driveLogin}
                  disabled={!!busy}
                  title="Runs the login on this machine, opens your browser, and saves the result"
                  className="h-11 w-full"
                >
                  {busy === 'drive' ? 'Waiting for the login in your browser' : 'Do it for me (runs the login here)'}
                </ActionButton>
              )}
              {local && found.length > 0 && (
                <div className="g-chip rounded-[18px] px-4 py-3">
                  <p className={cn(SMALL_LABEL, 'mb-1')}>Found on this machine</p>
                  <ul className="[&>li+li]:border-t [&>li+li]:border-[var(--line)]">
                    {found.map(f => (
                      <li key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-medium">{f.label}</p>
                          <p className={HINT}>
                            Would fill <code className={INLINE_CODE}>{f.secret}</code>
                          </p>
                        </div>
                        <ActionButton
                          onClick={() => pickFound(f.id)}
                          disabled={!!busy}
                          className="h-9 shrink-0 px-3.5 text-[13px]"
                        >
                          {busy === f.id ? 'Saving' : 'Use this'}
                        </ActionButton>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </GlassModal>
  )
}
