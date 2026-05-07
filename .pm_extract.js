const fs = require('fs');
const events = {
  357807: 'US-Iran-peace-deal (May-15 25.35 / May-31 40.5 / June-30 56.5) — BIG +pp 24h',
  438327: 'Iran-airspace (May-8 T-1 today, 1.85% YES)',
  372242: 'Trump-announces-blockade-of-Hormuz',
  329654: 'US-iranian-uranium-by-May-31',
  36173: 'When-will-BTC-hit-150k (June-30 1.35% YES, $5.82M v24)',
};

function fmt(c, idx) {
  const u = (c.profile && (c.profile.username || c.profile.name || c.profile.displayUsernamePublic))
    || (c.userAddress ? c.userAddress.slice(0, 10) : 'anon');
  const rx = c.reactionCount || 0;
  const date = (c.createdAt || '').slice(0, 16);
  const body = (c.body || '').replace(/\s+/g, ' ').slice(0, 380);
  return '  [' + idx + '] ' + rx + 'x ' + u + ' (' + date + '): ' + body;
}

for (const [id, label] of Object.entries(events)) {
  let top = [];
  let recent = [];
  try { top = JSON.parse(fs.readFileSync('.pm_top_' + id + '.json', 'utf8')); } catch (e) {}
  try { recent = JSON.parse(fs.readFileSync('.pm_recent_' + id + '.json', 'utf8')); } catch (e) {}
  console.log('\n=== EVENT ' + id + ' | ' + label + ' ===');
  console.log('TOP (n=' + top.length + '):');
  top.slice(0, 20).forEach((c, i) => console.log(fmt(c, i + 1)));
  console.log('RECENT (n=' + recent.length + '):');
  recent.slice(0, 12).forEach((c, i) => console.log(fmt(c, i + 1)));
}
