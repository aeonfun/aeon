import { NextResponse } from 'next/server'
import { requireGh, errorResponse } from '@/lib/http'
import { discover, registerClient, makePkce, makeState, authorizeUrl, type TokenSet } from '@/lib/mcp-oauth'
import { pendingFlows, openBrowser, storeSecrets, OAUTH_TIMEOUT_MS, type PendingFlow } from '@/lib/mcp-oauth-server'

// POST /api/mcp-auth — start (and complete) the OAuth Authorization Code + PKCE
// flow for an MCP server, mirroring app/api/grok-auth's one-click UX: discover the
// server's auth endpoints, register a client (or use a provided client_id), open
// the operator's browser to authorize, wait for the callback to exchange the code,
// then persist the tokens as repo secrets and wire the server into .mcp.json.
//
// Body: { slug, url, name?, scopes?, clientId? }. The request holds open until the
// browser callback resolves (or OAUTH_TIMEOUT_MS elapses) — same as grok login.
export async function POST(request: Request) {
  try {
    const notReady = requireGh()
    if (notReady) return notReady

    const body = (await request.json().catch(() => ({}))) as {
      slug?: string; url?: string; name?: string; scopes?: string[]; clientId?: string
    }
    const slug = (body.slug || '').trim()
    const url = (body.url || '').trim()
    const name = (body.name || slug).trim()
    if (!slug || !url) {
      return NextResponse.json({ error: 'slug and url are required' }, { status: 400 })
    }

    // 1. Discover the authorization server + endpoints from the MCP URL.
    const disc = await discover(url)

    // 2. redirect_uri is this dashboard's own callback (local-first origin).
    const redirectUri = `${new URL(request.url).origin}/api/mcp-auth/callback`

    // 3. Client: a provided client_id (for servers without DCR) wins; else register.
    let clientId = (body.clientId || '').trim()
    let clientSecret: string | undefined
    if (!clientId) {
      if (!disc.metadata.registration_endpoint) {
        return NextResponse.json({
          error: 'This server does not support dynamic client registration. ' +
            'Register a client with the provider and retry with its client_id.',
        }, { status: 400 })
      }
      const reg = await registerClient(disc.metadata.registration_endpoint, redirectUri)
      clientId = reg.client_id
      clientSecret = reg.client_secret
    }

    // 4. PKCE + state, then open the browser and wait for the callback.
    const { verifier, challenge } = makePkce()
    const state = makeState()
    const scopes = body.scopes?.length ? body.scopes : disc.metadata.scopes_supported

    let flow!: PendingFlow
    const tokens = await new Promise<TokenSet>((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingFlows.delete(state)
        reject(new Error('Timed out waiting for authorization. Approve in the browser, then click Connect again.'))
      }, OAUTH_TIMEOUT_MS)
      flow = {
        slug, name, url,
        tokenEndpoint: disc.metadata.token_endpoint,
        clientId, clientSecret, verifier, redirectUri,
        resource: disc.resource, resolve, reject, timer,
      }
      pendingFlows.set(state, flow)
      openBrowser(authorizeUrl({ metadata: disc.metadata, clientId, redirectUri, challenge, state, resource: disc.resource, scopes }))
    })

    // 5. Persist tokens as secrets; hand the server descriptor back for the panel
    //    to add via its normal save path.
    const { durable, server } = storeSecrets(flow, tokens)
    return NextResponse.json({
      ok: true,
      slug,
      server,
      durable,
      ...(durable ? {} : { warning: 'No refresh token was granted, so the access token will expire and need reconnecting. The provider may require an offline-access scope.' }),
    })
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to connect the MCP server')
  }
}
