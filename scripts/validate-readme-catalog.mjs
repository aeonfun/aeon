#!/usr/bin/env node
// validate-readme-catalog.mjs — parity checker between catalog/packs.json (the
// FIRST-PARTY pack catalog) and the places the README + docs restate it by hand.
//
// Why this gate exists: the README and docs/skill-packs.md carry catalog/packs.json
// data pasted in by hand - the "Full catalog" table (every pack's full skill
// list), the pack count ("Six skill packs, 85 skills total" in the README's packs
// image alt text, "Six packs, no empties" in docs/skill-packs.md), and the
// "all N skills by pack" caption. packs.json itself
// is already gated (ci-packs-json.yml regenerates it from SKILL.md frontmatter),
// but NOTHING checked that the README kept up. So a new skill lands, packs.json
// regenerates in the same PR, CI is green — and the README's full-catalog table
// silently omits it. That is not hypothetical: docs/CONFIGURATION.md drifted the
// exact same way (a featured MCP server was added to the catalog but never to the
// doc's list).
//
// This is the first-party sibling of validate-skill-packs.mjs, which does the
// same README-parity job for the COMMUNITY registry (catalog/skill-packs.json)
// and its "N community skill packs" counter. The two deliberately don't overlap:
// that one owns the "## Community Packs" 3-column table, this one owns the
// first-party full-catalog (2-column) table. Together
// with ci-packs-json.yml / ci-skills-json.yml (which gate the JSON itself), every
// place the skill catalog is written down is now drift-checked.
//
// What it enforces (all hard failures):
//   1. (retired) The README's 4-column "| Pack | Key | Skills | Examples |"
//      summary table was replaced by an image; nothing restates per-pack counts
//      in a table any more, so that check was removed rather than left warning.
//   2. FULL CATALOG   (<details> | Pack | Skills |) - every pack row's `(key, N)`
//      count matches, and its backtick-listed slug SET equals packs.json exactly
//      (a missing/added/renamed skill is the failure this is really here for).
//   3. HEADLINE COUNTS - every pack-count phrase (PACK_COUNT_PATTERNS below)
//      == total_packs, and "all N skills by pack" == total_skills.
//   Each of 2-3 must match in at least one checked file: if a reword or a moved
//   table leaves a check with nothing to verify, the run FAILS (retarget the
//   check here) instead of passing as a silent no-op.
//
//   4. SKILL COUNTS  - every "N skills" / "N+ skills" claim and every
//      "all-N-skills-by-pack" link anchor, in the README and the docs/assets
//      that repeat the total (docs/skill-packs.md, docs/aeon-setup.md,
//      docs/examples/README.md, the hero SVG), must equal total_skills. A
//      rounded "60+ skills" always fails; that floor is how these drifted.
//
// Sections 2-3 run over every Markdown file in that list, so the full-catalog
// table that moved from the README to docs/skill-packs.md is checked there.
//
// Deliberately NOT enforced: the packs' prose descriptions, the README packs
// image itself, and the "shown by default" annotations (editorial, not derivable from packs.json), and the exact
// slug ORDER in the full-catalog table (set equality is what matters).
//
// Usage:
//   node scripts/validate-readme-catalog.mjs
//   node scripts/validate-readme-catalog.mjs --packs <path> --readme <path>   # fixture overrides, for tests
//   node scripts/validate-readme-catalog.mjs ... --docs <path>,<path>         # extra files to check (fixtures)
//
// Exit 1 on any violation; exit 0 (with `validate-readme-catalog: OK`) otherwise.

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// ---- args ----
const args = process.argv.slice(2)
const opt = (flag, fallback) => {
  const i = args.indexOf(flag)
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback
}
const PACKS = opt('--packs', resolve(ROOT, 'catalog/packs.json'))
const README = opt('--readme', resolve(ROOT, '.github/README.md'))
// Other committed files that restate the catalog (tables, "N skills" counts,
// the "all-N-skills-by-pack" anchor). --docs a,b,c overrides the list; a
// fixture run that passes --readme without --docs checks the README alone.
const DEFAULT_DOCS = [
  'docs/skill-packs.md',
  'docs/aeon-setup.md',
  'docs/examples/README.md',
  'docs/assets/hero-animated.svg',
].map((p) => resolve(ROOT, p))
const docsArg = opt('--docs', null)
const DOCS = docsArg !== null
  ? docsArg.split(',').filter(Boolean).map((p) => resolve(p))
  : args.includes('--readme') ? [] : DEFAULT_DOCS
const FILES = [README, ...DOCS]

const errors = []
const warnings = []
const err = (m) => errors.push(m)
const warn = (m) => warnings.push(m)

