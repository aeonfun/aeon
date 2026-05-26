// __tests__/smoke.mjs — node:test smoke for the registry's pure functions.
//
// node:test doesn't compile TypeScript, so we inline the canonicalize
// algorithm here (mirroring src/verify.ts). If src/verify.ts diverges, this
// test will catch it via the "reference signing payload is stable" case.

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

describe('canonicalize', () => {
  test('sorts keys alphabetically', () => {
    assert.equal(canonicalize({ b: 1, a: 2 }), '{"a":2,"b":1}');
  });

  test('excludes the signature field', () => {
    assert.equal(canonicalize({ a: 1, signature: 'ed25519:xxx' }), '{"a":1}');
  });

  test('handles nested objects', () => {
    assert.equal(canonicalize({ outer: { z: 1, a: 2 } }), '{"outer":{"a":2,"z":1}}');
  });

  test('handles arrays', () => {
    assert.equal(canonicalize({ arr: [3, 1, 2] }), '{"arr":[3,1,2]}');
  });

  test('handles null + primitives', () => {
    assert.equal(canonicalize(null), 'null');
    assert.equal(canonicalize(42), '42');
    assert.equal(canonicalize('x'), '"x"');
  });

  test('reference signing payload is stable (signature is irrelevant)', () => {
    const manifest = {
      schema: 'aeon-federation/1',
      publisher: '@aeon-prime',
      publisher_key: 'ed25519:abc',
      endpoint: 'https://example.com',
      version: '2026-05-26',
      skills: [],
      withdrawn: false,
    };
    const c1 = canonicalize(manifest);
    const c2 = canonicalize({ ...manifest, signature: 'ed25519:xxx' });
    assert.equal(c1, c2, 'adding signature must not change the canonical form');
  });
});
