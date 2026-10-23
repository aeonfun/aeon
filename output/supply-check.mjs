const DEUS = '0x940A319B75861014A220D9c6c144d108552B089B';
const RPC = 'https://mainnet.base.org';

async function rpc(method, params) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const j = await r.json().catch(() => ({}));
    if (j.result !== undefined) return j.result;
    await new Promise((s) => setTimeout(s, 700 * 2 ** i));
  }
  return null;
}

const head = parseInt(await rpc('eth_blockNumber', []), 16);
for (const days of [0, 0.04, 0.25, 1, 7]) {
  const blk = head - Math.round(days * 43200);
  const res = await rpc('eth_call', [{ to: DEUS, data: '0x18160ddd' }, '0x' + blk.toString(16)]);
  console.log('T-' + days + 'd block', blk, 'supply', res ? Number(BigInt(res)) / 1e18 : 'ERR');
}
