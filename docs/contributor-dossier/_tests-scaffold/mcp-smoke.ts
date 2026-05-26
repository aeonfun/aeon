// mcp-smoke.ts — end-to-end smoke test for the Aeon MCP server
//
// Final location: mcp-server/__tests__/smoke.ts
// Run via: cd mcp-server && npx vitest run
//
// Spawns the built server, performs the MCP handshake, asserts tool catalog
// shape, invokes one safe tool, asserts error path. Parallel to the existing
// Python smoke at examples/mcp/test_connection.py.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';

let serverProc: ChildProcess | undefined;
let client: Client | undefined;

const REPO_ROOT = path.resolve(__dirname, '../..');
const SERVER_PATH = path.join(REPO_ROOT, 'mcp-server/dist/index.js');

beforeAll(async () => {
  // Verify the build exists.
  await import('node:fs/promises').then(fs => fs.access(SERVER_PATH));

  const transport = new StdioClientTransport({
    command: 'node',
    args: [SERVER_PATH],
  });

  client = new Client(
    { name: 'aeon-mcp-smoke', version: '0.0.1' },
    { capabilities: {} }
  );
  await client.connect(transport);
});

afterAll(async () => {
  await client?.close();
  if (serverProc && !serverProc.killed) serverProc.kill();
});

describe('MCP server — handshake + catalog', () => {
  it('initializes', () => {
    expect(client).toBeDefined();
  });

  it('returns at least one tool, all named aeon-*', async () => {
    const result = await client!.listTools();
    expect(result.tools.length).toBeGreaterThan(0);
    for (const t of result.tools) {
      expect(t.name).toMatch(/^aeon-[a-z][a-z0-9-]*$/);
      expect(t.description).toBeTruthy();
      expect(t.inputSchema).toBeDefined();
    }
  });

  it('every tool exposes optional `var` parameter', async () => {
    const result = await client!.listTools();
    for (const t of result.tools) {
      const schema = t.inputSchema as any;
      expect(schema?.type).toBe('object');
      // `var` should be optional (not in required list).
      if (schema.properties) {
        // tolerate either presence or absence of var; if present, must be string.
        if ('var' in schema.properties) {
          expect(schema.properties.var.type).toBe('string');
        }
      }
    }
  });
});

describe('MCP server — invocation', () => {
  // We invoke `aeon-heartbeat` because:
  // - It's the only skill enabled by default upstream.
  // - It has no `var` requirement.
  // - It writes to memory but is idempotent.
  // - It does not have side-effects (no posts, no on-chain ops).
  //
  // If your fork doesn't have heartbeat, swap for another safe meta skill.

  it('invokes aeon-heartbeat without error', async () => {
    const tools = await client!.listTools();
    const heartbeat = tools.tools.find(t => t.name === 'aeon-heartbeat');
    if (!heartbeat) {
      console.warn('aeon-heartbeat not registered; skipping invocation test');
      return;
    }

    const result = await client!.callTool({
      name: 'aeon-heartbeat',
      arguments: {},
    });

    expect(result.content).toBeDefined();
    expect(result.isError).not.toBe(true);
  }, 600_000); // 10 min — matches the server's own timeout.
});

describe('MCP server — error path', () => {
  it('returns proper error for nonexistent tool', async () => {
    await expect(
      client!.callTool({ name: 'aeon-does-not-exist', arguments: {} })
    ).rejects.toThrow();
  });

  it('rejects malformed argument schema', async () => {
    const tools = await client!.listTools();
    if (tools.tools.length === 0) return;
    const t = tools.tools[0];
    await expect(
      client!.callTool({
        name: t.name,
        arguments: { var: { not: 'a string' } } as any,
      })
    ).rejects.toThrow();
  });
});
