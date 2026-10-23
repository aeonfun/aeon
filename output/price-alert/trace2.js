const RPC = "https://base.gateway.tenderly.co";
const DEUS = "0x940A319B75861014A220D9c6c144d108552B089B";
const WATCH = [
  "0x3fd516041851011f38a0e9367b9e67e2eefd9a96",
  "0x6e831ebc833edb0160ba874ae934ca0981ac8ebb",
  "0x49a782c2660e77dded753bb88ac57619298ad50e",
  "0x999f938d97639e825dc963d375c69c78e5e03f38",
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rpc(method, params, tries = 6) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const j = await r.json();
      if (j.error) {
        if (/rate limit|exceeded|429/i.test(j.error.message)) { await sleep(1500 * (i + 1)); continue; }
        return { err: j.error.message };
      }
      return { ok: j.result };
    } catch (e) { await sleep(1500 * (i + 1)); }
  }
  return { err: "retries-exhausted" };
}

const headRes = await rpc("eth_blockNumber", []);
const head = parseInt(headRes.ok, 16);
const TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const set = new Set(WATCH.map((a) => a.toLowerCase()));

const rows = [];
const from = head - 2100;
for (let start = from; start <= head; start += 700) {
  const end = Math.min(start + 699, head);
  const r = await rpc("eth_getLogs", [{
    address: DEUS,
    fromBlock: "0x" + start.toString(16),
    toBlock: "0x" + end.toString(16),
    topics: [TOPIC],
  }]);
  if (r.ok) {
    for (const l of r.ok) {
      const f = "0x" + l.topics[1].slice(26);
      const t = "0x" + l.topics[2].slice(26);
      if (set.has(f) || set.has(t)) {
        rows.push({ blk: parseInt(l.blockNumber, 16), amt: Number(BigInt(l.data)) / 1e18, f, t, tx: l.transactionHash });
      }
    }
  } else console.log("err", start, r.err);
  await sleep(700);
}

rows.sort((a, b) => a.blk - b.blk);
console.log("matched transfers:", rows.length, "| window", from, "-", head);
for (const r of rows) {
  console.log(`blk=${r.blk} amt=${r.amt.toFixed(6)} from=${r.f} to=${r.t} tx=${r.tx}`);
}
