const { execFileSync } = require('child_process');
const fs = require('fs');
const body = fs.readFileSync('notify-msg.txt', 'utf8');
try {
  const out = execFileSync('./notify', [body], { encoding: 'utf8', stdio: 'pipe' });
  console.log('STDOUT:', out);
} catch (e) {
  console.log('exit code:', e.status);
  console.log('stdout:', e.stdout?.toString());
  console.log('stderr:', e.stderr?.toString());
}
