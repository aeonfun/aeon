const RPC = "https://base.gateway.tenderly.co";
const DEUS = "0x940A319B75861014A220D9c6c144d108552B089B";
const ESCROW = "0xA85A38796B951CE87B378538b32B3E6Ee3C4C373";
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

const padAddr = (a) => "0x" + a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const head = parseInt(await rpc("eth_blockNumber", []), 16);
const SPAN = 12000;
const start = head - SPAN;

async function scanIn(direction, fromIdx, toIdx) {
  const topics = direction === "in"
    ? [TRANSFER, null, padAddr(ESCROW)]
    : [TRANSFER, padAddr(ESCROW), null];
  const all = [];
  for (let b = fromIdx; b <= toIdx; b += 1000) {
    const to = Math.min(b + 999, toIdx);
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const logs = await rpc("eth_getLogs", [{
          address: DEUS,
          fromBlock: "0x" + b.toString(16),
          toBlock: "0x" + to.toString(16),
          topics,
        }]);
        all.push(...logs);
        break;
      } catch (e) {
        if (attempt === 3) throw e;
        await sleep(1000 * 2 ** (attempt - 1));
      }
    }
    await sleep(120);
  }
  return all;
}

const tsCache = new Map();
async function blkTs(hexBlk) {
  if (!tsCache.has(hexBlk)) {
    const blk = await rpc("eth_getBlockByNumber", [hexBlk, false]);
    tsCache.set(hexBlk, parseInt(blk.timestamp, 16));
  }
  return tsCache.get(hexBlk);
}

const ins = await scanIn("in", start, head);
const outs = await scanIn("out", start, head);

const items = [];
for (const l of ins) {
  items.push({
    dir: "in",
    block: parseInt(l.blockNumber, 16),
    ts: new Date((await blkTs(l.blockNumber)) * 1000).toISOString(),
    other: "0x" + l.topics[1].slice(26),
    deus: Number(BigInt(l.data)) / 1e18,
    tx: l.transactionHash,
  });
}
for (const l of outs) {
  items.push({
    dir: "out",
    block: parseInt(l.blockNumber, 16),
    ts: new Date((await blkTs(l.blockNumber)) * 1000).toISOString(),
    other: "0x" + l.topics[2].slice(26),
    deus: Number(BigInt(l.data)) / 1e18,
    tx: l.transactionHash,
  });
}
items.sort((a, b) => a.block - b.block);

const sumIn = items.filter((i) => i.dir === "in").reduce((s, i) => s + i.deus, 0);
const sumOut = items.filter((i) => i.dir === "out").reduce((s, i) => s + i.deus, 0);

console.log(JSON.stringify({
  head,
  window_blocks: [start, head],
  window_hours_approx: +(SPAN * 2 / 3600).toFixed(1),
  count_in: items.filter((i) => i.dir === "in").length,
  count_out: items.filter((i) => i.dir === "out").length,
  sum_in: sumIn,
  sum_out: sumOut,
  net: sumIn - sumOut,
  events: items,
}, null, 2));
