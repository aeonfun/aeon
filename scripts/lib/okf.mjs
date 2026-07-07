// okf.mjs — shared primitives for Aeon's OKF-native scripts (okf-index /
// okf-validate / okf-backfill): reserved names, the markdown walk, YAML-frontmatter
// parsing, and the okf-config.json location. Behavior-identical to the per-script
// copies it replaces — one home so the three can't drift.

import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Reserved OKF files that are never concepts (§6/§7).
export const RESERVED = new Set(['index.md', 'log.md'])

// scripts/okf-config.json, resolved from this lib's location (scripts/lib/).
export const CONFIG_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'okf-config.json')

// Build an exclude predicate from a list of repo-relative path prefixes.
export const makeIsExcluded = (exclude = []) => (p) =>
  exclude.some((ex) => p === ex || p.startsWith(ex + '/'))

// Recursively collect .md files under `dir`, skipping anything `isExcluded` rejects.
// A missing/unreadable dir yields []. Omit the predicate to include everything.
export function walk(dir, isExcluded = () => false) {
  let out = []
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const p = join(dir, e.name)
    if (isExcluded(p)) continue
    if (e.isDirectory()) out = out.concat(walk(p, isExcluded))
    else if (e.isFile() && e.name.endsWith('.md')) out.push(p)
  }
  return out
}

// Parse a leading `--- … ---` YAML frontmatter block (§4.1; tolerates a BOM).
// Returns { fields } with the scalar key→value map, or null when there is no block.
export function parseFrontmatter(content) {
  const text = content.replace(/^﻿/, '')
  const m = text.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/)
  if (!m) return null
  const fields = {}
  for (const line of m[1].split(/\r?\n/)) {
    const km = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/)
    if (km) fields[km[1]] = (km[2] ?? '').trim().replace(/^['"]|['"]$/g, '').trim()
  }
  return { fields }
}

// Load scripts/okf-config.json (throws if missing/invalid — callers that want a
// fallback wrap this in try/catch).
export function loadConfig() {
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
}
