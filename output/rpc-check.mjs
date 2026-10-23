const RPC = 'https://base.gateway.tenderly.co';
const DEUS = '0x940A319B75861014A220D9c6c144d108552B089B';

async function call(method, params) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const j = await r.json();
    if (j.result !== undefined) return j.result;
    if (j.error && /429|rate/i.test(JSON.stringify(j.error))) {
      await new Promise((s) => setTimeout(s, 1000 * 2 ** i));
      continue;
    }
    throw new Error(JSON.stringify(j.error));
  }
  throw new Error('retries exhausted');
}

const pad = (a) => '0x' + a.replace(/^0x/, '').toLowerCase().padStart(40, '0');

async function bal(a) {
  const data = '0x70a08231' + pad(a).slice(2);
  const out = await call('eth_call', [{ to: DEUS, data }, 'latest']);
  return BigInt(out);
}

const block = parseInt(await call('eth_blockNumber', []), 16);
console.log('block', block);

const addrs = [
  ['escrow', '0xA85A38796B951CE87B378538b32B3E6Ee3C4C373'],
  ['w1', '0x259f962e77262ee8d97cc6a112d0e0321323ea0d'],
  ['w2', '0xa2f42a10a8eb9089ac51108af68fa202bf2c3130'],
  ['poolVIRTUAL', '0x3E97c5EC8c73e7d566aCA606472141a9b9a8C1Fa'],
  ['poolUSDC', '0x58dBa34e6ee6eb76Ef71A6ca0f18871CAE817D3b'],
];

for (const [label, addr] of addrs) {
  try {
    const b = await bal(addr);
    console.log(label, addr, 'DEUS', (Number(b) / 1e18).toFixed(6));
  } catch (e) {
    console.log(label, addr, 'balanceOf FAILED', e.message);
  }
}

for (const [label, addr] of addrs.slice(1, 3)) {
  const nonce = parseInt(await call('eth_getTransactionCount', [addr, 'latest']), 16);
  const eth = Number(BigInt(await call('eth_getBalance', [addr, 'latest']))) / 1e18;
  const code = await call('eth_getCode', [addr, 'latest']);
  console.log(label, 'nonce', nonce, 'ETH', eth.toFixed(8), 'code', code.slice(0, 20));
}

const supply = BigInt(await call('eth_call', [{ to: DEUS, data: '0x18160ddd' }, 'latest']));
console.log('totalSupply', (Number(supply) / 1e18).toFixed(6));
