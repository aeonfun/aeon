const RPC = "https://base.gateway.tenderly.co";
const DEUS = "0x940A319B75861014A220D9c6c144d108552B089B";
const POOL = "0x3E97c5EC8c73e7d566aCA606472141a9b9a8C1Fa";
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function rpc(method, params) {
  for (let a = 1; a <= 6; a++) {
    const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    const j = await r.json();
    if (!j.error) return j.result;
    await sleep(1000 * 2 ** (a - 1));
  }
  throw new Error("rate limited");
}
const pad = (a) => "0x" + a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
const bal = async (a) => Number(BigInt(await rpc("eth_call", [{ to: DEUS, data: "0x70a08231" + pad(a).slice(2) }, "latest"]))) / 1e18;

const DEST = {
  "0xea247ce9": "0xea247ce961e2d19465fbf6657a1f43658ef1e6ae",
  "0x20d29c8e": "0x20d29c8ec7489c600da7e595ce4ae1da11d76fc5",
  "0xbf328713": "0xbf328713670d3407e94c3ab60ff1c36f95748e70",
};
const head = parseInt(await rpc("eth_blockNumber", []), 16);
const out = { recipients: {}, pool_sells_from_them_7d: 0 };

for (const [k, a] of Object.entries(DEST)) {
  const code = await rpc("eth_getCode", [a, "latest"]);
  out.recipients[k] = {
    address: a,
    eoa: code === "0x",
    code_prefix: code === "0x" ? null : code.slice(0, 12),
    deus: await bal(a),
    nonce: parseInt(await rpc("eth_getTransactionCount", [a, "latest"]), 16),
  };
  await sleep(150);
}

// did any of them send DEUS INTO the deepest pool in last 7d?
const start = head - 7 * 43200;
for (const [k, a] of Object.entries(DEST)) {
  let n = 0;
  for (let b = start; b <= head; b += 1000) {
    const to = Math.min(b + 999, head);
    for (let t = 1; t <= 3; t++) {
      try {
        const logs = await rpc("eth_getLogs", [{ address: DEUS, fromBlock: "0x" + b.toString(16), toBlock: "0x" + to.toString(16), topics: [TRANSFER, pad(a), pad(POOL)] }]);
        n += logs.length;
        break;
      } catch (e) { if (t === 3) throw e; await sleep(700 * 2 ** (t - 1)); }
    }
    await sleep(60);
  }
  out.recipients[k].deus_into_deep_pool_7d_transfers = n;
}
console.log(JSON.stringify(out, null, 2));
