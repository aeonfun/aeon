#!/usr/bin/env node
// fake-mcp-server - a tiny stdio MCP server with no dependencies, used by
// scripts/tests/harness_cli_smoke.sh to prove a harness adapter wires MCP
// through to the real CLI.
//
// It exposes ONE tool, `echo`, whose result text is FAKE_MCP_RESULT (default
// "MCP_TOOL_OK"). Messages are newline-delimited JSON-RPC 2.0 on stdin/stdout,
// the MCP stdio transport.
//
// Env knobs:
//   FAKE_MCP_DELAY_MS  wait this long before answering anything, like a server
//                      that is slow to start (npx download, JVM boot). stdin is
//                      buffered meanwhile, so nothing is lost; the client just
//                      sees a late `initialize` reply.
//   FAKE_MCP_RESULT    text the `echo` tool returns.
//   FAKE_MCP_LOG       append one JSON line per request (method + params) here,
//                      so a test can tell the tool was really called.
import fs from "node:fs";
import readline from "node:readline";

const DELAY = Number(process.env.FAKE_MCP_DELAY_MS || 0);
const RESULT = process.env.FAKE_MCP_RESULT || "MCP_TOOL_OK";
const LOG = process.env.FAKE_MCP_LOG || "";

const send = (msg) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...msg }) + "\n");
const log = (entry) => { if (LOG) fs.appendFileSync(LOG, JSON.stringify({ t: Date.now(), ...entry }) + "\n"); };

const TOOL = {
  name: "echo",
  description: "Return a fixed marker string. Call this when asked to use the probe tool.",
  inputSchema: { type: "object", properties: { text: { type: "string" } } },
};

function handle(req) {
  log({ method: req.method, params: req.params ?? null });
  if (req.id === undefined || req.id === null) return; // notification
  switch (req.method) {
    case "initialize":
      return send({ id: req.id, result: {
        protocolVersion: req.params?.protocolVersion || "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "aeon-fake-mcp", version: "1.0.0" },
      } });
    case "ping":
      return send({ id: req.id, result: {} });
    case "tools/list":
      return send({ id: req.id, result: { tools: [TOOL] } });
    case "tools/call":
      if (req.params?.name !== TOOL.name) {
        return send({ id: req.id, result: { isError: true, content: [{ type: "text", text: `unknown tool ${req.params?.name}` }] } });
      }
      return send({ id: req.id, result: { content: [{ type: "text", text: RESULT }] } });
    default:
      return send({ id: req.id, error: { code: -32601, message: `method not found: ${req.method}` } });
  }
}

log({ method: "_start", params: { delayMs: DELAY } });
const rl = readline.createInterface({ input: process.stdin });
const queue = [];
let ready = DELAY <= 0;
rl.on("line", (line) => {
  if (!line.trim()) return;
  let req;
  try { req = JSON.parse(line); } catch { return; }
  if (ready) handle(req); else queue.push(req);
});
rl.on("close", () => process.exit(0));
if (!ready) {
  setTimeout(() => {
    ready = true;
    log({ method: "_ready", params: null });
    for (const req of queue.splice(0)) handle(req);
  }, DELAY);
}
