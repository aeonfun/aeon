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

const POOL = "0x3E97c5EC8c73e7d566aCA606472141a9b9a8C1Fa";
const blk = 52994860;
const b = await rpc("eth_getBlockByNumber", [hex(blk), false]);
console.log("block", blk, b.ok ? new Date(parseInt(b.ok.timestamp, 16) * 1000).toISOString() : b.err);

const r = await rpc("eth_getLogs", [{ address: POOL, fromBlock: hex(blk), toBlock: hex(blk) }]);
for (const l of r.ok) {
  console.log("topic0=" + l.topics[0]);
  console.log("  topics:", l.topics.map((t, i) => i + ":" + t.slice(0, 18)).join(" "));
  console.log("  data words:", l.data.slice(2).match(/.{1,64}/g).map((w, i) => i + ":" + w.slice(0, 20)).join(" "));
  console.log("  tx:", l.transactionHash);
}

// Pool token balances now
console.log("\n-- DEUS held by deepest pool now --");
const pb = await rpc("eth_call", [{ to: DEUS, data: "0x70a08231" + pad(POOL) }, "latest"]);
console.log(pb.ok ? (Number(BigInt(pb.ok)) / 1e18).toFixed(6) : pb.err);

// pool liquidity() for CL pools
const liq = await rpc("eth_call", [{ to: POOL, data: "0x1a686502" }, "latest"]); // liquidity()
console.log("liquidity():", liq.ok ? liq.ok : liq.err);
const sp = await rpc("eth_call", [{ to: POOL, data: "0x3850c7bd" }, "latest"]); // slot0()
console.log("slot0():", sp.ok ? sp.ok.slice(0, 200) : sp.err);
