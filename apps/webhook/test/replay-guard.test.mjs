// Tests for the replay guard in ../src/worker.js — imports the REAL module
// (not a hand-copied approximation) and drives it against a stubbed `caches`
// + stubbed global `fetch` (Request/Response/Headers are real, native Node
// classes — same Fetch API surface the Workers runtime implements).
// Run: npm test  (or: node test/replay-guard.test.mjs)
import assert from "node:assert/strict";
import { register } from "node:module";

register("./loader-hook.mjs", import.meta.url);

// --- stub caches.default: a real in-memory Map behind the same Cache
// interface (match/put) the Worker calls. This is what needs *emulating* --
// the actual Cache API semantics (per-colo persistence, does it work on
// workers.dev) were already verified separately against a live deployment;
// this test is purely about the worker.js control-flow logic on top of it.
const store = new Map();
globalThis.caches = {
  default: {
    async match(req) {
      return store.has(req.url) ? new Response("1") : undefined;
    },
    async put(req, res) {
      store.set(req.url, true);
    },
  },
};

// --- stub the outbound fetch() the Worker uses for both the GitHub dispatch
// call and the Telegram answerCallbackQuery/sendMessage best-effort calls.
// Route by hostname; record dispatch call count for assertions.
let dispatchCalls = 0;
let dispatchShouldFail = false;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const u = new URL(url);
  if (u.hostname === "api.github.com") {
    dispatchCalls++;
    return dispatchShouldFail
      ? new Response("nope", { status: 500 })
      : new Response("ok", { status: 200 });
  }
  if (u.hostname === "api.telegram.org") {
    return new Response("{}", { status: 200 }); // best-effort, ignored
  }
  return realFetch(url, opts);
};

const mod = await import("../src/worker.js");
const worker = mod.default;

const env = {
  TELEGRAM_WEBHOOK_SECRET: "s3cr3t",
  TELEGRAM_CHAT_ID: "111",
  TELEGRAM_BOT_TOKEN: "fake-token",
  GITHUB_REPO: "fake/fake",
  GITHUB_TOKEN: "fake-gh-token",
};
let waitUntilPromises = [];
const ctx = { waitUntil: (p) => waitUntilPromises.push(p) };

function req(update) {
  return new Request("https://example.invalid/", {
    method: "POST",
    headers: { "x-telegram-bot-api-secret-token": "s3cr3t" },
    body: JSON.stringify(update),
  });
}
async function drain() {
  await Promise.all(waitUntilPromises);
  waitUntilPromises = [];
}

const msgUpdate = (id) => ({
  update_id: id,
  message: { text: "/status", chat: { id: 111, type: "private" }, from: { id: 111 } },
});

// --- test 1: first delivery dispatches, gets cached on success -------------
dispatchCalls = 0;
let res = await worker.fetch(req(msgUpdate(1001)), env, ctx);
await drain();
assert.equal(res.status, 200, "first delivery should succeed");
assert.equal(dispatchCalls, 1, "first delivery should dispatch exactly once");
console.log("ok   - first delivery of a new update_id dispatches and returns 200");

// --- test 2: Telegram redelivers the SAME update_id -> must NOT re-dispatch
res = await worker.fetch(req(msgUpdate(1001)), env, ctx);
await drain();
assert.equal(res.status, 200, "duplicate delivery should still return 200 (no redelivery from Telegram)");
assert.equal(dispatchCalls, 1, "duplicate delivery must NOT dispatch again");
console.log("ok   - redelivery of the same update_id is short-circuited, no second dispatch");

// --- test 3: a DIFFERENT update_id is unaffected by the cached one ----------
res = await worker.fetch(req(msgUpdate(1002)), env, ctx);
await drain();
assert.equal(res.status, 200);
assert.equal(dispatchCalls, 2, "a distinct update_id must still dispatch");
console.log("ok   - a different update_id dispatches normally (dedupe is per-update_id, not global)");

// --- test 4: a FAILED dispatch must NOT be cached, so retry can succeed ----
dispatchCalls = 0;
dispatchShouldFail = true;
res = await worker.fetch(req(msgUpdate(2001)), env, ctx);
await drain();
assert.equal(res.status, 502, "a failed dispatch should surface as 502");
assert.equal(dispatchCalls, 1);

dispatchShouldFail = false; // simulate the transient failure clearing up
res = await worker.fetch(req(msgUpdate(2001)), env, ctx);
await drain();
assert.equal(res.status, 200, "retry after a fixed failure should succeed");
assert.equal(dispatchCalls, 2, "retry after a FAILED (uncached) dispatch must still be attempted, not swallowed");
console.log("ok   - a failed dispatch is not cached, so Telegram's retry after failure still goes through");

// --- test 5: callback_query path shares the same update_id-keyed guard -----
dispatchCalls = 0;
const cbUpdate = (id) => ({
  update_id: id,
  callback_query: { id: "cbid1", data: "run:foo", from: { id: 111 }, message: { chat: { id: 111 }, message_id: 5 } },
});
res = await worker.fetch(req(cbUpdate(3001)), env, ctx);
await drain();
assert.equal(dispatchCalls, 1);
res = await worker.fetch(req(cbUpdate(3001)), env, ctx);
await drain();
assert.equal(dispatchCalls, 1, "a redelivered callback_query update must not fire its action twice");
console.log("ok   - callback_query updates are deduped by the same update_id guard as messages");

// --- test 6: a missing/non-numeric update_id degrades to no dedupe (never
// crashes, never blocks a legitimate update it can't key) -------------------
dispatchCalls = 0;
const noIdUpdate = { message: { text: "/status", chat: { id: 111, type: "private" }, from: { id: 111 } } };
res = await worker.fetch(
  new Request("https://example.invalid/", {
    method: "POST",
    headers: { "x-telegram-bot-api-secret-token": "s3cr3t" },
    body: JSON.stringify(noIdUpdate),
  }),
  env,
  ctx,
);
await drain();
assert.equal(res.status, 200);
assert.equal(dispatchCalls, 1, "an update with no update_id should still be processed (fail open on dedupe, not on delivery)");
console.log("ok   - an update with no update_id is still processed normally (dedupe fails open)");

console.log("\nALL PASS");
