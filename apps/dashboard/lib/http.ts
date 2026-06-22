import { NextResponse } from 'next/server'
import type { CommitResult } from './github'

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
