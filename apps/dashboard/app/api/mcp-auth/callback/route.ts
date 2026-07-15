import { exchangeCode } from '@/lib/mcp-oauth'
import { pendingFlows } from '@/lib/mcp-oauth-server'

// GET /api/mcp-auth/callback — the OAuth redirect target. Matches the ?state to a
// pending flow (started by POST /api/mcp-auth), exchanges the ?code for tokens
// with the stored PKCE verifier, and resolves the waiting POST. Renders a tiny
// self-contained page for the browser tab; the actual secret-storage + .mcp.json
// wiring happens back in the POST handler once resolve() fires.
function page(title: string, detail = '', status = 200): Response {
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<body style="font-family:ui-sans-serif,system-ui,sans-serif;background:#0a0a0a;color:#fafafa;display:grid;place-items:center;min-height:100vh;margin:0">
<div style="text-align:center;max-width:32rem;padding:2rem">
<h1 style="font-size:1.25rem;margin:0 0 .5rem">${title}</h1>
<p style="color:#a3a3a3;font-size:.9rem;margin:0">${detail}</p>
</div></body>`
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const state = url.searchParams.get('state') || ''
  const code = url.searchParams.get('code')
  const err = url.searchParams.get('error')
  const errDesc = url.searchParams.get('error_description') || ''

  const flow = state ? pendingFlows.get(state) : undefined
  if (!flow) {
    return page('Unknown or expired request', 'This authorization request is no longer pending. Start again from the dashboard.', 400)
  }
  // One-shot: remove it and stop the POST's timeout regardless of outcome.
  pendingFlows.delete(state)
  clearTimeout(flow.timer)

  if (err) {
    flow.reject(new Error(`Authorization error: ${err}${errDesc ? ` (${errDesc})` : ''}`))
    return page('Authorization denied', errDesc || err, 400)
  }
  if (!code) {
    flow.reject(new Error('No authorization code was returned'))
    return page('No authorization code', 'The provider returned no code. Try connecting again.', 400)
  }

  try {
    const tokens = await exchangeCode({
      tokenEndpoint: flow.tokenEndpoint,
      code,
      verifier: flow.verifier,
      clientId: flow.clientId,
      clientSecret: flow.clientSecret,
      redirectUri: flow.redirectUri,
      resource: flow.resource,
    })
    flow.resolve(tokens)
    return page('✓ Connected', 'Tokens captured. You can close this tab and return to the dashboard.')
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'token exchange failed'
    flow.reject(e instanceof Error ? e : new Error(msg))
    return page('Token exchange failed', msg, 500)
  }
}
