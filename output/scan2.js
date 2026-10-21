#!/usr/bin/env node
// On-chain incremental scanner v2 — explicit per-provider chunk sizes, bounded
// concurrency, writes JSON to a path passed as argv[3].
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// Provider endpoints + per-provider eth_getLogs range caps (observed, not guessed)
const PROVIDERS = {
  base: [
    { name: 'infura', url: process.env.BASE_RPC_URL, cap: 900 },
    { name: 'tenderly', url: 'https://base.gateway.tenderly.co', cap: 900 },
  ],
  robinhood: [
    { name: 'infura', url: process.env.RH_RPC_URL, cap: 9500 },
    { name: 'public', url: 'https://rpc.mainnet.chain.robinhood.com', cap: 25000 },
  ],
};

function parseWatches(text) {
  const out = [];
  let cur = null, inTopics = false;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+#.*$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (/^watches:\s*$/.test(line)) continue;
    let m = line.match(/^\s*-\s+label:\s*"?([^"]*)"?\s*$/);
    if (m) { if (cur) out.push(cur); cur = { label: m[1], event_topics: [] }; inTopics = false; continue; }
    if (!cur) continue;
    m = line.match(/^\s*-\s+"(0x[0-9a-fA-F]{64})"\s*$/);
    if (m && inTopics) { cur.event_topics.push(m[1].toLowerCase()); continue; }
    m = line.match(/^\s*([a-z_]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim().replace(/^"(.*)"$/, '$1').replace(/\s+#.*$/, '');
    if (key === 'event_topics') { inTopics = true; continue; }
    inTopics = false;
    if (key === 'address') cur.address = val.toLowerCase();
    else if (key === 'chain') cur.chain = val.toLowerCase();
    else if (key === 'type') cur.type = val.toLowerCase();
    else if (key === 'threshold_usd') cur.threshold_usd = Number(val);
  }
  if (cur) out.push(cur);
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stats = { calls: 0, retries: 0 };

async function callOnce(url, method, params, timeout = 25000) {
  stats.calls++;
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(timeout),
  });
  if (res.status === 429) throw Object.assign(new Error('http-429'), { retryable: true });
  if (!res.ok) throw Object.assign(new Error('http-' + res.status), { retryable: true });
  const j = await res.json();
  if (j.error) {
    const e = new Error(j.error.message || 'rpc-error');
    e.rangeLimit = /exceed|too large|limit/i.test(e.message);
    throw e;
  }
  return j.result;
}

async function call(chain, method, params, timeout) {
  const provs = PROVIDERS[chain].filter((p) => p.url);
  let last;
  for (const p of provs) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try { return { provider: p.name, result: await callOnce(p.url, method, params, timeout) }; }
      catch (e) {
        last = e;
        if (e.rangeLimit) throw e;
        stats.retries++;
        await sleep(500 * (attempt + 1));
      }
    }
  }
  throw last || new Error('no-provider');
}

async function head(chain) {
  const r = await call(chain, 'eth_blockNumber', []);
  return parseInt(r.result, 16);
}

// Sequential per provider chunk walk; rejects chunk size on range-limit errors.
async function getLogsRange(chain, filter, from, to) {
  const provs = PROVIDERS[chain].filter((p) => p.url);
  let provider = null, cap = null;
  for (const p of provs) {
    // quick probe: does this provider answer a 1-block query?
    try { await callOnce(p.url, 'eth_getLogs', [{ ...filter, fromBlock: '0x' + to.toString(16), toBlock: '0x' + to.toString(16) }]); provider = p; cap = p.cap; break; }
    catch { /* next */ }
  }
  if (!provider) throw new Error('no-working-provider');

  const out = [];
  let lo = from;
  while (lo <= to) {
    let hi = Math.min(lo + cap - 1, to);
    let done = false, guard = 0;
    while (!done) {
      try {
        const logs = await callOnce(provider.url, 'eth_getLogs', [{ ...filter, fromBlock: '0x' + lo.toString(16), toBlock: '0x' + hi.toString(16) }]);
        out.push(...(logs || []));
        done = true;
      } catch (e) {
        guard++;
        if (e.rangeLimit && hi > lo && guard < 15) {
          cap = Math.max(50, Math.floor(cap / 2));
          hi = Math.min(lo + cap - 1, to);
        } else if (e.retryable && guard < 8) { await sleep(700 * guard); }
        else throw e;
      }
    }
    lo = hi + 1;
  }
  return { logs: out, provider: provider.name, chunk: cap };
}

(async () => {
  const outPath = process.argv[2];
  const only = process.argv[3] || '';
  const watches = parseWatches(fs.readFileSync(path.join(ROOT, 'memory/on-chain-watches.yml'), 'utf8'));
  const state = JSON.parse(fs.readFileSync(path.join(ROOT, 'memory/on-chain-state.json'), 'utf8'));

  const heads = {};
  for (const c of ['base', 'robinhood']) {
    try { heads[c] = await head(c); } catch (e) { heads[c] = null; }
  }

  const result = { at: new Date().toISOString(), heads, watches: [] };
  const jobs = [];
  for (const w of watches) {
    if (only && w.label !== only && w.chain !== only) continue;
    const st = state[w.label] || {};
    const h = heads[w.chain];
    const e = { label: w.label, chain: w.chain, type: w.type, threshold_usd: w.threshold_usd, address: w.address, event_topics: w.event_topics };
    if (!h) { e.status = 'fail'; e.error = 'no-head'; result.watches.push(e); continue; }
    e.is_new = !st.last_block;
    e.from_block = st.last_block ? st.last_block + 1 : h - (w.chain === 'robinhood' ? 280000 : 2400);
    e.to_block = h;
    result.watches.push(e);
    jobs.push({ w, e, st });
  }

  // run 4 at a time
  let idx = 0;
  async function worker() {
    while (idx < jobs.length) {
      const j = jobs[idx++];
      const { w, e } = j;
      const filter = w.event_topics && w.event_topics.length ? { address: w.address, topics: [w.event_topics] } : { address: w.address };
      try {
        const r = await getLogsRange(w.chain, filter, e.from_block, e.to_block);
        e.status = 'ok'; e.provider = r.provider; e.chunk = r.chunk; e.raw_logs = r.logs.length;
        e.logs = r.logs.map((l) => ({ tx: l.transactionHash, block: parseInt(l.blockNumber, 16), addr: (l.address || '').toLowerCase(), t0: (l.topics[0] || '').toLowerCase(), topics: l.topics.map((t) => t.toLowerCase()), data: l.data }));
      } catch (err) {
        e.status = 'fail'; e.error = err.message;
      }
    }
  }
  await Promise.all([0, 1, 2, 3].map(worker));

  // timestamps
  const want = new Set();
  for (const e of result.watches) for (const l of (e.logs || [])) want.add(e.chain + ':' + l.block);
  result.ts = {};
  const keys = [...want];
  for (let i = 0; i < keys.length; i += 6) {
    await Promise.all(keys.slice(i, i + 6).map(async (k) => {
      const [c, b] = k.split(':');
      try { const blk = await call(c, 'eth_getBlockByNumber', ['0x' + Number(b).toString(16), false]); result.ts[k] = blk.result?.timestamp ? parseInt(blk.result.timestamp, 16) : null; }
      catch { result.ts[k] = null; }
    }));
  }
  result.stats = stats;
  fs.writeFileSync(outPath, JSON.stringify(result, null, 1));
  console.error('wrote ' + outPath + ' calls=' + stats.calls);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
