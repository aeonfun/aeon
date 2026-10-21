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
const TL = '0x4a53afd9c4d707c8fddd6415947ef0a1e67518b8';
const NOTE = '0xc4f730335fb9e439ca5552f7b52b8e638c4245b0';

// candidate selectors from selectors dump
const PROBE = {
  '0xd45c4435': 'getMinDelay()',
  '0x8f61f4f5': 'updateDelay(uint256)',
  '0xb1c5f427': 'isOperation(bytes32)',
  '0xf27a0c92': 'getTimestamp(bytes32)',
  '0x01d5062a': 'schedule(...)',
  '0x134008d3': 'execute(...)',
  '0xe38335e5': 'executeBatch(...)',
  '0x8f2a0bb0': 'scheduleBatch(...)',
  '0xb08e51c0': '?b08e51c0',
};

(async () => {
  console.log('--- Timelock 0x4a53afd9')
  for (const [s, n] of Object.entries(PROBE)) {
    try {
      const r = await rpc('eth_call', [{ to: TL, data: s }, 'latest']);
      console.log('  ', n, '=>', r, r.length === 66 ? 'uint=' + BigInt(r).toString() : '');
    } catch (e) { /* not a getter */ }
    await sleep(60);
  }

  console.log('\n--- Token 0xNOTES role probes');
  const ROLES = {
    'MINTER_ROLE_guess': '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6',
    'PAUSER_ROLE': '0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a',
  };
  for (const [n, role] of Object.entries(ROLES)) {
    try {
      const r = await rpc('eth_call', [{ to: NOTE, data: '0x91d14854' + role.slice(2) + '0000000000000000000000000b64b35c6dd23944d6d4029864d2ca2aa1b66422' }, 'latest']);
      console.log('  hasRole(' + n + ', owner EOA) =>', BigInt(r).toString());
    } catch (e) { console.log('  hasRole ' + n, 'ERR'); }
    await sleep(60);
  }
  try {
    const r = await rpc('eth_call', [{ to: NOTE, data: '0x5c975abb' }, 'latest']);
    console.log('  paused() =>', BigInt(r).toString());
  } catch (e) { console.log('  paused ERR'); }

  // token admin/owner selectors
  for (const [s, n] of [['0xf851a440', 'admin()'], ['0x8da5cb5b', 'owner()'], ['0xe30c3978', 'pendingOwner()']]) {
    try { const r = await rpc('eth_call', [{ to: NOTE, data: s }, 'latest']); console.log(' ', n, '=>', '0x' + r.slice(26)); } catch (e) {}
    await sleep(60);
  }
})();
