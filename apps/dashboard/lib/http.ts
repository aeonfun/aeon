import { NextResponse } from 'next/server'

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
 * Standard success body for routes that write a file and sync it. Returns the
 * `{ ok, synced, syncError? }` object (only including `syncError` when the sync
 * step reported a reason) so callers can pass it straight to `NextResponse.json`.
 */
export function syncResult(sync: { synced: boolean; reason?: string }) {
  return { ok: true, synced: sync.synced, ...(sync.reason ? { syncError: sync.reason } : {}) }
}
