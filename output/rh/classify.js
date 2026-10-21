const https = require('https');
const fs = require('fs');

const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const TOKEN = '0xc4f730335fb9e439ca5552f7b52b8e638c4245b0';

function rpc(method, params, tries = 3) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
    const req = https.request(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 30000,
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { const j = JSON.parse(d); if (j.error) return reject(new Error(JSON.stringify(j.error).slice(0,150))); resolve(j.result); }
        catch (e) { reject(new Error(d.slice(0, 150))); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.write(body); req.end();
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const addrs = process.argv.slice(2);
(async () => {
  const latest = '0x' + parseInt(await rpc('eth_blockNumber', []), 16).toString(16);
  for (const a of addrs) {
    let code = '', bal = '', nonce = '';
    try { code = await rpc('eth_getCode', [a, latest]); } catch (e) { code = 'ERR ' + e.message; }
    try { bal = await rpc('eth_getBalance', [a, latest]); } catch (e) {}
    try { nonce = await rpc('eth_getTransactionCount', [a, latest]); } catch (e) {}
    await sleep(120);
    let tok = '';
    try {
      const r = await rpc('eth_call', [{ to: TOKEN, data: '0x70a08231' + '000000000000000000000000' + a.slice(2) }, latest]);
      tok = (Number(BigInt(r)) / 1e18).toFixed(2);
    } catch (e) { tok = 'ERR'; }
    console.log(JSON.stringify({
      addr: a,
      kind: code === '0x' ? 'EOA' : (code.startsWith('ERR') ? code : 'contract(len ' + (code.length/2-1) + ')'),
      eth: (Number(BigInt(bal || '0x0')) / 1e18).toFixed(4),
      nonce: parseInt(nonce || '0x0', 16),
      note: tok,
    }));
  }
})();
