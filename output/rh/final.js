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
const TL = '0x4a53afd9c4d707c8fddd6415947ef0a1e67518b8';
const TOKEN = '0xc4f730335fb9e439ca5552f7b52b8e638c4245b0';
const latest = async () => '0x' + parseInt(await rpc('eth_blockNumber', []), 16).toString(16);

(async () => {
  const L = await latest();
  const probes = [
    [TL, '0xd45c4435', 'getMinDelay()'],
    [TL, '0x91d14854', 'hasRole(PROPOSER, owner)'],
    [TOKEN, '0x8e539e8c', '?8e539e8c'],
    [TOKEN, '0x3a46b1a8', '?3a46b1a8'],
  ];
  for (const [addr, s, n] of probes) {
    try {
      let data = s;
      if (s === '0x91d14854') data = s + 'b09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1' + '000000000000000000000000' + '0b64b35c6dd23944d6d4029864d2ca2aa1b66422';
      const r = await rpc('eth_call', [{ to: addr, data }, L]);
      console.log(n, '=>', r.length === 66 ? BigInt(r).toString() + (BigInt(r) > 10n**6n ? ' (' + (Number(BigInt(r))/1e18).toLocaleString() + ')' : '') : r);
    } catch (e) { console.log(n, 'ERR', e.message.slice(0, 80)); }
    await sleep(100);
  }
  // token balance of the 0x6f62 EOA and 0xd000 EOA now
  for (const a of ['0x6f62b43d8dfc378d3e2e8f8b1095919282691789', '0xd000b458f6a194b10e3ff516b00b94f7234695d3']) {
    const r = await rpc('eth_call', [{ to: TOKEN, data: '0x70a08231' + '000000000000000000000000' + a.slice(2) }, L]);
    console.log('bal', a, '=', (Number(BigInt(r)) / 1e18).toLocaleString());
    await sleep(100);
  }
})();
