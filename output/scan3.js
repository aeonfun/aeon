#!/usr/bin/env node
// On-chain incremental scanner v3.
// Provider choice is per-chain based on observed limits, not keyed preference:
//   robinhood -> public RPC (25k-block eth_getLogs cap, no key, no 429 wall)
//   base      -> tenderly public gateway (900-block cap)
// Sequential with throttling; 429 backoff. Writes JSON to argv[2].
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const CHAINS = {
  robinhood: {
    primary: 'https://rpc.mainnet.chain.robinhood.com',
    name: 'robinhood-public',
    cap: 24000,
    delay: 120,
  },
  base: {
    primary: 'https://base.gateway.tenderly.co',
    name: 'tenderly-public',
    cap: 900,
    delay: 250,
  },
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
const stats = { calls: 0, retries: 0, err429: 0 };

async function post(url, method, params, timeout = 30000) {
  stats.calls++;
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(timeout),
  });
  const txt = await res.text();
  if (res.status === 429) { stats.err429++; throw Object.assign(new Error('http-429'), { retryable: true }); }
  if (!res.ok) throw Object.assign(new Error('http-' + res.status), { retryable: true });
  let j;
  try { j = JSON.parse(txt); } catch { throw Object.assign(new Error('bad-json'), { retryable: true }); }
  if (j.error) {
    const e = new Error(j.error.message || 'rpc-error');
    if (/exceed|too large|limit|range/i.test(e.message)) e.rangeLimit = true;
    throw e;
  }
  return j.result;
}

async function rpc(chain, method, params, timeout) {
  const c = CHAINS[chain];
  let last;
  for (let attempt = 0; attempt < 6; attempt++) {
    try { return await post(c.primary, method, params, timeout); }
    catch (e) {
      last = e;
      if (e.rangeLimit) throw e;
      stats.retries++;
      await sleep(e.message === 'http-429' ? 3000 * (attempt + 1) : 600 * (attempt + 1));
    }
  }
  throw last;
}

async function getLogsRange(chain, filter, from, to) {
  const c = CHAINS[chain];
  let cap = c.cap;
  const out = [];
  let lo = from;
  while (lo <= to) {
    let hi = Math.min(lo + cap - 1, to);
    let done = false, guard = 0;
    while (!done) {
      try {
        const logs = await rpc(chain, 'eth_getLogs', [{ ...filter, fromBlock: '0x' + lo.toString(16), toBlock: '0x' + hi.toString(16) }]);
        out.push(...(logs || []));
        done = true;
      } catch (e) {
        guard++;
        if (e.rangeLimit && hi > lo && guard < 12) {
          cap = Math.max(50, Math.floor(cap / 2));
          hi = Math.min(lo + cap - 1, to);
        } else if (guard < 10) { await sleep(1500 * guard); }
        else throw e;
      }
      await sleep(c.delay);
    }
    lo = hi + 1;
  }
  return { logs: out, chunk: cap, provider: c.name };
}

(async () => {
  const outPath = process.argv[2];
  const only = process.argv[3] || '';
  const watches = parseWatches(fs.readFileSync(path.join(ROOT, 'memory/on-chain-watches.yml'), 'utf8'));
  const state = JSON.parse(fs.readFileSync(path.join(ROOT, 'memory/on-chain-state.json'), 'utf8'));

  const heads = {};
  for (const c of Object.keys(CHAINS)) {
    try { heads[c] = parseInt(await rpc(c, 'eth_blockNumber', []), 16); } catch (e) { heads[c] = null; console.error('head ' + c + ' fail: ' + e.message); }
  }
  console.error('heads ' + JSON.stringify(heads));

  const result = { at: new Date().toISOString(), heads, watches: [] };

  for (const w of watches) {
    if (only && w.label !== only && w.chain !== only) continue;
    const st = state[w.label] || {};
    const h = heads[w.chain];
    const e = { label: w.label, chain: w.chain, type: w.type, threshold_usd: w.threshold_usd, address: w.address, event_topics: w.event_topics };
    if (!h) { e.status = 'fail'; e.error = 'no-head'; result.watches.push(e); continue; }
    e.is_new = !st.last_block;
    e.from_block = st.last_block ? st.last_block + 1 : h - (w.chain === 'robinhood' ? 280000 : 2400);
    e.to_block = h;
    e.blocks = e.to_block - e.from_block + 1;

    const filter = w.event_topics && w.event_topics.length ? { address: w.address, topics: [w.event_topics] } : { address: w.address };
    try {
      const r = await getLogsRange(w.chain, filter, e.from_block, e.to_block);
      e.status = 'ok'; e.provider = r.provider; e.chunk = r.chunk; e.raw_logs = r.logs.length;
      e.logs = r.logs.map((l) => ({ tx: l.transactionHash, block: parseInt(l.blockNumber, 16), addr: (l.address || '').toLowerCase(), topics: l.topics.map((t) => t.toLowerCase()), data: l.data }));
    } catch (err) {
      e.status = 'fail'; e.error = err.message;
    }
    console.error(`  ${w.label}: ${e.status} raw=${e.raw_logs ?? '-'} ${e.error || ''}`);
    result.watches.push(e);
  }

  // timestamps only for blocks that produced logs
  const want = new Set();
  for (const e of result.watches) for (const l of (e.logs || [])) want.add(e.chain + ':' + l.block);
  result.ts = {};
  for (const k of [...want]) {
    const [c, b] = k.split(':');
    try { const blk = await rpc(c, 'eth_getBlockByNumber', ['0x' + Number(b).toString(16), false]); result.ts[k] = blk?.timestamp ? parseInt(blk.timestamp, 16) : null; }
    catch { result.ts[k] = null; }
  }

  result.stats = stats;
  fs.writeFileSync(outPath, JSON.stringify(result, null, 1));
  console.error('DONE calls=' + stats.calls + ' retries=' + stats.retries + ' err429=' + stats.err429);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
