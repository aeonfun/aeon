#!/usr/bin/env node
// scripts/skill-search.mjs — implementation backing ./skill-search and the
// dashboard + MCP + A2A search endpoints.
//
// Reads docs/skills-index.json, embeds the query with the same provider used
// to build the index, computes cosine similarity, returns ranked top-K.

import { readFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';

const ROOT = process.env.AEON_ROOT;
const QUERY = process.env.QUERY;
const LIMIT = parseInt(process.env.LIMIT || '5', 10);
const TAG_FILTER = process.env.TAG_FILTER || '';
const FORMAT = process.env.FORMAT || 'md';

if (!ROOT || !QUERY) {
  process.stderr.write('fatal: AEON_ROOT and QUERY env vars required\n');
  process.exit(2);
}

const INDEX_PATH = join(ROOT, 'docs', 'skills-index.json');
if (!existsSync(INDEX_PATH)) {
  process.stderr.write(`fatal: ${INDEX_PATH} not found. Run ./index-skills first.\n`);
  process.exit(2);
}

const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));

// Embed the query with the same provider used to build the index.
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

async function embed(text, provider, dims) {
  if (provider === 'mock') return mockEmbed(text, dims);
  // PLACEHOLDER: real providers throw inside the Sealed Sprint. See
  // scripts/index-skills.mjs for the swap-in pattern.
  throw new Error(
    `Provider '${provider}' is scaffolded but disabled inside the Sealed Sprint. ` +
    `Repo owner: enable in scripts/index-skills.mjs + scripts/skill-search.mjs.`
  );
}

function cosineSim(a, b) {
  // Both vectors are L2-normalized → dot product == cosine.
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

const queryVec = await embed(QUERY, index.provider, index.dims);

// Filter by tag if provided.
let candidates = index.skills;
if (TAG_FILTER) {
  candidates = candidates.filter(s => s.tags?.includes(TAG_FILTER));
}

// Score and rank.
const scored = candidates.map(s => ({
  slug: s.slug,
  name: s.name,
  description: s.description,
  tags: s.tags,
  score: cosineSim(queryVec, s.embedding),
}));
scored.sort((a, b) => b.score - a.score);
const top = scored.slice(0, LIMIT);

// Output.
if (FORMAT === 'json') {
  console.log(JSON.stringify({
    query: QUERY,
    provider: index.provider,
    results: top.map(t => ({
      slug: t.slug,
      name: t.name,
      description: t.description,
      tags: t.tags,
      score: Number(t.score.toFixed(4)),
      invoke_as: `aeon-${t.slug}`,
    })),
  }, null, 2));
} else {
  // Markdown output for terminal + chat consumption.
  console.log(`# Skill search results — "${QUERY}"`);
  console.log(`Provider: ${index.provider} (mock = deterministic, no network)`);
  console.log('');
  for (const [i, r] of top.entries()) {
    console.log(`## ${i + 1}. \`${r.slug}\` — score ${r.score.toFixed(4)}`);
    console.log(`**${r.name}** · tags: \`${(r.tags || []).join(', ')}\``);
    console.log('');
    console.log(r.description);
    console.log('');
    console.log(`Invoke via MCP: \`aeon-${r.slug}\``);
    console.log('');
  }
  console.log(`---`);
  console.log(`*Note: results are deterministic but NOT semantically meaningful while the mock provider is active. Swap to openai/workers post-seal for real similarity.*`);
}