const done = (summary) => {
  for (const w of warnings) console.warn(`validate-readme-catalog: WARN ${w}`)
  if (errors.length) {
    for (const e of errors) console.error(`::error::validate-readme-catalog: ${e}`)
    console.error('')
    console.error(`validate-readme-catalog: FAIL — ${errors.length} violation(s).`)
    console.error('The README/docs skill tables and counts mirror catalog/packs.json (regenerated by bin/generate-packs-json).')
    console.error('Update the flagged file(s) to match, then re-run: node scripts/validate-readme-catalog.mjs')
    process.exit(1)
  }
  console.log(`validate-readme-catalog: OK — ${summary}` + (warnings.length ? ` (${warnings.length} warning(s))` : ''))
  process.exit(0)
}

// number word -> value, enough to cover any plausible pack count.
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']

// Phrases that restate the whole-catalog pack count; group 1 is the number word.
// Anchored on the surrounding words so per-subset prose ("Three packs are shown
// by default") is never read as a total.
const PACK_COUNT_PATTERNS = [
  /\*\*(\w+)\s+packs ship in the box\*\*/gi, // hero line ("**Six packs ship in the box**")
  /\b(\w+)\s+skill packs,\s*\d+\s+skills total/gi, // README packs image alt text
  /\b(\w+)\s+packs,\s*no empties/gi, // docs/skill-packs.md "Pack key = category" line
]

// ---- load the first-party catalog ----
if (!existsSync(PACKS)) {
  console.error(`::error::validate-readme-catalog: packs catalog not found at ${PACKS}`)
  process.exit(1)
}
let packs
try {
  packs = JSON.parse(readFileSync(PACKS, 'utf8'))
} catch (e) {
  console.error(`::error::validate-readme-catalog: ${PACKS} is not valid JSON: ${e.message}`)
  process.exit(1)
}
if (!Array.isArray(packs?.packs)) {
  console.error(`::error::validate-readme-catalog: ${PACKS} has no \`packs\` array`)
  process.exit(1)
}

// key -> { count, slugs:Set }, in catalog order for stable messages.
const catalog = new Map()
for (const p of packs.packs) {
  if (typeof p?.key !== 'string') continue
  const slugs = Array.isArray(p.skills) ? p.skills.map((s) => (typeof s === 'string' ? s : s?.slug)).filter(Boolean) : []
  catalog.set(p.key, { count: slugs.length, slugs: new Set(slugs) })
}
const totalPacks = typeof packs.total_packs === 'number' ? packs.total_packs : catalog.size
const totalSkills = typeof packs.total_skills === 'number'
  ? packs.total_skills
  : [...catalog.values()].reduce((n, p) => n + p.count, 0)

const cellsOf = (line) => line.split('|').slice(1, -1).map((c) => c.trim())
const isSeparator = (line) => /^\|[\s:|-]+\|$/.test(line)

// Which of the table/headline checks found their target in at least one file.
// A check that matched nowhere warns once instead of once per file.
const found = { full: false, packsWord: false, allN: false }

// Sections 2-3 run over every Markdown file (the README plus the docs that took
// over its tables, e.g. docs/skill-packs.md's full catalog). Each file gets the
// same checks; a table/caption that isn't in a given file is simply skipped.
function checkMarkdown(file) {
  const where = rel(file)
  const text = readFileSync(file, 'utf8')
  const lines = text.split(/\r?\n/)

  // Find the data rows of the first table whose header matches `headerRe`, at or
  // after line index `from`. Returns [{cells, line}], or null if no such header.
  function tableRows(headerRe, from = 0) {
    const h = lines.slice(from).findIndex((l) => headerRe.test(l))
    if (h === -1) return null
    const header = from + h
    const rows = []
    for (let i = header + 1; i < lines.length; i++) {
      const line = lines[i]
      if (!line.startsWith('|')) break
      if (isSeparator(line)) continue
      rows.push({ cells: cellsOf(line), line: i + 1 })
    }
    return rows
  }

  // ---- 2. full-catalog table: | Pack | Skills | ----
  // Anchored after the "Full catalog" heading/summary so the 2-column header
  // can't be confused with the 4-column summary table above it.
  const detailsAt = lines.findIndex((l) => /Full catalog/i.test(l))
  const full = tableRows(/^\|\s*Pack\s*\|\s*Skills\s*\|\s*$/i, detailsAt === -1 ? 0 : detailsAt)
  if (full) {
    found.full = true
    const seen = new Set()
    for (const { cells, line } of full) {
      if (cells.length < 2) continue
      const m = cells[0].match(/\(`([a-z0-9-]+)`,\s*(\d+)\)/i)
      if (!m) {
        err(`full-catalog row has no \`(\`key\`, N)\` marker - "${cells[0]}" (${where}:${line})`)
        continue
      }
      const key = m[1]
      if (!catalog.has(key)) {
        err(`full-catalog table lists pack \`${key}\` which is not in ${rel(PACKS)} (${where}:${line})`)
        continue
      }
      seen.add(key)
      const cat = catalog.get(key)
      const claimed = Number.parseInt(m[2], 10)
      if (claimed !== cat.count) {
        err(`full-catalog table says \`${key}\` has ${claimed} skills but the catalog has ${cat.count} (${where}:${line})`)
      }
      const listed = new Set([...cells[1].matchAll(/`([^`]+)`/g)].map((mm) => mm[1]))
      const missing = [...cat.slugs].filter((s) => !listed.has(s))
      const extra = [...listed].filter((s) => !cat.slugs.has(s))
      if (missing.length) err(`full-catalog table for \`${key}\` is missing: ${missing.join(', ')} (${where}:${line})`)
      if (extra.length) err(`full-catalog table for \`${key}\` lists skills not in the pack: ${extra.join(', ')} (${where}:${line})`)
    }
    for (const key of catalog.keys()) {
      if (!seen.has(key)) err(`full-catalog table in ${where} is missing a row for pack \`${key}\``)
    }
  }

  // ---- 3. headline counts (enforced only when present + parseable) ----
  const expectedWord = NUMBER_WORDS[totalPacks] ?? String(totalPacks)
  for (const re of PACK_COUNT_PATTERNS) {
    for (const m of text.matchAll(re)) {
      found.packsWord = true
      const phrase = m[0].replace(/\*\*/g, '')
      const at = `${where}:${lineAt(text, m.index)}`
      const val = NUMBER_WORDS.indexOf(m[1].toLowerCase())
      if (val === -1) {
        warn(`${at} says "${phrase}" - can't map that number word; expected "${expectedWord}"`)
      } else if (val !== totalPacks) {
        err(`${at} says "${phrase}" but the catalog has ${totalPacks} pack(s) - reword to "${expectedWord}"`)
      }
    }
  }

  for (const m of text.matchAll(/all\s+(\d+)\s+skills by pack/gi)) {
    found.allN = true
    if (Number(m[1]) !== totalSkills) {
      err(`caption says "all ${m[1]} skills by pack" but the catalog has ${totalSkills} - update it (${where}:${lineAt(text, m.index)})`)
    }
  }
}

