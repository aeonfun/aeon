const https = require('https');
const fs = require('fs');
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
function rpc(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
    const req = https.request(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 30000 },
      res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { const j = JSON.parse(d); j.error ? reject(new Error(JSON.stringify(j.error).slice(0,120))) : resolve(j.result); } catch (e) { reject(new Error(d.slice(0,120))); } }); });
    req.on('error', reject); req.on('timeout', () => req.destroy(new Error('timeout')));
    req.write(body); req.end();
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TL = '0x4a53afd9c4d707c8fddd6415947ef0a1e67518b8';
// OpenZeppelin TimelockController events
const CALL_SCHEDULED = '0x4cf4410cc57040e44862ef0f45f3dd5a5e02db8eb8add648d4b0e236f1d07dca';
const CALL_EXECUTED  = '0x06dfcc65b3ec4b26f9d3f1c4a1a2a8b4ee0a5f9a6bd2b5e1a4a0c0c0b1b1b1b1';
const SENTINEL = '0x0000000000000000000000000000000000000000000000000000000000000000';

(async () => {
  const latest = parseInt(await rpc('eth_blockNumber', []), 16);
  const from = Math.max(0, latest - 864000 * 60); // 60 days
  console.log('scanning timelock logs', from, '->', latest);
  const W = 200000;
  const all = [];
  let fails = 0;
  for (let lo = from; lo <= latest; lo += W) {
    const hi = Math.min(lo + W - 1, latest);
    let res = null;
    for (let t = 0; t < 3; t++) {
      try { res = await rpc('eth_getLogs', [{ address: TL, fromBlock: '0x' + lo.toString(16), toBlock: '0x' + hi.toString(16) }]); break; }
      catch (e) { if (t === 2) fails++; await sleep(400); }
    }
    if (res) all.push(...res);
  }
  console.log('logs', all.length, 'fails', fails);
  const byTopic = {};
  for (const l of all) byTopic[l.topics[0]] = (byTopic[l.topics[0]] || 0) + 1;
  console.log('topic counts', byTopic);
  fs.writeFileSync('tl_logs.json', JSON.stringify(all));

  for (const l of all) {
    const blk = await rpc('eth_getBlockByNumber', [l.blockNumber, false]);
    const ts = parseInt(blk.timestamp, 16);
    console.log('blk', parseInt(l.blockNumber, 16), new Date(ts * 1000).toISOString(), 'topic0', l.topics[0].slice(0, 18), 'ntopics', l.topics.length);
    console.log('   data', l.data.slice(0, 400));
    await sleep(120);
  }
})();
