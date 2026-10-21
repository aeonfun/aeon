const https = require('https');
const fs = require('fs');

const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const TOKEN = '0xc4f730335fb9e439ca5552f7b52b8e638c4245b0';

function rpc(method, params, tries = 4) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
    const req = https.request(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 45000,
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          if (j.error) return reject(new Error(JSON.stringify(j.error).slice(0, 200)));
          resolve(j.result);
        } catch (e) { reject(new Error('parse: ' + d.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.write(body);
    req.end();
  });
}

sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const latest = parseInt(await rpc('eth_blockNumber', []), 16);
  const hours = parseFloat(process.argv[2] || '24');
  // ~0.1s blocks => 860k blocks/day
  const span = Math.round(hours * 3600 * 10);
  const from = latest - span;
  console.log(`latest=${latest} from=${from} span=${span} hours=${hours}`);

  const WINDOW = 5000;
  const logs = [];
  let windows = 0, fails = 0;
  for (let lo = from; lo <= latest; lo += WINDOW) {
    const hi = Math.min(lo + WINDOW - 1, latest);
    let res = null;
    for (let t = 0; t < 4; t++) {
      try {
        res = await rpc('eth_getLogs', [{ address: TOKEN, fromBlock: '0x' + lo.toString(16), toBlock: '0x' + hi.toString(16) }]);
        break;
      } catch (e) {
        if (t === 3) { console.log('FAIL', lo, hi, e.message.slice(0, 120)); fails++; }
        await sleep(400);
      }
    }
    if (res) logs.push(...res);
    windows++;
    if (windows % 20 === 0) console.log(`  ${windows} windows, ${logs.length} logs`);
  }
  console.log(`done: windows=${windows} fails=${fails} logs=${logs.length}`);
  fs.writeFileSync('logs_raw.json', JSON.stringify({ latest, from, logs }));
})();
