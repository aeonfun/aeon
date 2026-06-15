// Client-only transport helpers shared by the dashboard's mutation handlers.
// Keep this module free of server-only imports - it runs in the browser.
//
// Each handler in app/page.tsx still owns its own optimistic state updates
// (setSkills / flash / toast); these helpers cover only the repetitive
// fetch + JSON header + body stringify + parse step.

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const

export interface JsonResult<T> {
  ok: boolean
  status: number
  data: T
}

async function request<T>(url: string, method: string, body?: unknown): Promise<JsonResult<T>> {
  const init: RequestInit = { method, headers: JSON_HEADERS }
  if (body !== undefined) init.body = JSON.stringify(body)
  const res = await fetch(url, init)
  // Swallow parse errors (empty/204/non-JSON bodies) so callers always get an
  // object back; the response shape is authoritative for the same-codebase API.
  const data = (await res.json().catch(() => ({}))) as T
  return { ok: res.ok, status: res.status, data }
}

export function postJson<T>(url: string, body?: unknown): Promise<JsonResult<T>> {
  return request<T>(url, 'POST', body)
}

export function putJson<T>(url: string, body?: unknown): Promise<JsonResult<T>> {
  return request<T>(url, 'PUT', body)
}

export function patchJson<T>(url: string, body?: unknown): Promise<JsonResult<T>> {
  return request<T>(url, 'PATCH', body)
}

export function del<T>(url: string, body?: unknown): Promise<JsonResult<T>> {
  return request<T>(url, 'DELETE', body)
}

// Post-dispatch refresh cascade: re-poll runs at 2s / 5s / 10s so a freshly
// dispatched GitHub Actions run shows up without waiting for the 10s interval.
export function scheduleRunRefresh(refresh: () => void): void {
  for (const delay of [2000, 5000, 10000]) setTimeout(refresh, delay)
}
