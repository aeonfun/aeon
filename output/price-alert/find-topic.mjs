const RPC = "https://base.gateway.tenderly.co";
const POOL = "0x3E97c5EC8c73e7d566aCA606472141a9b9a8C1Fa";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function rpc(method, params) {
  for (let a = 1; a <= 5; a++) {
    const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: a, method, params }) });
    const j = await r.json();
    if (!j.error) return j.result;
    await sleep(1000 * 2 ** (a - 1));
  }
  throw new Error("rate limited");
}

const head = parseInt(await rpc("eth_blockNumber", []), 16);
// locate block at ~19:23:49Z. head is ~21:15Z. diff ~111 min ~ 3330 blocks
const probe = head - 3330;
const blk = await rpc("eth_getBlockByNumber", ["0x" + probe.toString(16), false]);
console.log(JSON.stringify({ head, probe, probe_ts: new Date(parseInt(blk.timestamp, 16) * 1000).toISOString() }));

const topics = {};
let total = 0;
for (let b = probe - 3000; b < probe + 1000; b += 1000) {
  const to = b + 999;
  try {
    const logs = await rpc("eth_getLogs", [{ address: POOL, fromBlock: "0x" + b.toString(16), toBlock: "0x" + to.toString(16) }]);
    total += logs.length;
    for (const l of logs) {
      const t = l.topics[0];
      if (!topics[t]) topics[t] = { count: 0, n_topics: l.topics.length, data_words: (l.data.length - 2) / 64, example_tx: l.transactionHash };
      topics[t].count++;
    }
  } catch (e) { topics["ERR_" + b] = String(e.message).slice(0, 80); }
  await sleep(200);
}
console.log(JSON.stringify({ block_range: [probe - 3000, probe + 999], total_logs: total, topic0_counts: topics }, null, 2));
