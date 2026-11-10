// Tests for the Bot API 10.4 paths in ../src/worker.js: ephemeral replies to
// button taps, the "Details" button, the /panel HTML widget and widget_query
// handling. Imports the REAL module and stubs global fetch, recording every
// Telegram and GitHub call. Run: node test/ephemeral-widget.test.mjs
import assert from "node:assert/strict";
import { register } from "node:module";
import { deflateSync } from "node:zlib";

register("./loader-hook.mjs", import.meta.url);

const env = {
  TELEGRAM_WEBHOOK_SECRET: "s3cr3t",
  TELEGRAM_CHAT_ID: "-100500", // the owner's group
  TELEGRAM_ALLOWED_USER_ID: "111", // the owner
  TELEGRAM_BOT_TOKEN: "fake-token",
  GITHUB_REPO: "fake/fake",
  GITHUB_TOKEN: "fake-gh-token",
};

let calls = [];
let skillOutput = "Full report: BTC up 4%.";
let tgReply = () => ({ ok: true, result: {} });
const runs = [
  { display_title: "skill: token-movers", status: "completed", conclusion: "success", run_started_at: "2026-11-10T08:00:00Z" },
  { display_title: "skill: token-movers (daily)", status: "completed", conclusion: "failure", run_started_at: "2026-11-09T08:00:00Z" },
  { display_title: "skill: pr-review", status: "in_progress", conclusion: null, run_started_at: "2026-11-10T09:00:00Z" },
  { display_title: "Messages", status: "completed", conclusion: "success", run_started_at: "2026-11-10T09:00:00Z" },
];

globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  const body = opts.body ? JSON.parse(opts.body) : null;
  if (u.hostname === "api.telegram.org") {
    const method = u.pathname.split("/").pop();
    calls.push({ host: "tg", method, body });
    return new Response(JSON.stringify(tgReply(method, body)), { status: 200 });
  }
  if (u.hostname === "api.github.com") {
    calls.push({ host: "gh", path: u.pathname, body });
    if (u.pathname.endsWith("/dispatches")) return new Response(null, { status: 204 });
    if (u.pathname.includes("/contents/output/.chains/")) {
      return skillOutput === null ? new Response("nope", { status: 404 }) : new Response(skillOutput, { status: 200 });
    }
    if (u.pathname.endsWith("/actions/workflows/aeon.yml/runs")) {
      return new Response(JSON.stringify({ workflow_runs: runs }), { status: 200 });
    }
  }
  throw new Error(`unexpected fetch ${url}`);
};

const worker = (await import("../src/worker.js")).default;
const { PANEL_HTML, packRuns } = await import("../src/panel-widget.js");
const ctx = { waitUntil: () => {} };

let nextId = 1;
const post = update =>
  worker.fetch(
    new Request("https://example.invalid/", {
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": "s3cr3t" },
      body: JSON.stringify({ update_id: nextId++, ...update }),
    }),
    env,
    ctx,
  );
const tgCalls = m => calls.filter(c => c.host === "tg" && c.method === m);
const dispatches = () => calls.filter(c => c.host === "gh" && c.path.endsWith("/dispatches"));
const tap = (data, fromId = 111, chat = { id: -100500, type: "supergroup" }) => ({
  callback_query: { id: "cb1", data, from: { id: fromId }, message: { chat, message_id: 7 } },
});

// 1. owner taps Run again: relayed to the repo, then an ephemeral ack
calls = [];
let res = await post(tap("run:token-movers"));
assert.equal(res.status, 200);
assert.equal(dispatches().length, 1, "run tap must dispatch once");
let eph = tgCalls("sendMessage");
assert.equal(eph.length, 1, "one ephemeral ack");
assert.deepEqual(eph[0].body.ephemeral_message_parameters, { callback_query_id: "cb1" });
assert.equal(eph[0].body.chat_id, undefined, "ephemeral reply to a tap omits chat_id");
assert.match(eph[0].body.text, /Queued a new run of \/token_movers/);
assert.equal(tgCalls("answerCallbackQuery").length, 1, "the tap is still answered");
console.log("ok   - owner Run again tap dispatches and gets an ephemeral ack");

