const https = require('https');
const fs = require('fs');
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
function rpc(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
    const req = https.request(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 40000 },
      res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { const j = JSON.parse(d); j.error ? reject(new Error(JSON.stringify(j.error).slice(0,120))) : resolve(j.result); } catch (e) { reject(new Error(d.slice(0,120))); } }); });
    req.on('error', reject); req.on('timeout', () => req.destroy(new Error('timeout')));
    req.write(body); req.end();
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const TOKEN = '0xc4f730335fb9e439ca5552f7b52b8e638c4245b0';
const TL = '0x4a53afd9c4d707c8fddd6415947ef0a1e67518b8';
const T = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const TLTOPIC = '0x000000000000000000000000' + TL.slice(2);

(async () => {
  const latest = parseInt(await rpc('eth_blockNumber', []), 16);
  const days = parseFloat(process.argv[2] || '30');
  const span = Math.round(days * 864000);
  const from = Math.max(0, latest - span);
  console.log(`latest=${latest} from=${from} days=${days}`);

  // test window size with topic filter
  for (const W of [50000, 100000, 200000, 400000]) {
    const lo = latest - W, hi = latest;
    try {
      const r = await rpc('eth_getLogs', [{ address: TOKEN, fromBlock: '0x' + lo.toString(16), toBlock: '0x' + hi.toString(16), topics: [T, TLTOPIC] }]);
      console.log('window', W, 'OK logs', r.length);
    } catch (e) { console.log('window', W, 'ERR', e.message.slice(0, 90)); }
    await sleep(300);
  }

  const WINDOW = 200000;
  const logs = [];
  let windows = 0, fails = 0;
  for (let lo = from; lo <= latest; lo += WINDOW) {
    const hi = Math.min(lo + WINDOW - 1, latest);
    let res = null;
    for (let t = 0; t < 3; t++) {
      try { res = await rpc('eth_getLogs', [{ address: TOKEN, fromBlock: '0x' + lo.toString(16), toBlock: '0x' + hi.toString(16), topics: [T, TLTOPIC] }]); break; }
      catch (e) { if (t === 2) { fails++; } await sleep(500); }
    }
    if (res) logs.push(...res);
    windows++;
    if (windows % 20 === 0) console.log(`  ${windows} windows, ${logs.length} tl-out logs`);
  }
  console.log(`done windows=${windows} fails=${fails} tlOut=${logs.length}`);
  fs.writeFileSync('tl_out.json', JSON.stringify({ latest, from, logs }));
})();
