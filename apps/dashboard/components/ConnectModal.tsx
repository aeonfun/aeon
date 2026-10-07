'use client'

import { useEffect, useRef, useState } from 'react'
import { inputCls } from '../lib/utils'
import { postJson } from '../lib/api-client'
import type { Harness } from '../lib/types'
import { detectPaste, providersForHarness, acceptsOpenRouter, harnessName, type Detection } from '../lib/connect-detect'
import { guideFor, captureCommand, canDriveLogin, type Os } from '../lib/connect-commands'

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

const panelCls = 'border border-[rgba(250,250,250,0.10)] bg-aeon-bg/40 px-[var(--space-md)] py-[var(--space-sm)]'
const stepCls = 'text-[10px] font-mono uppercase tracking-[0.18em] text-primary-40 mb-2'
const primaryBtn =
  'w-full bg-aeon-fg text-aeon-bg text-sm py-3 font-mono uppercase tracking-[2px] hover:opacity-90 transition-opacity disabled:opacity-50'
const secondaryBtn =
  'w-full bg-aeon-panel text-aeon-fg border border-[rgba(250,250,250,0.14)] text-xs py-2.5 font-mono uppercase tracking-[2px] hover:border-aeon-red transition-colors disabled:opacity-50'

function CopyIcon({ done }: { done: boolean }) {
  return done ? (
    <svg
      viewBox="0 0 16 16"
      className="w-3.5 h-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M3 8.5l3 3 7-7" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 16 16"
      className="w-3.5 h-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="5" y="5" width="8" height="9" />
      <path d="M3 11V2h8" />
    </svg>
  )
}

