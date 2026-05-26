/**
 * aeon-federation-registry/ingest.ts — D1 upsert helpers.
 *
 * SCAFFOLD inside the Sealed Sprint. D1 schema documented; actual SQL execution
 * is wrapped but no real DB exists yet.
 */

import type { Env } from './index.js';

/**
 * D1 schema (apply via wrangler d1 execute on activation):
 *
 * CREATE TABLE publishers (
 *   handle        TEXT PRIMARY KEY,
 *   publisher_key TEXT NOT NULL,
 *   endpoint      TEXT NOT NULL,
 *   operator      TEXT,
 *   last_seen     TEXT NOT NULL,
 *   withdrawn     INTEGER NOT NULL DEFAULT 0,
 *   unreachable_streak INTEGER NOT NULL DEFAULT 0
 * );
 *
 * CREATE TABLE skills (
 *   publisher     TEXT NOT NULL,
 *   slug          TEXT NOT NULL,
 *   description   TEXT,
 *   pricing       TEXT,
 *   sla           TEXT,
 *   tags          TEXT,
 *   PRIMARY KEY (publisher, slug),
 *   FOREIGN KEY (publisher) REFERENCES publishers(handle)
 * );
 *
 * CREATE INDEX ix_skills_slug ON skills(slug);
 */

export async function upsertPublisher(
  env: Env,
  handle: string,
  manifest: any
): Promise<void> {
  // PLACEHOLDER inside seal — actual SQL deferred until D1 is created.
  console.log(`[registry] (placeholder) upsert ${handle}`);
}

export async function markUnreachable(env: Env, handle: string): Promise<void> {
  console.log(`[registry] (placeholder) mark unreachable ${handle}`);
}
