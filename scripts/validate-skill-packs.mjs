#!/usr/bin/env node
// validate-skill-packs.mjs — conformance checker for catalog/skill-packs.json,
// the community pack registry, and its parity with the README's Community Packs
// table.
//
// Why this gate exists: skill-packs.json is the ONE file in the repo that is
// routinely edited by people outside it — every pack listing lands as an
// outside-contributor PR that hand-edits JSON (see docs/community-skill-packs.md
// "publishing checklist"). Nothing validated it. A trailing comma, a `skill:`
// typo, or a README row without a registry entry ships to main and breaks
// `bin/install-skill-pack --list` (it jq's this file) and the dashboard's
// community-packs panel (apps/dashboard/lib/packs.ts) for everyone.
//
// Two classes of check, both hard failures:
//
//   1. REGISTRY SHAPE — the fields `--list` and the dashboard actually read:
//      parseable JSON, `repo` as owner/repo, a non-empty unique `skills[]`,
//      `trust_level` in the enum, `capabilities[]` inside the LOCKED taxonomy
//      (read out of bin/install-skill-pack so it can never drift from the
//      installer — cf. scripts/check-capabilities-parity.sh, Issue #301).
//
//   2. README PARITY — every registry entry has a table row and vice versa,
//      with matching skill counts and matching `--path` flags. The publishing
//      checklist asks for both surfaces in one diff; this is what enforces it.
//      A row whose `--path` is missing hands browsers a copy-paste CLI command
//      that installs the wrong subtree, so path parity is an error, not a nit.
//
// One security-relevant check: `trust_level: trusted` is only honest if the repo
// is actually in skills/security/trusted-sources.txt. `--list` prints its badge
// from the registry (install-skill-pack:176) but decides the real scan bypass
// from the trusted-sources file (install-skill-pack:524) — so a self-declared
// `trusted` entry advertises "security scan skipped" without ever earning it.
//
// Deliberately NOT enforced (over-conformance would fight contributors for no
// tooling benefit): `category` vocabulary — the registry's is open and already
// carries values the per-skill list doesn't have (`messaging`, `memory`); prose
// style; whether `homepage` resolves. Missing recommended fields are warnings.
//
// Usage:
//   node scripts/validate-skill-packs.mjs
//   node scripts/validate-skill-packs.mjs --registry <path> --readme <path> \
//        --installer <path> --trusted <path>     # fixture overrides, for tests
//
// Exit 1 on any violation; exit 0 (with `validate-skill-packs: OK`) otherwise.

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
const REGISTRY = opt('--registry', resolve(ROOT, 'catalog/skill-packs.json'))
const README = opt('--readme', resolve(ROOT, '.github/README.md'))
const INSTALLER = opt('--installer', resolve(ROOT, 'bin/install-skill-pack'))
const TRUSTED = opt('--trusted', resolve(ROOT, 'skills/security/trusted-sources.txt'))

const errors = []
const warnings = []
const err = (m) => errors.push(m)
const warn = (m) => warnings.push(m)

const done = (summary) => {
  for (const w of warnings) console.warn(`validate-skill-packs: WARN ${w}`)
  if (errors.length) {
    for (const e of errors) console.error(`::error::validate-skill-packs: ${e}`)
    console.error('')
    console.error(`validate-skill-packs: FAIL — ${errors.length} violation(s).`)
    console.error('Registry schema and the publishing checklist: docs/community-skill-packs.md')
    console.error('Run locally: node scripts/validate-skill-packs.mjs')
    process.exit(1)
  }
  console.log(`validate-skill-packs: OK — ${summary}` + (warnings.length ? ` (${warnings.length} warning(s))` : ''))
  process.exit(0)
}

// ---- the locked capability taxonomy, read from the installer ----
// Source of truth is ALLOWED_CAPABILITIES in bin/install-skill-pack; parsing it
// here means a taxonomy change lands in one place and this gate follows.
function loadCapabilities() {
  if (!existsSync(INSTALLER)) {
    warn(`installer not found at ${INSTALLER} — capability taxonomy unchecked`)
    return null
  }
  const m = readFileSync(INSTALLER, 'utf8').match(/ALLOWED_CAPABILITIES=\(([^)]*)\)/)
  if (!m) {
    warn('could not parse ALLOWED_CAPABILITIES from the installer — capability taxonomy unchecked')
    return null
  }
  const caps = m[1].split(/\s+/).map((s) => s.trim()).filter(Boolean)
  return caps.length ? caps : null
}

