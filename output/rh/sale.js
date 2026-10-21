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

(async () => {
  const txs = ['0x792b51ef329970e8c65dfa140651c09826b2cfa251b0e3887bedf7234f855c3f',
               '0x3d0cd515bba56387d7ff4b4f7cbf6bccf6b84a4d2539fb2ad88989f4d7e1bd70',
               '0x201fe803d8b3ca04bce272f3a2d59832b2f7b7a3626e4995f96a75396c7b19b1'];
  for (const t of txs) {
    const tx = await rpc('eth_getTransactionByHash', [t]);
    const rc = await rpc('eth_getTransactionReceipt', [t]);
    const blk = await rpc('eth_getBlockByNumber', [tx.blockNumber, false]);
    console.log('=== ' + t.slice(0, 18) + ' block ' + parseInt(tx.blockNumber, 16) + ' ' + new Date(parseInt(blk.timestamp, 16) * 1000).toISOString());
    console.log('   from', tx.from, 'to', tx.to, 'sel', tx.input.slice(0, 10), 'value', (Number(BigInt(tx.value)) / 1e18).toFixed(6), 'ETH');
    for (const l of rc.logs) {
      console.log('   log', l.address.slice(0, 10) + '…', 'topic0', l.topics[0].slice(0, 10), 'n', l.topics.length, 'data', l.data.slice(0, 130));
    }
    await sleep(200);
  }
})();
