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

// Extract 4-byte selectors pushed as PUSH4 in the dispatcher
function selectors(code) {
  const hex = code.slice(2);
  const set = new Set();
  for (let i = 0; i + 10 <= hex.length; i += 2) {
    if (hex.slice(i, i + 2) === '63') { // PUSH4
      set.add('0x' + hex.slice(i + 2, i + 10));
    }
  }
  return [...set].sort();
}

const NAMES = {
  '0x06fdde03':'name()','0x95d89b41':'symbol()','0x313ce567':'decimals()','0x18160ddd':'totalSupply()',
  '0x70a08231':'balanceOf(address)','0xa9059cbb':'transfer(address,uint256)','0x23b872dd':'transferFrom(address,address,uint256)',
  '0x095ea7b3':'approve(address,uint256)','0xdd62ed3e':'allowance(address,address)',
  '0x40c10f19':'mint(address,uint256)','0x9dc29fac':'burn(address,uint256)','0x42966c68':'burn(uint256)',
  '0x8da5cb5b':'owner()','0xf2fde38b':'transferOwnership(address)','0x715018a6':'renounceOwnership()',
  '0x8f283970':'changeAdmin(address)','0xf851a440':'admin()','0x8456cb59':'pause()','0x3f4ba83a':'unpause()','0x5c975abb':'paused()',
  '0xec81b483':'?ec81b483','0xf1127ed8':'?f1127ed8','0xa0dc2758':'?a0dc2758','0x79ba5097':'acceptOwnership()',
  '0xe30c3978':'pendingOwner()','0xd505accf':'permit(...)','0x3644e515':'DOMAIN_SEPARATOR()','0x7ecebe00':'nonces(address)',
  '0xddf252ad':'Transfer','0x8c5be1e5':'Approval','0x9e1a4d19':'?','0x4b43ba17':'?','0x1ab7e0f4':'?','0xfcbd82a7':'?',
};

(async () => {
  const latest = '0x' + parseInt(await rpc('eth_blockNumber', []), 16).toString(16);
  for (const a of process.argv.slice(2)) {
    const code = await rpc('eth_getCode', [a, latest]);
    const sels = selectors(code);
    console.log('### ' + a + '  codebytes=' + (code.length / 2 - 1) + ' selectors=' + sels.length);
    const named = sels.map(s => (NAMES[s] || s)).join(' ');
    console.log('   ' + named.slice(0, 1800));
    console.log('');
  }
})();
