const RPC = "https://base.gateway.tenderly.co";
const DEUS = "0x940A319B75861014A220D9c6c144d108552B089B";
const POOL = "0x3E97c5EC8c73e7d566aCA606472141a9b9a8C1Fa";
const SWAP = "0xb3e2773606abfd36b5bd91394b3a54d1398336c65005baf7bf7a05efeffaf75b";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function rpc(method, params) {
  for (let a = 1; a <= 6; a++) {
    const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    const j = await r.json();
    if (!j.error) return j.result;
    await sleep(1000 * 2 ** (a - 1));
  }
  throw new Error("rate limited");
}
const pad = (a) => "0x" + a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
const balAt = async (blk) => {
  try { return Number(BigInt(await rpc("eth_call", [{ to: DEUS, data: "0x70a08231" + pad(POOL).slice(2) }, blk]))) / 1e18; }
  catch { return null; }
};

const head = parseInt(await rpc("eth_blockNumber", []), 16);
const headBlk = await rpc("eth_getBlockByNumber", ["0x" + head.toString(16), false]);
const headTs = parseInt(headBlk.timestamp, 16);
// last known trade ran at block ~52997078 (19:25) .. 19:37 -> block ~52997440
const fromB = 52997000;

const swaps = [];
for (let b = fromB; b <= head; b += 1000) {
  const to = Math.min(b + 999, head);
  for (let a = 1; a <= 5; a++) {
    try {
      swaps.push(...await rpc("eth_getLogs", [{ address: POOL, fromBlock: "0x" + b.toString(16), toBlock: "0x" + to.toString(16), topics: [SWAP] }]));
      break;
    } catch (e) { if (a === 5) throw new Error(`chunk ${b}: ${e.message}`); await sleep(900 * 2 ** (a - 1)); }
  }
  await sleep(120);
}

// timestamps of the last swaps
const tsCache = new Map();
async function blkTs(h) {
  if (!tsCache.has(h)) { const b = await rpc("eth_getBlockByNumber", [h, false]); tsCache.set(h, parseInt(b.timestamp, 16)); }
  return tsCache.get(h);
}
const last = [];
for (const l of swaps.slice(-6)) last.push({ block: parseInt(l.blockNumber, 16), ts: new Date((await blkTs(l.blockNumber)) * 1000).toISOString(), tx: l.transactionHash });

console.log(JSON.stringify({
  head, head_ts: new Date(headTs * 1000).toISOString(),
  scan_from_block: fromB,
  swaps_since_1970: swaps.length,
  last_swaps: last,
  silent_minutes: last.length ? +((headTs - (await blkTs("0x" + last[last.length - 1].block.toString(16)))) / 60).toFixed(1) : null,
  pool_deus_usd_now: { now: await balAt("latest"), minus_1h: await balAt("0x" + (head - 1800).toString(16)), minus_24h: await balAt("0x" + (head - 43200).toString(16)) },
}, null, 2));
