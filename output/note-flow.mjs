const u = "https://rpc.mainnet.chain.robinhood.com";
const call = (m, p) => fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: m, params: p }) }).then(r => r.json()).then(j => j.result);
const NOTE = "0xc4f730335fb9e439ca5552f7b52b8e638c4245b0";
const PM = "0x8366a39cc670b4001a1121b8f6a443a643e40951";
const T = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const from = 94992965, to = 95407836, win = 24000;
(async () => {
  let all = [], lo = from, w = win, calls = 0, retries = 0;
  while (lo <= to) {
    const hi = Math.min(lo + w - 1, to);
    try {
      const r = await call("eth_getLogs", [{ address: NOTE, topics: [T], fromBlock: "0x" + lo.toString(16), toBlock: "0x" + hi.toString(16) }]);
      all = all.concat(r); lo = hi + 1; calls++;
    } catch (e) {
      retries++; if (w <= 6000) { lo = hi + 1; } else w = Math.floor(w / 2);
    }
  }
  const dec = (h) => Number(BigInt(h)) / 1e18;
  const a = (t) => "0x" + t.slice(26).toLowerCase();
  let intoPool = 0, outPool = 0, sells = 0, buys = 0, mint = 0, burn = 0;
  const addrs = {};
  for (const l of all) {
    const f = a(l.topics[1]), t = a(l.topics[2]), v = dec(l.data);
    if (t === PM) { intoPool += v; sells++; }
    if (f === PM) { outPool += v; buys++; }
    if (f === "0x0000000000000000000000000000000000000000") mint += v;
    if (t === "0x0000000000000000000000000000000000000000") burn += v;
    addrs[f] = (addrs[f] || 0) - v;
    addrs[t] = (addrs[t] || 0) + v;
  }
  const top = Object.entries(addrs).sort((x, y) => x[1] - y[1]).slice(0, 8);
  console.log(JSON.stringify({ calls, retries, finalWin: w, total: all.length, sells, buys, intoPool: intoPool.toFixed(2), outPool: outPool.toFixed(2), net: (intoPool - outPool).toFixed(2), mint, burn, topNet: top.map(([k, v]) => [k, v.toFixed(2)]).concat(Object.entries(addrs).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, v]) => [k, v.toFixed(2)])) }, null, 1));
})();
