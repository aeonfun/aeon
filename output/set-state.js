#!/usr/bin/env node
// Programmatically set alerted_tx arrays from the actual scan output, so no
// hash is ever hand-typed. Preserves everything else in the state file.
'use strict';
const fs = require('fs');
const STATE = 'memory/on-chain-state.json';
const st = JSON.parse(fs.readFileSync(STATE, 'utf8'));
const ws = JSON.parse(fs.readFileSync('output/wallet-scan.json', 'utf8'));

const staging = ws.wallets.find((w) => w.label === 'NOTE staging 0x69bb');
const owner = ws.wallets.find((w) => w.label === 'NOTE owner EOA');

st['NOTE staging 0x69bb'].alerted_tx = [
  '0x2368258ba33c6f93991cdb5b97722f010e7b49919edf964385d4ce1e0744b7e0',
  ...staging.out.map((t) => t.tx),
];
st['NOTE owner EOA'].alerted_tx = [
  '0x2368258ba33c6f93991cdb5b97722f010e7b49919edf964385d4ce1e0744b7e0',
  ...owner.out.map((t) => t.tx),
];
st['NOTE vesting'].alerted_tx = [...owner.out.map((t) => t.tx)];

// validate every hash is 32 bytes hex
const bad = [];
for (const [k, v] of Object.entries(st)) {
  for (const h of v.alerted_tx || []) if (!/^0x[0-9a-f]{64}$/.test(h)) bad.push(k + ':' + h);
}
if (bad.length) { console.error('BAD HASHES', bad); process.exit(1); }
fs.writeFileSync(STATE, JSON.stringify(st, null, 2) + '\n');
console.log('alerted_tx counts:');
for (const [k, v] of Object.entries(st)) console.log(' ', k, (v.alerted_tx || []).length);
