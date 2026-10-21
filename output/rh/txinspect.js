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

const TXS = process.argv.slice(2);
(async () => {
  for (const t of TXS) {
    const tx = await rpc('eth_getTransactionByHash', [t]);
    const rc = await rpc('eth_getTransactionReceipt', [t]);
    if (!tx) { console.log(t, 'NOT FOUND'); continue; }
    const blk = await rpc('eth_getBlockByNumber', [tx.blockNumber, false]);
    const ts = parseInt(blk.timestamp, 16);
    console.log('=== ' + t);
    console.log('  block', parseInt(tx.blockNumber, 16), new Date(ts * 1000).toISOString(), 'status', rc.status);
    console.log('  from', tx.from, 'to', tx.to, 'sel', tx.input.slice(0, 10), 'value', Number(BigInt(tx.value)) / 1e18);
    console.log('  gasUsed', parseInt(rc.gasUsed, 16), 'logs', rc.logs.length);
    // decode Transfer logs across all tokens
    for (const l of rc.logs) {
      if (l.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' && l.topics.length === 3) {
        const from = '0x' + l.topics[1].slice(26), to = '0x' + l.topics[2].slice(26);
        const v = BigInt(l.data === '0x' ? '0x0' : l.data);
        console.log('   token', l.address, trim(from), '->', trim(to), (Number(v) / 1e18).toFixed(2));
      }
    }
    console.log('  input[:200]', tx.input.slice(0, 200));
    await sleep(150);
  }
  function trim(a) { return a.slice(0, 8) + '…' + a.slice(-6); }
})();