function CommandBox({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* select-all fallback below */
    }
  }
  return (
    <div className="flex items-stretch border border-[rgba(250,250,250,0.14)] bg-aeon-bg">
      <code className="flex-1 min-w-0 px-3 py-2 text-[11px] font-mono text-aeon-fg break-all select-all">
        {command}
      </code>
      <button
        onClick={copy}
        title="Copy"
        className="shrink-0 px-3 border-l border-[rgba(250,250,250,0.14)] text-primary-70 hover:text-aeon-fg flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.14em]"
      >
        <CopyIcon done={copied} />
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

function DetectionLine({ d }: { d: Detection }) {
  if (d.state === 'empty') return null
  const tone =
    d.state === 'error'
      ? 'text-aeon-red-alert'
      : d.warn || d.needsProvider
        ? 'text-aeon-red'
        : d.state === 'pending'
          ? 'text-primary-50'
          : 'text-aeon-green'
  return (
    <div className="mt-2 text-[11px] font-mono leading-relaxed" aria-live="polite">
      <div className={tone}>
        {d.state === 'error' ? 'Not savable: ' : d.state === 'pending' ? 'Detected: ' : 'Detected: '}
        <span className="text-aeon-fg">{d.label}</span>
        {d.secret && (
          <>
            {' '}
            {'->'} <span className="text-aeon-fg">{d.secret}</span>
          </>
        )}
      </div>
      {d.note && (
        <div className={d.state === 'error' || d.warn ? 'text-aeon-red-alert/80' : 'text-primary-40'}>{d.note}</div>
      )}
    </div>
  )
}

// What was saved. No test run follows: the next skill run uses it.
function SavedPanel({ saved, harness, onClose }: { saved: SavedCredential; harness: Harness; onClose: () => void }) {
  return (
    <div>
      <p className={stepCls}>Saved</p>
      <div className={`${panelCls} flex items-start gap-3`}>
        <svg
          viewBox="0 0 16 16"
          className="mt-0.5 w-4 h-4 text-aeon-green shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M3 8.5l3 3 7-7" />
        </svg>
        <div className="min-w-0 text-[11px] font-mono leading-relaxed">
          <div className="text-aeon-fg">
            Saved {saved.secret || saved.label || 'the credential'}. The next run uses it.
          </div>
          {saved.harness && saved.harness !== harness && (
            <div className="text-primary-40">Saving also selected the {harnessName(saved.harness)} harness.</div>
          )}
          <div className="text-primary-40">If a run fails, HQ says why and what to do next.</div>
        </div>
      </div>
      <button onClick={onClose} className={`${primaryBtn} mt-[var(--space-md)]`}>
        Done
      </button>
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div
        role="dialog"
        aria-label={`Connect ${harnessName(harness)}`}
        className="bg-aeon-panel border border-[rgba(250,250,250,0.10)] w-full max-w-lg mx-4 p-[var(--space-lg)] shadow-2xl max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-[var(--space-sm)]">
          <h2 className="font-display text-xl">Connect {harnessName(harness)}</h2>
          <button onClick={onClose} aria-label="Close" className="text-primary-35 hover:text-primary-100 text-lg">
            &times;
          </button>
        </div>

        {saved ? (
          <SavedPanel saved={saved} harness={harness} onClose={onClose} />
        ) : (
          <>
            <p className="text-xs text-primary-50 font-mono mb-[var(--space-md)]">
              Give Aeon a model to run on. It is saved as an encrypted GitHub secret, and the next run uses it.
            </p>

            {/* Step 1 */}
            <p className={stepCls}>Step 1 {step1 ? '- run this on your computer' : '- get a key'}</p>
            {step1 ? (
              <>
                {isCapture && (
                  <div className="flex gap-1 mb-1.5">
                    {(['mac', 'linux'] as const).map(o => (
                      <button
                        key={o}
                        onClick={() => setOs(o)}
                        aria-pressed={os === o}
                        className={`text-[10px] font-mono uppercase tracking-[0.14em] px-2 py-0.5 border ${os === o ? 'border-aeon-fg text-aeon-fg' : 'border-[rgba(250,250,250,0.14)] text-primary-40 hover:text-primary-70'}`}
                      >
                        {o === 'mac' ? 'macOS' : 'Linux'}
                      </button>
                    ))}
                  </div>
                )}
                <CommandBox command={step1} />
                <p className="text-[10px] text-primary-40 font-mono mt-1.5 leading-relaxed">
                  {harness === 'claude'
                    ? 'Signs in with your Claude plan and prints a token that starts with sk-ant-oat.'
                    : isCapture && os === 'mac'
                      ? 'Logs in, then copies the saved login to your clipboard.'
                      : isCapture
                        ? 'Logs in, then prints the saved login. Copy the whole line it prints.'
                        : ''}
                  {guide.cli && (
                    <>
                      {' '}
                      Inside your aeon folder? <code className="text-primary-70">{guide.cli}</code> does it all.
                    </>
                  )}
                </p>
              </>
            ) : null}
            {guide.keys.length > 0 && (
              <p className="text-[11px] font-mono text-primary-50 mt-2">
                {step1 ? 'Or use an API key: ' : 'Get one: '}
                {guide.keys.map((k, i) => (
                  <span key={k.url}>
                    {i > 0 && ' / '}
                    <a
                      href={k.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-70 underline decoration-dotted underline-offset-2 hover:text-aeon-fg"
                    >
                      {k.label}
                    </a>
                  </span>
                ))}
              </p>
            )}

            {/* Step 2 */}
            <p className={`${stepCls} mt-[var(--space-md)]`}>Step 2 - paste the result</p>
            <input
              type="password"
              value={value}
              autoComplete="off"
              spellCheck={false}
              onChange={e => {
                setValue(e.target.value)
                setError('')
              }}
              onKeyDown={e => e.key === 'Enter' && save()}
              placeholder={guide.pasteHint}
              aria-label="Paste your token, key, or login"
              className={inputCls}
            />
            <DetectionLine d={detection} />
            {value.trim() && providerOptions.length > 1 && (detection.needsProvider || showProvider || provider) ? (
              <select
                value={provider}
                onChange={e => setProvider(e.target.value)}
                aria-label="Provider"
                className="mt-2 w-full bg-aeon-bg text-aeon-fg text-xs px-3 py-2 border border-[rgba(250,250,250,0.10)] outline-none font-mono cursor-pointer hover:border-[rgba(250,250,250,0.22)] focus:border-aeon-red transition-colors"
              >
                <option value="">Provider: detect automatically</option>
                {providerOptions.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            ) : value.trim() &&
              providerOptions.length > 1 &&
              detection.state !== 'pending' &&
              !detection.captureHarness ? (
              <button
                onClick={() => setShowProvider(true)}
                className="mt-1 text-[10px] font-mono text-primary-40 hover:text-aeon-fg"
              >
                Wrong provider? Pick it
              </button>
            ) : null}
            {harness === 'claude' && (
              <p className="text-[10px] text-primary-40 font-mono mt-2 leading-relaxed">
                If a run fails, the Why? toggle on HQ says why. An API key or OpenRouter also works.
              </p>
            )}
            {harness === 'grok' && !patSet && (
              <p className="text-[10px] text-primary-40 font-mono mt-2 leading-relaxed">
                An X-account login rotates on every run and needs a secrets PAT to keep working past ~6h:{' '}
                <button
                  onClick={() => onGoToSecret('GH_SECRETS_PAT')}
                  className="text-aeon-red-alert underline decoration-dotted underline-offset-2 hover:text-aeon-fg"
                >
                  set GH_SECRETS_PAT
                </button>
                . An xAI key needs nothing extra.
              </p>
            )}
            <button
              onClick={save}
              disabled={detection.state !== 'ok' || !!busy}
              className={`${primaryBtn} mt-[var(--space-md)]`}
            >
              {busy === 'save' ? '...' : detection.secret ? `Save as ${detection.secret}` : 'Save'}
            </button>
            {error && (
              <p className="mt-2 text-[11px] font-mono text-aeon-red-alert" role="alert">
                {error}
              </p>
            )}

            {/* Options */}
            {(acceptsOpenRouter(harness) || (local && (canDriveLogin(harness) || found.length > 0))) && (
              <div className="mt-[var(--space-md)] pt-[var(--space-md)] border-t border-[rgba(250,250,250,0.10)] space-y-2">
                <p className={stepCls}>Other ways</p>
                {acceptsOpenRouter(harness) && (
                  <>
                    <button onClick={connectOpenRouter} disabled={!!busy} className={secondaryBtn}>
                      {busy === 'openrouter' ? 'Waiting for OpenRouter...' : 'Connect OpenRouter in one click'}
                    </button>
                    {orLink && (
                      <a
                        href={orLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-[11px] font-mono text-aeon-red underline"
                      >
                        Popup blocked - open OpenRouter
                      </a>
                    )}
                  </>
                )}
                {local && canDriveLogin(harness) && (
                  <button
                    onClick={driveLogin}
                    disabled={!!busy}
                    title="Runs the login on this machine, opens your browser, and saves the result"
                    className={secondaryBtn}
                  >
                    {busy === 'drive'
                      ? 'Waiting for the login in your browser...'
                      : 'Do it for me (runs the login here)'}
                  </button>
                )}
                {local && found.length > 0 && (
                  <div className={panelCls}>
                    <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-primary-40 mb-1.5">
                      Found on this machine
                    </p>
                    {found.map(f => (
                      <div key={f.id} className="flex items-center justify-between gap-2 py-1">
                        <div className="min-w-0 text-[11px] font-mono">
                          <div className="text-aeon-fg truncate">{f.label}</div>
                          <div className="text-primary-40">would fill {f.secret}</div>
                        </div>
                        <button onClick={() => pickFound(f.id)} disabled={!!busy} className="btn-mini-go shrink-0">
                          {busy === f.id ? '...' : 'Use this'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
