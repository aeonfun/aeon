const fs = require('fs');
const events = {
  357807: 'US-Iran-peace-deal (parent: May-15/May-31/June-30)',
  438327: 'Iran-airspace (parent: May-8 T-2 / May-31)',
  329654: 'US-iranian-uranium-by-May-31',
  30829: 'Democratic-presidential-nominee-2028 (Bernie etc.)',
  372242: 'Trump-announces-blockade-of-Hormuz',
};

function fmt(c, idx) {
  const u = (c.profile && (c.profile.username || c.profile.name)) || (c.userAddress || '').slice(0, 10) || 'anon';
  const rx = c.reactionCount || 0;
  const date = (c.createdAt || '').slice(0, 16);
  const body = (c.body || '').replace(/\s+/g, ' ').slice(0, 320);
  return `  [${idx}] ${rx}x ${u} (${date}): ${body}`;
}

for (const [id, label] of Object.entries(events)) {
  const top = JSON.parse(fs.readFileSync(`.pm_top_${id}.json`));
  const recent = JSON.parse(fs.readFileSync(`.pm_recent_${id}.json`));
  console.log(`\n=== EVENT ${id} | ${label} ===`);
  console.log(`TOP (n=${top.length}):`);
  top.slice(0, 18).forEach((c, i) => console.log(fmt(c, i + 1)));
  console.log(`RECENT (n=${recent.length}):`);
  recent.slice(0, 12).forEach((c, i) => console.log(fmt(c, i + 1)));
}
