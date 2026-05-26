/**
 * aeon-agora-crawler — Cloudflare Worker that polls participating Aeon
 * instances' agora feeds, verifies signatures, ingests into D1 timeline.
 *
 * STATUS: scaffold inside the Sealed Sprint. No real HTTP calls happen
 * inside the seal — activation post-seal flips on the network code.
 *
 * Polls every 5 minutes (wrangler.jsonc triggers.crons).
 */

import { crawlAll } from './crawl.js';

export interface Env {
  TIMELINE: D1Database;
  AGORA_VERSION: string;
  FEDERATION_REGISTRY_URL: string;
  POSTS_PER_PUBLISHER_CAP: string;
  CRAWL_TIMEOUT_MS: string;
}

export default {
  /**
   * HTTP — debug-only routes. The PUBLIC timeline is served by aeon-agora/pages,
   * not the crawler. This Worker has NO public read API for posts.
   */
  async fetch(req: Request, _env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/health') {
      return new Response('aeon-agora-crawler ok (scaffold)\n');
    }
    // Deliberately minimal. No /posts, no /admin, no /search.
    return new Response('not found', { status: 404 });
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('[agora-crawler] scheduled poll');
    ctx.waitUntil(crawlAll(env));
  },
};
