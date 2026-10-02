// Tests for ../src/worker.js telemetry redaction + webhook secret check.
// The OTel fetch instrumentation records outbound URLs, and Telegram puts the
// bot token in the path (api.telegram.org/bot<TOKEN>/...). The exporter that
// worker.js configures must scrub it before any span leaves the Worker.
// Run: npm test  (or: node test/otel-redact.test.mjs)
import assert from "node:assert/strict";
import { register } from "node:module";

register("./loader-hook.mjs", import.meta.url);

// Built from parts so GitHub secret scanning does not flag this fake token
// in every repo created from this template.
const TOKEN = ["123456789", "AAH-fake_TokenValue0123456789abcdef"].join(":");
const env = {
  TELEGRAM_WEBHOOK_SECRET: "s3cr3t",
  TELEGRAM_CHAT_ID: "111",
  TELEGRAM_BOT_TOKEN: TOKEN,
  GITHUB_REPO: "fake/fake",
  GITHUB_TOKEN: "fake-gh-token",
  OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example/",
};

const { captured } = await import("./otel-stub.mjs");
const worker = (await import("../src/worker.js")).default;

let failures = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log(`ok   - ${name}`);
  } catch (e) {
    failures++;
    console.log(`FAIL - ${name}: ${e.message}`);
  }
}

// A GET is the health probe; with OTEL configured it still routes through
// instrument(), which is all we need to capture the config function.
await worker.fetch(new Request("https://example.invalid/"), env, { waitUntil() {} });

await check("instrument() received a config function", () => {
  assert.equal(typeof captured.configFn, "function");
});

await check("exported spans carry no Telegram bot token", async () => {
  const config = captured.configFn(env);
  const span = {
    name: "fetch POST api.telegram.org",
    attributes: {
      "url.full": `https://api.telegram.org/bot${TOKEN}/sendMessage`,
      "url.path": `/bot${TOKEN}/sendMessage`,
      "server.address": "api.telegram.org",
      "http.response.status_code": 200,
    },
    events: [{ name: "exception", attributes: { "exception.message": `fetch failed for /bot${TOKEN}/x` } }],
    status: { code: 2, message: `error at bot${TOKEN}` },
  };
  await new Promise((resolve) => config.exporter.export([span], resolve));
  const sent = JSON.stringify(captured.exported.at(-1));
  assert.ok(!sent.includes(TOKEN), `token leaked: ${sent}`);
  assert.ok(!sent.includes("AAH-fake"), `token tail leaked: ${sent}`);
  assert.equal(span.attributes["url.full"], "https://api.telegram.org/bot<redacted>/sendMessage");
  assert.equal(span.attributes["url.path"], "/bot<redacted>/sendMessage");
  assert.equal(span.attributes["http.response.status_code"], 200);
});

await check("non-Telegram URLs pass through unchanged", async () => {
  const config = captured.configFn(env);
  const span = {
    attributes: { "url.full": "https://api.github.com/repos/fake/bot-repo/dispatches" },
    events: [],
    status: { code: 0 },
  };
  await new Promise((resolve) => config.exporter.export([span], resolve));
  assert.equal(span.attributes["url.full"], "https://api.github.com/repos/fake/bot-repo/dispatches");
});

function post(headers) {
  return new Request("https://example.invalid/", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ update_id: 1 }),
  });
}

await check("wrong webhook secret is rejected", async () => {
  const res = await worker.fetch(post({ "x-telegram-bot-api-secret-token": "s3cr3u" }), env, { waitUntil() {} });
  assert.equal(res.status, 403);
});

await check("missing webhook secret header is rejected", async () => {
  const res = await worker.fetch(post({}), env, { waitUntil() {} });
  assert.equal(res.status, 403);
});

await check("unset TELEGRAM_WEBHOOK_SECRET rejects even an empty header", async () => {
  const res = await worker.fetch(post({ "x-telegram-bot-api-secret-token": "" }), { ...env, TELEGRAM_WEBHOOK_SECRET: "" }, { waitUntil() {} });
  assert.equal(res.status, 403);
});

await check("correct webhook secret passes the gate", async () => {
  const res = await worker.fetch(post({ "x-telegram-bot-api-secret-token": "s3cr3t" }), env, { waitUntil() {} });
  assert.notEqual(res.status, 403);
});

console.log("---");
console.log(failures === 0 ? "ALL PASS" : "SOME FAILED");
process.exit(failures === 0 ? 0 : 1);
