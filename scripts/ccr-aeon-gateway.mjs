// ccr-aeon-gateway.mjs - claude-code-router 3.x core-gateway plugin for aeon's
// sidecar gateway arms (surplus / venice / hivemindos in scripts/llm-gateway.sh).
//
// ccr 3.x replaced 2.x's custom transformer classes (config.json "transformers":
// [{path}] + provider "transformer.use") with gateway plugins: an ES module whose
// default export returns request hooks. llm-gateway.sh registers this file under
// the config's `plugins[].coreGateway.plugins[]` with a small `config` object:
//
//   pinModel    "<provider>/<model>" - every request is routed to the one model
//               the sidecar serves. ccr 3.x hard-fails an unconfigured model id
//               ('Model "claude-opus-4-8" is not configured'), and Claude Code
//               sends its own claude-* ids (and haiku for background calls), so
//               this replaces 2.x's Router default/background/think/longContext
//               slots, which 3.x no longer reads.
//   hivemindos  true on the hivemindos arm: reshape the final upstream request
//               for the credit-billed endpoint (scripts/ccr-hivemindos.js).
//
// Every request also goes through scripts/ccr-sanitize.js before routing (blank
// text blocks, cache_control), the job ccr-sanitize.js did as a 2.x transformer.
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { sanitizeRequest } = require('./ccr-sanitize.js')
const { prepareRequest } = require('./ccr-hivemindos.js')

export default function createGatewayPlugin({ plugin } = {}) {
  const cfg = (plugin && plugin.config) || {}
  const hooks = {
    requestTransforms: [{
      key: 'aeon-sanitize-and-pin',
      stage: 'beforeRouting',
      transform({ requestBody }) {
        if (!requestBody || typeof requestBody !== 'object') return undefined
        sanitizeRequest(requestBody)
        if (cfg.pinModel) requestBody.model = cfg.pinModel
        return { requestBody }
      },
    }],
  }
  if (cfg.hivemindos) {
    hooks.providerPlugins = [{
      key: 'aeon-hivemindos',
      transformRequest({ upstreamRequest }) {
        const { body, headers } = prepareRequest(upstreamRequest.body || {})
        return { ok: true, value: { ...upstreamRequest, body, headers: { ...upstreamRequest.headers, ...headers } } }
      },
    }]
  }
  return hooks
}
