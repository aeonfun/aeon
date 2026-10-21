const https = require('https');
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

// find the tx that emitted the CallScheduled at block 94195015
(async () => {
  const blk = await rpc('eth_getBlockByNumber', ['0x' + (94195015).toString(16), true]);
  for (const tx of blk.transactions) {
    if (tx.to && tx.to.toLowerCase() === '0x4a53afd9c4d707c8fddd6415947ef0a1e67518b8') {
      console.log('tx', tx.hash);
      console.log('from', tx.from, 'sel', tx.input.slice(0, 10));
      console.log('input', tx.input);
      const rc = await rpc('eth_getTransactionReceipt', [tx.hash]);
      console.log('logs', rc.logs.length, 'status', rc.status);
    }
  }
})();
