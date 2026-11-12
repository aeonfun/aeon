import { NextResponse } from 'next/server'
import { requireGh, errorResponse } from '@/lib/http'
import { discover, registerClient, makePkce, makeState, authorizeUrl, type TokenSet } from '@/lib/mcp-oauth'
import { pendingFlows, storeSecrets, OAUTH_TIMEOUT_MS, type PendingFlow } from '@/lib/mcp-oauth-server'
import { openBrowser } from '@/lib/open-browser'

// POST /api/mcp-auth — OAuth Authorization Code + PKCE connect for an MCP server,
// in two phases so the authorize URL is surfaced even when the browser can't open
// itself (a headless, remote, or sandboxed host where `open`/`xdg-open` is a no-op):
//   begin  { slug, url, name?, scopes?, clientId? } → registers the pending flow,
//          opens the operator's browser, and returns { state, authorizeUrl } at once.
//   await  { awaitState } → waits for the callback to exchange the code (up to
//          OAUTH_TIMEOUT_MS), persists the tokens as secrets, and returns the server.
// Splitting the wait out lets the panel show a "didn't open? authorize here" link
// during the hold instead of spinning on "Connecting…" with no way through.
export async function POST(request: Request) {
  try {
    const notReady = requireGh()
    if (notReady) return notReady

    const body = (await request.json().catch(() => ({}))) as {
      slug?: string
      url?: string
      name?: string
      scopes?: string[]
      clientId?: string
      awaitState?: string
    }

    const awaitState = (body.awaitState || '').trim()
    if (awaitState) return awaitFlow(awaitState)

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
        return NextResponse.json(
          {
            error:
              'This server does not support dynamic client registration. ' +
              'Register a client with the provider and retry with its client_id.',
          },
          { status: 400 },
        )
      }
      const reg = await registerClient(disc.metadata.registration_endpoint, redirectUri)
      clientId = reg.client_id
      clientSecret = reg.client_secret
    }

    // 4. PKCE + state. Register the pending flow (its promise is resolved by the
    //    callback), open the browser, and return the authorize URL — the actual
    //    wait happens in the second (awaitState) request.
    const { verifier, challenge } = makePkce()
    const state = makeState()
    const scopes = body.scopes?.length ? body.scopes : disc.metadata.scopes_supported

    let resolve!: (t: TokenSet) => void
    let reject!: (e: Error) => void
    const promise = new Promise<TokenSet>((res, rej) => {
      resolve = res
      reject = rej
    })
    // If the timer rejects before an awaiter attaches (operator closed the tab and
    // never finalized), don't let it surface as an unhandled promise rejection.
    promise.catch(() => {})

    const timer = setTimeout(() => {
      pendingFlows.delete(state)
      reject(new Error('Timed out waiting for authorization. Approve in the browser, then click Connect again.'))
    }, OAUTH_TIMEOUT_MS)

    const flow: PendingFlow = {
      slug,
      name,
      url,
      tokenEndpoint: disc.metadata.token_endpoint,
      clientId,
      clientSecret,
      verifier,
      redirectUri,
      resource: disc.resource,
      resolve,
      reject,
      promise,
      timer,
    }
    pendingFlows.set(state, flow)

    const authorize = authorizeUrl({
      metadata: disc.metadata,
      clientId,
      redirectUri,
      challenge,
      state,
      resource: disc.resource,
      scopes,
    })
    openBrowser(authorize)

    return NextResponse.json({ ok: true, slug, state, authorizeUrl: authorize })
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to connect the MCP server')
  }
}

// Phase 2: wait for the browser callback to resolve the pending flow, then persist
// the captured tokens as secrets and return the .mcp.json descriptor for the panel.
// The flow reference is taken up front, so the callback deleting the map entry mid-
// wait is safe.
async function awaitFlow(state: string): Promise<Response> {
  const flow = pendingFlows.get(state)
  if (!flow) {
    return NextResponse.json(
      {
        error:
          'This authorization is no longer pending — it may have timed out or been ' +
          'started elsewhere. Click Connect again.',
      },
      { status: 410 },
    )
  }
  try {
    const tokens = await flow.promise
    const { durable, server } = storeSecrets(flow, tokens)
    return NextResponse.json({
      ok: true,
      slug: flow.slug,
      server,
      durable,
      ...(durable
        ? {}
        : {
            warning:
              'No refresh token was granted, so the access token will expire and need reconnecting. The provider may require an offline-access scope.',
          }),
    })
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to connect the MCP server')
  }
}
