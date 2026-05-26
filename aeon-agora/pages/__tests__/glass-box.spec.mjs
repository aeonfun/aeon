/**
 * glass-box.spec.mjs — enforces the seven glass-box properties on the agora
 * frontend. Run via `node --test __tests__/glass-box.spec.mjs`.
 *
 * Binding contract. Any PR that breaks these must be rejected.
 * Documented in: ../../docs/agora-spec/GLASS-BOX-CONTRACT.md
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'src');
const PAGES_DIR = join(SRC, 'pages');

function walkFiles(dir, exts) {
  const out = [];
  function go(d) {
    if (!existsSync(d)) return;
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) go(p);
      else if (exts.includes(extname(p).toLowerCase())) out.push(p);
    }
  }
  go(dir);
  return out;
}

/**
 * Strip comments before scanning for violations. The contract is about
 * what the page *does*, not what its source code documents about what
 * it does NOT do — comments explaining "no admin link here" are valid.
 */
function stripComments(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')      // /* block */
    .replace(/\/\/[^\n]*/g, '')             // // line
    .replace(/<!--[\s\S]*?-->/g, '');       // <!-- HTML -->
}

function readScrubbed(path) {
  return stripComments(readFileSync(path, 'utf8'));
}

describe('Glass-box property 1 — no write surface in src/pages/', () => {
  const files = walkFiles(PAGES_DIR, ['.astro', '.ts', '.tsx', '.js', '.jsx']);

  test('walks at least one frontend file (sanity)', () => {
    assert.ok(files.length > 0, 'no frontend files found — test cannot enforce');
  });

  test('no POST/PUT/PATCH/DELETE methods', () => {
    const pattern = /method\s*[:=]\s*['"](POST|PUT|PATCH|DELETE)['"]/i;
    const offenders = files.filter(f => pattern.test(readScrubbed(f)));
    assert.equal(offenders.length, 0,
      `glass-box violation: write methods in:\n  ${offenders.join('\n  ')}`);
  });

  test('no exported POST/PUT/PATCH/DELETE handlers', () => {
    const pattern = /export\s+(const|async\s+function)\s+(POST|PUT|PATCH|DELETE)\b/;
    const offenders = files.filter(f => pattern.test(readScrubbed(f)));
    assert.equal(offenders.length, 0,
      `glass-box violation: API route handlers in:\n  ${offenders.join('\n  ')}`);
  });

  test('no admin / moderate / login UI language', () => {
    const pattern = /\b(admin|moderate|approve_post|delete_post|edit_post|ban_user|mute_user|signin|signup|register|password)\b/i;
    const offenders = [];
    for (const f of files) {
      // Verify pages may mention these as verification-context strings.
      if (f.includes('/verify/') || f.includes('/verify.')) continue;
      const content = readScrubbed(f);
      if (pattern.test(content)) offenders.push(f);
    }
    assert.equal(offenders.length, 0,
      `glass-box violation: admin/moderate/login language in:\n  ${offenders.join('\n  ')}`);
  });

  test('no <form method="POST">', () => {
    const pattern = /<form[^>]+method\s*=\s*['"]POST['"]/i;
    const offenders = files.filter(f => pattern.test(readScrubbed(f)));
    assert.equal(offenders.length, 0,
      `glass-box violation: POST form in:\n  ${offenders.join('\n  ')}`);
  });
});

describe('Glass-box property 2 — no central moderation/admin routes', () => {
  test('no /admin/ directory exists in pages/', () => {
    assert.ok(!existsSync(join(PAGES_DIR, 'admin')),
      'glass-box violation: pages/admin/ directory found');
  });

  test('no /api/ directory exists in pages/', () => {
    assert.ok(!existsSync(join(PAGES_DIR, 'api')),
      'glass-box violation: pages/api/ directory found');
  });

  test('no /moderate/ directory exists in pages/', () => {
    assert.ok(!existsSync(join(PAGES_DIR, 'moderate')),
      'glass-box violation: pages/moderate/ directory found');
  });
});

describe('Glass-box property 4 — client-side verification exists', () => {
  test('/verify/[id].astro is in place', () => {
    assert.ok(
      existsSync(join(PAGES_DIR, 'verify', '[id].astro')),
      'glass-box violation: /verify/[id] route missing — client-side verification is a contract property'
    );
  });

  test('verify-client lib exists', () => {
    assert.ok(
      existsSync(join(SRC, 'lib', 'verify-client.ts')),
      'glass-box violation: src/lib/verify-client.ts missing'
    );
  });
});

describe('Glass-box property 7 — no algorithmic ranking', () => {
  const files = walkFiles(SRC, ['.astro', '.ts', '.js']);

  test('no ranking function calls (score/rank/engagement/boost) in render code', () => {
    const pattern = /\b(score|rank|engagement|boost)\s*\(/i;
    const offenders = [];
    for (const f of files) {
      if (f.includes('/verify')) continue;
      if (f.includes('glass-box.spec')) continue;
      const content = readScrubbed(f);
      if (pattern.test(content)) offenders.push(f);
    }
    assert.equal(offenders.length, 0,
      `glass-box violation: ranking call in:\n  ${offenders.join('\n  ')}`);
  });

  test('ORDER BY in any SQL must be chronological (ts / created_at / id)', () => {
    for (const f of files) {
      const content = readScrubbed(f);
      const matches = content.match(/ORDER\s+BY\s+(\w+)/gi) || [];
      for (const m of matches) {
        const col = m.replace(/ORDER\s+BY\s+/i, '').toLowerCase();
        assert.ok(
          ['ts', 'created_at', 'id'].includes(col),
          `glass-box violation: ORDER BY ${col} in ${f} — only chronological allowed`
        );
      }
    }
  });
});
