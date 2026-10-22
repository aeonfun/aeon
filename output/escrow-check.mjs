const u = "https://base.gateway.tenderly.co";
const call = (m, p) => fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: m, params: p }) }).then(r => r.json()).then(j => j.result);
const DEUS = "0x940a319b75861014a220d9c6c144d108552b089b";
const ESC = "0xa85a38796b951ce87b378538b32b3e6ee3c4c373";
const T = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const pad = (a) => "0x000000000000000000000000" + a.slice(2);
const from = 52935166, to = 52956772, win = 1000;
async function scan(topics) {
  let out = [], lo = from, w = win;
  while (lo <= to) {
    const hi = Math.min(lo + w - 1, to);
    try {
      const r = await call("eth_getLogs", [{ address: DEUS, topics, fromBlock: "0x" + lo.toString(16), toBlock: "0x" + hi.toString(16) }]);
      out = out.concat(r); lo = hi + 1;
    } catch (e) { if (w <= 250) { console.error("SKIP", lo, String(e.message).slice(0, 100)); lo = hi + 1; } else w = Math.floor(w / 2); }
  }
  return out;
}
const a = (t) => "0x" + t.slice(26).toLowerCase();
(async () => {
  const inn = await scan([T, null, pad(ESC)]);
  const out = await scan([T, pad(ESC)]);
  console.log("IN", inn.length, inn.map(l => [a(l.topics[1]), (Number(BigInt(l.data)) / 1e18).toFixed(3), parseInt(l.blockNumber, 16)]));
  console.log("OUT", out.length, out.map(l => [a(l.topics[2]), (Number(BigInt(l.data)) / 1e18).toFixed(3), parseInt(l.blockNumber, 16)]));
  const si = inn.reduce((s, l) => s + Number(BigInt(l.data)) / 1e18, 0);
  const so = out.reduce((s, l) => s + Number(BigInt(l.data)) / 1e18, 0);
  console.log("sumIn", si.toFixed(3), "sumOut", so.toFixed(3), "net", (si - so).toFixed(3));
  const bal = await call("eth_call", [{ to: DEUS, data: "0x70a08231" + pad(ESC).slice(2) }, "latest"]);
  console.log("balanceNow", (Number(BigInt(bal)) / 1e18).toFixed(6));
})();
