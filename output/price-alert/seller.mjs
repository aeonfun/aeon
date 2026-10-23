const RPC = "https://base.gateway.tenderly.co";
const DEUS = "0x940A319B75861014A220D9c6c144d108552B089B";
const WHO = "0xbf328713670d3407e94c3ab60ff1c36f95748e70";
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
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
const head = parseInt(await rpc("eth_blockNumber", []), 16);
const start = head - 7 * 43200;

async function scan(topics) {
  const all = [];
  for (let b = start; b <= head; b += 1000) {
    const to = Math.min(b + 999, head);
    for (let t = 1; t <= 4; t++) {
      try {
        all.push(...await rpc("eth_getLogs", [{ address: DEUS, fromBlock: "0x" + b.toString(16), toBlock: "0x" + to.toString(16), topics }]));
        break;
      } catch (e) { if (t === 4) throw new Error(`chunk ${b}: ${e.message}`); await sleep(700 * 2 ** (t - 1)); }
    }
    await sleep(70);
  }
  return all;
}

const ins = await scan([TRANSFER, null, pad(WHO)]);
const outs = await scan([TRANSFER, pad(WHO), null]);
const tsCache = new Map();
async function blkTs(h) { if (!tsCache.has(h)) { const b = await rpc("eth_getBlockByNumber", [h, false]); tsCache.set(h, parseInt(b.timestamp, 16)); } return tsCache.get(h); }

const ev = [];
for (const l of ins) ev.push({ dir: "IN", block: parseInt(l.blockNumber, 16), ts: new Date((await blkTs(l.blockNumber)) * 1000).toISOString(), other: "0x" + l.topics[1].slice(26), deus: Number(BigInt(l.data)) / 1e18, tx: l.transactionHash });
for (const l of outs) ev.push({ dir: "OUT", block: parseInt(l.blockNumber, 16), ts: new Date((await blkTs(l.blockNumber)) * 1000).toISOString(), other: "0x" + l.topics[2].slice(26), deus: Number(BigInt(l.data)) / 1e18, tx: l.transactionHash });
ev.sort((a, b) => a.block - b.block);
console.log(JSON.stringify({
  address: WHO, nonce: parseInt(await rpc("eth_getTransactionCount", [WHO, "latest"]), 16),
  eth: Number(BigInt(await rpc("eth_getBalance", [WHO, "latest"]))) / 1e18,
  deus: Number(BigInt(await rpc("eth_call", [{ to: DEUS, data: "0x70a08231" + pad(WHO).slice(2) }, "latest"]))) / 1e18,
  n_in: ins.length, n_out: outs.length,
  sum_in: ev.filter((e) => e.dir === "IN").reduce((s, e) => s + e.deus, 0),
  sum_out: ev.filter((e) => e.dir === "OUT").reduce((s, e) => s + e.deus, 0),
  events: ev,
}, null, 2));
