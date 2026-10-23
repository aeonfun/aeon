const RPC = "https://base.gateway.tenderly.co";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hex = (n) => "0x" + n.toString(16);
const pad = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
const DEUS = "0x940A319B75861014A220D9c6c144d108552B089B";

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
const SWAP = "0xb3e2773606abfd36b5bd91394b3a54d1398336c65005baf7bf7a05efeffaf75b";
// DEUS is token1 in this pool (confirmed), so amount1 is DEUS delta.
const s256 = (h) => { const v = BigInt("0x" + h); return v >= 1n << 255n ? v - (1n << 256n) : v; };

const headRes = await rpc("eth_blockNumber", []);
const head = parseInt(headRes.ok, 16);
const from = head - 2600;
console.log("head", head, "| window", from, "-", head, "(~85 min)");

const rows = [];
for (let s = from; s <= head; s += 950) {
  const e = Math.min(s + 949, head);
  const r = await rpc("eth_getLogs", [{ address: POOL, fromBlock: hex(s), toBlock: hex(e), topics: [SWAP] }]);
  if (r.ok) rows.push(...r.ok); else console.log("err", s, r.err);
  await sleep(800);
}
rows.sort((a, b) => parseInt(a.blockNumber, 16) - parseInt(b.blockNumber, 16));
console.log("swaps found:", rows.length);

let buyUsd = 0, sellUsd = 0;
const blks = [];
for (const l of rows) {
  const blk = parseInt(l.blockNumber, 16);
  blks.push(blk);
  const d = l.data.slice(2);
  const w = d.match(/.{1,64}/g) || [];
  const a0 = s256(w[0]), a1 = s256(w[1]);
  const sender = "0x" + (l.topics[1] || "").slice(26);
  const recip = "0x" + (l.topics[2] || "").slice(26);
  const deus = a1;
  const usd = Math.abs(Number(deus) / 1e18) * 0.0181;
  const kind = deus > 0n ? "SELL" : "BUY";
  if (kind === "BUY") buyUsd += usd; else sellUsd += usd;
  console.log(`blk=${blk} ${kind} DEUS=${(Number(deus)/1e18).toFixed(2)} ≈$${usd.toFixed(2)} sender=${sender} recipient=${recip} tx=${l.transactionHash}`);
  console.log(`   amount0=${(Number(a0)/1e6).toFixed(6)} (token0 18dec=${(Number(a0)/1e18).toFixed(4)}) sqrtP/tick words: ${w.slice(2,5).map(x=>x.slice(0,16)).join(",")}`);
}

// block timestamps
if (blks.length) {
  await sleep(500);
  for (const b of [...new Set(blks)]) {
    const r = await rpc("eth_getBlockByNumber", [hex(b), false]);
    console.log("ts", b, r.ok ? new Date(parseInt(r.ok.timestamp, 16) * 1000).toISOString() : r.err);
    await sleep(450);
  }
}
console.log(`\nwindow $ flow: BUY $${buyUsd.toFixed(2)} / SELL $${sellUsd.toFixed(2)}`);
