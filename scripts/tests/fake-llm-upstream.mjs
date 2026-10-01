#!/usr/bin/env node
// fake-llm-upstream - a tiny local stand-in for a model provider, used by
// scripts/tests/harness_cli_smoke.sh so CI can drive each pinned harness CLI
// through its real adapter WITHOUT an API key or a real model call.
//
// It answers every request with the same fixed reply (REPLY below) and fixed
// token usage, in whichever wire format the caller speaks:
//   POST .../chat/completions   OpenAI chat completions (JSON or SSE stream)
//   POST .../responses          OpenAI Responses API (JSON or SSE stream)
//   POST .../messages           Anthropic Messages (JSON or SSE stream)
//   POST .../count_tokens       Anthropic token count
//   GET  .../models             a one-model list
// Anything else gets a 404 JSON error. Every request is appended as one JSON line
// (method, path, headers, body) to $FAKE_LLM_LOG so a test can assert on what
// the CLI actually sent.
//
// Tool round-trip (chat completions only, opt-in): with FAKE_LLM_TOOL=<name>
// set, a request that DECLARES a function tool of that name and carries no tool
// result yet gets a tool call to it (arguments {}) instead of the reply; once
// the conversation carries a tool result, the reply is REPLY plus that result's
// text. A request that does not declare the tool still gets the plain REPLY, so
// a CLI that never saw the tool fails the caller's "result reached .result"
// check. Unset (the default), every harness sees the fixed reply as before.
//
// Usage: node fake-llm-upstream.mjs <port>    (prints "listening <port>" when up)
import http from "node:http";
import fs from "node:fs";

const port = Number(process.argv[2] || process.env.FAKE_LLM_PORT || 0);
const LOG = process.env.FAKE_LLM_LOG || "";
const REPLY = process.env.FAKE_LLM_REPLY || "AEON_SMOKE_OK";
const TOOL = process.env.FAKE_LLM_TOOL || "";
const USAGE = { input: 11, output: 7, cached: 3 };
const now = () => Math.floor(Date.now() / 1000);

function sse(res, events) {
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
  for (const [event, data] of events) {
    if (event) res.write(`event: ${event}\n`);
    res.write(`data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`);
  }
  res.end();
}
function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

// Text of the last tool result in an OpenAI chat conversation ("" when none).
function lastToolResult(body) {
  const tool = (body.messages || []).filter(m => m && m.role === "tool").pop();
  if (!tool) return "";
  const c = tool.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map(p => (p && p.text) || "").join("");
  return JSON.stringify(c ?? "");
}
const declaresTool = (body, name) =>
  (body.tools || []).some(t => (t && t.function && t.function.name) === name);

function chatCompletions(res, body) {
  const id = "chatcmpl-smoke", model = body.model || "smoke-model";
  const usage = { prompt_tokens: USAGE.input, completion_tokens: USAGE.output, total_tokens: USAGE.input + USAGE.output,
    prompt_tokens_details: { cached_tokens: USAGE.cached } };
  const toolResult = TOOL ? lastToolResult(body) : "";
  const callTool = TOOL && !toolResult && declaresTool(body, TOOL);
  const text = toolResult ? `${REPLY} ${toolResult}` : REPLY;
  const call = { id: "call_smoke", type: "function", function: { name: TOOL, arguments: "{}" } };
  if (!body.stream) {
    const message = callTool ? { role: "assistant", content: null, tool_calls: [call] } : { role: "assistant", content: text };
    return json(res, 200, { id, object: "chat.completion", created: now(), model,
      choices: [{ index: 0, message, finish_reason: callTool ? "tool_calls" : "stop" }], usage });
  }
  const chunk = (delta, finish = null, extra = {}) =>
    ["", { id, object: "chat.completion.chunk", created: now(), model, choices: [{ index: 0, delta, finish_reason: finish }], ...extra }];
  const frames = callTool
    ? [chunk({ role: "assistant", content: null, tool_calls: [{ index: 0, ...call, function: { name: TOOL, arguments: "" } }] }),
       chunk({ tool_calls: [{ index: 0, function: { arguments: "{}" } }] }),
       chunk({}, "tool_calls")]
    : [chunk({ role: "assistant", content: "" }), chunk({ content: text }), chunk({}, "stop")];
  sse(res, [
    ...frames,
    ["", { id, object: "chat.completion.chunk", created: now(), model, choices: [], usage }],
    ["", "[DONE]"],
  ]);
}

