const fs = require('fs');
const logs = JSON.parse(fs.readFileSync('tl_logs.json', 'utf8'));
for (const l of logs) {
  if (parseInt(l.blockNumber, 16) !== 94195015) continue;
  console.log('topic0', l.topics[0]);
  l.topics.slice(1).forEach((t, i) => console.log('  topic', i + 1, t));
  const d = l.data.slice(2);
  for (let i = 0; i < d.length / 64; i++) console.log('  word', i, d.slice(i * 64, (i + 1) * 64));
}
