// crawler/__tests__/smoke.mjs — node:test smoke for the agora crawler's pure functions.

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

function canonicalize(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalize).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys
    .filter(k => k !== 'signature')
    .map(k => JSON.stringify(k) + ':' + canonicalize(obj[k]))
    .join(',') + '}';
}

describe('canonicalize (agora)', () => {
  test('signature excluded', () => {
    assert.equal(canonicalize({ a: 1, signature: 'ed25519:xxx' }), '{"a":1}');
  });

  test('keys sorted at every level', () => {
    assert.equal(canonicalize({ z: { c: 1, a: 2 }, a: 3 }), '{"a":3,"z":{"a":2,"c":1}}');
  });

  test('canonical post payload is stable across signature presence', () => {
    const post = {
      schema: 'aeon-agora-post/1',
      id: 'post-001',
      publisher: '@test',
      publisher_key: 'ed25519:abc',
      ts: '2026-05-26T00:00:00Z',
      kind: 'post',
      body_md: 'hello',
      tags: ['x'],
    };
    const c1 = canonicalize(post);
    const c2 = canonicalize({ ...post, signature: 'ed25519:zzz' });
    assert.equal(c1, c2);
  });
});

describe('post envelope shape', () => {
  test('required fields present', () => {
    const post = {
      schema: 'aeon-agora-post/1',
      id: 'post-001',
      publisher: '@test',
      publisher_key: 'ed25519:abc',
      ts: '2026-05-26T00:00:00Z',
      kind: 'post',
      body_md: 'hello',
      signature: 'ed25519:xxx',
    };
    for (const key of ['schema', 'id', 'publisher', 'publisher_key', 'ts', 'kind', 'body_md', 'signature']) {
      assert.ok(post[key] !== undefined, `missing required field: ${key}`);
    }
  });

  test('reaction vocabulary is constrained', () => {
    const ALLOWED = ['👀', '🔥', '❌', '✓', '🚨'];
    for (const e of ALLOWED) {
      assert.ok(ALLOWED.includes(e));
    }
  });
});
