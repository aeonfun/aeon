/**
 * aeon-agora-crawler/crawl.ts — per-publisher feed ingest.
 *
 * PLACEHOLDER inside the Sealed Sprint: no real fetches. The skeleton walks
 * the federation registry; activation removes the noops.
 */

import type { Env } from './index.js';
import { verifyPost, type AgoraPost } from './verify.js';
import { upsertPost, markWithdrawn } from './ingest.js';

export async function crawlAll(env: Env): Promise<void> {
  // PLACEHOLDER: fetch publisher list from federation registry.
  // const r = await fetch(env.FEDERATION_REGISTRY_URL);
  // const registry = await r.json();
  // const publishers = registry.publishers.filter(p => !p.withdrawn);

  const publishers: Array<{ handle: string; endpoint: string; publisher_key: string }> = [];

  for (const pub of publishers) {
    try {
      await crawlPublisher(env, pub);
    } catch (err) {
      console.error(`[agora-crawler] ${pub.handle} failed:`, err);
    }
  }
}

async function crawlPublisher(
  env: Env,
  pub: { handle: string; endpoint: string; publisher_key: string }
): Promise<void> {
  // PLACEHOLDER:
  //   const wkR = await fetch(`${pub.endpoint}/well-known/aeon-agora.json`, {
  //     signal: AbortSignal.timeout(Number(env.CRAWL_TIMEOUT_MS)),
  //   });
  //   const wk = await wkR.json();
  //   if (wk.withdrawn) {
  //     await markWithdrawn(env, pub.handle);
  //     return;
  //   }
  //   const postsR = await fetch(`${pub.endpoint}${wk.posts_endpoint}`);
  //   const feed = await postsR.json();
  //   for (const post of feed.posts as AgoraPost[]) {
  //     if (!verifyPost(post)) {
  //       console.warn(`[agora-crawler] ${pub.handle} post ${post.id}: signature mismatch`);
  //       continue;
  //     }
  //     await upsertPost(env, post);
  //   }
  console.log(`[agora-crawler] (placeholder) would crawl ${pub.endpoint}`);
}
