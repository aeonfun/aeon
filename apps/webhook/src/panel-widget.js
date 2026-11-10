// Aeon run panel: a Telegram HTML widget (Bot API 10.4, sendWidget).
//
// The widget runs inside the chat bubble with no network access. Everything it
// shows comes from `chat_data` (set by the Worker on send and on refresh), and
// every action goes back through TelegramWidget.request(), which reaches the
// Worker as a `widget_query` update. The Worker must answer within 15 s, so the
// panel only works in instant mode (this Worker), never through the 5-min poller.
//
// chat_data shape (<= 1024 bytes, built by packRuns in worker.js):
//   {"u":<unix seconds when built>,"r":[["skill","o|f|r|c",<unix seconds>], ...]}
//   o = success, f = failure, r = queued/running, c = cancelled or other.
//
// Limits to keep in mind when editing: 32768 bytes raw, 4096 bytes after zlib
// level 9 (test/ephemeral-widget.test.mjs checks both), no form inputs, no
// network, request() data 1-64 bytes, one request() per tap.
export const PANEL_HTML = `<style>
body{margin:0;font:var(--tg-text-font-size,15px)/1.35 system-ui,sans-serif;color:var(--tg-theme-text-color);background:var(--tg-theme-bg-color)}
.w{padding:10px 12px}
.h{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.t{font-weight:600}
.s{color:var(--tg-theme-hint-color);font-size:13px}
.row{display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid var(--tg-theme-section-separator-color,rgba(127,127,127,.2))}
.d{width:9px;height:9px;border-radius:50%;flex:none}
.o{background:#34c759}.f{background:#ff3b30}.r{background:#ffcc00}.c{background:#8e8e93}
.n{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
button{border:0;border-radius:8px;padding:5px 10px;font:inherit;font-size:13px;background:var(--tg-theme-button-color);color:var(--tg-theme-button-text-color)}
button:active{opacity:.6}
button.g{background:var(--tg-theme-secondary-bg-color);color:var(--tg-theme-text-color)}
.m{min-height:18px;margin-top:6px}
</style>
<div class="w">
<div class="h"><span class="t">Aeon runs</span><button class="g" id="rf">Refresh</button></div>
<div id="list"></div>
<div class="s m" id="msg"></div>
</div>
<script>
var TW=window.TelegramWidget,L=document.getElementById('list'),M=document.getElementById('msg');
function data(){try{return JSON.parse(TW&&TW.chatData||'{}')}catch(e){return{}}}
function ago(t){var s=Math.max(0,Math.floor(Date.now()/1000)-t);if(s<60)return'now';if(s<3600)return Math.floor(s/60)+'m';if(s<86400)return Math.floor(s/3600)+'h';return Math.floor(s/86400)+'d'}
var LBL={o:'ok',f:'failed',r:'running',c:'stopped'};
function draw(){
var d=data(),r=d.r||[];L.textContent='';
if(!r.length){L.innerHTML='<div class="s">No skill runs yet.</div>';return}
r.forEach(function(x){
var row=document.createElement('div');row.className='row';
var dot=document.createElement('span');dot.className='d '+(LBL[x[1]]?x[1]:'c');
var n=document.createElement('span');n.className='n';n.textContent=x[0];
var s=document.createElement('span');s.className='s';s.textContent=(LBL[x[1]]||'?')+' '+ago(x[2]);
var b=document.createElement('button');b.textContent='Run';
b.onclick=function(){ask('run:'+x[0],'Queued '+x[0])};
row.appendChild(dot);row.appendChild(n);row.appendChild(s);row.appendChild(b);L.appendChild(row)});
}
function ask(q,okMsg){
if(!TW){M.textContent='Open in Telegram.';return}
M.textContent='Sending...';
TW.request(q).then(function(a){
var j={};try{j=JSON.parse(a&&a.result||'{}')}catch(e){}
M.textContent=j.ok?(j.m||okMsg):('Not done: '+(j.m||'error'));
},function(e){M.textContent=e&&e.code==='NOT_ALLOWED'?'Open the chat with the bot to use this.':'Not sent: '+(e&&e.code||'error')});
}
document.getElementById('rf').onclick=function(){ask('refresh','Updated')};
if(TW){TW.onEvent('chatDataChanged',draw);if(TW.ready)TW.ready()}
draw();
</script>`;

// Turn GitHub Actions runs of aeon.yml (newest first) into the panel's chat_data:
// the latest run per skill, at most 10 skills, trimmed until it fits 1024 bytes.
// Skill names come from the workflow's run-name, "skill: <name> ...".
export function packRuns(runs, now = Math.floor(Date.now() / 1000)) {
  const seen = new Set();
  const rows = [];
  for (const run of runs || []) {
    const m = /^skill: ([a-z0-9-]{1,48})\b/.exec(run?.display_title || "");
    if (!m || seen.has(m[1])) continue;
    seen.add(m[1]);
    const st =
      run.status !== "completed" ? "r" : run.conclusion === "success" ? "o" : run.conclusion === "failure" ? "f" : "c";
    const t = Math.floor(Date.parse(run.run_started_at || run.created_at || "") / 1000) || now;
    rows.push([m[1], st, t]);
    if (rows.length >= 10) break;
  }
  const enc = new TextEncoder();
  let out = JSON.stringify({ u: now, r: rows });
  while (enc.encode(out).length > 1024 && rows.length) {
    rows.pop();
    out = JSON.stringify({ u: now, r: rows });
  }
  return out;
}
