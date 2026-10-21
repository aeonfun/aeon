const fs = require('fs');
const https = require('https');
const logs = JSON.parse(fs.readFileSync('tl_logs.json', 'utf8'));
const w = (h, i) => h.slice(2 + i * 64, 2 + (i + 1) * 64);
const num = x => (x && /^[0-9a-fA-F]+$/.test(x) ? BigInt('0x' + x) : 0n);
const addr = x => '0x' + x.slice(24).toLowerCase();

function rpc(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
    const req = https.request('https://rpc.mainnet.chain.robinhood.com', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 25000,
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { const j = JSON.parse(d); j.error ? reject(new Error('e')) : resolve(j.result); } catch (e) { reject(e); } }); });
    req.on('error', reject); req.write(body); req.end();
  });
}

// CallScheduled data layout (OZ TimelockController):
// 0: id, 1: index, 2: target, 3: value, 4: data offset, 5: predecessor, 6: delay
// CallExecuted: 0: id, 1: index, 2: target, 3: value, 4: data offset
(async () => {
  const out = [];
  for (const l of logs) {
    const t0 = l.topics[0], d = l.data, blk = parseInt(l.blockNumber, 16);
    if (!t0.startsWith('0x4cf4410c') && !t0.startsWith('0xc2617efa')) continue;
    const isSched = t0.startsWith('0x4cf4410c');
    const target = addr(w(d, 2));
    const dataOff = Number(num(w(d, 4)));
    const len = Number(num(d.slice(2 + dataOff, 2 + dataOff + 64)));
    const inn = d.slice(2 + dataOff + 64, 2 + dataOff + 64 + len * 2);
    const delay = isSched ? Number(num(w(d, 6))) : 0;
    out.push({ kind: isSched ? 'SCHEDULE' : 'EXECUTE', blk, target, delay, inner: inn });
  }
  const cache = new Map();
  for (const r of out) {
    if (!cache.has(r.blk)) {
      const b = await rpc('eth_getBlockByNumber', ['0x' + r.blk.toString(16), false]);
      cache.set(r.blk, parseInt(b.timestamp, 16));
    }
    const ts = cache.get(r.blk);
    const iso = new Date(ts * 1000).toISOString().replace('.000', '');
    const eta = r.kind === 'SCHEDULE' ? new Date((ts + r.delay) * 1000).toISOString().replace('.000', '') : '';
    let act;
    const s = r.inner.slice(0, 8), a = '0x' + r.inner.slice(8 + 24, 8 + 64), amt = r.inner.length >= 136 ? BigInt('0x' + r.inner.slice(8 + 64, 8 + 128)) : 0n;
    if (s === 'a9059cbb') act = 'transfer(' + a + ', ' + (Number(amt) / 1e18).toLocaleString() + ' NOTE)';
    else if (s === 'dd46508f') act = 'modifyLiquidities(swap/LP) len=' + (r.inner.length / 2 - 4) + 'B';
    else if (s === '79ba5097') act = 'acceptOwnership()';
    else act = 'sel=' + s + ' len=' + (r.inner.length / 2 - 4) + 'B';
    console.log(`${r.kind.padEnd(8)} ${iso} blk=${r.blk} target=${r.target}${r.kind === 'SCHEDULE' ? ' delay=' + r.delay + 's eta=' + eta : ''}\n         -> ${act}`);
  }
})();
