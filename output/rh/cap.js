const https = require('https');
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
function rpc(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
    const req = https.request(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 20000 },
      res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { const j = JSON.parse(d); j.error ? reject(new Error(JSON.stringify(j.error).slice(0,120))) : resolve(j.result); } catch (e) { reject(new Error(d.slice(0,120))); } }); });
    req.on('error', reject); req.on('timeout', () => req.destroy(new Error('timeout')));
    req.write(body); req.end();
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const T = '0xc4f730335fb9e439ca5552f7b52b8e638c4245b0';

(async () => {
  const latest = '0x' + parseInt(await rpc('eth_blockNumber', []), 16).toString(16);
  for (const [s, n] of [['0xec81b483', 'CAP()'], ['0xa0dc2758', 'EPOCH()'], ['0x06dfcc65', '?06dfcc65'], ['0x153de143', '?153de143'], ['0x2cd44ac3','?2cd44ac3'], ['0x4bf5d7e9','?4bf5d7e9'], ['0x715018a6','renounce'], ['0x5c975abb','paused']]) {
    try { const r = await rpc('eth_call', [{ to: T, data: s }, latest]);
      let v = r;
      if (r.length === 66) { const b = BigInt(r); v = b > 10n**9n ? (Number(b)/1e18).toLocaleString() + '  (raw ' + b.toString() + ')' : b.toString(); }
      console.log(n, '=>', v);
    } catch (e) { console.log(n, 'ERR'); }
    await sleep(80);
  }
})();
