/** Tests for scripts/ccr-hivemindos.js, the transformer the hivemindos gateway arm uses.
 *  Run: node scripts/tests/test_ccr_hivemindos.mjs */
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Transformer = require("../ccr-hivemindos.js");
const transformer = new Transformer();

let passed = 0;
const check = async (name, run) => {
  try { await run(); passed += 1; console.log(`ok   - ${name}`); }
  catch (error) { console.log(`FAIL - ${name}`); throw error; }
};
const streaming = { req: { body: { stream: true } } };
const frames = text => text.trim().split("\n\n").map(line => line.replace(/^data: /, ""));

await check("every request carries a fresh Idempotency-Key", async () => {
  const one = await transformer.transformRequestIn({ model: "m", messages: [] });
  const two = await transformer.transformRequestIn({ model: "m", messages: [] });
  assert.match(one.config.headers["Idempotency-Key"], /^[0-9a-f-]{36}$/);
  assert.notEqual(one.config.headers["Idempotency-Key"], two.config.headers["Idempotency-Key"]);
});

await check("the request goes upstream non-streamed", async () => {
  const { body } = await transformer.transformRequestIn({ model: "m", messages: [], stream: true, stream_options: { include_usage: true } });
  assert.equal(body.stream, false);
  assert.equal("stream_options" in body, false);
});

await check("a reasoning block that only disables reasoning is dropped", async () => {
  const off = await transformer.transformRequestIn({ model: "m", messages: [], reasoning: { effort: "high", enabled: false } });
  assert.equal("reasoning" in off.body, false);
  // An explicit ask is the operator's, and is left alone.
  const on = await transformer.transformRequestIn({ model: "m", messages: [], reasoning: { effort: "low" } });
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
  const kept = await new Keep().transformRequestIn({ model: "m", messages: [], reasoning: { effort: "high", enabled: false } });
  assert.deepEqual(kept.body.reasoning, { effort: "high", enabled: false });
});

await check("the completion budget is capped, so a call holds what it can spend", async () => {
  const { body } = await transformer.transformRequestIn({ model: "m", messages: [], max_tokens: 32000 });
  assert.equal(body.max_tokens, 4096);
  const small = await transformer.transformRequestIn({ model: "m", messages: [], max_tokens: 500 });
  assert.equal(small.body.max_tokens, 500, "a modest ask is left alone");
});

await check("the stable prefix is marked cacheable, so a caching provider can read it back", async () => {
  const { body } = await transformer.transformRequestIn({ model: "m", messages: [{ role: "system", content: "You are careful." }, { role: "user", content: "hi" }] });
  assert.deepEqual(body.messages[0].content, [{ type: "text", text: "You are careful.", cache_control: { type: "ephemeral" } }]);
  assert.equal(body.messages[1].content, "hi", "only the prefix is marked");
  // The caller's own array shape is respected, and an existing marker is left alone.
  const already = await transformer.transformRequestIn({ model: "m", messages: [{ role: "system", content: [{ type: "text", text: "a", cache_control: { type: "persistent" } }] }] });
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
  const { body } = await new Trimming().transformRequestIn({ model: "m", messages });
  assert.ok(JSON.stringify(body).length <= 400_000, `still too large: ${JSON.stringify(body).length}`);
  assert.match(JSON.stringify(body.messages[2].content), /characters trimmed/);
  assert.equal(JSON.stringify(body.messages[0].content).includes("instructions"), true, "the system prompt survives");
  assert.ok(String(body.messages[3].content).length > 200_000, "the newest turn is never trimmed");
});

await check("a non-streaming client gets the upstream answer untouched", async () => {
  const response = new Response(JSON.stringify({ choices: [] }), { headers: { "Content-Type": "application/json" } });
  assert.equal(await transformer.transformResponseOut(response, { req: { body: { stream: false } } }), response);
});

await check("a streaming client gets the answer replayed as SSE", async () => {
  const completion = {
    id: "chatcmpl-1", created: 42, model: "m",
    choices: [{ index: 0, message: { role: "assistant", content: "hello" }, finish_reason: "stop" }],
    usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
  };
  const out = await transformer.transformResponseOut(new Response(JSON.stringify(completion), { headers: { "Content-Type": "application/json" } }), streaming);
  assert.equal(out.headers.get("Content-Type"), "text/event-stream");
  const parts = frames(await out.text());
  assert.equal(parts.at(-1), "[DONE]");
  const content = parts.slice(0, -1).map(part => JSON.parse(part)).filter(part => part.choices?.[0]?.delta?.content).map(part => part.choices[0].delta.content);
  assert.deepEqual(content, ["hello"]);
  assert.equal(parts.map(part => part === "[DONE]" ? null : JSON.parse(part)).find(part => part?.choices?.[0]?.finish_reason)?.choices[0].finish_reason, "stop");
  const chunks = parts.map(part => part === "[DONE]" ? null : JSON.parse(part));
  assert.ok(chunks.some(part => part?.usage?.total_tokens === 3), "usage is carried through");
  // A client that only reads the finish chunk recorded a free run before this.
  assert.equal(chunks.find(part => part?.choices?.[0]?.finish_reason)?.usage?.total_tokens, 3, "usage rides the finish frame too");
});

await check("tool calls survive the replay, which is what an agent acts on", async () => {
  const completion = {
    id: "chatcmpl-2", created: 42, model: "m",
    choices: [{ index: 0, message: { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "Bash", arguments: '{"command":"ls"}' } }] }, finish_reason: "tool_calls" }],
  };
  const out = await transformer.transformResponseOut(new Response(JSON.stringify(completion), { headers: { "Content-Type": "application/json" } }), streaming);
  const calls = frames(await out.text()).filter(part => part !== "[DONE]").map(part => JSON.parse(part)).flatMap(part => part.choices?.[0]?.delta?.tool_calls ?? []);
  assert.equal(calls.length, 1);
  assert.deepEqual([calls[0].index, calls[0].id, calls[0].function.name, calls[0].function.arguments], [0, "call_1", "Bash", '{"command":"ls"}']);
});

await check("an upstream error is passed through, never replayed as a valid answer", async () => {
  const response = new Response(JSON.stringify({ error: "nope" }), { status: 402, headers: { "Content-Type": "application/json" } });
  assert.equal(await transformer.transformResponseOut(response, streaming), response);
  const sse = new Response("data: {}\n\n", { headers: { "Content-Type": "text/event-stream" } });
  assert.equal(await transformer.transformResponseOut(sse, streaming), sse, "an endpoint that does stream is left alone");
});

console.log(`\nAll ccr-hivemindos tests passed (${passed}).`);
