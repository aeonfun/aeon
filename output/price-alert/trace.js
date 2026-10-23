const RPC = "https://base.gateway.tenderly.co";
const DEUS = "0x940A319B75861014A220D9c6c144d108552B089B";
const WALLET = "0x3fd516041851011f38a0e9367b9e67e2eefd9a96";
const pad = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
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
const w = pad(WALLET);

const from = head - 2200;
const all = [];
for (let start = from; start < head; start += 900) {
  const end = Math.min(start + 899, head);
  const r = await rpc("eth_getLogs", [{
    address: DEUS,
    fromBlock: "0x" + start.toString(16),
    toBlock: "0x" + end.toString(16),
    topics: [TOPIC, null, w],
  }]);
  if (r.ok) for (const l of r.ok) all.push({ ...l, dir: "IN" });
  else console.log("err-IN", start, r.err);
  await sleep(600);
  const r2 = await rpc("eth_getLogs", [{
    address: DEUS,
    fromBlock: "0x" + start.toString(16),
    toBlock: "0x" + end.toString(16),
    topics: [TOPIC, w],
  }]);
  if (r2.ok) for (const l of r2.ok) all.push({ ...l, dir: "OUT" });
  else console.log("err-OUT", start, r2.err);
  await sleep(600);
}

all.sort((a, b) => parseInt(a.blockNumber, 16) - parseInt(b.blockNumber, 16));
console.log("transfers", all.length, "window", from, "-", head);
for (const l of all) {
  const amt = Number(BigInt(l.data)) / 1e18;
  const blk = parseInt(l.blockNumber, 16);
  console.log(
    l.dir, amt.toFixed(6), "DEUS",
    l.dir === "IN" ? "from=" + "0x" + l.topics[1].slice(26) : "to=" + "0x" + l.topics[2].slice(26),
    "blk=" + blk, "tx=" + l.transactionHash
  );
}
