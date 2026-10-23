const RPC = "https://base.gateway.tenderly.co";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hex = (n) => "0x" + n.toString(16);

async function rpc(method, params, tries = 6) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(RPC, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const j = await r.json();
      if (j.error) {
        if (/rate limit|exceeded|429/i.test(j.error.message)) { await sleep(2000 * (i + 1)); continue; }
        return { err: j.error.message };
      }
      return { ok: j.result };
    } catch (e) { await sleep(2000 * (i + 1)); }
  }
  return { err: "retries-exhausted" };
}

const POOL = "0x3E97c5EC8c73e7d566aCA606472141a9b9a8C1Fa";
// 14:00Z hour was the high-volume hour ($5,615). 18:11Z = 52994860.
const end = 52994860 - 4 * 1800; // ~14:11Z
const start = end - 1900;

const counts = {};
const byTx = {};
let n = 0;
for (let s = start; s <= end; s += 950) {
  const e = Math.min(s + 949, end);
  const r = await rpc("eth_getLogs", [{ address: POOL, fromBlock: hex(s), toBlock: hex(e) }]);
  if (r.ok) {
    n += r.ok.length;
    for (const l of r.ok) {
      const k = l.topics[0] ? l.topics[0] : "anon";
      counts[k] = (counts[k] || 0) + 1;
      byTx[l.transactionHash] = (byTx[l.transactionHash] || 0) + 1;
    }
  } else console.log("err", s, r.err);
  await sleep(700);
}
console.log("pool 0x3E97 logs in high-volume window", start, "-", end, "total:", n);
for (const [k, v] of Object.entries(counts)) console.log("  topic0", k, "x", v);
console.log("distinct txs:", Object.keys(byTx).length);
