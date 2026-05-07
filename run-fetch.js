const { execFileSync } = require('child_process');
const fs = require('fs');
const out = execFileSync('gh', [
  'api', 'graphql',
  '-F', 'owner=tomscaria',
  '-F', 'name=swarm-fund-mvp',
  '--field', 'query=@/tmp/repo-actions-query.graphql'
], { maxBuffer: 50 * 1024 * 1024 });
fs.writeFileSync('/tmp/repo-actions-state.json', out);
console.log('bytes=' + out.length);
