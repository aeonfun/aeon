const RPC = "https://base.gateway.tenderly.co";
const DEUS = "0x940A319B75861014A220D9c6c144d108552B089B";
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
console.log("head_block", head);

const offsets = [
  ["now", 0],
  ["-1h", 1800],
  ["-6h", 10800],
  ["-24h", 43200],
  ["-48h", 86400],
];

const addrs = [
  ["0x3fd516041851011f38a0e9367b9e67e2eefd9a96", "18:38Z buyer $21.8"],
  ["0x999f938d97639e825dc963d375c69c78e5e03f38", "16:52Z buyer $198"],
  ["0x6e831ebc833edb0160ba874ae934ca0981ac8ebb", "router"],
  ["0x49a782c2660e77dded753bb88ac57619298ad50e", "MM seller"],
  ["0xA85A38796B951CE87B378538b32B3E6Ee3C4C373", "escrow"],
];

for (const [a, label] of addrs) {
  const out = [];
  for (const [tag, off] of offsets) {
    const blk = "0x" + (head - off).toString(16);
    const r = await rpc("eth_call", [{ to: DEUS, data: "0x70a08231" + pad(a) }, blk]);
    out.push(tag + "=" + (r.ok ? (Number(BigInt(r.ok)) / 1e18).toFixed(6) : "ERR:" + r.err));
    await sleep(500);
  }
  console.log(label, a, out.join("  "));
}
