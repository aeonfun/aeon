const RPC = "https://base.gateway.tenderly.co";
const DEUS = "0x940A319B75861014A220D9c6c144d108552B089B";
const WHO = "0xcd920c78f0dc6d6d9d6b9d9116e93fdf7f7a343a";
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

async function rpc(method, params) {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(JSON.stringify(j.error));
  return j.result;
}
const pad = (a) => "0x" + a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const head = parseInt(await rpc("eth_blockNumber", []), 16);
// ~40 days of Base blocks would be huge; go back 30 days worth is impossible with 1k cap.
// Instead scan back 300k blocks (~7 days) for this wallet's transfers.
const start = head - 300000;

async function scan(topics) {
  const all = [];
  for (let b = start; b <= head; b += 1000) {
    const to = Math.min(b + 999, head);
    for (let a = 1; a <= 3; a++) {
      try {
        all.push(...await rpc("eth_getLogs", [{
          address: DEUS, fromBlock: "0x" + b.toString(16), toBlock: "0x" + to.toString(16), topics,
        }]));
        break;
      } catch (e) { if (a === 3) throw e; await sleep(800 * 2 ** (a - 1)); }
    }
    await sleep(100);
  }
  return all;
}

const ins = await scan([TRANSFER, null, pad(WHO)]);
const outs = await scan([TRANSFER, pad(WHO), null]);

const tsCache = new Map();
async function blkTs(h) {
  if (!tsCache.has(h)) {
    const b = await rpc("eth_getBlockByNumber", [h, false]);
    tsCache.set(h, parseInt(b.timestamp, 16));
  }
  return tsCache.get(h);
}

const ev = [];
for (const l of ins) ev.push({ dir: "IN", block: parseInt(l.blockNumber, 16), ts: new Date((await blkTs(l.blockNumber)) * 1000).toISOString(), from: "0x" + l.topics[1].slice(26), deus: Number(BigInt(l.data)) / 1e18, tx: l.transactionHash });
for (const l of outs) ev.push({ dir: "OUT", block: parseInt(l.blockNumber, 16), ts: new Date((await blkTs(l.blockNumber)) * 1000).toISOString(), to: "0x" + l.topics[2].slice(26), deus: Number(BigInt(l.data)) / 1e18, tx: l.transactionHash });
ev.sort((a, b) => a.block - b.block);

console.log(JSON.stringify({ head, scanned_blocks: [start, head], approx_days: +(300000 * 2 / 86400).toFixed(1), total_events: ev.length, events: ev }, null, 2));