function responsesApi(res, body) {
  const id = "resp_smoke", model = body.model || "smoke-model", msgId = "msg_smoke";
  const usage = { input_tokens: USAGE.input, input_tokens_details: { cached_tokens: USAGE.cached },
    output_tokens: USAGE.output, output_tokens_details: { reasoning_tokens: 0 }, total_tokens: USAGE.input + USAGE.output };
  const textPart = { type: "output_text", text: REPLY, annotations: [] };
  const item = { id: msgId, type: "message", status: "completed", role: "assistant", content: [textPart] };
  const base = { id, object: "response", created_at: now(), model, output: [], usage: null };
  if (!body.stream) return json(res, 200, { ...base, status: "completed", output: [item], usage });
  let seq = 0;
  const ev = (type, data) => [type, { type, sequence_number: seq++, ...data }];
  sse(res, [
    ev("response.created", { response: { ...base, status: "in_progress" } }),
    ev("response.in_progress", { response: { ...base, status: "in_progress" } }),
    ev("response.output_item.added", { output_index: 0, item: { ...item, status: "in_progress", content: [] } }),
    ev("response.content_part.added", { item_id: msgId, output_index: 0, content_index: 0, part: { ...textPart, text: "" } }),
    ev("response.output_text.delta", { item_id: msgId, output_index: 0, content_index: 0, delta: REPLY }),
    ev("response.output_text.done", { item_id: msgId, output_index: 0, content_index: 0, text: REPLY }),
    ev("response.content_part.done", { item_id: msgId, output_index: 0, content_index: 0, part: textPart }),
    ev("response.output_item.done", { output_index: 0, item }),
    ev("response.completed", { response: { ...base, status: "completed", output: [item], usage } }),
  ]);
}

function anthropicMessages(res, body) {
  const id = "msg_smoke", model = body.model || "smoke-model";
  const usage = { input_tokens: USAGE.input, output_tokens: USAGE.output,
    cache_read_input_tokens: USAGE.cached, cache_creation_input_tokens: 0 };
  if (!body.stream) {
    return json(res, 200, { id, type: "message", role: "assistant", model,
      content: [{ type: "text", text: REPLY }], stop_reason: "end_turn", stop_sequence: null, usage });
  }
  sse(res, [
    ["message_start", { type: "message_start", message: { id, type: "message", role: "assistant", model, content: [],
      stop_reason: null, stop_sequence: null, usage: { ...usage, output_tokens: 1 } } }],
    ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }],
    ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: REPLY } }],
    ["content_block_stop", { type: "content_block_stop", index: 0 }],
    ["message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null },
      usage: { output_tokens: USAGE.output } }],
    ["message_stop", { type: "message_stop" }],
  ]);
}

const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", c => { raw += c; });
  req.on("end", () => {
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { body = { _unparsed: raw.slice(0, 2000) }; }
    if (LOG) fs.appendFileSync(LOG, JSON.stringify({ method: req.method, path: req.url, headers: req.headers, body }) + "\n");
    const path = (req.url || "").split("?")[0].replace(/\/+$/, "");
    if (req.method === "GET" && /\/models$/.test(path)) {
      return json(res, 200, { object: "list", data: [{ id: "smoke-model", object: "model", created: now(), owned_by: "aeon-smoke" }] });
    }
    if (req.method === "GET" && /\/(health|healthz)$/.test(path)) return json(res, 200, { ok: true });
    if (req.method !== "POST") return json(res, 404, { error: { message: `no route for ${req.method} ${path}` } });
    if (/\/chat\/completions$/.test(path)) return chatCompletions(res, body);
    if (/\/responses$/.test(path)) return responsesApi(res, body);
    if (/\/messages\/count_tokens$/.test(path)) return json(res, 200, { input_tokens: USAGE.input });
    if (/\/messages$/.test(path)) return anthropicMessages(res, body);
    return json(res, 404, { error: { message: `no route for POST ${path}` } });
  });
});
server.listen(port, "127.0.0.1", () => console.log(`listening ${server.address().port}`));
