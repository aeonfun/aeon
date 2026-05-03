const {execFileSync} = require('child_process');
const fs = require('fs');
const msg = fs.readFileSync('.pending-notify/monitor-polymarket-2026-05-03.txt', 'utf8');
execFileSync('./notify', [msg.trim()], {stdio: 'inherit'});
