// onchain-monitor scan helper — windowed eth_getLogs with halving retry, <=3 concurrency.
// NOTE (2026-10-22): $BASE_RPC_URL / $RH_RPC_URL now resolve to Infura free tier,
// which rejects eth_getLogs above a 10-block range. Use public endpoints with real windows.
const RPCS = {
  base: "https://base.gateway.tenderly.co",
  rh: "https://rpc.mainnet.chain.robinhood.com",
};
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rpc(chain, method, params, attempt = 0) {
  const url = RPCS[chain];
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    if (res.status !== 200) throw new Error(`HTTP ${res.status} ${text.slice(0, 160)}`);
    const j = JSON.parse(text);
    if (j.error) throw new Error(`RPCERR ${JSON.stringify(j.error).slice(0, 200)}`);
    return j.result;
  } catch (e) {
    if (attempt < 3) {
      await sleep(1000 * 2 ** attempt);
      return rpc(chain, method, params, attempt + 1);
    }
    throw e;
  }
}

const toNum = (h) => Number(BigInt(h));
const toHex = (n) => "0x" + BigInt(n).toString(16);
const pad = (a) => "0x000000000000000000000000" + a.toLowerCase().replace(/^0x/, "");

// Fetch a block range for one filter spec, splitting windows on failure.
async function getLogsRange(chain, filter, from, to, win, stats, key) {
  const out = [];
  let lo = from;
  let w = win;
  while (lo <= to) {
    let hi = Math.min(lo + w - 1, to);
    const f = { ...filter, fromBlock: toHex(lo), toBlock: toHex(hi) };
    try {
      const r = await rpc(chain, "eth_getLogs", [f]);
      stats.calls++;
      out.push(...r);
      lo = hi + 1;
      stats.windows++;
      if (stats.windows % 20 === 0) console.error(`PROGRESS ${key} at ${lo}/${to} win=${w} logs=${out.length}`);
    } catch (e) {
      stats.retries++;
      const msg = String(e.message);
      if (w <= 500) {
        stats.skipped.push(`${lo}-${hi}: ${msg.slice(0, 120)}`);
        lo = hi + 1;
      } else {
        w = Math.max(500, Math.floor(w / 2));
      }
    }
  }
  stats.finalWindow = w;
  return out;
}

async function pool(tasks, limit = 3) {
  const results = new Array(tasks.length);
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

function decodeTransfer(log) {
  const t = log.topics;
  const from = "0x" + t[1].slice(26).toLowerCase();
  const to = t[2] ? "0x" + t[2].slice(26).toLowerCase() : null;
  const tokenId = t[3] ? BigInt(t[3]).toString() : null;
  const data = log.data && log.data !== "0x" ? BigInt(log.data).toString() : null;
  return { from, to, tokenId, rawValue: data, block: toNum(log.blockNumber), tx: log.transactionHash, address: log.address.toLowerCase() };
}

const DEUS = "0x940a319b75861014a220d9c6c144d108552b089b";
const XDEUS = "0xe6d5f7439bc236c40054e2275f765f59343d4431";
const ESCROW = "0xa85a38796b951ce87b378538b32b3e6ee3c4c373";
const NOTE = "0xc4f730335fb9e439ca5552f7b52b8e638c4245b0";
const TIMELOCK = "0x4a53afd9c4d707c8fddd6415947ef0a1e67518b8";
const OWNER = "0x0b64b35c6dd23944d6d4029864d2ca2aa1b66422";
const VESTING = "0xfdd983c66d4da2ef64769b6a2eba9cd838289962";

const JOBS = [
  { key: "deus_in", chain: "base", win: 1000, filter: { address: DEUS, topics: [TRANSFER, null, pad(ESCROW)] }, from: 52935166 },
  { key: "deus_out", chain: "base", win: 1000, filter: { address: DEUS, topics: [TRANSFER, pad(ESCROW)] }, from: 52935166 },
  { key: "xdeus", chain: "base", win: 1000, filter: { address: XDEUS, topics: [TRANSFER] }, from: 52935166 },
  { key: "timelock", chain: "rh", win: 24000, filter: { address: TIMELOCK }, from: 94992965 },
  { key: "owner_in", chain: "rh", win: 24000, filter: { address: NOTE, topics: [TRANSFER, null, pad(OWNER)] }, from: 94992965 },
  { key: "owner_out", chain: "rh", win: 24000, filter: { address: NOTE, topics: [TRANSFER, pad(OWNER)] }, from: 94992965 },
  { key: "vest_in", chain: "rh", win: 24000, filter: { address: NOTE, topics: [TRANSFER, null, pad(VESTING)] }, from: 94992965 },
  { key: "vest_out", chain: "rh", win: 24000, filter: { address: NOTE, topics: [TRANSFER, pad(VESTING)] }, from: 94992965 },
];

const head = { base: 52956772, rh: 95407836 };
const all = {};
const statsByJob = {};

const tasks = JOBS.map((j) => async () => {
  const st = { calls: 0, retries: 0, windows: 0, skipped: [], finalWindow: j.win };
  const logs = await getLogsRange(j.chain, j.filter, j.from, head[j.chain], j.win, st, j.key);
  all[j.key] = logs.map(decodeTransfer).sort((a, b) => a.block - b.block);
  statsByJob[j.key] = st;
});

await pool(tasks, 3);

// Balances / supply witnesses
async function call(chain, to, data) {
  return rpc(chain, "eth_call", [{ to, data }, "latest"]);
}
const balTasks = [
  ["escrow_bal", async () => BigInt(await call("base", DEUS, "0x70a08231" + pad(ESCROW).slice(2))).toString()],
  ["xdeus_supply", async () => BigInt(await call("base", XDEUS, "0x18160ddd")).toString()],
  ["escrow_xdeus", async () => BigInt(await call("base", XDEUS, "0x70a08231" + pad(ESCROW).slice(2))).toString()],
  ["timelock_note", async () => BigInt(await call("rh", NOTE, "0x70a08231" + pad(TIMELOCK).slice(2))).toString()],
  ["owner_note", async () => BigInt(await call("rh", NOTE, "0x70a08231" + pad(OWNER).slice(2))).toString()],
  ["vesting_note", async () => BigInt(await call("rh", NOTE, "0x70a08231" + pad(VESTING).slice(2))).toString()],
  ["note_supply", async () => BigInt(await call("rh", NOTE, "0x18160ddd")).toString()],
];
const balRes = await pool(balTasks.map(([, f]) => f), 3);
const balances = Object.fromEntries(balTasks.map(([k], i) => [k, balRes[i]]));

const fs = await import("node:fs");
const full = { head, stats: statsByJob, balances, logs: all };
fs.writeFileSync("/tmp/scan-result.json", JSON.stringify(full, null, 1));
console.log("HEAD", JSON.stringify(head));
console.log("STATS", JSON.stringify(statsByJob));
console.log("BAL", JSON.stringify(balances));
for (const k of Object.keys(all)) console.log("COUNT", k, all[k].length);
