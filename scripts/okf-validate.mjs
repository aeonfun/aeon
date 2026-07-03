#!/usr/bin/env node
// okf-validate.mjs — conformance checker for Aeon's OKF-native knowledge bundle.
//
// Aeon speaks the Open Knowledge Format (OKF v0.1) *natively*: memory/topics/ IS
// the bundle (no separate knowledge/ dir). This validator enforces the ONE hard
// requirement of the spec (§9) and nothing stricter:
//
//   1. Every non-reserved .md file has a parseable YAML frontmatter block.
//   2. Every frontmatter block has a non-empty `type:` field.
//   3. Reserved files (index.md, log.md) follow their §6/§7 shape *when present*.
//
// Deliberately NOT enforced (the spec forbids over-conformance — a stricter bar
// would fight Aeon's own non-deterministic agents): unknown `type:` values,
// missing optional fields (title/description/timestamp/…), broken cross-links.
// Those are soft guidance, surfaced at most as warnings.
//
// Usage:
//   node scripts/okf-validate.mjs [root]            # default root: memory/topics
//   node scripts/okf-validate.mjs [root] --stale N  # also WARN on concepts whose
//                                                     # timestamp: is older than N days
//
// Exit 1 on any §9 hard violation; exit 0 (with `okf-validate: OK`) otherwise.
// Warnings never change the exit code.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, basename } from 'node:path'

const RESERVED = new Set(['index.md', 'log.md'])

// ---- args ----
const rawArgs = process.argv.slice(2)
let root = 'memory/topics'
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
    root = a
  }
}

// ---- fs walk ----
function walk(dir) {
  let out = []
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out = out.concat(walk(p))
    else if (e.isFile() && e.name.endsWith('.md')) out.push(p)
  }
  return out
}

// ---- frontmatter ----
// Strip a leading BOM, then match a leading `--- ... ---` block per OKF §4.1
// (frontmatter is delimited by `---` on its own line at the START of the file).
function parseFrontmatter(content) {
  const text = content.replace(/^﻿/, '')
  const m = text.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/)
  if (!m) return null
  const block = m[1]
  const fields = {}
  for (const line of block.split(/\r?\n/)) {
    const km = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/)
    if (km) fields[km[1]] = unquote(km[2])
  }
  return { block, fields }
}

function unquote(v) {
  return (v ?? '').trim().replace(/^['"]|['"]$/g, '').trim()
}

// ---- validation ----
const errors = []
const warnings = []
const files = walk(root).sort()
let conceptCount = 0

const staleCutoff =
  staleDays != null ? Date.now() - staleDays * 24 * 60 * 60 * 1000 : null

for (const file of files) {
  const rel = relative(process.cwd(), file)
  const name = basename(file)
  const content = readFileSync(file, 'utf-8')
  const fm = parseFrontmatter(content)

  if (RESERVED.has(name)) {
    // §6 / §7 structure — soft. index.md carries no frontmatter except the
    // bundle-root, which MAY declare only `okf_version` (§11).
    if (name === 'index.md' && fm) {
      const isBundleRoot = rel === join(root, 'index.md') || file === join(root, 'index.md')
      const keys = Object.keys(fm.fields)
      const onlyOkfVersion = keys.length === 1 && keys[0] === 'okf_version'
      if (!isBundleRoot || !onlyOkfVersion) {
        warnings.push(
          `${rel}: index.md should carry no frontmatter (only the bundle-root index.md may declare okf_version). Found: [${keys.join(', ') || 'empty'}]`
        )
      }
    }
    if (name === 'log.md') {
      const badHeading = content
        .split(/\r?\n/)
        .filter(l => /^##\s+/.test(l))
        .find(l => !/^##\s+\d{4}-\d{2}-\d{2}\s*$/.test(l))
      if (badHeading) {
        warnings.push(`${rel}: log.md date headings should be ISO '## YYYY-MM-DD' (found "${badHeading.trim()}")`)
      }
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

  // Staleness — soft, opt-in via --stale.
  if (staleCutoff != null && fm.fields.timestamp) {
    const t = Date.parse(fm.fields.timestamp)
    if (Number.isFinite(t) && t < staleCutoff) {
      warnings.push(`${rel}: stale — timestamp ${fm.fields.timestamp} is older than ${staleDays}d`)
    }
  }
}

// ---- report ----
for (const w of warnings) console.warn(`okf-validate: WARN ${w}`)

if (errors.length) {
  for (const e of errors) console.error(`okf-validate: ERROR ${e}`)
  console.error(`\nokf-validate: FAIL — ${errors.length} violation(s) across ${conceptCount} concept(s) in ${root}/`)
  process.exit(1)
}

console.log(
  `okf-validate: OK — ${conceptCount} concept(s) in ${root}/ conform to OKF v0.1 §9` +
    (warnings.length ? ` (${warnings.length} warning(s))` : '')
)
