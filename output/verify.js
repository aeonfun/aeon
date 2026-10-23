const https = require("https");

function rpcOn(host, method, params) {
  return new Promise((res, rej) => {
    const d = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
    const r = https.request(
      host,
      { method: "POST", headers: { "content-type": "application/json", "content-length": Buffer.byteLength(d) } },
      (x) => {
        let b = "";
        x.on("data", (c) => (b += c));
        x.on("end", () => {
          try {
            const j = JSON.parse(b);
            if (j.error) rej(new Error(JSON.stringify(j.error)));
            else res(j.result);
          } catch (e) {
            rej(new Error("bad json: " + b.slice(0, 200)));
          }
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
const PAD = "0x000000000000000000000000" + WALLET.slice(2);
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const HOSTS = ["https://base.gateway.tenderly.co", "https://mainnet.base.org"];

(async () => {
  for (const h of HOSTS) {
    console.log("== " + h);
    try {
      const bn = parseInt(await rpcOn(h, "eth_blockNumber", []), 16);
      const bal = await rpcOn(h, "eth_call", [{ to: TOKEN, data: "0x70a08231" + PAD.slice(2) }, "latest"]);
      const sup = await rpcOn(h, "eth_call", [{ to: TOKEN, data: "0x18160ddd" }, "latest"]);
      console.log("block=" + bn);
      console.log("wallet_deus=" + (Number(BigInt(bal)) / 1e18).toFixed(18));
      console.log("total_supply=" + (Number(BigInt(sup)) / 1e18).toFixed(3));
    } catch (e) {
      console.log("err " + e.message.slice(0, 160));
    }
  }
  // full log detail from tenderly
  try {
    const logs = await rpcOn(HOSTS[0], "eth_getLogs", [
      {
        address: TOKEN,
        fromBlock: "0x" + (52981900).toString(16),
        toBlock: "0x" + (52981910).toString(16),
        topics: [TRANSFER],
      },
    ]);
    for (const l of logs) {
      console.log("---- tx " + l.transactionHash + " blk " + parseInt(l.blockNumber, 16));
      l.topics.forEach((t, i) => console.log("  topic" + i + " " + t));
      console.log("  data " + (Number(BigInt(l.data)) / 1e18).toFixed(18));
      console.log("  wallet_in_t1=" + (l.topics[1] === PAD) + " in_t2=" + (l.topics[2] === PAD));
    }
  } catch (e) {
    console.log("logerr " + e.message.slice(0, 160));
  }
})();
