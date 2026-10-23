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

const headRes = await rpc("eth_blockNumber", []);
const head = parseInt(headRes.ok, 16);

// ALL topics on the deepest pool, last 2100 blocks (~70 min)
const POOL = "0x3E97c5EC8c73e7d566aCA606472141a9b9a8C1Fa";
let total = 0;
const counts = {};
const rows = [];
for (let s = head - 2100; s <= head; s += 950) {
  const e = Math.min(s + 949, head);
  const r = await rpc("eth_getLogs", [{ address: POOL, fromBlock: hex(s), toBlock: hex(e) }]);
  if (r.ok) {
    total += r.ok.length;
    for (const l of r.ok) {
      const k = l.topics[0] ? l.topics[0].slice(0, 10) : "anon";
      counts[k] = (counts[k] || 0) + 1;
      rows.push({ blk: parseInt(l.blockNumber, 16), t: k, tx: l.transactionHash });
    }
  } else console.log("err", s, r.err);
  await sleep(800);
}
console.log("deepest pool 0x3E97 ALL logs in last 2100 blocks:", total, JSON.stringify(counts));
const uniq = [...new Set(rows.map((r) => r.blk))].sort((a, b) => a - b);
console.log("distinct blocks with activity:", uniq.length, uniq.slice(0, 20).join(","));

// Widen: last 7200 blocks (~4h) for that pool
let t4 = 0;
const c4 = {};
for (let s = head - 7200; s <= head; s += 950) {
  const e = Math.min(s + 949, head);
  const r = await rpc("eth_getLogs", [{ address: POOL, fromBlock: hex(s), toBlock: hex(e) }]);
  if (r.ok) { t4 += r.ok.length; for (const l of r.ok) { const k = l.topics[0] ? l.topics[0].slice(0, 10) : "anon"; c4[k] = (c4[k] || 0) + 1; } }
  await sleep(700);
}
console.log("deepest pool 0x3E97 ALL logs in last 7200 blocks (~4h):", t4, JSON.stringify(c4));
