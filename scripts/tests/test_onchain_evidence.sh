#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

node - "$TMP/valid.json" <<'NODE'
const { writeFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const out = process.argv[2];
const receipt = {
  schema: 'aeon.onchain-monitor.evidence.v1',
  run_id: '2026-10-21T00-00-00Z',
  chains: [
    { chain: 'base', chain_id: 8453, from_block: 10, to_block: 20, block_hash: '0x' + '1'.repeat(64), sources: { rpc: 'ok' }, query_windows: 1, watches: 1, raw_events: 2, kept_events: 1, dropped_events: 1, unpriced_events: 0, tx_hashes: ['0x' + 'a'.repeat(64)] },
    { chain: 'robinhood', chain_id: 4663, from_block: 30, to_block: 40, block_hash: null, sources: { rpc: 'degraded' }, query_windows: 2, watches: 1, raw_events: 0, kept_events: 0, dropped_events: 0, unpriced_events: 0, tx_hashes: [] },
  ],
};
const canonical = (v) => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
receipt.sha256 = createHash('sha256').update(JSON.stringify(canonical(receipt))).digest('hex');
writeFileSync(out, JSON.stringify(receipt, null, 2));
NODE

node "$ROOT/scripts/verify-onchain-evidence.mjs" "$TMP/valid.json" >/dev/null

cp "$TMP/valid.json" "$TMP/tampered.json"
node - "$TMP/tampered.json" <<'NODE'
const fs = require('node:fs'); const p = process.argv[2]; const x = JSON.parse(fs.readFileSync(p)); x.chains[0].kept_events = 2; fs.writeFileSync(p, JSON.stringify(x));
NODE
if node "$ROOT/scripts/verify-onchain-evidence.mjs" "$TMP/tampered.json" >/dev/null 2>&1; then echo 'tampered receipt unexpectedly passed' >&2; exit 1; fi

cp "$TMP/valid.json" "$TMP/duplicate.json"
node - "$TMP/duplicate.json" <<'NODE'
const fs = require('node:fs'); const p = process.argv[2]; const x = JSON.parse(fs.readFileSync(p)); x.chains[0].tx_hashes.push(x.chains[0].tx_hashes[0]); fs.writeFileSync(p, JSON.stringify(x));
NODE
if node "$ROOT/scripts/verify-onchain-evidence.mjs" "$TMP/duplicate.json" >/dev/null 2>&1; then echo 'duplicate tx receipt unexpectedly passed' >&2; exit 1; fi

cp "$TMP/valid.json" "$TMP/secret.json"
node - "$TMP/secret.json" <<'NODE'
const fs = require('node:fs'); const p = process.argv[2]; const x = JSON.parse(fs.readFileSync(p)); x.chains[0].sources.api_key = 'not-for-a-receipt'; fs.writeFileSync(p, JSON.stringify(x));
NODE
if node "$ROOT/scripts/verify-onchain-evidence.mjs" "$TMP/secret.json" >/dev/null 2>&1; then echo 'secret-bearing receipt unexpectedly passed' >&2; exit 1; fi

node - "$TMP" "$ROOT/scripts/verify-onchain-evidence.mjs" <<'NODE'
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const [dir, cli] = process.argv.slice(2);
const base = JSON.parse(fs.readFileSync(`${dir}/valid.json`));
const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
const sign = x => { delete x.sha256; x.sha256 = createHash('sha256').update(JSON.stringify(canonical(x))).digest('hex'); };
function check(name, mutate, expected, message, resign = true) {
  const x = structuredClone(base); mutate(x); if (resign) sign(x);
  const file = `${dir}/${name}.json`; fs.writeFileSync(file, JSON.stringify(x));
  const r = spawnSync(process.execPath, [cli, file], { encoding: 'utf8' });
  assert.equal(r.status, expected, `${name}: ${r.stderr}`);
  if (message) assert.ok(r.stderr.includes(message), `${name}: ${r.stderr}`);
  console.log(`PASS ${name}`);
}
check('single', x => { x.chains.pop(); }, 0);
check('reversed-range', x => { x.chains[0].from_block = 21; }, 1, 'block range');
check('negative-block', x => { x.chains[0].from_block = -1; }, 1, 'safe integer');
check('unsafe-block', x => { x.chains[0].to_block = 2 ** 53; }, 1, 'safe integer');
check('counter-mismatch', x => { x.chains[0].kept_events = 9; }, 1, 'must equal');
check('duplicate-chain', x => { x.chains.push(x.chains[0]); }, 1, 'duplicate chain');
check('duplicate-tx', x => { x.chains[0].tx_hashes.push(x.chains[0].tx_hashes[0]); }, 1, 'unique');
check('unsorted-tx', x => { x.chains[0].tx_hashes.push('0x' + '0'.repeat(64)); }, 1, 'sorted');
check('missing-degraded', x => { x.chains[1].sources.rpc = 'ok'; }, 1, 'degraded');
check('bad-status', x => { x.chains[0].sources.rpc = 'nonsense'; }, 1, 'status');
check('bad-hash', x => { x.chains[0].block_hash = '0x123'; }, 1, 'block_hash');
check('array-hash', x => { x.chains[0].block_hash = [x.chains[0].block_hash]; }, 1, 'block_hash');
check('uppercase-tx', x => { x.chains[0].tx_hashes = ['0x' + 'A'.repeat(64)]; }, 1, 'invalid hash');
check('zero-watches', x => { x.chains[0].watches = 0; }, 1, 'watches must be a positive');
check('zero-windows', x => { x.chains[0].query_windows = 0; }, 1, 'query_windows must be a positive');
check('vendor-key-field', x => { x.chains[0].sources.ALCHEMY_API_KEY = 'synthetic-secret'; }, 1, 'not allowed');
check('camel-key-field', x => { x.apiKey = 'synthetic-secret'; }, 1, 'not allowed');
check('alchemy-url', x => { x.note = 'https://base-mainnet.g.alchemy.com/v2/syntheticKey123'; }, 1, 'credential');
check('newline-key', x => { x['a\n::error::x'] = { api_key: 'synthetic-secret' }; }, 1, '["a\\n::error::x"]');
check('secret-field', x => { x.api_key = 'synthetic-secret'; }, 1, 'not allowed');
check('credential-url', x => { x.note = 'https://user:synthetic-secret@example.test'; }, 1, 'credential');
check('raw-body', x => { x.raw_response = {}; }, 1, 'not allowed');
check('digest-mismatch', x => { x.run_id += '-changed'; }, 1, 'sha256 mismatch', false);
check('wrong-schema', x => { x.schema = 'unknown'; }, 1, 'schema');
check('key-order', x => { x.chains[0] = Object.fromEntries(Object.entries(x.chains[0]).reverse()); }, 0, null, false);
const malformed = `${dir}/malformed.json`;
fs.writeFileSync(malformed, '{"private_key":"synthetic-secret", broken');
const bad = spawnSync(process.execPath, [cli, malformed], { encoding: 'utf8' });
assert.equal(bad.status, 1); assert.ok(bad.stderr.includes('malformed JSON')); assert.ok(!bad.stderr.includes('synthetic-secret'));
assert.equal(spawnSync(process.execPath, [cli]).status, 2);
assert.equal(spawnSync(process.execPath, [cli, `${dir}/missing`]).status, 1);
console.log('PASS malformed redaction, missing argument and unreadable file');
NODE

# Interop: a receipt written the way step 6.1 describes, from Python, with non-ASCII text.
if command -v python3 >/dev/null 2>&1; then
  python3 - "$TMP" <<'PY'
import hashlib, json, sys
d = sys.argv[1]
r = {"schema": "aeon.onchain-monitor.evidence.v1", "run_id": "2026-10-24T00-00-00Z",
     "chains": [{"chain": "robinhood", "chain_id": 4663, "from_block": 1, "to_block": 2, "block_hash": "0x" + "2" * 64,
                 "sources": {"rpc": "ok"}, "query_windows": 1, "watches": 1, "raw_events": 0, "kept_events": 0,
                 "dropped_events": 0, "unpriced_events": 0, "tx_hashes": [], "label": "Trésor ✓"}]}
for name, ascii_ in (("py-utf8", False), ("py-ascii", True)):
    body = json.dumps(r, sort_keys=True, separators=(",", ":"), ensure_ascii=ascii_).encode()
    json.dump(dict(r, sha256=hashlib.sha256(body).hexdigest()), open(f"{d}/{name}.json", "w", encoding="utf-8"), ensure_ascii=False)
PY
  node "$ROOT/scripts/verify-onchain-evidence.mjs" "$TMP/py-utf8.json" >/dev/null
  if node "$ROOT/scripts/verify-onchain-evidence.mjs" "$TMP/py-ascii.json" >/dev/null 2>&1; then
    echo 'ASCII-escaped digest unexpectedly matched; the 6.1 canonical form is ambiguous' >&2; exit 1
  fi
  echo 'PASS python receipt (ensure_ascii=False) verifies; escaped digest is rejected'
else
  echo 'SKIP python interop (python3 not found)'
fi

echo 'onchain evidence verifier: PASS'
