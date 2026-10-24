#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const usage = 'usage: node scripts/verify-onchain-evidence.mjs <receipt.json>';
// Lowercase only, as RPCs return them, so one tx cannot appear twice in different case.
const HASH = /^0x[0-9a-f]{64}$/;
const FORBIDDEN_KEYS = /^(raw|raw_response|response_body|request_body|secret|token|password)$|(api[_-]?key|private[_-]?key)$/i;
const SECRET_VALUE = /(https?:\/\/[^\s/@]+:[^\s/@]+@|alchemy\.com\/v2\/[A-Za-z0-9_-]+|(?:api[_-]?key|private[_-]?key|secret|password|token)\s*[:=]\s*['"]?[^\s,'"]+)/i;

function fail(message) {
  console.error(`invalid evidence: ${message}`);
  process.exitCode = 1;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function digest(receipt) {
  const { sha256: _ignored, ...unsigned } = receipt;
  return createHash('sha256').update(JSON.stringify(canonical(unsigned))).digest('hex');
}

// Keys come from the receipt: quote odd ones so a newline cannot start a new log line.
const segment = (key) => (/^[A-Za-z0-9_]+$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`);

function walk(value, path = '$') {
  if (Array.isArray(value)) value.forEach((item, i) => walk(item, `${path}[${i}]`));
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.test(key)) throw new Error(`${path}${segment(key)} is not allowed`);
      walk(item, `${path}${segment(key)}`);
    }
  } else if (typeof value === 'string' && SECRET_VALUE.test(value)) {
    throw new Error(`${path} looks like a credential or credential-bearing URL`);
  }
}

function integer(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${field} must be a non-negative safe integer`);
}

function verifyChain(chain, index) {
  const p = `chains[${index}]`;
  if (!chain || typeof chain !== 'object' || Array.isArray(chain)) throw new Error(`${p} must be an object`);
  if (typeof chain.chain !== 'string' || !chain.chain) throw new Error(`${p}.chain is required`);
  if (!Number.isSafeInteger(chain.chain_id) || chain.chain_id <= 0) throw new Error(`${p}.chain_id must be a positive safe integer`);
  integer(chain.from_block, `${p}.from_block`);
  integer(chain.to_block, `${p}.to_block`);
  if (chain.from_block > chain.to_block) throw new Error(`${p} block range is invalid`);
  if (chain.block_hash !== null && (typeof chain.block_hash !== 'string' || !HASH.test(chain.block_hash))) throw new Error(`${p}.block_hash must be 0x-prefixed 32-byte hash or null`);
  if (!chain.sources || typeof chain.sources !== 'object' || Array.isArray(chain.sources)) throw new Error(`${p}.sources is required`);
  if (Object.keys(chain.sources).length === 0 || Object.values(chain.sources).some((s) => !['ok', 'skipped', 'degraded', 'fail'].includes(s))) throw new Error(`${p}.sources contains an invalid status`);
  if (chain.block_hash === null && !Object.values(chain.sources).includes('degraded')) throw new Error(`${p}.block_hash null requires a degraded source`);
  for (const field of ['query_windows', 'watches']) {
    if (!Number.isSafeInteger(chain[field]) || chain[field] < 1) throw new Error(`${p}.${field} must be a positive safe integer`);
  }
  for (const field of ['raw_events', 'kept_events', 'dropped_events', 'unpriced_events']) integer(chain[field], `${p}.${field}`);
  if (chain.kept_events + chain.dropped_events !== chain.raw_events) throw new Error(`${p} kept_events + dropped_events must equal raw_events`);
  if (chain.unpriced_events > chain.raw_events) throw new Error(`${p}.unpriced_events exceeds raw_events`);
  if (!Array.isArray(chain.tx_hashes)) throw new Error(`${p}.tx_hashes must be an array`);
  if (chain.tx_hashes.some((tx) => typeof tx !== 'string' || !HASH.test(tx))) throw new Error(`${p}.tx_hashes contains an invalid hash`);
  const sorted = [...new Set(chain.tx_hashes)].sort();
  if (sorted.length !== chain.tx_hashes.length) throw new Error(`${p}.tx_hashes must be unique`);
  if (JSON.stringify(sorted) !== JSON.stringify(chain.tx_hashes)) throw new Error(`${p}.tx_hashes must be sorted`);
}

const file = process.argv[2];
if (!file) { console.error(usage); process.exit(2); }
try {
  let raw;
  try { raw = readFileSync(file, 'utf8'); } catch { throw new Error('cannot read input file'); }
  let receipt;
  try { receipt = JSON.parse(raw); } catch { throw new Error('malformed JSON'); }
  if (receipt?.schema !== 'aeon.onchain-monitor.evidence.v1') throw new Error('unsupported schema');
  if (typeof receipt.run_id !== 'string' || !receipt.run_id) throw new Error('run_id is required');
  if (!Array.isArray(receipt.chains) || receipt.chains.length === 0) throw new Error('chains must be a non-empty array');
  walk(receipt);
  if (typeof receipt.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(receipt.sha256)) throw new Error('sha256 must be a 64-character lowercase hex digest');
  receipt.chains.forEach(verifyChain);
  if (new Set(receipt.chains.map((c) => c.chain_id)).size !== receipt.chains.length) throw new Error('chains contains duplicate chain IDs');
  const expected = digest(receipt);
  if (receipt.sha256 !== expected) throw new Error(`sha256 mismatch (expected ${expected})`);
  console.log(`OK: ${file}`);
  console.log(`  schema: ${receipt.schema}`);
  console.log(`  chains: ${receipt.chains.length}`);
  console.log(`  sha256: ${receipt.sha256}`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
