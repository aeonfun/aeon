#!/usr/bin/env node
// Wallet-type watch scanner for Robinhood chain.
// An EOA emits no logs, so `eth_getLogs{address: EOA}` always returns zero --
// a false "quiet". Correct shape is a topic filter on the token contract:
//   incoming: topics [Transfer, null, padded(wallet)]
//   outgoing: topics [Transfer, padded(wallet)]
// Covers ERC-20 only; native ETH movement is covered by the balance witness.
'use strict';
const fs = require('fs');
const RH = 'https://rpc.mainnet.chain.robinhood.com';
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const TOKENS = { NOTE: '0xc4f730335fb9e439ca5552f7b52b8e638c4245b0' };
const CAP = 24000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stats = { calls: 0, err429: 0 };

async function post(method, params, timeout = 30000) {
  stats.calls++;
  const res = await fetch(RH, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(timeout),
  });
  const txt = await res.text();
  if (res.status === 429) { stats.err429++; throw Object.assign(new Error('http-429'), { retryable: true }); }
  if (!res.ok) throw Object.assign(new Error('http-' + res.status), { retryable: true });
  let j; try { j = JSON.parse(txt); } catch { throw Object.assign(new Error('bad-json'), { retryable: true }); }
  if (j.error) {
    const e = new Error(j.error.message || 'rpc-error');
    if (/exceed|too large|limit|range/i.test(e.message)) e.rangeLimit = true;
    throw e;
  }
  return j.result;
}
async function rpc(method, params, timeout) {
  let last;
  for (let a = 0; a < 6; a++) {
    try { return await post(method, params, timeout); }
    catch (e) { last = e; if (e.rangeLimit) throw e; await sleep(e.message === 'http-429' ? 3000 * (a + 1) : 600 * (a + 1)); }
  }
  throw last;
}
async function walk(filter, from, to) {
  let cap = CAP, out = [], lo = from;
  while (lo <= to) {
    let hi = Math.min(lo + cap - 1, to), done = false, guard = 0;
    while (!done) {
      try {
        const logs = await rpc('eth_getLogs', [{ ...filter, fromBlock: '0x' + lo.toString(16), toBlock: '0x' + hi.toString(16) }]);
        out.push(...(logs || [])); done = true;
      } catch (e) {
        guard++;
        if (e.rangeLimit && hi > lo && guard < 12) { cap = Math.max(100, Math.floor(cap / 2)); hi = Math.min(lo + cap - 1, to); }
        else if (guard < 10) await sleep(1500 * guard);
        else throw e;
      }
      await sleep(150);
    }
    lo = hi + 1;
  }
  return out;
}
const pad = (a) => '0x' + a.slice(2).toLowerCase().padStart(64, '0');

(async () => {
  const target = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const outPath = process.argv[3];
  const head = parseInt(await rpc('eth_blockNumber', []), 16);
  const res = { at: new Date().toISOString(), head, wallets: [] };

  for (const w of target) {
    const e = { label: w.label, address: w.address, from_block: w.from_block, to_block: head };
    try {
      const IN = await walk({ address: TOKENS.NOTE, topics: [TRANSFER, null, pad(w.address)] }, w.from_block, head);
      const OUT = await walk({ address: TOKENS.NOTE, topics: [TRANSFER, pad(w.address)] }, w.from_block, head);
      e.in = IN.map((l) => ({ tx: l.transactionHash, block: parseInt(l.blockNumber, 16), from: '0x' + l.topics[1].slice(26), amt: l.data, logIndex: parseInt(l.logIndex, 16) }));
      e.out = OUT.map((l) => ({ tx: l.transactionHash, block: parseInt(l.blockNumber, 16), to: '0x' + l.topics[2].slice(26), amt: l.data, logIndex: parseInt(l.logIndex, 16) }));
      e.status = 'ok';
    } catch (err) { e.status = 'fail'; e.error = err.message; }
    console.error(`${w.label}: ${e.status} in=${(e.in || []).length} out=${(e.out || []).length} ${e.error || ''}`);
    res.wallets.push(e);
  }

  // timestamps
  const want = new Set();
  for (const w of res.wallets) for (const l of [...(w.in || []), ...(w.out || [])]) want.add(l.block);
  res.ts = {};
  for (const b of [...want]) {
    try { const blk = await rpc('eth_getBlockByNumber', ['0x' + b.toString(16), false]); res.ts[b] = blk?.timestamp ? parseInt(blk.timestamp, 16) : null; }
    catch { res.ts[b] = null; }
  }
  res.stats = stats;
  fs.writeFileSync(outPath, JSON.stringify(res, null, 1));
  console.error('DONE calls=' + stats.calls + ' err429=' + stats.err429);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
