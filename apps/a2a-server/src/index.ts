#!/usr/bin/env node
/**
 * Aeon A2A Gateway Server
 *
 * Implements Google's Agent-to-Agent (A2A) protocol, exposing all Aeon skills
 * as callable tasks. Any A2A-compliant agent framework — LangChain, AutoGen,
 * CrewAI, OpenAI Agents SDK, Vertex AI — can invoke Aeon skills via standard
 * HTTP + JSON-RPC, no MCP client or Claude interface required.
 *
 * Endpoints:
 *   GET  /.well-known/agent.json   — Agent card advertising all skills
 *   POST /                          — JSON-RPC: tasks/send, tasks/get, tasks/cancel
 *   POST /tasks/sendSubscribe       — SSE streaming for long-running skills
 *
 * Usage:
 *   node dist/index.js              # default port 41241
 *   A2A_PORT=8080 node dist/index.js
 *   A2A_URL=https://your-host.com node dist/index.js
 */

import { createServer, IncomingMessage, ServerResponse } from "http";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn, ChildProcess } from "child_process";
import { randomUUID } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// apps/a2a-server/dist/index.js → apps/a2a-server/ → apps/ → repo root
const REPO_ROOT = join(__dirname, "..", "..", "..");
const DEFAULT_PORT = parseInt(process.env.A2A_PORT ?? "41241", 10);
const SERVER_URL = process.env.A2A_URL ?? `http://localhost:${DEFAULT_PORT}`;

// ── Types ────────────────────────────────────────────────────────────────────

interface Skill {
  slug: string;
  name: string;
  description: string;
  category: string;
  schedule: string;
  var: string;
}

interface SkillsManifest {
  version: string;
  repo: string;
  skills: Skill[];
}

type TaskState = "submitted" | "working" | "completed" | "failed" | "canceled";

interface MessagePart {
  type: string;
  text: string;
}

interface A2AMessage {
  role: string;
  parts: MessagePart[];
}

interface TaskStatus {
  state: TaskState;
  timestamp: string;
  message?: A2AMessage;
}

interface TaskArtifact {
  name?: string;
  mimeType?: string;
  parts: MessagePart[];
}

interface Task {
  id: string;
  sessionId?: string;
  status: TaskStatus;
  artifacts: TaskArtifact[];
  history: A2AMessage[];
  metadata?: Record<string, unknown>;
  skillSlug?: string;
  _subscribers: ServerResponse[];
  _childProcess?: ChildProcess;
  _completedAt?: number;
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

// ── State ─────────────────────────────────────────────────────────────────────

const tasks = new Map<string, Task>();
const skills = loadSkills();

const TASK_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_TASKS = 1000;

function evictStaleTasks(): void {
  const now = Date.now();
  for (const [id, task] of tasks) {
    if (task._completedAt && now - task._completedAt > TASK_TTL_MS) {
      tasks.delete(id);
    }
  }
  // Hard cap: if still over limit, drop oldest completed tasks
  if (tasks.size > MAX_TASKS) {
    const completed = [...tasks.entries()]
      .filter(([, t]) => t._completedAt)
      .sort((a, b) => (a[1]._completedAt ?? 0) - (b[1]._completedAt ?? 0));
    for (const [id] of completed) {
      tasks.delete(id);
      if (tasks.size <= MAX_TASKS) break;
    }
  }
}

// ── Skill loading ─────────────────────────────────────────────────────────────

function loadSkills(): Skill[] {
  const manifestPath = join(REPO_ROOT, "skills.json");
  if (!existsSync(manifestPath)) {
    process.stderr.write(`[aeon-a2a] skills.json not found at ${manifestPath}\n`);
    return [];
  }
  const manifest: SkillsManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  return manifest.skills ?? [];
}

function getSkillBySlug(slug: string): Skill | undefined {
  return skills.find((s) => s.slug === slug);
}

/**
 * Parse a skill slug and optional var from an A2A message.
 * Accepts: "aeon-<slug>", "skill: <slug>", or a bare slug (if exact match).
 * Var extraction: "var=<value>", "var: <value>", or var="<value>".
 */
function parseSkillFromMessage(message: A2AMessage): { slug: string; varValue: string } | null {
  const text = message.parts.find((p) => p.type === "text")?.text ?? "";

  const slugMatch =
    text.match(/\baeon-([a-z0-9-]+)\b/i) ??
    text.match(/\bskill:\s*([a-z0-9-]+)\b/i) ??
    text.match(/^([a-z0-9-]+)$/);

  if (!slugMatch) return null;
  const slug = slugMatch[1].toLowerCase();
  if (!getSkillBySlug(slug)) return null;

  const varMatch = text.match(/\bvar\s*[=:]\s*["']?([^"'\n]+?)["']?(?:\s|$)/i);
  return { slug, varValue: varMatch ? varMatch[1].trim() : "" };
}

// ── Skill execution ───────────────────────────────────────────────────────────

function runSkillAsync(task: Task, slug: string, varValue: string): void {
  const skillFile = join(REPO_ROOT, "skills", slug, "SKILL.md");
  if (!existsSync(skillFile)) {
    completeTask(task, "failed", `Error: skill '${slug}' not found at ${skillFile}`);
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  let prompt = `Today is ${today}. Read and execute the skill defined in skills/${slug}/SKILL.md`;
  if (varValue) {
    prompt += `\n\nUse this variable (override the default in the skill file):\nvar=${varValue}`;
  }

  process.stderr.write(
    `[aeon-a2a] Starting skill: ${slug}${varValue ? ` (var=${varValue})` : ""}\n`
  );

  setTaskState(task, "working");

  const chunks: string[] = [];
  const child = spawn("claude", ["-p", "-", "--output-format", "json"], {
    cwd: REPO_ROOT,
    env: { ...process.env },
  });
  task._childProcess = child;

  child.stdin.write(prompt);
  child.stdin.end();

  child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));

