const DEUS = '0x940A319B75861014A220D9c6c144d108552B089B';
const RPC = 'https://mainnet.base.org';
const W = '0x09b383a627c3d35daf38cd77af0064c1848833c6';
const W1 = '0x259f962e77262ee8d97cc6a112d0e0321323ea0d';
const W2 = '0xa2f42a10a8eb9089ac51108af68fa202bf2c3130';

const pad = (a) => a.replace(/^0x/, '').toLowerCase().padStart(64, '0');

async function rpc(method, params) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const j = await r.json().catch(() => ({}));
    if (j.result !== undefined) return j.result;
    await new Promise((s) => setTimeout(s, 800 * 2 ** i));
  }
  return null;
}

const head = parseInt(await rpc('eth_blockNumber', []), 16);
console.log('head', head, '- approx', new Date().toISOString());

for (const [label, addr] of [
  ['whale09b3', W],
  ['w1', W1],
  ['w2', W2],
]) {
  for (const days of [0, 7, 14, 30]) {
    const blk = head - days * 43200;
    const res = await rpc('eth_call', [{ to: DEUS, data: '0x70a08231' + pad(addr) }, '0x' + blk.toString(16)]);
    console.log(label, 'T-' + days + 'd', res ? (Number(BigInt(res)) / 1e18).toFixed(4) : 'ERR');
  }
  const nonce = await rpc('eth_getTransactionCount', [addr, 'latest']);
  console.log(label, 'nonce now', nonce ? parseInt(nonce, 16) : '?');
}
