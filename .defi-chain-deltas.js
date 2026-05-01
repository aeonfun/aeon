const fs = require('fs');
const path = require('path');

const chainFiles = fs.readdirSync('/home/runner/work/aeon/aeon')
  .filter(f => f.startsWith('.defi-chain-') && f.endsWith('.json'));

const result = {};
for (const f of chainFiles) {
  const chain = f.replace('.defi-chain-', '').replace('.json', '');
  try {
    const data = JSON.parse(fs.readFileSync(path.join('/home/runner/work/aeon/aeon', f), 'utf8'));
    if (!Array.isArray(data) || data.length < 8) continue;
    const last = data[data.length - 1];
    const prev = data[data.length - 2];
    const week = data[data.length - 8];
    if (!last || !prev || !week) continue;
    const ch1d = (last.tvl - prev.tvl) / prev.tvl * 100;
    const ch7d = (last.tvl - week.tvl) / week.tvl * 100;
    result[chain] = {
      tvl: last.tvl,
      tvl_yday: prev.tvl,
      tvl_week: week.tvl,
      change_1d: ch1d,
      change_7d: ch7d,
      lastDate: new Date(last.date * 1000).toISOString().slice(0, 10),
    };
  } catch (e) {
    result[chain] = { error: e.message };
  }
}

// Global
try {
  const g = JSON.parse(fs.readFileSync('/home/runner/work/aeon/aeon/.defi-global-chart.json', 'utf8'));
  const last = g[g.length - 1];
  const prev = g[g.length - 2];
  const week = g[g.length - 8];
  result['__global__'] = {
    tvl: last.tvl,
    tvl_yday: prev.tvl,
    tvl_week: week.tvl,
    change_1d: (last.tvl - prev.tvl) / prev.tvl * 100,
    change_7d: (last.tvl - week.tvl) / week.tvl * 100,
    lastDate: new Date(last.date * 1000).toISOString().slice(0, 10),
  };
} catch (e) {}

fs.writeFileSync('/home/runner/work/aeon/aeon/.defi-chain-deltas.json', JSON.stringify(result, null, 2));

// Print summary table
console.log('Chain\t\t1d\t7d\tTVL_M\tDate');
const entries = Object.entries(result).filter(([k]) => k !== '__global__');
entries.sort((a,b) => (b[1].tvl||0) - (a[1].tvl||0));
for (const [name, d] of entries) {
  if (d.error) { console.log(name + ': ERROR ' + d.error); continue; }
  console.log(`${name.padEnd(20)} ${d.change_1d.toFixed(2)}%\t${d.change_7d.toFixed(2)}%\t${(d.tvl/1e6).toFixed(0)}\t${d.lastDate}`);
}
console.log('---');
const g = result['__global__'];
console.log(`__global__\t\t${g.change_1d.toFixed(2)}%\t${g.change_7d.toFixed(2)}%\t${(g.tvl/1e9).toFixed(2)}B\t${g.lastDate}`);