// 2. a non-owner member of the owner's group: ephemeral refusal, no dispatch
calls = [];
await post(tap("run:token-movers", 222));
assert.equal(dispatches().length, 0, "non-owner tap must not dispatch");
eph = tgCalls("sendMessage");
assert.equal(eph.length, 1);
assert.match(eph[0].body.text, /Only the owner/);
assert.ok(eph[0].body.ephemeral_message_parameters, "refusal is ephemeral");
console.log("ok   - non-owner tap in the owner group gets an ephemeral refusal, no dispatch");

// 3. a tap from some other chat: silent, no dispatch, no ephemeral
calls = [];
await post(tap("run:token-movers", 222, { id: -999, type: "group" }));
assert.equal(dispatches().length, 0);
assert.equal(tgCalls("sendMessage").length, 0, "no reply into a foreign chat");
console.log("ok   - tap from a foreign chat is ignored silently");

// 4. Details: answered from the repo's saved output, ephemeral, no dispatch
calls = [];
skillOutput = "Full report: BTC up 4%.";
await post(tap("details:token-movers"));
assert.equal(dispatches().length, 0, "details must not dispatch");
assert.ok(calls.some(c => c.host === "gh" && c.path === "/repos/fake/fake/contents/output/.chains/token-movers.md"));
eph = tgCalls("sendMessage");
assert.equal(eph.length, 1);
assert.match(eph[0].body.text, /Latest \/token_movers output/);
assert.match(eph[0].body.text, /BTC up 4%/);
assert.ok(eph[0].body.ephemeral_message_parameters);
console.log("ok   - Details tap sends the saved output as an ephemeral reply");

// 5. Details with a long output is cut and links the full file
calls = [];
skillOutput = "x".repeat(10000);
await post(tap("details:token-movers"));
eph = tgCalls("sendMessage");
assert.ok(eph[0].body.text.length < 4096, "fits one Telegram message");
assert.match(eph[0].body.text, /github\.com\/fake\/fake\/blob\/HEAD\/output\/\.chains\/token-movers\.md/);
console.log("ok   - long Details output is cut under 4096 chars with a link");

// 6. Details with no saved output, and a bad skill name
calls = [];
skillOutput = null;
await post(tap("details:token-movers"));
assert.match(tgCalls("sendMessage")[0].body.text, /No saved output/);
calls = [];
await post(tap("details:../../etc"));
assert.equal(calls.filter(c => c.host === "gh").length, 0, "bad name never reaches GitHub");
assert.match(tgCalls("sendMessage")[0].body.text, /Unknown skill/);
console.log("ok   - Details handles missing output and rejects bad skill names");

// 7. Details in a 1:1 DM falls back to a normal message if ephemeral is refused
calls = [];
skillOutput = "dm report";
tgReply = (method, body) =>
  method === "sendMessage" && body.ephemeral_message_parameters ? { ok: false, description: "nope" } : { ok: true };
const dmEnv = { ...env, TELEGRAM_CHAT_ID: "111" };
await worker.fetch(
  new Request("https://example.invalid/", {
    method: "POST",
    headers: { "x-telegram-bot-api-secret-token": "s3cr3t" },
    body: JSON.stringify({ update_id: nextId++, ...tap("details:token-movers", 111, { id: 111, type: "private" }) }),
  }),
  dmEnv,
  ctx,
);
const sends = tgCalls("sendMessage");
assert.equal(sends.length, 2);
assert.equal(sends[1].body.chat_id, 111);
assert.match(sends[1].body.text, /dm report/);
tgReply = () => ({ ok: true, result: {} });
console.log("ok   - Details in a private chat falls back to a normal message");

