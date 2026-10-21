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

const SELECTORS = {
  'owner()': '0x8da5cb5b', 'pendingOwner()': '0xe30c3978', 'beneficiary()': '0x38af3eed',
  'start()': '0xbe9a6555', 'duration()': '0x0fb5a6b4', 'cliff()': '0x13d033c0',
  'released()': '0x9610c2c5', 'total()': '0x6a99b4f0', 'name()': '0x06fdde03',
  'symbol()': '0x95d89b41', 'decimals()': '0x313ce567', 'totalSupply()': '0x18160ddd',
  'poolManager()': '0xdc4c90d3', 'factory()': '0xc45a0155', 'token0()': '0x0dfe1681',
  'token1()': '0xd21220a7', 'getReserves()': '0x0902f1ac', 'admin()': '0xf851a440',
};

(async () => {
  const latest = '0x' + parseInt(await rpc('eth_blockNumber', []), 16).toString(16);
  for (const a of process.argv.slice(2)) {
    console.log('### ' + a);
    for (const [name, sel] of Object.entries(SELECTORS)) {
      try {
        const r = await rpc('eth_call', [{ to: a, data: sel }, latest]);
        if (r && r !== '0x') {
          let human = r;
          // try as string
          try {
            const hex = r.slice(2);
            if (hex.length >= 128) {
              const off = parseInt(hex.slice(0, 64), 16) * 2;
              if (off + 64 <= hex.length) {
                const len = parseInt(hex.slice(off, off + 64), 16);
                if (len > 0 && len < 200 && off + 64 + len * 2 <= hex.length) {
                  const s = Buffer.from(hex.slice(off + 64, off + 64 + len * 2), 'hex').toString('utf8');
                  if (/^[\x20-\x7e]+$/.test(s)) human = JSON.stringify(s);
                }
              }
            }
            if (human === r && hex.length === 64) human = 'uint ' + BigInt(r).toString();
            if (human === r && hex.length === 64) human = 'addr 0x' + hex.slice(24);
          } catch (e) {}
          console.log('  ', name, '=>', human);
        }
      } catch (e) { /* revert */ }
      await sleep(60);
    }
  }
})();
