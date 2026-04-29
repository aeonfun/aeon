const fs = require('fs');
const SKIP = new Set([
  '2509.22638', '2511.03628', '2604.22748', '2604.22436', '2601.13545',
  '2604.17295', '2604.20987', '2601.01706', '2512.25070', '2604.24005',
  '2602.19520', '2602.04837', '2602.16928', '2510.14264',
  '2502.11433', '2511.20606', '2510.02209', '2512.16030'
]);
const FILES = ['pmcalib','marl','regime','polymarket','darwin','fincon','llmtrade','evo','bin','group'];
const seen = new Set();
const all = [];
for (const f of FILES) {
  const path = `.outputs/pp-q-${f}.json`;
  let arr;
  try { arr = JSON.parse(fs.readFileSync(path, 'utf8')); } catch(e) { console.error('skip', f, e.message); continue; }
  for (const item of arr) {
    const p = item.paper || item;
    const id = p.id;
    if (!id || SKIP.has(id) || seen.has(id)) continue;
    seen.add(id);
    all.push({
      id,
      title: p.title || '',
      authors: (p.authors || []).map(a => a.name).slice(0, 6),
      pub: p.publishedAt || '',
      up: p.upvotes || 0,
      summary: (p.summary || '').slice(0, 600),
      hit: f
    });
  }
}
all.sort((a,b) => (b.up - a.up) || (b.pub.localeCompare(a.pub)));
const top = all.slice(0, 40);
fs.writeFileSync('.outputs/pp-ranked.json', JSON.stringify(top, null, 2));
console.log('TOTAL UNIQUE:', all.length, ' TOP:', top.length);
for (const p of top.slice(0, 30)) {
  console.log([
    p.up.toString().padStart(4),
    (p.pub || '').slice(0,10).padEnd(10),
    p.id.padEnd(11),
    p.hit.padEnd(10),
    p.title
  ].join(' | '));
}
