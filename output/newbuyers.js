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
const enc = (a) => "0x70a08231" + "0".repeat(24) + a.toLowerCase().replace(/^0x/, "");
const ADD = {
  "14:01Z buyer 0x6663f69e": "0x6663f69eec709618e563597a3e2e7d0b6e3e4a32",
  "14:00Z buyer 0x2d3faeac": "0x2d3faeac23567d32b249b2325689f6f76dda4a28",
  "13:28Z buyer 0x394311a6": "0x394311a6aaa0d8e3411d8b62de4578d41322d1bd",
  "12:57Z buyer 0x754dcfb2": "0x754dcfb2861547015b221e963b4133a71dbdc024",
};
(async () => {
  for (const [k, a] of Object.entries(ADD)) {
    const r = await rpc("eth_call", [{ to: TOKEN, data: enc(a) }, "latest"]);
    console.log(k + " -> " + (Number(BigInt(r)) / 1e18).toFixed(6) + " DEUS");
  }
})();
