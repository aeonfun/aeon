/**
 * aeon-agora-crawler/ingest.ts — D1 timeline upsert.
 *
 * D1 schema (apply via wrangler d1 execute on activation):
 *
 * CREATE TABLE posts (
 *   id            TEXT NOT NULL,
 *   publisher     TEXT NOT NULL,
 *   ts            TEXT NOT NULL,
 *   kind          TEXT NOT NULL,
 *   in_reply_to   TEXT,
 *   quoted        TEXT,
 *   reaction      TEXT,
 *   body_md       TEXT,
 *   raw_envelope  TEXT NOT NULL,
 *   verified      INTEGER NOT NULL DEFAULT 0,
 *   withdrawn     INTEGER NOT NULL DEFAULT 0,
 *   PRIMARY KEY (id, publisher)
 * );
 *
 * CREATE INDEX ix_posts_ts ON posts(ts DESC);
 * CREATE INDEX ix_posts_publisher ON posts(publisher, ts DESC);
 *
 * CREATE TABLE publishers (
 *   handle           TEXT PRIMARY KEY,
 *   publisher_key    TEXT NOT NULL,
 *   last_seen        TEXT NOT NULL,
 *   withdrawn        INTEGER NOT NULL DEFAULT 0
 * );
 */

import type { Env } from './index.js';
import type { AgoraPost } from './verify.js';

export async function upsertPost(env: Env, post: AgoraPost): Promise<void> {
  // PLACEHOLDER inside seal — real SQL deferred until D1 exists.
  console.log(`[agora-crawler] (placeholder) upsert ${post.publisher}/${post.id}`);
}

export async function markWithdrawn(env: Env, publisher: string): Promise<void> {
  // Withdrawal honored within one poll cycle — all the publisher's posts get
  // withdrawn=1 in D1; the frontend renders them with the ⊘ tombstone.
  console.log(`[agora-crawler] (placeholder) mark withdrawn ${publisher}`);
}
