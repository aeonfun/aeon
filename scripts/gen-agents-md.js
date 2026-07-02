#!/usr/bin/env node
// gen-agents-md.js — generate AGENTS.md from CLAUDE.md + STRATEGY.md.
//
// Why: the Grok Build (`grok`) harness auto-loads AGENTS.md as its standing
// instructions the way Claude Code auto-loads CLAUDE.md. To make a skill behave
// identically on either harness, AGENTS.md must carry the SAME operating manual.
// CLAUDE.md pulls STRATEGY.md via the Claude-Code-specific `@STRATEGY.md` import,
// which grok does not honour, so we inline STRATEGY.md's contents here.
//
// AGENTS.md is committed (grok reads it from the checkout), so regenerate it
// whenever CLAUDE.md or STRATEGY.md changes:
//
//   node scripts/gen-agents-md.js          # write AGENTS.md
//   node scripts/gen-agents-md.js --check  # verify it's up to date (CI/parity)
//
// Exit 1 in --check mode if AGENTS.md is stale or missing.

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const claudePath = path.join(root, 'CLAUDE.md')
const strategyPath = path.join(root, 'STRATEGY.md')
const outPath = path.join(root, 'AGENTS.md')

const BANNER = `<!-- AUTO-GENERATED from CLAUDE.md + STRATEGY.md by scripts/gen-agents-md.js.
     Do not edit by hand — edit CLAUDE.md / STRATEGY.md and re-run the generator.
     This is Aeon's operating manual for the Grok Build (grok) harness; it mirrors
     CLAUDE.md, which Claude Code loads. Keep behaviour harness-agnostic. -->
`

function build() {
  const claude = fs.readFileSync(claudePath, 'utf8')
  const strategy = fs.readFileSync(strategyPath, 'utf8').trim()
  // Inline the `@STRATEGY.md` import (its own line) with STRATEGY.md's body.
  const inlined = claude.replace(
    /^@STRATEGY\.md$/m,
    `<!-- begin inlined STRATEGY.md -->\n${strategy}\n<!-- end inlined STRATEGY.md -->`,
  )
  return BANNER + '\n' + inlined
}

const generated = build()

if (process.argv.includes('--check')) {
  let current = ''
  try {
    current = fs.readFileSync(outPath, 'utf8')
  } catch {
    console.error('AGENTS.md is missing — run: node scripts/gen-agents-md.js')
    process.exit(1)
  }
  if (current !== generated) {
    console.error('AGENTS.md is out of date — run: node scripts/gen-agents-md.js')
    process.exit(1)
  }
  console.log('AGENTS.md is up to date')
  process.exit(0)
}

fs.writeFileSync(outPath, generated)
console.log(`Wrote ${path.relative(root, outPath)} (${generated.length} bytes)`)
