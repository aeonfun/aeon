const RPC = "https://base.gateway.tenderly.co";
const DEUS = "0x940A319B75861014A220D9c6c144d108552B089B";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
const hex = (n) => "0x" + n.toString(16);

async function rpc(method, params, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      const j = await r.json();
      if (j.error) { if (/rate limit|exceeded|429/i.test(j.error.message)) { await sleep(2000*(i+1)); continue; } return { err: j.error.message }; }
      return { ok: j.result };
    } catch (e) { await sleep(2000 * (i + 1)); }
  }
  return { err: "retries-exhausted" };
}

const headRes = await rpc("eth_blockNumber", []);
const head = parseInt(headRes.ok, 16);
console.log("head", head);

const W = [
  ["NEW 0x1184 (46195 DEUS)", "0x1184de98c71b565a7bc8313d89d74322c3df7f3b"],
  ["NEW 0x3fd5 (5225 DEUS)", "0x3fd516041851011f38a0e9367b9e67e2eefd9a96"],
];
// 1h=1800 blocks, 24h=43200, 7d=302400, 30d=1296000
const offs = [["now",0],["-1h",1800],["-6h",10800],["-24h",43200],["-7d",302400],["-30d",1296000]];

for (const [label, a] of W) {
  const out = [];
  for (const [tag, off] of offs) {
    const r = await rpc("eth_call", [{ to: DEUS, data: "0x70a08231" + pad(a) }, hex(head - off)]);
    out.push(tag + "=" + (r.ok ? (Number(BigInt(r.ok)) / 1e18).toFixed(4) : "ERR"));
    await sleep(550);
  }
  const eth = await rpc("eth_getBalance", [a, "latest"]); await sleep(450);
  const code = await rpc("eth_getCode", [a, "latest"]); await sleep(450);
  const nonce = await rpc("eth_getTransactionCount", [a, "latest"]); await sleep(450);
  console.log("\n" + label + " " + a);
  console.log("  " + out.join("  "));
  console.log("  ETH=" + (eth.ok ? (Number(BigInt(eth.ok))/1e18).toFixed(6) : "ERR") +
              " nonce=" + (nonce.ok ? parseInt(nonce.ok,16) : "ERR") +
              " code=" + (code.ok ? code.ok.slice(0,10) : "ERR") + " (len " + (code.ok?code.ok.length:0) + ")");
}

// nonce history of the new whale -> when was it first active?
console.log("\n-- nonce at older blocks (0x1184) --");
for (const [tag, off] of [["-24h",43200],["-7d",302400],["-30d",1296000]]) {
  const r = await rpc("eth_getTransactionCount", ["0x1184de98c71b565a7bc8313d89d74322c3df7f3b", hex(head - off)]);
  console.log("  " + tag + " nonce=" + (r.ok ? parseInt(r.ok,16) : "ERR"));
  await sleep(500);
}