  child.on("close", (code) => {
    const raw = chunks.join("").trim();
    if (code !== 0) {
      completeTask(task, "failed", `Skill '${slug}' failed (exit ${code}):\n${raw}`);
      return;
    }
    let result = raw;
    try {
      const parsed = JSON.parse(raw) as { result?: string };
      result = parsed.result ?? raw;
    } catch {
      // use raw output
    }
    completeTask(task, "completed", result);
  });

  child.on("error", (err) => {
    const code = (err as NodeJS.ErrnoException).code;
    const msg =
      code === "ENOENT"
        ? "'claude' CLI not found. Install: npm install -g @anthropic-ai/claude-code"
        : `Failed to spawn claude: ${err.message}`;
    completeTask(task, "failed", msg);
  });
}

function setTaskState(task: Task, state: TaskState): void {
  task.status = { state, timestamp: new Date().toISOString() };
  broadcastSSE(task, "status", { id: task.id, status: task.status });
}

function completeTask(task: Task, state: TaskState, text: string): void {
  const msg: A2AMessage = { role: "agent", parts: [{ type: "text", text }] };
  task.status = { state, timestamp: new Date().toISOString() };
  task.history.push(msg);
  task._completedAt = Date.now();
  task._childProcess = undefined;

  if (state === "completed") {
    task.artifacts = [{ mimeType: "text/plain", parts: [{ type: "text", text }] }];
    broadcastSSE(task, "artifact", {
      id: task.id,
      artifact: task.artifacts[0],
    });
  }

  broadcastSSE(task, "status", { id: task.id, status: task.status });

  // Close all SSE connections
  for (const res of task._subscribers) {
    if (!res.writableEnded) {
      writeSSE(res, "close", {});
      res.end();
    }
  }
  task._subscribers = [];
}

// ── SSE helpers ───────────────────────────────────────────────────────────────

