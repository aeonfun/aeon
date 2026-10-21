const https = require('https');

function rpc(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
    const req = https.request('https://rpc.mainnet.chain.robinhood.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 30000,
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(new Error(d.slice(0,200))); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

(async () => {
  const b = await rpc('eth_blockNumber', []);
  const latest = parseInt(b.result, 16);
  console.log('latest', latest);
  for (const n of [latest, latest - 1000, latest - 10000, latest - 50000, latest - 200000]) {
    const r = await rpc('eth_getBlockByNumber', ['0x' + n.toString(16), false]);
    const ts = parseInt(r.result.timestamp, 16);
    console.log(n, ts, new Date(ts * 1000).toISOString());
  }
})();
