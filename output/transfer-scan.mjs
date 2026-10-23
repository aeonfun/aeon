const DEUS = '0x940A319B75861014A220D9c6c144d108552B089B';
const RPC = 'https://mainnet.base.org';
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const POOLS = new Set([
  '0x3e97c5ec8c73e7d566aca606472141a9b9a8c1fa',
  '0x58dba34e6ee6eb76ef71a6ca0f18871cae817d3b',
  '0x1b2f3f5c1b6037101fdd3ec14649e0d3f98fa642',
  '0x75bc14950ab093cbd1f80bbbdf458596939180a3',
  '0x7df2d59c764b290a2629e09b42773703fd1e575338f834b5ec28529299421edc',
]);

async function rpc(method, params) {
  for (let i = 0; i < 5; i++) {
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
const from = head - 4200; // ~2.3h at 2s
console.log('scan', from, '->', head, 'head', head);

const logs = [];
for (let start = from; start <= head; start += 999) {
  const end = Math.min(start + 998, head);
  const res = await rpc('eth_getLogs', [
    { address: DEUS, topics: [TRANSFER], fromBlock: '0x' + start.toString(16), toBlock: '0x' + end.toString(16) },
  ]);
  if (res === null) {
    console.log('chunk fail', start, end);
    continue;
  }
  logs.push(...res);
}
console.log('logs', logs.length);

const net = new Map();
const inCount = new Map();
for (const l of logs) {
  const fromA = '0x' + l.topics[1].slice(26);
  const toA = '0x' + l.topics[2].slice(26);
  const v = Number(BigInt(l.data)) / 1e18;
  const f = fromA.toLowerCase();
  const t = toA.toLowerCase();
  if (POOLS.has(f) && !POOLS.has(t)) {
    net.set(t, (net.get(t) || 0) + v);
    inCount.set(t, (inCount.get(t) || 0) + 1);
  } else if (POOLS.has(t) && !POOLS.has(f)) {
    net.set(f, (net.get(f) || 0) - v);
    inCount.set(f, (inCount.get(f) || 0) + 1);
  }
}

const rows = [...net.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 20);
console.log('--- top pool-counterparties by absolute net DEUS movement ---');
for (const [addr, v] of rows) {
  console.log(addr, 'net', v.toFixed(4), 'DEUS  ($' + (v * 0.01802).toFixed(2) + ')  legs', inCount.get(addr));
}