// ---- trusted sources (owner or owner/repo, one per line) ----
function loadTrusted() {
  if (!existsSync(TRUSTED)) return null
  return new Set(
    readFileSync(TRUSTED, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
  )
}
const isTrusted = (trusted, repo) => trusted.has(repo) || trusted.has(repo.split('/')[0])

// ---- README Community Packs table ----
// Rows look like:
//   | [name](https://github.com/owner/repo) | 2 | Description. |
//   | [name](https://github.com/owner/repo/tree/main/sub) (`--path sub`) | 3 | … |
// Anchored to the "## Community Packs" heading and the 3-column header, because
// the README also carries a 2-column `| Pack | Skills |` table for the
// first-party packs earlier in the file.
function parseReadmeTable(text) {
  const lines = text.split(/\r?\n/)
  const section = lines.findIndex((l) => /^#+\s+Community Packs\s*$/i.test(l))
  const from = section === -1 ? 0 : section
  const found = lines.slice(from).findIndex((l) => /^\|\s*Pack\s*\|\s*Skills\s*\|\s*Description\s*\|/i.test(l))
  if (found === -1) return null
  const header = from + found

  const rows = []
  for (let i = header + 2; i < lines.length; i++) {
    const line = lines[i]
    if (!line.startsWith('|')) break
    const cells = line.split('|').slice(1, -1).map((c) => c.trim())
    if (cells.length < 3) continue

    const [pack, count] = cells
    const link = pack.match(/https:\/\/github\.com\/([A-Za-z0-9._-]+\/[A-Za-z0-9._-]+)((?:\/tree\/[^/)\s]+\/([^)\s]+))?)/)
    if (!link) {
      err(`README: Community Packs row has no github.com/<owner>/<repo> link — "${pack}"`)
      continue
    }
    const flag = pack.match(/--path\s+([^\s`)]+)/)
    rows.push({
      repo: link[1],
      // The copy-paste CLI flag wins; the /tree/ link path is the fallback.
      path: flag ? flag[1] : link[3] || '',
      hasFlag: Boolean(flag),
      treePath: link[3] || '',
      count: /^\d+$/.test(count) ? Number(count) : null,
      rawCount: count,
      line: i + 1,
    })
  }
  return rows
}

// ---- registry ----
if (!existsSync(REGISTRY)) {
  err(`registry not found at ${REGISTRY}`)
  done('')
}

let registry
try {
  registry = JSON.parse(readFileSync(REGISTRY, 'utf8'))
} catch (e) {
  err(`${REGISTRY} is not valid JSON — ${e.message}`)
  done('')
}

if (registry === null || typeof registry !== 'object' || Array.isArray(registry)) {
  err('registry root must be a JSON object')
  done('')
}
if (!Array.isArray(registry.packs)) {
  err('registry has no `packs` array')
  done('')
}
if (typeof registry.version !== 'string' || !registry.version) warn('registry has no `version` string')
if (typeof registry.updated !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(registry.updated)) {
  warn(`registry \`updated\` should be an ISO date (YYYY-MM-DD), got ${JSON.stringify(registry.updated)}`)
}

const ALLOWED_CAPS = loadCapabilities()
const trusted = loadTrusted()
const TRUST_LEVELS = ['trusted', 'community']
const KNOWN_FIELDS = new Set([
  'repo', 'path', 'name', 'description', 'author', 'license', 'homepage',
  'category', 'trust_level', 'skills', 'secrets_required', 'capabilities',
])

const seen = new Map()

registry.packs.forEach((pack, i) => {
  const at = `packs[${i}]`
  if (pack === null || typeof pack !== 'object' || Array.isArray(pack)) {
    err(`${at}: must be an object`)
    return
  }
  const id = typeof pack.repo === 'string' && pack.repo ? pack.repo : at

  // repo — required, owner/repo only (a URL or trailing path breaks the clone).
  if (typeof pack.repo !== 'string' || !pack.repo) {
    err(`${at}: missing required \`repo\` (owner/repo)`)
  } else if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(pack.repo)) {
    err(`${id}: \`repo\` must be "owner/repo" — no URL, no trailing slash, no subdirectory (put a subdirectory in \`path\`)`)
  } else {
    const key = `${pack.repo}#${pack.path ?? ''}`
    if (seen.has(key)) err(`${id}: duplicate entry — already listed at packs[${seen.get(key)}]`)
    else seen.set(key, i)
  }

  // skills — required, non-empty, unique slugs. `--list` prints the count and
  // the installer resolves each slug inside the pack repo.
  if (!Array.isArray(pack.skills) || pack.skills.length === 0) {
    err(`${id}: \`skills\` must be a non-empty array of slugs`)
  } else {
    const slugs = new Set()
    for (const s of pack.skills) {
      if (typeof s !== 'string' || !s) err(`${id}: \`skills\` contains a non-string entry (${JSON.stringify(s)})`)
      else if (!/^[a-z0-9][a-z0-9-]*$/.test(s)) err(`${id}: skill slug "${s}" must be lowercase kebab-case (it is a directory name under skills/)`)
      else if (slugs.has(s)) err(`${id}: skill slug "${s}" listed twice`)
      else slugs.add(s)
    }
  }

  // Recommended display fields — `--list` and the dashboard card degrade
  // without them, but nothing breaks.
  for (const f of ['name', 'description', 'author']) {
    if (pack[f] === undefined) warn(`${id}: no \`${f}\` — recommended (docs/community-skill-packs.md field reference)`)
    else if (typeof pack[f] !== 'string' || !pack[f].trim()) err(`${id}: \`${f}\` must be a non-empty string`)
  }
  for (const f of ['license', 'category', 'path']) {
    if (pack[f] !== undefined && (typeof pack[f] !== 'string' || !pack[f].trim())) {
      err(`${id}: \`${f}\` must be a non-empty string when present`)
    }
  }
  if (pack.path !== undefined && typeof pack.path === 'string' && /^\/|^\.\.|\/$/.test(pack.path)) {
    err(`${id}: \`path\` must be a repo-relative subdirectory (no leading "/", no "..", no trailing "/")`)
  }
  if (pack.homepage !== undefined && !/^https?:\/\/\S+$/.test(String(pack.homepage))) {
    err(`${id}: \`homepage\` must be an http(s) URL`)
  }

  // trust_level — enum, and `trusted` must be backed by trusted-sources.txt.
  if (pack.trust_level !== undefined) {
    if (!TRUST_LEVELS.includes(pack.trust_level)) {
      err(`${id}: \`trust_level\` must be one of ${TRUST_LEVELS.join('|')} (got ${JSON.stringify(pack.trust_level)})`)
    } else if (pack.trust_level === 'trusted' && trusted && typeof pack.repo === 'string' && !isTrusted(trusted, pack.repo)) {
      err(
        `${id}: declares \`trust_level: trusted\` but is not in skills/security/trusted-sources.txt — ` +
          '`--list` would badge it as scan-skipped without the installer ever honouring it'
      )
    }
  }

  // capabilities — the locked taxonomy (docs/CAPABILITIES.md).
  if (pack.capabilities !== undefined) {
    if (!Array.isArray(pack.capabilities)) {
      err(`${id}: \`capabilities\` must be an array`)
    } else if (ALLOWED_CAPS) {
      for (const c of pack.capabilities) {
        if (!ALLOWED_CAPS.includes(c)) {
          err(`${id}: unknown capability ${JSON.stringify(c)} — allowed: ${ALLOWED_CAPS.join(', ')} (docs/CAPABILITIES.md)`)
        }
      }
    }
  }

  // secrets_required — env var names; drives `--list --no-secrets`.
  if (pack.secrets_required !== undefined) {
    if (!Array.isArray(pack.secrets_required)) {
      err(`${id}: \`secrets_required\` must be an array`)
    } else {
      for (const s of pack.secrets_required) {
        if (typeof s !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(s)) {
          err(`${id}: \`secrets_required\` entry ${JSON.stringify(s)} must be an UPPER_SNAKE env var name`)
        }
      }
    }
  }

  // Unknown fields are almost always typos of a real one (`skill`, `capability`).
  for (const f of Object.keys(pack)) {
    if (!KNOWN_FIELDS.has(f)) warn(`${id}: unknown field \`${f}\` — typo? (known: ${[...KNOWN_FIELDS].join(', ')})`)
  }
})

// ---- README parity ----
if (!existsSync(README)) {
  warn(`README not found at ${README} — parity unchecked`)
} else {
  const readmeText = readFileSync(README, 'utf8')
  const rows = parseReadmeTable(readmeText)

  if (rows === null) {
    warn('README has no "| Pack | Skills | Description |" table — parity unchecked')
  } else {
    // A repo may legitimately appear more than once (a monorepo publishing two
    // packs from different subdirectories), so rows are matched on repo+path
    // first and fall back to the repo when it has exactly one row — that
    // fallback is what lets the path checks below report a useful mismatch
    // instead of a bare "no README row".
    const rowsByRepo = new Map()
    for (const r of rows) {
      if (!rowsByRepo.has(r.repo)) rowsByRepo.set(r.repo, [])
      rowsByRepo.get(r.repo).push(r)
    }
    for (const [repo, group] of rowsByRepo) {
      const paths = new Set(group.map((r) => r.path))
      if (paths.size !== group.length) {
        err(`${repo}: listed twice in the README Community Packs table with the same path (README:${group.map((r) => r.line).join(', ')})`)
      }
    }

    const claimed = new Set()
    const registryRepos = new Set()

    for (const pack of registry.packs) {
      if (typeof pack?.repo !== 'string' || !pack.repo) continue
      registryRepos.add(pack.repo)
      const group = rowsByRepo.get(pack.repo) ?? []
      const wantPath = typeof pack.path === 'string' ? pack.path : ''
      const row = group.find((r) => r.path === wantPath) ?? (group.length === 1 ? group[0] : undefined)
      if (row) claimed.add(row)
      if (!row) {
        err(`${pack.repo}: in the registry but has no row in the README Community Packs table — the publishing checklist asks for both in one diff`)
        continue
      }
      const count = Array.isArray(pack.skills) ? pack.skills.length : null
      if (row.count === null) {
        err(`${pack.repo}: README row Skills column is not a number ("${row.rawCount}", README:${row.line})`)
      } else if (count !== null && row.count !== count) {
        err(`${pack.repo}: README says ${row.count} skill(s) but the registry lists ${count} (README:${row.line})`)
      }

      if (wantPath && !row.hasFlag) {
        err(`${pack.repo}: registry \`path: "${wantPath}"\` but the README row shows no (\`--path ${wantPath}\`) — the copy-paste command would install the wrong subtree (README:${row.line})`)
      } else if (wantPath !== row.path) {
        err(`${pack.repo}: registry \`path\` is ${JSON.stringify(wantPath)} but the README row says ${JSON.stringify(row.path)} (README:${row.line})`)
      } else if (row.treePath && row.treePath !== wantPath) {
        err(`${pack.repo}: README link points into /tree/…/${row.treePath} but the registry \`path\` is ${JSON.stringify(wantPath)} (README:${row.line})`)
      }
    }

    // Matched on the row object, not the repo: a monorepo with two rows and one
    // registry entry leaves the second row genuinely unlisted.
    for (const row of rows) {
      if (claimed.has(row)) continue
      const hint = registryRepos.has(row.repo) ? ` — the registry has no entry for this repo at path ${JSON.stringify(row.path)}` : ''
      err(`${row.repo}: has a README Community Packs row but no entry in catalog/skill-packs.json (README:${row.line})${hint} — \`bin/install-skill-pack --list\` and the dashboard would not show it`)
    }

    // The proof-of-work counter drifts every time a pack lands. Only enforced
    // when the sentence is present and parseable, so a reword can't false-fail.
    const counter = readmeText.match(/\*\*(\d+)\s+community skill packs\*\*/)
    if (!counter) {
      warn('README has no "**N community skill packs**" counter — count parity unchecked')
    } else if (Number(counter[1]) !== registry.packs.length) {
      err(`README claims "${counter[1]} community skill packs" but the registry lists ${registry.packs.length} — update the Proof of work line`)
    }
  }
}

done(`${registry.packs.length} pack(s) in the registry conform and match the README table`)
