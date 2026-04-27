#!/usr/bin/env node
const fs = require('fs');
const https = require('https');

const key = process.env.XAI_API_KEY;
if (!key) { console.error('XAI_API_KEY not set'); process.exit(2); }

const today = new Date();
const yesterday = new Date(today.getTime() - 24*3600*1000);
const fmt = d => d.toISOString().slice(0,10);
const fromDate = fmt(yesterday);
const toDate = fmt(today);

const prompt = `Search X from ${fromDate} to ${toDate} for tweets in the AI-agents conversation: autonomous agents, agent frameworks, MCP / agent protocols, agent products, agent benchmarks, agent research papers. Return up to 40 candidates. For EACH candidate you MUST return: @handle, follower_count (integer or null), role_guess (builder|founder|researcher|investor|commentator|anon), one-line claim (what they actually said - not a paraphrase, the thesis), likes (int), retweets (int), replies (int), posted_at (ISO), direct_link (https://x.com/username/status/ID). Prefer builders/founders/researchers. Skip obvious engagement-farming threads (RT if you agree, reply-guy pileons, giveaways).`;

const body = JSON.stringify({
  model: 'grok-4-1-fast',
  input: [{role: 'user', content: prompt}],
  tools: [{type: 'x_search', from_date: fromDate, to_date: toDate}]
});

const req = https.request({
  hostname: 'api.x.ai',
  path: '/v1/responses',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + key,
    'Content-Length': Buffer.byteLength(body)
  },
  timeout: 180000
}, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    try { fs.mkdirSync('.xai-cache', {recursive: true}); } catch(e){}
    fs.writeFileSync('.xai-cache/agent-buzz.json', data);
    console.log('HTTP ' + res.statusCode + ' bytes=' + data.length);
    if (res.statusCode !== 200) {
      console.error(data.slice(0, 600));
      process.exit(1);
    }
  });
});
req.on('error', e => { console.error('req error: ' + e.message); process.exit(3); });
req.on('timeout', () => { console.error('timeout'); req.destroy(); process.exit(4); });
req.write(body);
req.end();
