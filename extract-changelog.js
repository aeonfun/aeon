const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/tmp/repo-actions-state.json', 'utf8'));
const r = data.data.repository;
console.log('===== CHANGELOG line count =====');
console.log(r.changelog.text.split('\n').length);
console.log('===== "Unreleased" / TASKS hints in CHANGELOG =====');
const lines = r.changelog.text.split('\n');
let inUnreleased = false;
for (const l of lines) {
  if (l.match(/^## /)) inUnreleased = l.toLowerCase().includes('unreleased');
  if (inUnreleased) console.log(l);
}
console.log('\n===== KEY TASKS / TODO mentions =====');
const cl = r.claude.text;
console.log('CLAUDE.md TASKS section search:');
const claudeLines = cl.split('\n');
let i = 0;
for (const l of claudeLines) { i++; if (l.match(/TASK/i) || l.match(/TODO/i)) console.log(`L${i}: ${l}`); }
