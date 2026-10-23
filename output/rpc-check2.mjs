const DEUS = '0x940A319B75861014A220D9c6c144d108552B089B';
const ENDPOINTS = [
  'https://mainnet.base.org',
  'https://base.llamarpc.com',
  'https://base.gateway.tenderly.co',
];
const esc = '0xA85A38796B951CE87B378538b32B3E6Ee3C4C373';
const w1 = '0x259f962e77262ee8d97cc6a112d0e0321323ea0d';
const w2 = '0xa2f42a10a8eb9089ac51108af68fa202bf2c3130';
const poolV = '0x3E97c5EC8c73e7d566aCA606472141a9b9a8C1Fa';
const poolU = '0x58dBa34e6ee6eb76Ef71A6ca0f18871CAE817D3b';

const pad = (a) => a.replace(/^0x/, '').toLowerCase().padStart(64, '0');

async function rpc(url, method, params) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  return r.json();
}

for (const url of ENDPOINTS) {
  try {
    const b = await rpc(url, 'eth_blockNumber', []);
    console.log('==', url, 'block', parseInt(b.result, 16));
    const ts = await rpc(url, 'eth_call', [{ to: DEUS, data: '0x18160ddd' }, 'latest']);
    console.log('  totalSupply', ts.result ? (Number(BigInt(ts.result)) / 1e18).toFixed(6) : JSON.stringify(ts.error));
    for (const [label, a] of [['escrow', esc], ['w1', w1], ['w2', w2], ['poolV', poolV], ['poolU', poolU]]) {
      const res = await rpc(url, 'eth_call', [{ to: DEUS, data: '0x70a08231' + pad(a) }, 'latest']);
      console.log('  ', label, res.result ? (Number(BigInt(res.result)) / 1e18).toFixed(6) : 'ERR ' + JSON.stringify(res.error));
    }
  } catch (e) {
    console.log('==', url, 'FAILED', e.message);
  }
}
