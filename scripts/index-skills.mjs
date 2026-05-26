#!/usr/bin/env node
// scripts/index-skills.mjs — implementation backing ./index-skills
//
// Reads every skills/*/SKILL.md, embeds via the configured PROVIDER, and writes:
//   docs/skills-index.json       canonical index (slug, name, desc, tags, embedding, …)
//   docs/skills-index.manifest   sha256 of sorted slug list (coherence check)
//
// PLACEHOLDER: real provider implementations (openai, workers) are scaffolded but
// throw inside the Sealed Sprint. Repo owner enables them by setting credentials
// and re-running with --provider <name> post-seal.

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { join, basename, dirname } from 'path';

const ROOT = process.env.AEON_ROOT;
if (!ROOT) {
  process.stderr.write('fatal: AEON_ROOT env not set\n');
  process.exit(2);
}

const SKILLS_DIR = join(ROOT, 'skills');
const INDEX_JSON = join(ROOT, 'docs', 'skills-index.json');
const MANIFEST_PATH = join(ROOT, 'docs', 'skills-index.manifest');
const PROVIDER = process.env.PROVIDER || 'mock';
const MODE = process.env.MODE || 'incremental';

function log(msg) { process.stderr.write(`[index-skills] ${msg}\n`); }

// --- Discover skills ---------------------------------------------------------
if (!existsSync(SKILLS_DIR)) {
  log(`fatal: ${SKILLS_DIR} not found`);
  process.exit(2);
}

const skillDirs = readdirSync(SKILLS_DIR)
  .map(n => join(SKILLS_DIR, n))
  .filter(p => {
    try { return statSync(p).isDirectory(); } catch { return false; }
  })
  .filter(p => existsSync(join(p, 'SKILL.md')))
  .sort();

if (skillDirs.length === 0) {
  log('fatal: no SKILL.md files found');
  process.exit(2);
}

const skillSlugs = skillDirs.map(d => basename(d));
log(`Discovered ${skillSlugs.length} skills`);

// --- Coherence manifest (sha256 of sorted slug list) -------------------------
const slugListText = skillSlugs.join('\n') + '\n';
const currentHash = createHash('sha256').update(slugListText).digest('hex');

if (MODE === 'check') {
  if (!existsSync(MANIFEST_PATH)) {
    log(`MISSING: ${MANIFEST_PATH} does not exist. Run ./index-skills to create.`);
    process.exit(1);
  }
  const stored = readFileSync(MANIFEST_PATH, 'utf8').trim();
  if (stored === currentHash) {
    log(`✓ skills-index.json is coherent with ${skillSlugs.length} skills`);
    process.exit(0);
  } else {
    log(`✗ DRIFT: manifest ${stored.slice(0, 12)} vs current ${currentHash.slice(0, 12)}`);
    log('  Run ./index-skills to regenerate.');
    process.exit(1);
  }
}

// --- Parse each SKILL.md -----------------------------------------------------
function parseSkillMd(path) {
  const raw = readFileSync(path, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  const fm = m[1];
  const prose = m[2];
  const name = (fm.match(/^name:\s*"?([^"\n]+)"?/m) || [])[1] || '';
  const description = (fm.match(/^description:\s*"?([^"\n]+)"?/m) || [])[1] || '';
  const tagsLine = (fm.match(/^tags:\s*\[([^\]]*)\]/m) || [])[1] || '';
  const tags = tagsLine.split(',').map(t => t.trim().replace(/^"|"$/g, '')).filter(Boolean);
  return { name: name.trim(), description: description.trim(), tags, prose: prose.slice(0, 2000) };
}

// --- Embedding providers -----------------------------------------------------

// Mock: deterministic 384-dim hash-based unit vector. Same text → same vector.
// Used for tests + default-during-sealed-sprint. NO network.
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

// PLACEHOLDER: real providers. Disabled inside the Sealed Sprint.
async function openaiEmbed(_text) {
  throw new Error(
    "Provider 'openai' is scaffolded but disabled inside the Sealed Sprint. " +
    "Repo owner: set OPENAI_API_KEY and remove the throw in scripts/index-skills.mjs. " +
    "See docs/contributor-dossier/03-subsystems/skill-discovery.md § Enabling real embeddings."
  );
  // const { default: fetchFn } = await import('node-fetch'); // or use global fetch
  // const r = await fetch('https://api.openai.com/v1/embeddings', {
  //   method: 'POST',
  //   headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ model: 'text-embedding-3-small', input: _text }),
  // });
  // const data = await r.json();
  // return data.data[0].embedding;
}

async function workersEmbed(_text) {
  throw new Error(
    "Provider 'workers' is scaffolded but disabled inside the Sealed Sprint. " +
    "Repo owner: set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID, then remove the throw."
  );
  // const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/baai/bge-small-en-v1.5`, {
  //   method: 'POST',
  //   headers: { 'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ text: _text }),
  // });
  // const data = await r.json();
  // return data.result.data[0];
}

async function embed(text) {
  switch (PROVIDER) {
    case 'mock':    return mockEmbed(text);
    case 'openai':  return await openaiEmbed(text);
    case 'workers': return await workersEmbed(text);
    default:        throw new Error(`Unknown provider: ${PROVIDER}`);
  }
}

// --- Build index -------------------------------------------------------------
log(`Embedding ${skillSlugs.length} skills via provider: ${PROVIDER}`);

const skills = [];
for (const dir of skillDirs) {
  const slug = basename(dir);
  const md = parseSkillMd(join(dir, 'SKILL.md'));
  if (!md) {
    process.stderr.write(`[index-skills] skipping ${slug}: malformed SKILL.md\n`);
    continue;
  }
  // Embed: name + tags + description + first prose chunk. The tags+name front-load
  // category-relevant signal so similar-named skills don't dominate similarity.
  const text = `${md.name}\n${md.tags.join(' ')}\n${md.description}\n${md.prose}`;
  let embedding;
  try {
    embedding = await embed(text);
  } catch (err) {
    log(`✗ ${slug}: ${err.message}`);
    process.exit(3);
  }
  skills.push({
    slug,
    name: md.name,
    description: md.description,
    tags: md.tags,
    embedding,
    dims: embedding.length,
  });
}

skills.sort((a, b) => a.slug.localeCompare(b.slug));

const index = {
  schema: 'aeon-skills-index/1',
  generated: new Date().toISOString(),
  provider: PROVIDER,
  dims: skills[0]?.dims ?? 0,
  count: skills.length,
  skills,
};

mkdirSync(dirname(INDEX_JSON), { recursive: true });
writeFileSync(INDEX_JSON, JSON.stringify(index, null, 2));
writeFileSync(MANIFEST_PATH, currentHash + '\n');

log(`✓ Wrote ${INDEX_JSON} (${skills.length} skills, provider=${PROVIDER}, dims=${index.dims})`);
log(`✓ Wrote ${MANIFEST_PATH} (${currentHash})`);
