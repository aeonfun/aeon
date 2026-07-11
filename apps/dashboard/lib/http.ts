import { NextResponse } from 'next/server'
import type { CommitResult } from './github'
import { ghAvailable } from './gh'

/**
 * 503 guard for routes that need the `gh` CLI authenticated. Returns a ready-to-
 * return NextResponse when gh is unavailable, else null (proceed). Pass `extra`
 * to merge fields into the error body (e.g. `{ ghReady: false }`).
 */
export function requireGh(extra?: Record<string, unknown>): NextResponse | null {
  if (ghAvailable()) return null
  return NextResponse.json(
    { error: 'GitHub CLI not authenticated. Run: gh auth login', ...extra },
    { status: 503 },
  )
}

/**
 * Standard JSON error response for API routes. Surfaces `error.message` when the
 * caught value is an Error, otherwise falls back to `fallback`. Mirrors the
 * `{ error: msg }` shape every route's 500 catch block already returns.
 */
export function errorResponse(error: unknown, fallback = 'Unknown error', status = 500) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status },
  )
}

/**
 * Maps a commit/sync outcome to its response fields: `{ synced, syncError? }`
 * (only including `syncError` when the sync step reported a reason). Use this
 * when composing a larger response body alongside other fields.
 */
export function syncFields(sync: CommitResult) {
  return { synced: sync.synced, ...(sync.reason ? { syncError: sync.reason } : {}) }
}

/**
 * Standard success body for routes that write a file and sync it. Returns the
 * `{ ok, synced, syncError? }` object so callers can pass it straight to
 * `NextResponse.json`.
 */
export function syncResult(sync: CommitResult) {
  return { ok: true, ...syncFields(sync) }
}
