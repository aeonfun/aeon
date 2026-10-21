const fs = require('fs');
const https = require('https');
const logs = JSON.parse(fs.readFileSync('tl_logs.json', 'utf8'));
const w = (h, i) => h.slice(2 + i * 64, 2 + (i + 1) * 64);
const addr = x => '0x' + x.slice(24).toLowerCase();
const num = x => (x && /^[0-9a-fA-F]+$/.test(x) ? BigInt('0x' + x) : 0n);

function inner(hex) {
  const s = hex.slice(0, 8);
  if (s === 'a9059cbb') {
    const to = '0x' + hex.slice(32, 72);
    const a = BigInt('0x' + hex.slice(72, 136));
    return 'transfer(' + to + ', ' + (Number(a) / 1e18).toLocaleString() + ' NOTE)';
  }
  if (s === 'dd46508f') return 'modifyLiquidities (swap/LP)';
  if (s === '79ba5097') return 'acceptOwnership()';
  return 'sel ' + s + ' len=' + ((hex.length - 8) / 2);
}

function rpc(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
    const req = https.request('https://rpc.mainnet.chain.robinhood.com', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 20000,
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { const j = JSON.parse(d); j.error ? reject(new Error('e')) : resolve(j.result); } catch (e) { reject(e); } }); });
    req.on('error', reject); req.write(body); req.end();
  });
}

(async () => {
  const rows = [];
  for (const l of logs) {
    const t0 = l.topics[0], d = l.data, blk = parseInt(l.blockNumber, 16);
    if (t0.startsWith('0x4cf4410c') && d.length >= 2 + 7 * 64) {
      const target = addr(w(d, 0));
      const off = Number(num(w(d, 2)));
      const len = Number(num(d.slice(2 + off, 2 + off + 64)));
      const inn = d.slice(2 + off + 64, 2 + off + 64 + len * 2);
      const delay = num(w(d, 5));
      rows.push({ kind: 'SCHEDULE', blk, target, delay: Number(delay), action: inner(inn) });
    } else if (t0.startsWith('0xc2617efa') && d.length >= 2 + 4 * 64) {
      const target = addr(w(d, 0));
      const off = Number(num(w(d, 2)));
      const len = Number(num(d.slice(2 + off, 2 + off + 64)));
      const inn = d.slice(2 + off + 64, 2 + off + 64 + len * 2);
      rows.push({ kind: 'EXECUTE', blk, target, delay: 0, action: inner(inn) });
    }
  }
  const cache = new Map();
  for (const r of rows) {
    if (!cache.has(r.blk)) {
      const b = await rpc('eth_getBlockByNumber', ['0x' + r.blk.toString(16), false]);
      cache.set(r.blk, parseInt(b.timestamp, 16));
    }
    const ts = cache.get(r.blk);
    const iso = new Date(ts * 1000).toISOString().replace('.000', '');
    const eta = r.kind === 'SCHEDULE' ? new Date((ts + r.delay) * 1000).toISOString().replace('.000', '') : '';
    console.log(`${r.kind.padEnd(8)} blk=${r.blk} ${iso} target=${r.target} ${r.kind === 'SCHEDULE' ? 'delay=' + r.delay + 's eta=' + eta : ''} | ${r.action}`);
  }
})();
