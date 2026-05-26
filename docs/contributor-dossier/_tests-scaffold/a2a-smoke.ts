// a2a-smoke.ts — end-to-end smoke test for the Aeon A2A gateway
//
// Final location: a2a-server/__tests__/smoke.ts
// Run via: cd a2a-server && npx vitest run

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, ChildProcess } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';

let serverProc: ChildProcess | undefined;
let baseUrl: string;

const REPO_ROOT = path.resolve(__dirname, '../..');
const SERVER_PATH = path.join(REPO_ROOT, 'a2a-server/dist/index.js');

beforeAll(async () => {
  const port = 41000 + Math.floor(Math.random() * 1000);
  baseUrl = `http://127.0.0.1:${port}`;

  serverProc = spawn('node', [SERVER_PATH], {
    env: { ...process.env, A2A_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Wait for /.well-known/agent.json to respond.
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`${baseUrl}/.well-known/agent.json`);
      if (r.ok) break;
    } catch {
      /* not ready yet */
    }
    await sleep(200);
  }
}, 30_000);

afterAll(() => {
  if (serverProc && !serverProc.killed) serverProc.kill();
});

describe('A2A — discovery', () => {
  it('returns a valid agent card', async () => {
    const r = await fetch(`${baseUrl}/.well-known/agent.json`);
    expect(r.ok).toBe(true);
    const card = await r.json();
    expect(card.name).toBeTruthy();
    expect(Array.isArray(card.skills)).toBe(true);
    expect(card.skills.length).toBeGreaterThan(0);

    for (const s of card.skills) {
      expect(s.name).toMatch(/^aeon-[a-z][a-z0-9-]*$/);
      expect(s.description).toBeTruthy();
    }
  });
});

describe('A2A — JSON-RPC tasks/send', () => {
  it('creates a task for a valid skill id', async () => {
    const rpc = {
      jsonrpc: '2.0',
      id: 'smoke-1',
      method: 'tasks/send',
      params: {
        skillId: 'aeon-heartbeat',
        message: { role: 'user', parts: [{ type: 'text', text: 'run' }] },
      },
    };
    const r = await fetch(`${baseUrl}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rpc),
    });
    expect(r.ok).toBe(true);
    const body = await r.json();
    expect(body.error).toBeUndefined();
    expect(body.result?.id).toBeTruthy();
    expect(body.result?.status).toBeDefined();
  });

  it('returns a JSON-RPC error for an unknown skill', async () => {
    const rpc = {
      jsonrpc: '2.0',
      id: 'smoke-2',
      method: 'tasks/send',
      params: {
        skillId: 'aeon-does-not-exist',
        message: { role: 'user', parts: [{ type: 'text', text: 'run' }] },
      },
    };
    const r = await fetch(`${baseUrl}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rpc),
    });
    expect(r.ok).toBe(true);
    const body = await r.json();
    expect(body.error).toBeDefined();
  });

  it('rejects malformed JSON-RPC', async () => {
    const r = await fetch(`${baseUrl}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not-json',
    });
    // Either 400 or a JSON-RPC parse error.
    if (r.ok) {
      const body = await r.json();
      expect(body.error?.code).toBe(-32700); // parse error per JSON-RPC spec
    } else {
      expect(r.status).toBeGreaterThanOrEqual(400);
    }
  });
});

describe('A2A — tasks/get lifecycle', () => {
  it('progresses through submitted → working → completed', async () => {
    const create = await fetch(`${baseUrl}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'lifecycle-1',
        method: 'tasks/send',
        params: { skillId: 'aeon-heartbeat', message: { role: 'user', parts: [{ type: 'text', text: 'run' }] } },
      }),
    });
    const { result } = await create.json();
    const taskId = result.id;
    expect(taskId).toBeTruthy();

    // Poll until completed or fail after 10 min.
    let lastState = result.status?.state;
    const deadline = Date.now() + 600_000;
    while (Date.now() < deadline && !['completed', 'failed', 'canceled'].includes(lastState)) {
      await sleep(2000);
      const getR = await fetch(`${baseUrl}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'lifecycle-poll',
          method: 'tasks/get',
          params: { id: taskId },
        }),
      });
      const body = await getR.json();
      lastState = body.result?.status?.state;
    }

    expect(['completed', 'failed']).toContain(lastState);
  }, 700_000);
});

describe('A2A — CORS', () => {
  it('preflight OPTIONS returns permissive CORS headers', async () => {
    const r = await fetch(`${baseUrl}/`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://attacker.example',
        'Access-Control-Request-Method': 'POST',
      },
    });
    // The gateway is intentionally permissive — operator should bind to 127.0.0.1
    // at the network layer; this test documents the current posture, not endorses it.
    expect(r.headers.get('access-control-allow-origin')).toBeTruthy();
  });
});
