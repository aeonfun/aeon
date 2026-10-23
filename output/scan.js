const https = require("https");

function rpc(method, params) {
  return new Promise((res, rej) => {
    const d = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
    const r = https.request(
      "https://base.gateway.tenderly.co",
      { method: "POST", headers: { "content-type": "application/json", "content-length": Buffer.byteLength(d) } },
      (x) => {
        let b = "";
        x.on("data", (c) => (b += c));
        x.on("end", () => {
          const j = JSON.parse(b);
          if (j.error) rej(new Error(JSON.stringify(j.error)));
          else res(j.result);
        });
      }
    );
    r.on("error", rej);
    r.write(d);
    r.end();
  });
}

const TOKEN = "0x940A319B75861014A220D9c6c144d108552B089B";
const WALLET = "0xa2f42a10a8eb9089ac51108af68fa202bf2c3130";
const pad = "0x" + WALLET.slice(2).padStart(64, "0");
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

(async () => {
  const latest = parseInt(await rpc("eth_blockNumber", []), 16);
  const start = 52970000;
  const logs = [];
  for (let from = start; from <= latest; from += 900) {
    const to = Math.min(from + 899, latest);
    try {
      const out = await rpc("eth_getLogs", [
        { address: TOKEN, fromBlock: "0x" + from.toString(16), toBlock: "0x" + to.toString(16), topics: [TRANSFER] },
      ]);
      for (const l of out) {
        const t1 = l.topics[1];
        const t2 = l.topics[2];
        if (t1 === pad || t2 === pad) logs.push(l);
      }
    } catch (e) {
      console.log("chunk_error " + from + "-" + to + " " + e.message.slice(0, 120));
    }
  }
  console.log("latest=" + latest + " matched_logs=" + logs.length);
  for (const l of logs) {
    const dir = l.topics[1] === pad ? "OUT" : "IN";
    const other = l.topics[1] === pad ? l.topics[2] : l.topics[1];
    const amt = Number(BigInt(l.data)) / 1e18;
    console.log(
      [dir, parseInt(l.blockNumber, 16), l.transactionHash, "cp=" + "0x" + other.slice(-40), "amt=" + amt.toFixed(6)].join(" ")
    );
  }
})();
