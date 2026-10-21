#!/usr/bin/env node
// On-chain incremental scanner for onchain-monitor.
// Reads watches from memory/on-chain-watches.yml (simple block parser) and
// state from memory/on-chain-state.json, walks each watch's window in RPC-sized
// chunks, and prints a JSON summary to stdout. Untrusted on-chain data is only
// ever held as data here — never interpolated into shell.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WATCHES = path.join(ROOT, 'memory/on-chain-watches.yml');
const STATE = path.join(ROOT, 'memory/on-chain-state.json');

const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// ---------- minimal YAML block parser (only the shapes this file uses) ----------
function parseWatches(text) {
  const lines = text.split('\n');
  const out = [];
  let cur = null;
  let inTopics = false;
  for (const raw of lines) {
    const line = raw.replace(/\s+#.*$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (/^watches:\s*$/.test(line)) continue;
    let m = line.match(/^\s*-\s+label:\s*"?([^"]*)"?\s*$/);
    if (m) {
      if (cur) out.push(cur);
      cur = { label: m[1], event_topics: [] };
      inTopics = false;
      continue;
    }
    if (!cur) continue;
    m = line.match(/^\s*-\s+"(0x[0-9a-fA-F]{64})"\s*$/);
    if (m && inTopics) { cur.event_topics.push(m[1].toLowerCase()); continue; }
    m = line.match(/^\s*([a-z_]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim().replace(/^"(.*)"$/, '$1').replace(/\s+#.*$/, '');
    if (key === 'event_topics') { inTopics = true; continue; }
    if (key === 'address') { cur.address = val.toLowerCase(); inTopics = false; }
    else if (key === 'chain') { cur.chain = val.toLowerCase(); inTopics = false; }
    else if (key === 'type') { cur.type = val.toLowerCase(); inTopics = false; }
    else if (key === 'threshold_usd') { cur.threshold_usd = Number(val); inTopics = false; }
  }
  if (cur) out.push(cur);
  return out;
}

// ---------- RPC ----------
const RPCS = {
  base: process.env.BASE_RPC_URL,
  robinhood: process.env.RH_RPC_URL,
};
const FALLBACK = {
  base: 'https://base.gateway.tenderly.co',
  robinhood: 'https://rpc.mainnet.chain.robinhood.com',
};
const CHUNK = { base: 900, robinhood: 25000 };

let rpcCalls = 0;
async function rpc(chain, method, params, tries = 3) {
  const urls = [RPCS[chain], FALLBACK[chain]].filter(Boolean);
  let lastErr = null;
  for (const url of urls) {
    for (let t = 0; t < tries; t++) {
      try {
        rpcCalls++;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
          signal: AbortSignal.timeout(25000),
        });
        const txt = await res.text();
        if (res.status === 429) { await sleep(1200 * (t + 1)); lastErr = new Error('http-429'); continue; }
        if (!res.ok) { lastErr = new Error('http-' + res.status); continue; }
        let j;
        try { j = JSON.parse(txt); } catch { lastErr = new Error('bad-json'); continue; }
        if (j.error) {
          const msg = j.error.message || JSON.stringify(j.error);
          lastErr = new Error(msg);
          // range/limit errors are handled by caller shrinking the chunk
          if (/exceed|too large|limit|range/i.test(msg)) throw lastErr;
          continue;
        }
        return j.result;
      } catch (e) {
        lastErr = e;
        if (/exceed|too large|limit of|range/i.test(e.message)) throw e;
      }
    }
  }
  throw lastErr || new Error('rpc-failed');
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getLogsChunked(chain, filter, fromBlock, toBlock, stats) {
  let out = [];
  let size = CHUNK[chain];
  let lo = fromBlock;
  while (lo <= toBlock) {
    let hi = Math.min(lo + size - 1, toBlock);
    let ok = false;
    let attempts = 0;
    while (!ok) {
      try {
        const logs = await rpc(chain, 'eth_getLogs', [{ ...filter, fromBlock: '0x' + lo.toString(16), toBlock: '0x' + hi.toString(16) }]);
        out = out.concat(logs || []);
        stats.windows++;
        ok = true;
      } catch (e) {
        attempts++;
        if (/exceed|too large|limit|range|max results/i.test(e.message) && hi > lo && attempts < 12) {
          size = Math.max(1, Math.floor(size / 4));
          hi = Math.min(lo + size - 1, toBlock);
          stats.shrinks++;
        } else if (attempts < 5) {
          await sleep(800 * attempts);
        } else {
          throw e;
        }
      }
    }
    lo = hi + 1;
  }
  return out;
}

// ---------- main ----------
async function main() {
  const watches = parseWatches(fs.readFileSync(WATCHES, 'utf8'));
  const state = JSON.parse(fs.readFileSync(STATE, 'utf8'));
  const only = process.argv[2] || '';

  const filterBy = only ? (w) => w.label === only || w.chain === only : () => true;

  const result = { generated_at: new Date().toISOString(), watches: [], sources: {}, rpc_calls: 0 };

  // heads
  const heads = {};
  for (const chain of ['base', 'robinhood']) {
    try { heads[chain] = parseInt(await rpc(chain, 'eth_blockNumber', []), 16); }
    catch (e) { heads[chain] = null; result.sources[chain] = 'head-fail: ' + e.message; }
  }
  result.heads = heads;

  for (const w of watches) {
    if (!filterBy(w)) continue;
    const st = state[w.label] || {};
    const head = heads[w.chain];
    const entry = { label: w.label, chain: w.chain, type: w.type, threshold_usd: w.threshold_usd, address: w.address, event_topics: w.event_topics };
    if (!head) { entry.status = 'fail'; entry.error = 'no head for chain'; result.watches.push(entry); continue; }

    const isNew = !st.last_block;
    const from = isNew
      ? head - (w.chain === 'robinhood' ? 280000 : 2400)
      : st.last_block + 1;
    entry.from_block = from;
    entry.to_block = head;
    entry.blocks = head - from + 1;
    entry.is_new = isNew;

    const stats = { windows: 0, shrinks: 0 };
    const filter = w.event_topics && w.event_topics.length
      ? { address: w.address, topics: [w.event_topics] }
      : { address: w.address };
    try {
      const logs = await getLogsChunked(w.chain, filter, from, head, stats);
      entry.status = 'ok';
      entry.raw_logs = logs.length;
      entry.windows = stats.windows;
      entry.shrinks = stats.shrinks;
      entry.logs = logs.map((l) => ({
        tx: l.transactionHash,
        block: parseInt(l.blockNumber, 16),
        address: (l.address || '').toLowerCase(),
        topic0: (l.topics[0] || '').toLowerCase(),
        topics: l.topics.map((t) => t.toLowerCase()),
        data: l.data,
        index: parseInt(l.logIndex, 16),
      }));
    } catch (e) {
      entry.status = 'fail';
      entry.error = e.message;
      entry.windows = stats.windows;
    }
    result.watches.push(entry);
  }

  // block timestamps for interesting blocks (dedup)
  const want = new Set();
  for (const w of result.watches) for (const l of (w.logs || [])) want.add(w.chain + ':' + l.block);
  result.timestamps = {};
  for (const key of want) {
    const [chain, blk] = key.split(':');
    try {
      const b = await rpc(chain, 'eth_getBlockByNumber', ['0x' + Number(blk).toString(16), false]);
      result.timestamps[key] = b && b.timestamp ? parseInt(b.timestamp, 16) : null;
    } catch { result.timestamps[key] = null; }
  }
  result.rpc_calls = rpcCalls;
  console.log(JSON.stringify(result, null, 1));
}

main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
