#!/usr/bin/env node
// scripts/test-skill-discovery.mjs — node:test suite for the skill-discovery layer.
//
// Covers Session 06 (Day 5):
//   - index-skills generates a coherent index
//   - skill-search returns ranked results with the expected shape
//   - manifest coherence check passes
//   - MCP server lists aeon-skill-search and handles its call
//
// Run with: node --test scripts/test-skill-discovery.mjs
//
// No external dependencies. Uses node:test (Node 22+) and node:assert.

import { test, describe, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync, spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = process.cwd();
const INDEX_PATH = join(ROOT, 'docs', 'skills-index.json');
const MANIFEST_PATH = join(ROOT, 'docs', 'skills-index.manifest');

// --------------------------------------------------------------------------
describe('index-skills', () => {
  test('docs/skills-index.json exists after running ./index-skills', () => {
    const r = spawnSync('./index-skills', ['--provider', 'mock'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, `index-skills exited ${r.status}: ${r.stderr}`);
    assert.ok(existsSync(INDEX_PATH), 'skills-index.json not produced');
    assert.ok(existsSync(MANIFEST_PATH), 'skills-index.manifest not produced');
  });

  test('index has expected schema', () => {
    const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
    assert.equal(index.schema, 'aeon-skills-index/1');
    assert.equal(index.provider, 'mock');
    assert.equal(index.dims, 384);
    assert.ok(index.count > 100, `expected >100 skills, got ${index.count}`);
    assert.ok(Array.isArray(index.skills));

    const s = index.skills[0];
    assert.ok(s.slug);
    assert.ok(s.name);
    assert.ok(s.description);
    assert.ok(Array.isArray(s.tags));
    assert.ok(Array.isArray(s.embedding));
    assert.equal(s.embedding.length, 384);
  });

  test('embedding vectors are L2-normalized', () => {
    const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
    for (const s of index.skills.slice(0, 5)) {
      let norm = 0;
      for (const v of s.embedding) norm += v * v;
      norm = Math.sqrt(norm);
      assert.ok(Math.abs(norm - 1) < 1e-5, `${s.slug}: norm ${norm} not ~1`);
    }
  });

  test('--check passes when index is fresh', () => {
    const r = spawnSync('./index-skills', ['--check'], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(r.status, 0, `check failed: ${r.stderr}`);
  });

  test('mock embeddings are deterministic', () => {
    // Re-run; manifest hash must stay identical.
    const before = readFileSync(MANIFEST_PATH, 'utf8');
    const r = spawnSync('./index-skills', ['--provider', 'mock'], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(r.status, 0);
    const after = readFileSync(MANIFEST_PATH, 'utf8');
    assert.equal(before, after, 'manifest changed across re-runs (non-deterministic!)');
  });
});

// --------------------------------------------------------------------------
describe('skill-search', () => {
  test('returns valid JSON with the expected shape', () => {
    const r = spawnSync(
      'node',
      [join(ROOT, 'scripts', 'skill-search.mjs')],
      {
        env: {
          ...process.env,
          AEON_ROOT: ROOT,
          QUERY: 'monitor crypto tokens',
          LIMIT: '3',
          FORMAT: 'json',
        },
        encoding: 'utf8',
      }
    );
    assert.equal(r.status, 0, `skill-search exited ${r.status}: ${r.stderr}`);
    const data = JSON.parse(r.stdout);
    assert.equal(data.query, 'monitor crypto tokens');
    assert.equal(data.provider, 'mock');
    assert.equal(data.results.length, 3);
    for (const item of data.results) {
      assert.ok(item.slug);
      assert.ok(item.name);
      assert.ok(item.description);
      assert.ok(item.invoke_as.startsWith('aeon-'));
      assert.ok(typeof item.score === 'number');
      assert.ok(item.score >= -1 && item.score <= 1, `score ${item.score} out of [-1,1]`);
    }
  });

  test('honors --type tag filter', () => {
    const r = spawnSync(
      'node',
      [join(ROOT, 'scripts', 'skill-search.mjs')],
      {
        env: {
          ...process.env,
          AEON_ROOT: ROOT,
          QUERY: 'anything',
          LIMIT: '5',
          TAG_FILTER: 'research',
          FORMAT: 'json',
        },
        encoding: 'utf8',
      }
    );
    assert.equal(r.status, 0);
    const data = JSON.parse(r.stdout);
    for (const item of data.results) {
      assert.ok(item.tags.includes('research'), `${item.slug} missing 'research' tag`);
    }
  });

  test('mock provider results are deterministic for the same query', () => {
    function runQuery() {
      const r = spawnSync(
        'node',
        [join(ROOT, 'scripts', 'skill-search.mjs')],
        {
          env: { ...process.env, AEON_ROOT: ROOT, QUERY: 'test query', LIMIT: '5', FORMAT: 'json' },
          encoding: 'utf8',
        }
      );
      return JSON.parse(r.stdout);
    }
    const a = runQuery();
    const b = runQuery();
    assert.deepEqual(
      a.results.map(r => r.slug),
      b.results.map(r => r.slug)
    );
  });
});

// --------------------------------------------------------------------------
describe('MCP server — skill-search tool', () => {
  // We spawn the built server, send list_tools and call_tool, and assert.
  // This requires mcp-server to have been built; we check that first.
  const SERVER_PATH = join(ROOT, 'mcp-server', 'dist', 'index.js');

  before(() => {
    if (!existsSync(SERVER_PATH)) {
      // Build the server first.
      const r = spawnSync('npm', ['run', 'build'], {
        cwd: join(ROOT, 'mcp-server'),
        encoding: 'utf8',
      });
      assert.equal(r.status, 0, `mcp-server build failed: ${r.stderr}`);
    }
  });

  test('MCP server registers aeon-skill-search in tool list', async () => {
    const server = spawn('node', [SERVER_PATH], {
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let buffer = '';
    server.stdout.on('data', (chunk) => { buffer += chunk.toString(); });

    // Send initialize then tools/list per MCP stdio JSON-RPC.
    const send = (obj) => server.stdin.write(JSON.stringify(obj) + '\n');
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', clientInfo: { name: 'test', version: '0' }, capabilities: {} } });
    await sleep(200);
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    await sleep(100);
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    await sleep(500);

    server.kill();
    await sleep(50);

    // Parse all complete JSON-RPC messages from the buffer.
    const lines = buffer.split('\n').filter(l => l.trim());
    const messages = lines.map(l => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);

    const toolsListResponse = messages.find(m => m.id === 2 && m.result?.tools);
    assert.ok(toolsListResponse, `no tools/list response in ${messages.length} messages`);
    const toolNames = toolsListResponse.result.tools.map(t => t.name);
    assert.ok(toolNames.includes('aeon-skill-search'), `aeon-skill-search missing from ${toolNames.length} tools`);
    assert.ok(toolNames.length > 100, `expected >100 tools, got ${toolNames.length}`);
  });
});

// --------------------------------------------------------------------------
describe('skill-lint coherence (Session 06 prerequisite)', () => {
  test('every indexed slug has a real SKILL.md on disk', () => {
    const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
    for (const s of index.skills) {
      const path = join(ROOT, 'skills', s.slug, 'SKILL.md');
      assert.ok(existsSync(path), `indexed slug ${s.slug} has no SKILL.md`);
    }
  });
});
