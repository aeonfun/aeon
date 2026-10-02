// Short-lived server-side state for the connect flows: OpenRouter PKCE
// verifiers (bound to a `state`), Telegram link nonces, and connect-check
// dispatch ids. Everything here expires within minutes and is safe to lose on a
// restart (the operator just clicks again).
//
// The local dashboard is one Node process, so an in-memory map is enough. The
// hosted fork (aeon-connect) runs serverless with Upstash Redis, so callers only
// ever talk to the KvStore interface below; the hosted port swaps in a Redis
// implementation (SET key value EX ttl / GET / GETDEL / DEL) and nothing else
// changes.

export interface KvStore {
  get<T>(key: string): Promise<T | null>
  // Store `value` under `key`, expiring after `ttlSeconds`.
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>
  // Read and delete in one step. Used for single-use values (an OAuth verifier
  // must never be exchanged twice). Redis: GETDEL.
  take<T>(key: string): Promise<T | null>
  del(key: string): Promise<void>
}

interface Entry { value: unknown; expiresAt: number }

export function createMemoryStore(now: () => number = Date.now): KvStore {
  const map = new Map<string, Entry>()
  const live = (key: string): Entry | null => {
    const e = map.get(key)
    if (!e) return null
    if (e.expiresAt <= now()) { map.delete(key); return null }
    return e
  }
  return {
    async get<T>(key: string) { return (live(key)?.value as T | undefined) ?? null },
    async set<T>(key: string, value: T, ttlSeconds: number) {
      map.set(key, { value, expiresAt: now() + ttlSeconds * 1000 })
    },
    async take<T>(key: string) {
      const e = live(key)
      map.delete(key)
      return (e?.value as T | undefined) ?? null
    },
    async del(key: string) { map.delete(key) },
  }
}

// One store per process. Pinned on globalThis so Next's per-route bundles and
// dev hot reloads share it: the route that starts a flow and the callback that
// finishes it must see the same map.
const GLOBAL_KEY = '__aeonConnectStore'

export function getConnectStore(): KvStore {
  const g = globalThis as unknown as Record<string, KvStore | undefined>
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = createMemoryStore()
  return g[GLOBAL_KEY]!
}
