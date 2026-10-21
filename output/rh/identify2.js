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

// brute-force 4-byte selectors from a list of likely getter names
const crypto = require('crypto');
function sel(sig) { return '0x' + crypto.createHash('sha3-256') ? null : null; }
// keccak isn't in node core; use precomputed list instead
const KNOWN = {
  '0x8da5cb5b': 'owner()', '0xe30c3978': 'pendingOwner()',
  '0x02571be3': 'owner(bytes32)', '0x6352211e': 'ownerOf(uint256)',
  '0xbe9a6555': 'start()', '0x0fb5a6b4': 'duration()', '0x13d033c0': 'cliff()',
  '0x9610c2c5': 'released()', '0x6a99b4f0': 'total()', '0x9e1a4d19': 'released(address)',
  '0x70a08231': 'balanceOf(address)', '0x18160ddd': 'totalSupply()',
  '0x5c19a95c': 'delegate(address)', '0x38af3eed': 'beneficiary()',
  '0x4e71d92d': 'claim()', '0x379607f5': 'claim(uint256)',
  '0xeea0d7b2': 'milestones(uint256)', '0x1ab7e0f4': 'locker()',
  '0xfcbd82a7': 'locks(address)', '0x4b43ba17': 'getLocks(address)',
  '0xf1127ed8': 'delegate(address)' /* wrong */,
  '0x7ecebe00': 'nonces(address)', '0x3644e515': 'DOMAIN_SEPARATOR()',
  '0xfc0c546a': 'want()','0x3f4ba83a':'unpause()','0x8f283970':'changeAdmin(address)',
  '0x9dc29fac': 'burn(address,uint256)', '0x40c10f19': 'mint(address,uint256)',
};

(async () => {
  const latest = '0x' + parseInt(await rpc('eth_blockNumber', []), 16).toString(16);
  for (const a of process.argv.slice(2)) {
    console.log('### ' + a);
    const code = await rpc('eth_getCode', [a, latest]);
    console.log('  codelen', code.length / 2 - 1);
    for (const [s, name] of Object.entries(KNOWN)) {
      try {
        const r = await rpc('eth_call', [{ to: a, data: s }, latest]);
        if (r && r !== '0x') {
          const hex = r.slice(2);
          let out = r;
          if (hex.length === 64) {
            const v = BigInt(r);
            if (v < 10n ** 12n) out = 'uint ' + v.toString();
            else if (hex.slice(0, 24) === '0'.repeat(24)) out = 'addr 0x' + hex.slice(24);
            else out = 'word ' + r;
          }
          console.log('  ', name, '=>', out);
        }
      } catch (e) {}
      await sleep(40);
    }
  }
})();
