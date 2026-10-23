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
// selector + 12 bytes (24 hex) of left padding + 20-byte address
const enc = (addr) => "0x70a08231" + "0".repeat(24) + addr.toLowerCase().replace(/^0x/, "");

const TARGETS = {
  escrow: "0xA85A38796B951CE87B378538b32B3E6Ee3C4C373",
  pool_virtual: "0x3e97c5ec8c73e7d566aca606472141a9b9a8c1fa",
  prior_buyer: "0xa2f42a10a8eb9089ac51108af68fa202bf2c3130",
};

(async () => {
  for (const [k, a] of Object.entries(TARGETS)) {
    const d = enc(a);
    if (d.length !== 74) throw new Error("bad calldata len " + d.length);
    const r = await rpc("eth_call", [{ to: TOKEN, data: d }, "latest"]);
    console.log(k + " = " + (Number(BigInt(r)) / 1e18).toFixed(6));
  }
})();
