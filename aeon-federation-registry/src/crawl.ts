/**
 * aeon-federation-registry/crawl.ts — per-publisher crawl + signature verify.
 *
 * PLACEHOLDER inside the Sealed Sprint: no real HTTP calls to publisher
 * endpoints. The skeleton reads seeds.json + iterates; activation removes
 * the noop returns.
 */

import type { Env } from './index.js';
import { verifyManifest } from './verify.js';
import { upsertPublisher, markUnreachable } from './ingest.js';

export interface Publisher {
  handle: string;
  endpoint: string;
  operator: string;
}

export interface SeedsFile {
  schema: 'aeon-federation-seeds/1';
  publishers: Publisher[];
}

const SEEDS: SeedsFile = {
  schema: 'aeon-federation-seeds/1',
  publishers: [
    // PLACEHOLDER: inside the seal we hard-code an empty seed list. Post-seal,
    // this comes from a KV-backed seed file the operator manages via PR to
    // seeds.json (with a CI job that copies it into KV on deploy).
  ],
};

export async function crawlAll(env: Env): Promise<void> {
  for (const pub of SEEDS.publishers) {
    try {
      await crawlOne(env, pub);
    } catch (err) {
      console.error(`[registry] crawl ${pub.handle} failed:`, err);
      await markUnreachable(env, pub.handle);
    }
  }
}

async function crawlOne(env: Env, pub: Publisher): Promise<void> {
  // PLACEHOLDER: inside the seal, no fetch happens. Post-seal:
  //   const r = await fetch(`${pub.endpoint}/well-known/aeon-federation.json`, {
  //     signal: AbortSignal.timeout(Number(env.CRAWL_TIMEOUT_MS)),
  //   });
  //   if (!r.ok) throw new Error(`HTTP ${r.status}`);
  //   const manifest = await r.json();
  //   const ok = await verifyManifest(manifest);
  //   if (!ok) throw new Error('signature mismatch');
  //   await upsertPublisher(env, pub.handle, manifest);
  console.log(`[registry] (placeholder) would crawl ${pub.endpoint}`);
}
