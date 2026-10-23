const RPC = "https://base.gateway.tenderly.co";
const DEUS = "0x940A319B75861014A220D9c6c144d108552B089B";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hex = (n) => "0x" + n.toString(16);
const pad = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");

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

const blocks = [52994876, 52995672, 52996499];
for (const b of blocks) {
  const r = await rpc("eth_getBlockByNumber", [hex(b), false]);
  console.log("blk", b, "->", r.ok ? new Date(parseInt(r.ok.timestamp, 16) * 1000).toISOString() : r.err);
  await sleep(500);
}

console.log("\n-- pool DEUS inventory (balanceOf DEUS held by pool) --");
const pools = [
  ["0x3E97 VIRTUAL", "0x3E97c5EC8c73e7d566aCA606472141a9b9a8C1Fa"],
  ["0x58dB USDC", "0x58dBa34e6ee6eb76Ef71A6ca0f18871CAE817D3b"],
  ["0x1B2f USDC", "0x1B2f3f5C1B6037101FDD3EC14649E0d3F98fA642"],
];
for (const [label, p] of pools) {
  const r = await rpc("eth_call", [{ to: DEUS, data: "0x70a08231" + pad(p) }, "latest"]);
  console.log(label, r.ok ? (Number(BigInt(r.ok)) / 1e18).toFixed(6) : "ERR " + r.err);
  await sleep(600);
}

console.log("\n-- escrow at head / -6h / -24h --");
const headRes = await rpc("eth_blockNumber", []);
const head = parseInt(headRes.ok, 16);
for (const [tag, off] of [["now", 0], ["-6h", 10800], ["-24h", 43200]]) {
  const r = await rpc("eth_call", [{ to: DEUS, data: "0x70a08231" + pad("0xA85A38796B951CE87B378538b32B3E6Ee3C4C373") }, hex(head - off)]);
  console.log(tag, r.ok ? (Number(BigInt(r.ok)) / 1e18).toFixed(6) : "ERR " + r.err);
  await sleep(600);
}

console.log("\n-- new wallet 0x3fd5 balance at buy block -1 and now --");
for (const blk of [52995671, head]) {
  const r = await rpc("eth_call", [{ to: DEUS, data: "0x70a08231" + pad("0x3fd516041851011f38a0e9367b9e67e2eefd9a96") }, hex(blk)]);
  console.log("blk", blk, r.ok ? (Number(BigInt(r.ok)) / 1e18).toFixed(6) : "ERR " + r.err);
  await sleep(600);
}
