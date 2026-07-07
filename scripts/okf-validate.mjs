#!/usr/bin/env node
// okf-validate.mjs — conformance checker for Aeon's OKF-native knowledge.
//
// Aeon speaks the Open Knowledge Format (OKF v0.1) *natively* and in place: the
// real files ARE the bundle (no separate/duplicated copy). Scope is "knowledge +
// operational" — see scripts/okf-config.json for the exact roots. This validator
// enforces the ONE hard requirement of the spec (§9) and nothing stricter:
//
//   1. Every non-reserved .md file (under a configured root) has a parseable YAML
//      frontmatter block.
//   2. Every frontmatter block has a non-empty `type:` field.
//   3. Reserved files (index.md, log.md) follow their §6/§7 shape *when present*.
//
// Deliberately NOT enforced (the spec forbids over-conformance — a stricter bar
// would fight Aeon's own non-deterministic agents): unknown `type:` values,
// missing optional fields, broken cross-links. Those are soft, at most warnings.
//
// Usage:
//   node scripts/okf-validate.mjs                 # validate all roots in okf-config.json
//   node scripts/okf-validate.mjs <root> [root…]  # validate explicit root(s), no config excludes
//   node scripts/okf-validate.mjs … --stale N      # also WARN on concepts older than N days
//
// Exit 1 on any §9 hard violation; exit 0 (with `okf-validate: OK`) otherwise.

import { readFileSync } from 'node:fs'
import { relative, basename } from 'node:path'
import { RESERVED, walk, parseFrontmatter, makeIsExcluded, loadConfig } from './lib/okf.mjs'

// ---- args ----
const rawArgs = process.argv.slice(2)
let explicitRoots = []
let staleDays = null
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i]
  if (a === '--stale') {
    staleDays = Number(rawArgs[++i])
    if (!Number.isFinite(staleDays)) {
      console.error('okf-validate: --stale expects a number of days')
      process.exit(2)
    }
  } else if (!a.startsWith('--')) {
    explicitRoots.push(a)
  }
}

// Explicit roots → validate exactly those (no config excludes; used by okf-ingest
// against a fetched .okf-cache/ tree). No args → the whole configured scope.
let roots
let exclude = []
if (explicitRoots.length) {
  roots = explicitRoots
} else {
  let cfg = { roots: ['memory/topics'], exclude: [] }
  try {
    cfg = loadConfig()
  } catch {
    /* no config → fall back to the original single root */
  }
  roots = cfg.roots ?? ['memory/topics']
  exclude = cfg.exclude ?? []
}

const isExcluded = makeIsExcluded(exclude)

// ---- validate ----
const errors = []
const warnings = []
let conceptCount = 0
const seen = new Set()
const staleCutoff = staleDays != null ? Date.now() - staleDays * 864e5 : null

for (const root of roots) {
  for (const file of walk(root, isExcluded)) {
    if (seen.has(file)) continue // roots may nest; validate each file once
    seen.add(file)
    const rel = relative(process.cwd(), file)
    const name = basename(file)
    const content = readFileSync(file, 'utf-8')
    const fm = parseFrontmatter(content)

    if (RESERVED.has(name)) {
      // §6/§7 — soft. An index.md carries no frontmatter except the bundle-root's,
      // which MAY declare only `okf_version` (§11). Warn (never fail) on extras.
      if (name === 'index.md' && fm) {
        const keys = Object.keys(fm.fields)
        if (!(keys.length === 1 && keys[0] === 'okf_version')) {
          warnings.push(`${rel}: index.md should carry no frontmatter except a bundle-root okf_version. Found: [${keys.join(', ') || 'empty'}]`)
        }
      }
      if (name === 'log.md') {
        const bad = content.split(/\r?\n/).filter((l) => /^##\s+/.test(l)).find((l) => !/^##\s+\d{4}-\d{2}-\d{2}\s*$/.test(l))
        if (bad) warnings.push(`${rel}: log.md date headings should be ISO '## YYYY-MM-DD' (found "${bad.trim()}")`)
      }
      continue
    }

    // Non-reserved .md = a concept. HARD requirements (§9.1, §9.2).
    conceptCount++
    if (!fm) {
      errors.push(`${rel}: missing or unparseable YAML frontmatter block (§9.1)`)
      continue
    }
    if (!fm.fields.type) {
      errors.push(`${rel}: frontmatter has no non-empty \`type:\` field (§9.2)`)
      continue
    }
    if (staleCutoff != null && fm.fields.timestamp) {
      const t = Date.parse(fm.fields.timestamp)
      if (Number.isFinite(t) && t < staleCutoff) {
        warnings.push(`${rel}: stale — timestamp ${fm.fields.timestamp} is older than ${staleDays}d`)
      }
    }
  }
}

// ---- report ----
for (const w of warnings) console.warn(`okf-validate: WARN ${w}`)

if (errors.length) {
  for (const e of errors) console.error(`okf-validate: ERROR ${e}`)
  console.error(`\nokf-validate: FAIL — ${errors.length} violation(s) across ${conceptCount} concept(s) in [${roots.join(', ')}]`)
  process.exit(1)
}

console.log(
  `okf-validate: OK — ${conceptCount} concept(s) across [${roots.join(', ')}] conform to OKF v0.1 §9` +
    (warnings.length ? ` (${warnings.length} warning(s))` : '')
)
