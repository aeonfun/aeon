#!/usr/bin/env node
// okf-backfill.mjs — stamp a `type:` onto every in-scope markdown file that lacks
// one, so Aeon's real files are OKF v0.1 conformant IN PLACE (no duplicate copy).
//
// Type per file family comes from scripts/okf-config.json → backfill_rules (first
// match wins). Idempotent: a file that already has a non-empty `type:` is left
// untouched, as are reserved index.md/log.md and anything under `exclude`.
//
// For a file that already has frontmatter (SKILL.md, Jekyll docs), `type:` is
// inserted as the first field. For a file with none, a minimal `--- type: X ---`
// block is prepended — nothing else is disturbed.
//
// Usage:
//   node scripts/okf-backfill.mjs          # apply
//   node scripts/okf-backfill.mjs --dry     # preview only

import { readFileSync, writeFileSync } from 'node:fs'
import { relative, basename } from 'node:path'
import { RESERVED, walk, makeIsExcluded, loadConfig } from './lib/okf.mjs'

const dry = process.argv.includes('--dry')

const cfg = loadConfig()
const roots = cfg.roots ?? []
const exclude = cfg.exclude ?? []
const rules = cfg.backfill_rules ?? []

const isExcluded = makeIsExcluded(exclude)

// forward-slash relative path from repo root, for rule matching
const relPath = (p) => relative(process.cwd(), p).split('\\').join('/')

function ruleType(rel) {
  for (const r of rules) {
    const pathMatch = r.match.endsWith('/') ? rel.startsWith(r.match) : rel === r.match
    if (!pathMatch) continue
    if (r.name && basename(rel) !== r.name) continue // optional basename constraint
    return r.type
  }
  return null
}

const FM_OPEN = /^﻿?(---[ \t]*\r?\n)/
function hasType(content) {
  const m = content.replace(/^﻿/, '').match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---/)
  return m ? /^type:\s*\S/m.test(m[1]) : false
}

const changed = []
const seen = new Set()
for (const root of roots) {
  for (const file of walk(root, isExcluded)) {
    if (seen.has(file)) continue
    seen.add(file)
    if (RESERVED.has(basename(file))) continue
    const rel = relPath(file)
    const type = ruleType(rel)
    if (!type) continue // no rule → not our concern (e.g. memory/topics handled elsewhere)

    const content = readFileSync(file, 'utf-8')
    if (hasType(content)) continue // idempotent

    let next
    if (FM_OPEN.test(content)) {
      // existing frontmatter → insert type: as the first field
      next = content.replace(FM_OPEN, `$1type: ${type}\n`)
    } else {
      // no frontmatter → prepend a minimal block
      next = `---\ntype: ${type}\n---\n\n${content.replace(/^﻿/, '')}`
    }
    changed.push({ rel, type })
    if (!dry) writeFileSync(file, next)
  }
}

if (!changed.length) {
  console.log('okf-backfill: nothing to do — every in-scope file already carries a type:')
} else {
  for (const c of changed) console.log(`okf-backfill: ${dry ? 'would set' : 'set'} type: ${c.type.padEnd(9)} ${c.rel}`)
  console.log(`\nokf-backfill: ${dry ? 'would update' : 'updated'} ${changed.length} file(s)`)
}
