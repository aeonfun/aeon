// api-gate.test.ts — Vitest spec for dashboard/lib/security/api-gate.ts
//
// Final location: dashboard/__tests__/api-gate.test.ts
// Run via: cd dashboard && npx vitest run
//
// Tests the host-header allowlist + Origin/Referer CSRF gate. This is the most
// security-critical surface in the dashboard — a regression here means anyone
// with a browser tab can manipulate the operator's GitHub secrets.

import { describe, expect, it, beforeEach, afterEach } from 'vitest';

// NOTE: adjust the import path when moving this file to dashboard/__tests__/.
// import { gateRequest, isAllowedHost, isSameOriginWrite } from '../lib/security/api-gate';

// ---- shimmed for scaffolding portability; real test pulls the real impl --
declare function gateRequest(req: Request): Response | null;
declare function isAllowedHost(host: string, opts?: { allowAny?: boolean; extraAllowed?: Set<string> }): boolean;
declare function isSameOriginWrite(req: Request, opts?: { allowAny?: boolean; extraAllowed?: Set<string> }): boolean;

// Helper: build a Request with arbitrary Host + Origin.
function req(opts: { method?: string; host: string; origin?: string; referer?: string }): Request {
  const headers = new Headers();
  headers.set('Host', opts.host);
  if (opts.origin) headers.set('Origin', opts.origin);
  if (opts.referer) headers.set('Referer', opts.referer);
  return new Request(`http://${opts.host}/api/secrets`, { method: opts.method ?? 'GET', headers });
}

// ----------------------------------------------------------------------------
// isAllowedHost
// ----------------------------------------------------------------------------

describe('isAllowedHost', () => {
  for (const loopback of [
    '127.0.0.1',
    'localhost',
    '::1',
    '[::1]',
    '0.0.0.0',
    '127.0.0.1:5555',
    'localhost:5555',
    '[::1]:5555',
  ]) {
    it(`accepts loopback variant: ${loopback}`, () => {
      expect(isAllowedHost(loopback)).toBe(true);
    });
  }

  for (const evil of [
    'attacker.example',
    '10.0.0.1',
    'evil.localhost.com',
    'localhost.attacker.example',
    '127.0.0.1.attacker.example',
    'aeon.evil.com',
  ]) {
    it(`rejects non-loopback: ${evil}`, () => {
      expect(isAllowedHost(evil)).toBe(false);
    });
  }

  it('honors extraAllowed for legitimate LAN hosts', () => {
    const extra = new Set(['box.tail-xxx.ts.net', 'aeon.local']);
    expect(isAllowedHost('box.tail-xxx.ts.net', { extraAllowed: extra })).toBe(true);
    expect(isAllowedHost('aeon.local:5555', { extraAllowed: extra })).toBe(true);
    expect(isAllowedHost('attacker.example', { extraAllowed: extra })).toBe(false);
  });

  it('allowAny disables all checks', () => {
    expect(isAllowedHost('attacker.example', { allowAny: true })).toBe(true);
    expect(isAllowedHost('', { allowAny: true })).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// isSameOriginWrite — CSRF gate
// ----------------------------------------------------------------------------

describe('isSameOriginWrite', () => {
  it('safe methods skip the Origin check', () => {
    expect(isSameOriginWrite(req({ method: 'GET', host: 'attacker.example' }))).toBe(true);
    expect(isSameOriginWrite(req({ method: 'HEAD', host: 'attacker.example' }))).toBe(true);
    expect(isSameOriginWrite(req({ method: 'OPTIONS', host: 'attacker.example' }))).toBe(true);
  });

  it('state-changing methods require Origin or Referer on allowlist', () => {
    // Both headers missing → reject.
    expect(isSameOriginWrite(req({ method: 'POST', host: '127.0.0.1:5555' }))).toBe(false);

    // Origin on allowlist → accept.
    expect(isSameOriginWrite(req({
      method: 'POST', host: '127.0.0.1:5555', origin: 'http://127.0.0.1:5555',
    }))).toBe(true);

    // Origin from attacker → reject.
    expect(isSameOriginWrite(req({
      method: 'POST', host: '127.0.0.1:5555', origin: 'http://attacker.example',
    }))).toBe(false);

    // Referer-only with allowlist → accept.
    expect(isSameOriginWrite(req({
      method: 'POST', host: '127.0.0.1:5555', referer: 'http://localhost:5555/dashboard',
    }))).toBe(true);
  });

  it('invalid Origin URL → reject', () => {
    expect(isSameOriginWrite(req({
      method: 'POST', host: '127.0.0.1:5555', origin: 'not-a-url',
    }))).toBe(false);
  });
});

// ----------------------------------------------------------------------------
// gateRequest — end-to-end behavior
// ----------------------------------------------------------------------------

describe('gateRequest', () => {
  beforeEach(() => {
    delete process.env.AEON_DASHBOARD_ALLOWED_HOSTS;
    delete process.env.AEON_DASHBOARD_ALLOW_ANY_HOST;
  });

  it('returns null (allow) for legitimate loopback GET', () => {
    const r = gateRequest(req({ method: 'GET', host: '127.0.0.1:5555' }));
    expect(r).toBeNull();
  });

  it('returns 403 with JSON for non-loopback Host', () => {
    const r = gateRequest(req({ method: 'GET', host: 'attacker.example' }));
    expect(r?.status).toBe(403);
    // Response body should explain the loopback rule + env-var hatches.
  });

  it('returns 403 with JSON for cross-origin POST', () => {
    const r = gateRequest(req({
      method: 'POST', host: '127.0.0.1:5555', origin: 'http://attacker.example',
    }));
    expect(r?.status).toBe(403);
  });

  it('env vars are picked up live, not cached', () => {
    // Attempt rejected.
    expect(gateRequest(req({ method: 'GET', host: 'box.tail-xxx.ts.net' }))?.status).toBe(403);

    // Add to allowlist.
    process.env.AEON_DASHBOARD_ALLOWED_HOSTS = 'box.tail-xxx.ts.net';

    // Now accepted on the very next request (no restart).
    expect(gateRequest(req({ method: 'GET', host: 'box.tail-xxx.ts.net' }))).toBeNull();
  });

  it('AEON_DASHBOARD_ALLOW_ANY_HOST=1 disables both checks', () => {
    process.env.AEON_DASHBOARD_ALLOW_ANY_HOST = '1';
    expect(gateRequest(req({ method: 'POST', host: 'attacker.example' }))).toBeNull();
    expect(gateRequest(req({
      method: 'POST', host: 'attacker.example', origin: 'http://attacker.example',
    }))).toBeNull();
  });
});

// ----------------------------------------------------------------------------
// DNS-rebinding scenario — explicit walkthrough
// ----------------------------------------------------------------------------

describe('attack scenario: DNS rebinding', () => {
  it('rejects cross-origin POST that bypasses CORS via Content-Type tricks', () => {
    // Attacker page at attacker.example flips DNS to 127.0.0.1 then sends:
    //   POST http://127.0.0.1:5555/api/secrets
    //   Host: attacker.example
    //   Origin: http://attacker.example
    //   Content-Type: text/plain      (no preflight)
    const r = gateRequest(req({
      method: 'POST', host: 'attacker.example', origin: 'http://attacker.example',
    }));
    expect(r?.status).toBe(403);
  });

  it('rejects even if attacker spoofs Host as localhost (because Origin check still runs)', () => {
    const r = gateRequest(req({
      method: 'POST', host: 'localhost:5555', origin: 'http://attacker.example',
    }));
    expect(r?.status).toBe(403);
  });
});
