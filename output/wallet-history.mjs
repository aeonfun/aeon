const DEUS = '0x940A319B75861014A220D9c6c144d108552B089B';
const RPC = 'https://mainnet.base.org';
const W = '0x09b383a627c3d35daf38cd77af0064c1848833c6';

const pad = (a) => a.replace(/^0x/, '').toLowerCase().padStart(64, '0');

async function rpc(method, params) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const j = await r.json();
    if (j.result !== undefined) return j.result;
    await new Promise((s) => setTimeout(s, 900 * 2 ** i));
  }
  return null;
}

async function balAt(blockTag) {
  const res = await rpc('eth_call', [{ to: DEUS, data: '0x70a08231' + pad(W) }, blockTag]);
  return res ? Number(BigInt(res)) / 1e18 : null;
}

const head = parseInt(await rpc('eth_blockNumber', []), 16);
console.log('head', head);
// Base ~2s blocks. 17:06:13Z vs now.
const now = Math.floor(Date.now() / 1000);
const offsets = [0, 600, 1800, 3600, 7200, 14400, 86400];
for (const secs of offsets) {
  const blk = head - Math.round(secs / 2);
  const b = await balAt('0x' + blk.toString(16));
  const when = new Date((now - secs) * 1000).toISOString().replace('.000', '');
  console.log(when, 'block', blk, 'bal', b === null ? 'ERR' : b.toFixed(6));
}

// ETH balance + nonce
const eth = await rpc('eth_getBalance', [W, 'latest']);
console.log('ETH', (Number(BigInt(eth)) / 1e18).toFixed(8));
