/** Tests for scripts/ccr-hivemindos.js (request shaping for the hivemindos gateway arm)
 *  and scripts/ccr-aeon-gateway.mjs, the claude-code-router 3.x plugin that applies it.
 *  Run: node scripts/tests/test_ccr_hivemindos.mjs */
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const hivemindos = require("../ccr-hivemindos.js");
const { default: createGatewayPlugin } = await import("../ccr-aeon-gateway.mjs");

let passed = 0;
const check = async (name, run) => {
  try { await run(); passed += 1; console.log(`ok   - ${name}`); }
  catch (error) { console.log(`FAIL - ${name}`); throw error; }
};

await check("every request carries a fresh Idempotency-Key", async () => {
  const one = await hivemindos.prepareRequest({ model: "m", messages: [] });
  const two = await hivemindos.prepareRequest({ model: "m", messages: [] });
  assert.match(one.headers["Idempotency-Key"], /^[0-9a-f-]{36}$/);
  assert.notEqual(one.headers["Idempotency-Key"], two.headers["Idempotency-Key"]);
});

await check("the request goes upstream non-streamed", async () => {
  const { body } = await hivemindos.prepareRequest({ model: "m", messages: [], stream: true, stream_options: { include_usage: true } });
  assert.equal(body.stream, false);
  assert.equal("stream_options" in body, false);
});

await check("a reasoning block that only disables reasoning is dropped", async () => {
  const off = await hivemindos.prepareRequest({ model: "m", messages: [], reasoning: { effort: "high", enabled: false } });
  assert.equal("reasoning" in off.body, false);
  // An explicit ask is the operator's, and is left alone.
  const on = await hivemindos.prepareRequest({ model: "m", messages: [], reasoning: { effort: "low" } });
  assert.deepEqual(on.body.reasoning, { effort: "low" });
});

await check("HIVEMINDOS_REASONING=keep leaves the flag alone, for models that honour it", async () => {
  // The knob is read when the module loads, so load a second copy under it.
  const module = require.resolve("../ccr-hivemindos.js");
  delete require.cache[module];
  process.env.HIVEMINDOS_REASONING = "keep";
  const Keep = require("../ccr-hivemindos.js");
  delete process.env.HIVEMINDOS_REASONING;
  delete require.cache[module];
  const kept = await Keep.prepareRequest({ model: "m", messages: [], reasoning: { effort: "high", enabled: false } });
  assert.deepEqual(kept.body.reasoning, { effort: "high", enabled: false });
});

await check("the completion budget is capped, so a call holds what it can spend", async () => {
  const { body } = await hivemindos.prepareRequest({ model: "m", messages: [], max_tokens: 32000 });
  assert.equal(body.max_tokens, 4096);
  const small = await hivemindos.prepareRequest({ model: "m", messages: [], max_tokens: 500 });
  assert.equal(small.body.max_tokens, 500, "a modest ask is left alone");
});

await check("an unset repo variable still caps the budget (GitHub passes '', not undefined)", async () => {
  // `HIVEMINDOS_MAX_TOKENS: ${{ vars.HIVEMINDOS_MAX_TOKENS }}` sets the EMPTY STRING when the
  // variable does not exist, and Number('') is 0, which is this knob's "no cap" value. That
  // silently disabled the cap on every workflow run until it was read as "not set".
  const module = require.resolve("../ccr-hivemindos.js");
  delete require.cache[module];
  process.env.HIVEMINDOS_MAX_TOKENS = "";
  const Unset = require("../ccr-hivemindos.js");
  delete process.env.HIVEMINDOS_MAX_TOKENS;
  delete require.cache[module];
  const { body } = await Unset.prepareRequest({ model: "m", messages: [], max_tokens: 32000 });
  assert.equal(body.max_tokens, 4096, "an empty variable must mean the default, not 'uncapped'");

  // An explicit 0 is still the operator asking for no cap at all.
  delete require.cache[module];
  process.env.HIVEMINDOS_MAX_TOKENS = "0";
  const Off = require("../ccr-hivemindos.js");
  delete process.env.HIVEMINDOS_MAX_TOKENS;
  delete require.cache[module];
  const uncapped = await Off.prepareRequest({ model: "m", messages: [], max_tokens: 32000 });
  assert.equal(uncapped.body.max_tokens, 32000, "an explicit 0 still disables the cap");
});

