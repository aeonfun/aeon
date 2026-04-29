const fs = require('fs');
const arr = JSON.parse(fs.readFileSync('.outputs/pp-ranked.json', 'utf8'));
const TARGET_IDS = ['2512.16301','2508.07407','2604.01658','2603.27771','2603.19461','2412.20138','2503.16252','2510.25779','2509.09995','2510.11695','2604.17406','2603.08127'];
for (const id of TARGET_IDS) {
  const p = arr.find(x => x.id === id);
  if (!p) { console.log('--- NOT FOUND', id); continue; }
  console.log('===', p.id, '↑'+p.up, p.pub.slice(0,10), '|', p.hit);
  console.log('TITLE:', p.title);
  console.log('AUTHORS:', p.authors.join(', '));
  console.log('SUMMARY:', p.summary);
  console.log('');
}
