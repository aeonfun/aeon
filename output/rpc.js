const https = require("https");

function post(body) {
  return new Promise((res, rej) => {
    const d = JSON.stringify(body);
    const r = https.request(
      "https://base.gateway.tenderly.co",
      { method: "POST", headers: { "content-type": "application/json", "content-length": Buffer.byteLength(d) } },
      (x) => {
        let b = "";
        x.on("data", (c) => (b += c));
        x.on("end", () => res(JSON.parse(b)));
      }
    );
    r.on("error", rej);
    r.write(d);
    r.end();
  });
}

(async () => {
  const escrow = "0xA85A38796B951CE87B378538b32B3E6Ee3C4C373".toLowerCase().slice(2).padStart(64, "0");
  const reqs = [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [
        { to: "0x940A319B75861014A220D9c6c144d108552B089B", data: "0x70a08231000000000000000000000000" + escrow },
        "latest",
      ],
    },
    { jsonrpc: "2.0", id: 2, method: "eth_blockNumber", params: [] },
  ];
  const out = await post(reqs);
  for (const x of out) {
    if (x.id === 1) {
      if (x.error) console.log("escrow_error=" + JSON.stringify(x.error));
      else console.log("escrow_wei=" + BigInt(x.result).toString() + " deus=" + (Number(BigInt(x.result)) / 1e18).toFixed(3));
    } else {
      console.log("block=" + parseInt(x.result, 16));
    }
  }
})();