await check("the stable prefix is marked cacheable, so a caching provider can read it back", async () => {
  const { body } = await hivemindos.prepareRequest({ model: "m", messages: [{ role: "system", content: "You are careful." }, { role: "user", content: "hi" }] });
  assert.deepEqual(body.messages[0].content, [{ type: "text", text: "You are careful.", cache_control: { type: "ephemeral" } }]);
  assert.equal(body.messages[1].content, "hi", "only the prefix is marked");
  // The caller's own array shape is respected, and an existing marker is left alone.
  const already = await hivemindos.prepareRequest({ model: "m", messages: [{ role: "system", content: [{ type: "text", text: "a", cache_control: { type: "persistent" } }] }] });
  assert.deepEqual(already.body.messages[0].content[0].cache_control, { type: "persistent" });
});

await check("a conversation past the size ceiling is trimmed, not abandoned", async () => {
  const huge = "x".repeat(300_000);
  const messages = [
    { role: "system", content: "instructions" },
    { role: "user", content: `first ${huge}` },
    { role: "assistant", content: `tool output ${huge}` },
    { role: "user", content: `latest ${huge}` },
  ];
  process.env.HIVEMINDOS_MAX_BODY_CHARS = "400000";
  const module = require.resolve("../ccr-hivemindos.js");
  delete require.cache[module];
  const Trimming = require("../ccr-hivemindos.js");
  delete process.env.HIVEMINDOS_MAX_BODY_CHARS;
  delete require.cache[module];
  const { body } = await Trimming.prepareRequest({ model: "m", messages });
  assert.ok(JSON.stringify(body).length <= 400_000, `still too large: ${JSON.stringify(body).length}`);
  assert.match(JSON.stringify(body.messages[2].content), /characters trimmed/);
  assert.equal(JSON.stringify(body.messages[0].content).includes("instructions"), true, "the system prompt survives");
  assert.ok(String(body.messages[3].content).length > 200_000, "the newest turn is never trimmed");
});

// The SSE replay this file used to do is built into claude-code-router 3.x (a JSON
// answer to a streaming client comes back as Anthropic SSE); ci-harness-cli.yml's ccr
// job checks it against the real router. What is left to test here is the plugin.
await check("the gateway plugin pins every request to the sidecar's one model", async () => {
  const hooks = createGatewayPlugin({ plugin: { config: { pinModel: "vendor/model-a" } } });
  const [pin] = hooks.requestTransforms;
  assert.equal(pin.stage, "beforeRouting");
  const out = pin.transform({ requestBody: { model: "claude-haiku-4-5", messages: [{ role: "user", content: "hi" }] } });
  assert.equal(out.requestBody.model, "vendor/model-a");
  assert.equal(hooks.providerPlugins, undefined, "no hivemindos hook unless asked");
});

await check("the gateway plugin drops blank text blocks before routing", async () => {
  const [pin] = createGatewayPlugin({ plugin: { config: {} } }).requestTransforms;
  const out = pin.transform({ requestBody: {
    model: "m",
    system: [{ type: "text", text: "  " }, { type: "text", text: "sys" }],
    messages: [{ role: "user", content: [{ type: "text", text: " " }] }, { role: "user", content: [{ type: "text", text: "hi" }] }],
  } });
  assert.equal(out.requestBody.system, "sys");
  assert.deepEqual(out.requestBody.messages, [{ role: "user", content: "hi" }]);
  assert.equal(out.requestBody.model, "m", "no pin configured -> model untouched");
});

await check("on hivemindos the plugin reshapes the upstream call and adds a fresh Idempotency-Key", async () => {
  const hooks = createGatewayPlugin({ plugin: { config: { hivemindos: true } } });
  const [hook] = hooks.providerPlugins;
  const upstreamRequest = { url: "https://x/chat/completions", headers: { authorization: "Bearer k" },
    body: { model: "m", stream: true, stream_options: { include_usage: true }, max_tokens: 32000, messages: [] } };
  const one = hook.transformRequest({ upstreamRequest });
  const two = hook.transformRequest({ upstreamRequest });
  assert.equal(one.ok, true);
  assert.equal(one.value.body.stream, false);
  assert.equal("stream_options" in one.value.body, false);
  assert.equal(one.value.body.max_tokens, 4096);
  assert.equal(one.value.headers.authorization, "Bearer k", "the provider's own auth header survives");
  assert.match(one.value.headers["Idempotency-Key"], /^[0-9a-f-]{36}$/);
  assert.notEqual(one.value.headers["Idempotency-Key"], two.value.headers["Idempotency-Key"]);
  assert.equal(upstreamRequest.body.stream, true, "the caller's request object is not mutated");
});

console.log(`\nAll ccr-hivemindos tests passed (${passed}).`);
