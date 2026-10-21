const https = require('https');
const fs = require('fs');
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
function rpc(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
    const req = https.request(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 25000 },
      res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { const j = JSON.parse(d); j.error ? reject(new Error(JSON.stringify(j.error).slice(0,120))) : resolve(j.result); } catch (e) { reject(new Error(d.slice(0,120))); } }); });
    req.on('error', reject); req.on('timeout', () => req.destroy(new Error('timeout')));
    req.write(body); req.end();
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const evs = JSON.parse(fs.readFileSync('evs.json', 'utf8'));
  const POOL = '0x8366a39cc670b4001a1121b8f6a443a643e40951';
  const TL = '0x4a53afd9c4d707c8fddd6415947ef0a1e67518b8';
  const OWNER = '0x0b64b35c6dd23944d6d4029864d2ca2aa1b66422';

  // flow through the v4 PoolManager
  let intoPool = 0, outOfPool = 0;
  for (const e of evs) {
    if (e.to === POOL) intoPool += e.amt;
    if (e.from === POOL) outOfPool += e.amt;
  }
  console.log('POOL NOTE in (sells):', intoPool.toFixed(2), 'out (buys):', outOfPool.toFixed(2), 'net:', (intoPool - outOfPool).toFixed(2));

  // timelock activity
  const tlEvs = evs.filter(e => e.from === TL || e.to === TL);
  console.log('\nTIMELOCK events:', tlEvs.length);
  for (const e of tlEvs) console.log('  ', e.amt.toFixed(2), e.from, '->', e.to, e.tx, 'block', e.block);

  const ownerEvs = evs.filter(e => e.from === OWNER || e.to === OWNER);
  console.log('\nOWNER(0x0b64..) events:', ownerEvs.length);
  for (const e of ownerEvs) console.log('  ', e.amt.toFixed(2), e.from, '->', e.to, e.tx, 'block', e.block);

  // timestamps for unique blocks of the big ones
  const blocks = [...new Set([...tlEvs, ...ownerEvs].map(e => e.block))].sort();
  for (const b of blocks.slice(0, 20)) {
    try {
      const blk = await rpc('eth_getBlockByNumber', ['0x' + b.toString(16), false]);
      const ts = parseInt(blk.timestamp, 16);
      console.log('block', b, new Date(ts * 1000).toISOString());
    } catch (e) { console.log('block', b, 'ERR'); }
    await sleep(80);
  }

  // concentration: top holders we saw
  const bal = new Map();
  const holders = new Set();
  for (const e of evs) { holders.add(e.from); holders.add(e.to); }
  const big = [...holders].filter(a => a !== '0x0000000000000000000000000000000000000000');
  const out = [];
  for (const a of big) {
    try {
      const r = await rpc('eth_call', [{ to: '0xc4f730335fb9e439ca5552f7b52b8e638c4245b0', data: '0x70a08231' + '000000000000000000000000' + a.slice(2) }, 'latest']);
      out.push({ a, bal: Number(BigInt(r)) / 1e18 });
    } catch (e) {}
    await sleep(45);
  }
  out.sort((x, y) => y.bal - x.bal);
  fs.writeFileSync('holders.json', JSON.stringify(out));
  const total = 60000000;
  console.log('\nTOP HOLDERS (of addresses seen in 24h logs):');
  for (const h of out.slice(0, 12)) console.log('  ', h.bal.toFixed(0).padStart(10), (h.bal / total * 100).toFixed(2) + '%', h.a);
  const sum = out.reduce((s, h) => s + h.bal, 0);
  console.log('  sum of sampled holders:', (sum / 1e6).toFixed(2) + 'M', '=', (sum / total * 100).toFixed(1) + '% of supply');
})();
