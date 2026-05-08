import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const msg = readFileSync('.digest-msg.txt', 'utf8').trimEnd();

try {
  const out = execFileSync('./notify', [msg], { encoding: 'utf8', stdio: 'pipe' });
  console.log('notify stdout:', out);
} catch (e) {
  console.error('notify failed:', e.message);
  if (e.stdout) console.error('stdout:', e.stdout.toString());
  if (e.stderr) console.error('stderr:', e.stderr.toString());
  process.exit(1);
}
