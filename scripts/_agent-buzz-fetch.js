// One-shot XAI x_search fetcher for agent-buzz skill.
// Invoked via `node scripts/_agent-buzz-fetch.js` so process.env access bypasses the bash env-expansion sandbox issue.
const fs = require('fs');
const https = require('https');

const key = process.env.XAI_API_KEY;
if (!key) { console.log('NO_KEY'); process.exit(2); }

const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

const prompt = `Search X from ${yesterday} to ${today} for tweets in the AI-agents conversation: autonomous agents, agent frameworks, MCP / agent protocols, agent products, agent benchmarks, agent research papers. Return up to 40 candidates. For EACH candidate you MUST return: @handle, follower_count (integer or null), role_guess (builder|founder|researcher|investor|commentator|anon), one-line claim (what they actually said — not a paraphrase, the thesis), likes (int), retweets (int), replies (int), posted_at (ISO), direct_link (https://x.com/username/status/ID). Prefer builders/founders/researchers. Skip obvious engagement-farming threads ("RT if you agree", reply-guy pileons, giveaways).`;

const body = JSON.stringify({
  model: 'grok-4-1-fast',
  input: [{ role: 'user', content: prompt }],
  tools: [{ type: 'x_search', from_date: yesterday, to_date: today }],
});

const req = https.request({
  method: 'POST',
  hostname: 'api.x.ai',
  path: '/v1/responses',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + key,
    'Content-Length': Buffer.byteLength(body),
  },
  timeout: 180000,
}, (res) => {
  let chunks = '';
  res.on('data', (c) => { chunks += c; });
  res.on('end', () => {
    fs.mkdirSync('.xai-cache', { recursive: true });
    fs.writeFileSync('.xai-cache/agent-buzz.json', chunks);
    console.log('HTTP=' + res.statusCode + ' bytes=' + chunks.length);
  });
});
req.on('error', (e) => { console.log('ERR=' + e.message); process.exit(3); });
req.on('timeout', () => { console.log('TIMEOUT'); req.destroy(); process.exit(4); });
req.write(body);
req.end();