function writeSSE(res: ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function broadcastSSE(task: Task, event: string, data: unknown): void {
  for (const res of task._subscribers) {
    if (!res.writableEnded) writeSSE(res, event, data);
  }
}

// ── Agent Card ────────────────────────────────────────────────────────────────

function buildAgentCard(): Record<string, unknown> {
  return {
    name: "Aeon",
    description:
      `Background intelligence agent with ${skills.length} skills across research, dev tooling, ` +
      "crypto monitoring, and productivity. Runs on GitHub Actions — always available, " +
      "no infra required.",
    url: SERVER_URL,
    version: "1.0.0",
    documentationUrl: "https://github.com/aaronjmars/aeon",
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true,
    },
    authentication: {
      schemes: [],
    },
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    skills: skills.map((s) => ({
      id: `aeon-${s.slug}`,
      name: s.name,
      description: s.description,
      tags: [s.category, "aeon", "background-agent"],
      inputModes: ["text"],
      outputModes: ["text"],
      examples: [
        {
          role: "user",
          parts: [
            {
              type: "text",
              text: `Run aeon-${s.slug}${s.var ? ` with var="${s.var}"` : ""}`,
            },
          ],
        },
      ],
    })),
  };
}

// ── JSON-RPC handlers ─────────────────────────────────────────────────────────

type RpcResult<T> = T | { error: { code: number; message: string } };

// Narrowing guards for untrusted JSON-RPC params (params is Record<string, unknown>).
function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function asNumber(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function isA2AMessage(v: unknown): v is A2AMessage {
  return isRecord(v) && Array.isArray((v as { parts?: unknown }).parts);
}

function handleTasksSend(params: Record<string, unknown>): RpcResult<Task> {
  const id = asString(params.id) ?? randomUUID();
  const message = isA2AMessage(params.message) ? params.message : undefined;
  const skillId = asString(params.skillId);
  const varOverride = asString(params.var);

  let slug: string | undefined;
  let varValue = varOverride ?? "";

  if (skillId) {
    slug = skillId.replace(/^aeon-/, "");
  } else if (message) {
    const parsed = parseSkillFromMessage(message);
    if (parsed) {
      slug = parsed.slug;
      if (!varOverride) varValue = parsed.varValue;
    }
  }

  if (!slug || !getSkillBySlug(slug)) {
    const examples = skills
      .slice(0, 5)
      .map((s) => `aeon-${s.slug}`)
      .join(", ");
    return {
      error: {
        code: -32602,
        message:
          `No valid skill found. Pass skillId (e.g. "aeon-deep-research") or ` +
          `mention an aeon-<slug> in your message. Examples: ${examples}, ...`,
      },
    };
  }

  const task: Task = {
    id,
    status: { state: "submitted", timestamp: new Date().toISOString() },
    artifacts: [],
    history: message ? [message] : [],
    metadata: isRecord(params.metadata) ? params.metadata : undefined,
    skillSlug: slug,
    _subscribers: [],
  };
  tasks.set(id, task);
  evictStaleTasks();

  // Kick off async — return submitted state immediately
  setImmediate(() => runSkillAsync(task, slug!, varValue));

  return task;
}

function handleTasksGet(params: Record<string, unknown>): RpcResult<Record<string, unknown>> {
  const id = asString(params.id) ?? "";
  const task = tasks.get(id);
  if (!task) {
    return { error: { code: -32602, message: `Task not found: ${id}` } };
  }
  const historyLength = asNumber(params.historyLength) ?? task.history.length;
  // Omit internal _subscribers from response
  const { _subscribers: _, ...safe } = task;
  return { ...safe, history: task.history.slice(-historyLength) };
}

function handleTasksCancel(params: Record<string, unknown>): RpcResult<Record<string, unknown>> {
  const id = asString(params.id) ?? "";
  const task = tasks.get(id);
  if (!task) {
    return { error: { code: -32602, message: `Task not found: ${id}` } };
  }
  if (task.status.state === "submitted" || task.status.state === "working") {
    if (task._childProcess) {
      task._childProcess.kill("SIGTERM");
    }
    completeTask(task, "canceled", "Task canceled by caller.");
  }
  const { _subscribers: _, ...safe } = task;
  return safe;
}

// ── HTTP request handling ─────────────────────────────────────────────────────

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error("Request body too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json", ...CORS_HEADERS });
  res.end(JSON.stringify(data));
}

