/**
 * aeon-federation-registry — Cloudflare Worker that crawls participating Aeon
 * instances and serves the canonical federation registry at federation.aeon.bot.
 *
 * STATUS: scaffold inside the Sealed Sprint. The structure is in place; the
 * crawler logic is documented + skeletal. No real HTTP calls happen inside the
 * seal; activation post-seal flips on the network code.
 */

import { crawlAll } from './crawl.js';
import { handleFederationRoutes } from './serve.js';

export interface Env {
  DB: D1Database;
  REGISTRY_VERSION: string;
  MAX_PUBLISHERS: string;
  CRAWL_TIMEOUT_MS: string;
}

export default {
  /**
   * HTTP — serve /federation, /federation/<publisher>, /federation/skills.
   */
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/federation')) {
      return handleFederationRoutes(req, env);
    }
    if (url.pathname === '/health') {
      return new Response('aeon-federation-registry ok (scaffold)\n');
    }
    return new Response('not found', { status: 404 });
  },

  /**
   * Cron — crawl every 15 min per wrangler.jsonc triggers.crons.
   */
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('[registry] scheduled crawl tick');
    // PLACEHOLDER inside the seal: no real HTTP calls. Skeleton runs.
    ctx.waitUntil(crawlAll(env));
  },
};