// ---- 4. whole-catalog skill counts in prose, alt text and images ----
// "60+ skills across 9 harnesses", "Aeon ships **85 skills**", the hero SVG's
// "85 skills" bubble, and the "#full-catalog-all-N-skills-by-pack" anchor all
// restate catalog.total_skills by hand. Rules:
//   - "N+ skills" always fails: a rounded floor is exactly how these drifted
//     (it said 60+ while the catalog was 85). Write the exact count.
//   - "N skills" fails when N is bigger than the largest pack (so it can only be
//     a whole-catalog claim) and isn't the real total. Smaller numbers are
//     per-pack or example prose ("the 12 Core skills", "2 skills") and are left
//     alone. "all N skills by pack" is owned by section 3 above.
//   - Any "all-N-skills-by-pack" link anchor must use the real total, or the
//     link silently stops resolving when the heading is updated.
const maxPack = Math.max(0, ...[...catalog.values()].map((p) => p.count))
function checkCounts(file) {
  const where = rel(file)
  const text = readFileSync(file, 'utf8')
  for (const m of text.matchAll(/(?<!all\s)\b(\d+)(\+?)\s+skills\b/gi)) {
    const n = Number(m[1])
    const at = `${where}:${lineAt(text, m.index)}`
    if (m[2]) {
      err(`"${m[0]}" is a rounded count - write the exact catalog total "${totalSkills} skills" (${at})`)
    } else if (n > maxPack && n !== totalSkills) {
      err(`"${m[0]}" but the catalog has ${totalSkills} skills - update the count (${at})`)
    }
  }
  for (const m of text.matchAll(/all-(\d+)-skills-by-pack/gi)) {
    if (Number(m[1]) !== totalSkills) {
      err(`link anchor "${m[0]}" is stale - the heading is "all ${totalSkills} skills by pack" (${where}:${lineAt(text, m.index)})`)
    }
  }
}

function lineAt(text, index) {
  return text.slice(0, index).split('\n').length
}

function rel(p) {
  return p.startsWith(ROOT) ? p.slice(ROOT.length + 1) : p
}

for (const file of FILES) {
  if (!existsSync(file)) {
    err(`${rel(file)} not found - drop it from the checked files in scripts/validate-readme-catalog.mjs if it moved`)
    continue
  }
  if (file.endsWith('.md')) checkMarkdown(file)
  checkCounts(file)
}

// A check whose target vanished (reworded caption, moved table) must fail loudly,
// not pass as a no-op: retarget it above to wherever the data lives now.
const retarget = 'retarget the check in scripts/validate-readme-catalog.mjs'
if (!found.full) err(`no "Full catalog" | Pack | Skills | table in any checked file - full-catalog parity has nothing to check; ${retarget}`)
if (!found.packsWord) err(`no pack-count phrase (PACK_COUNT_PATTERNS) in any checked file - pack-count parity has nothing to check; ${retarget}`)
if (!found.allN) err(`no "all N skills by pack" caption in any checked file - skill-count parity has nothing to check; ${retarget}`)

done(`${totalPacks} pack(s) / ${totalSkills} skill(s) match the tables and skill counts in ${FILES.map(rel).join(', ')}`)