function rpcError(id: string | number, code: number, message: string): Record<string, unknown> {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const method = req.method ?? "GET";

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // Agent card — the discovery endpoint A2A clients fetch first
  if (method === "GET" && url.pathname === "/.well-known/agent.json") {
    json(res, 200, buildAgentCard());
    return;
  }

  // SSE streaming: POST /tasks/sendSubscribe
  if (method === "POST" && url.pathname === "/tasks/sendSubscribe") {
    let body: string;
    try {
      body = await readBody(req);
    } catch {
      json(res, 400, { error: "Cannot read request body" });
      return;
    }

    let rpc: JsonRpcRequest;
    try {
      rpc = JSON.parse(body);
    } catch {
      json(res, 400, { error: "Invalid JSON" });
      return;
    }

    const result = handleTasksSend((rpc.params ?? {}) as Record<string, unknown>);
    if ("error" in result) {
      json(res, 400, { jsonrpc: "2.0", id: rpc.id, error: result.error });
      return;
    }

    const task = result as Task;
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...CORS_HEADERS,
    });

    writeSSE(res, "status", { id: task.id, status: task.status });
    task._subscribers.push(res);

    req.on("close", () => {
      task._subscribers = task._subscribers.filter((s) => s !== res);
    });
    return;
  }

  // JSON-RPC endpoint: POST /  or  POST /rpc
  if (method === "POST" && (url.pathname === "/" || url.pathname === "/rpc")) {
    let body: string;
    try {
      body = await readBody(req);
    } catch {
      json(res, 400, rpcError(0, -32700, "Parse error"));
      return;
    }

    let rpc: JsonRpcRequest;
    try {
      rpc = JSON.parse(body);
    } catch {
      json(res, 400, rpcError(0, -32700, "Parse error"));
      return;
    }

    if (rpc.jsonrpc !== "2.0" || !rpc.method) {
      json(res, 400, rpcError(rpc?.id ?? 0, -32600, "Invalid Request"));
      return;
    }

    const params = (rpc.params ?? {}) as Record<string, unknown>;

    switch (rpc.method) {
      case "tasks/send": {
        const r = handleTasksSend(params);
        if ("error" in r) {
          json(res, 200, { jsonrpc: "2.0", id: rpc.id, error: r.error });
          return;
        }
        const { _subscribers: _, ...safe } = r as Task;
        json(res, 200, { jsonrpc: "2.0", id: rpc.id, result: safe });
        return;
      }
      case "tasks/get": {
        const r = handleTasksGet(params);
        if ("error" in r) {
          json(res, 200, { jsonrpc: "2.0", id: rpc.id, error: r.error });
          return;
        }
        json(res, 200, { jsonrpc: "2.0", id: rpc.id, result: r });
        return;
      }
      case "tasks/cancel": {
        const r = handleTasksCancel(params);
        if ("error" in r) {
          json(res, 200, { jsonrpc: "2.0", id: rpc.id, error: r.error });
          return;
        }
        json(res, 200, { jsonrpc: "2.0", id: rpc.id, result: r });
        return;
      }
      default:
        json(res, 200, rpcError(rpc.id, -32601, `Method not found: ${rpc.method}`));
        return;
    }
  }

  json(res, 404, { error: "Not found" });
}

// ── Entry point ───────────────────────────────────────────────────────────────

const httpServer = createServer((req, res) => {
  handleRequest(req, res).catch((err: unknown) => {
    process.stderr.write(`[aeon-a2a] Unhandled error: ${err}\n`);
    if (!res.headersSent) {
      json(res, 500, { error: "Internal server error" });
    }
  });
});

httpServer.listen(DEFAULT_PORT, () => {
  process.stderr.write(`[aeon-a2a] Server running on port ${DEFAULT_PORT}\n`);
  process.stderr.write(`[aeon-a2a] Agent card : ${SERVER_URL}/.well-known/agent.json\n`);
  process.stderr.write(`[aeon-a2a] JSON-RPC   : POST ${SERVER_URL}/\n`);
  process.stderr.write(`[aeon-a2a] SSE stream : POST ${SERVER_URL}/tasks/sendSubscribe\n`);
  process.stderr.write(`[aeon-a2a] Loaded ${skills.length} skills\n`);
});

httpServer.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    process.stderr.write(
      `[aeon-a2a] Port ${DEFAULT_PORT} already in use. Set A2A_PORT=<port> to change.\n`
    );
  } else {
    process.stderr.write(`[aeon-a2a] Server error: ${err.message}\n`);
  }
  process.exit(1);
});
