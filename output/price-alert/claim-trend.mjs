const RPC = "https://base.gateway.tenderly.co";
const DEUS = "0x940A319B75861014A220D9c6c144d108552B089B";
const CLAIM = "0x5cbf5dfaa5336ce0456e24217e7911365100879a";
const CLAIM2 = "0x0ae95bd71d64e1d24d67f3cc293fb75f826c4a7b";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rpc(method, params) {
  for (let a = 1; a <= 6; a++) {
    const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    const j = await r.json();
    if (!j.error) return j.result;
    if (j.error.code === -32005 || /rate limit/i.test(j.error.message || "")) { await sleep(1000 * 2 ** (a - 1)); continue; }
    throw new Error(JSON.stringify(j.error));
  }
  throw new Error("rate limited");
}
const pad = (a) => "0x" + a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
const bal = async (t, blk) => Number(BigInt(await rpc("eth_call", [{ to: DEUS, data: "0x70a08231" + pad(t).slice(2) }, blk]))) / 1e18;

const head = parseInt(await rpc("eth_blockNumber", []), 16);
const BLOCKS_PER_DAY = 43200;
const marks = { now: head, "1d": head - BLOCKS_PER_DAY, "7d": head - 7 * BLOCKS_PER_DAY, "30d": head - 30 * BLOCKS_PER_DAY };

const out = {};
for (const [k, b] of Object.entries(marks)) {
  const hex = "0x" + b.toString(16);
  const blk = await rpc("eth_getBlockByNumber", [hex, false]);
  out[k] = {
    block: b,
    ts: new Date(parseInt(blk.timestamp, 16) * 1000).toISOString(),
    claim_5cbf: await bal(CLAIM, hex),
    claim_w2_0ae9: await bal(CLAIM2, hex),
  };
  await sleep(200);
}
for (const k of ["1d", "7d", "30d"]) {
  const d = out["now"].claim_5cbf - out[k].claim_5cbf;
  out[k].claim_outflow_vs_now = +d.toFixed(2);
  out[k].per_day = +(d / parseInt(k)).toFixed(2);
}
console.log(JSON.stringify(out, null, 2));