// 8. /panel from the owner's group goes to the owner's DM as a widget
calls = [];
await post({ message: { text: "/panel", chat: { id: -100500, type: "supergroup" }, from: { id: 111 } } });
assert.equal(dispatches().length, 0, "/panel is not relayed to the repo");
let w = tgCalls("sendWidget");
assert.equal(w.length, 1);
assert.equal(w[0].body.chat_id, "111", "widget goes to the owner's private chat");
assert.equal(w[0].body.allow_queries, true);
assert.equal(w[0].body.html, PANEL_HTML);
const data = JSON.parse(w[0].body.chat_data);
assert.deepEqual(
  data.r.map(r => [r[0], r[1]]),
  [
    ["token-movers", "o"],
    ["pr-review", "r"],
  ],
  "latest run per skill, non-skill runs dropped",
);
assert.match(tgCalls("sendMessage")[0].body.text, /private chat/);
console.log("ok   - /panel in the group sends the widget to the owner DM");

// 9. /panel from a non-owner does nothing
calls = [];
await post({ message: { text: "/panel", chat: { id: -100500, type: "supergroup" }, from: { id: 222 } } });
assert.equal(tgCalls("sendWidget").length, 0);
console.log("ok   - /panel from a non-owner is ignored");

// 10. widget Refresh: edits the widget data and answers the query
calls = [];
await post({ widget_query: { id: "wq1", from: { id: 111 }, chat: { id: 111, type: "private" }, message_id: 9, type: { type: "data" }, data: "refresh" } });
const edit = tgCalls("editMessageWidgetData");
assert.equal(edit.length, 1);
assert.equal(edit[0].body.message_id, 9);
assert.ok(JSON.parse(edit[0].body.chat_data).r.length === 2);
let ans = tgCalls("answerWidgetQuery");
assert.equal(ans.length, 1);
assert.equal(ans[0].body.widget_query_id, "wq1");
assert.equal(JSON.parse(ans[0].body.data).ok, 1);
console.log("ok   - widget Refresh edits chat_data and answers the query");

// 11. widget Run: dispatches run:<skill> without chat_id, answers ok
calls = [];
await post({ widget_query: { id: "wq2", from: { id: 111 }, chat: { id: 111, type: "private" }, message_id: 9, data: "run:pr-review" } });
const d = dispatches();
assert.equal(d.length, 1);
assert.equal(d[0].body.event_type, "telegram-callback");
assert.equal(d[0].body.client_payload.data, "run:pr-review");
assert.equal(d[0].body.client_payload.chat_id, undefined, "route job would reject the DM chat id");
assert.equal(d[0].body.client_payload.from_id, 111);
assert.equal(JSON.parse(tgCalls("answerWidgetQuery")[0].body.data).ok, 1);
console.log("ok   - widget Run dispatches the skill and answers ok");

// 12. widget queries from a non-owner, or with junk data, never dispatch
calls = [];
await post({ widget_query: { id: "wq3", from: { id: 222 }, chat: { id: 222, type: "private" }, message_id: 1, data: "run:pr-review" } });
await post({ widget_query: { id: "wq4", from: { id: 111 }, chat: { id: 111, type: "private" }, message_id: 1, data: "run:../x" } });
assert.equal(dispatches().length, 0);
ans = tgCalls("answerWidgetQuery").map(c => JSON.parse(c.body.data));
assert.deepEqual(
  ans.map(a => a.ok),
  [0, 0],
);
console.log("ok   - non-owner and malformed widget queries are answered with ok:0, no dispatch");

// 13. widget size limits: 32768 raw bytes, 4096 after zlib level 9
const raw = Buffer.byteLength(PANEL_HTML);
const packed = deflateSync(Buffer.from(PANEL_HTML), { level: 9 }).length;
assert.ok(raw <= 32768, `raw ${raw}`);
assert.ok(packed <= 3900, `compressed ${packed} (keep margin under 4096)`);
console.log(`ok   - panel widget is ${raw} bytes raw, ${packed} compressed (limit 4096)`);

// 14. packRuns always fits chat_data's 1024 bytes
const many = Array.from({ length: 40 }, (_, i) => ({
  display_title: `skill: ${"s".repeat(40)}-${i}`,
  status: "completed",
  conclusion: "success",
  run_started_at: "2026-11-10T08:00:00Z",
}));
assert.ok(Buffer.byteLength(packRuns(many, 1)) <= 1024);
console.log("ok   - packRuns stays within 1024 bytes");

console.log("\nALL PASS");
