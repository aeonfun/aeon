#!/usr/bin/env node
// scripts/memory-query.mjs — implementation backing ./memory-query and the MCP
// `memory-query` tool that Session 02 adds.
//
// Reads memory/graph/{chunks,entities,edges}.json, embeds the query, returns
// top-K chunks ranked by cosine similarity, plus a walk over the entity graph
// for entities mentioned in the query.
//
// PLACEHOLDER: real embedding providers are scaffolded but throw inside the
// Sealed Sprint. Same enable-pattern as scripts/skill-search.mjs.

import { readFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';

const ROOT = process.env.AEON_ROOT;
const QUERY = process.env.QUERY;
const LIMIT = parseInt(process.env.LIMIT || '10', 10);
const WINDOW = parseInt(process.env.WINDOW || '30', 10);
const ENTITY_TYPE = process.env.ENTITY_TYPE || '';
const FORMAT = process.env.FORMAT || 'md';

if (!ROOT || !QUERY) {
  process.stderr.write('fatal: AEON_ROOT and QUERY env vars required\n');
  process.exit(2);
}

const GRAPH_DIR = join(ROOT, 'memory', 'graph');
const CHUNKS_PATH = join(GRAPH_DIR, 'chunks.json');
const ENTITIES_PATH = join(GRAPH_DIR, 'entities.json');
const MANIFEST_PATH = join(GRAPH_DIR, 'manifest.json');

if (!existsSync(MANIFEST_PATH)) {
  process.stderr.write(
    `memory/graph/ not initialized. Run the graphify-memory skill (or scripts/graphify-memory.mjs) first.\n`
  );
  // Return empty result rather than failing — skills should degrade gracefully.
  console.log(FORMAT === 'json'
    ? JSON.stringify({ query: QUERY, results: [], entities: [], status: 'not_initialized' })
    : '_(memory graph not initialized — run graphify-memory to populate)_'
  );
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
const provider = manifest.provider || 'mock';

const chunks = existsSync(CHUNKS_PATH) ? JSON.parse(readFileSync(CHUNKS_PATH, 'utf8')).chunks ?? [] : [];
const entities = existsSync(ENTITIES_PATH) ? JSON.parse(readFileSync(ENTITIES_PATH, 'utf8')).entities ?? [] : [];

// --- Embed query (same mock pattern as scripts/skill-search.mjs) -------------
function mockEmbed(text, dims = 384) {
  const vec = new Float32Array(dims);
  for (let i = 0; i < dims; i++) {
    const h = createHash('sha256').update(`${text}|${i}`).digest();
    const u32 = h.readUInt32BE(0);
    vec[i] = (u32 / 0xFFFFFFFF) * 2 - 1;
  }
  let norm = 0;
  for (let i = 0; i < dims; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dims; i++) vec[i] /= norm;
  return Array.from(vec);
}

async function embed(text) {
  if (provider === 'mock') return mockEmbed(text);
  throw new Error(
    `Provider '${provider}' is scaffolded but disabled inside the Sealed Sprint. ` +
    `See docs/contributor-dossier/03-subsystems/knowledge-graph.md § Enabling real embeddings.`
  );
}

function cosine(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

// --- Filter chunks by time window --------------------------------------------
const cutoff = Date.now() - WINDOW * 24 * 60 * 60 * 1000;
const inWindow = chunks.filter(c => {
  if (!c.ts) return true;
  return new Date(c.ts).getTime() >= cutoff;
});

// --- Rank chunks -------------------------------------------------------------
const queryVec = await embed(QUERY);
const scored = inWindow.map(c => ({
  ...c,
  score: cosine(queryVec, c.embedding),
}));
scored.sort((a, b) => b.score - a.score);
const topChunks = scored.slice(0, LIMIT);

// --- Walk entity graph for entities mentioned in the query -------------------
const queryLower = QUERY.toLowerCase();
const mentionedEntities = entities.filter(e => {
  if (ENTITY_TYPE && e.type !== ENTITY_TYPE) return false;
  return e.canonical?.toLowerCase().includes(queryLower) || e.name.toLowerCase().includes(queryLower);
}).slice(0, 5);

// --- Output ------------------------------------------------------------------
if (FORMAT === 'json') {
  console.log(JSON.stringify({
    query: QUERY,
    provider,
    window_days: WINDOW,
    chunks: topChunks.map(c => ({
      source: c.source,
      ts: c.ts,
      text: c.text,
      score: Number(c.score.toFixed(4)),
    })),
    entities: mentionedEntities.map(e => ({
      name: e.name,
      type: e.type,
      mention_count: e.mention_count,
      first_seen: e.first_seen,
      last_seen: e.last_seen,
    })),
  }, null, 2));
} else {
  console.log(`# Memory query — "${QUERY}"`);
  console.log(`Provider: ${provider} · window: ${WINDOW}d · ${topChunks.length} chunks · ${mentionedEntities.length} entities`);
  console.log('');
  if (mentionedEntities.length > 0) {
    console.log('## Entities');
    for (const e of mentionedEntities) {
      console.log(`- **${e.name}** (${e.type}) — ${e.mention_count} mentions · first: ${e.first_seen} · last: ${e.last_seen}`);
    }
    console.log('');
  }
  console.log('## Top chunks');
  for (const [i, c] of topChunks.entries()) {
    console.log(`### ${i + 1}. [${c.source}](${c.source}) — score ${c.score.toFixed(4)}`);
    if (c.ts) console.log(`*${c.ts}*`);
    console.log('');
    console.log(c.text.slice(0, 400).trim() + (c.text.length > 400 ? '…' : ''));
    console.log('');
  }
  if (provider === 'mock') {
    console.log(`---`);
    console.log(`*Note: results are deterministic but NOT semantically meaningful while mock provider is active.*`);
  }
}
