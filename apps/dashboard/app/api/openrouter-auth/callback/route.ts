import { getConnectStore } from '@/lib/connect-store'
import { finishFlow } from '@/lib/openrouter-oauth'
import { setSecret } from '@/lib/secrets-catalog'

// GET /api/openrouter-auth/callback?state=...&code=... - OpenRouter's redirect
// target. Exchanges the single-use code with the stored PKCE verifier, saves
// the key as OPENROUTER_API_KEY (setSecret also re-syncs the claude gateway),
// then tells the opener and closes. The message carries only the flow state and
// outcome, never the key, so it can go to any origin: the dashboard may be open
// on 127.0.0.1 while this page loads on localhost.

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function page(state: string, ok: boolean, title: string, detail: string): Response {
  const msg = JSON.stringify({ type: 'aeon-openrouter', state, status: ok ? 'done' : 'error' }).replace(/</g, '\\u003c')
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<body style="font-family:ui-monospace,monospace;background:#0a0a0a;color:#fafafa;display:grid;place-items:center;min-height:100vh;margin:0">
<div style="text-align:center;max-width:32rem;padding:2rem">
<h1 style="font-size:1.1rem;margin:0 0 .5rem;text-transform:uppercase;letter-spacing:.12em">${escapeHtml(title)}</h1>
<p style="color:#a3a3a3;font-size:.85rem;margin:0">${escapeHtml(detail)}</p>
</div>
<script>try{if(window.opener){window.opener.postMessage(${msg},'*');${ok ? 'setTimeout(function(){window.close()},800)' : ''}}}catch(e){}</script>
</body>`
  return new Response(html, { status: ok ? 200 : 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const state = url.searchParams.get('state') || ''
  const result = await finishFlow(getConnectStore(), {
    state,
    code: url.searchParams.get('code'),
    error: url.searchParams.get('error'),
  }, {
    save: async (key) => {
      await setSecret('OPENROUTER_API_KEY', key)
      return 'OPENROUTER_API_KEY'
    },
  })
  return result.status === 'done'
    ? page(state, true, 'OpenRouter connected', 'Saved as OPENROUTER_API_KEY. You can close this tab.')
    : page(state, false, 'OpenRouter connect failed', result.status === 'error' ? result.error : '')
}
