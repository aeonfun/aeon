#!/usr/bin/env node
// gen-agents-md.js — generate a MINIMAL AGENTS.md carrying STRATEGY.md for grok.
//
// Why this file is tiny (and used to be a full copy of CLAUDE.md):
//
// The Grok Build (`grok`) harness reads BOTH `AGENTS.md` and `CLAUDE.md` as
// standing instructions — a directory that holds both contributes both (verified
// with `grok inspect`). Grok reads `CLAUDE.md` natively via its Claude-compat
// discovery, so duplicating the whole operating manual into AGENTS.md just
// double-loaded ~2.5k tokens of near-identical text on every grok run.
//
// The ONE thing CLAUDE.md can't deliver to grok is STRATEGY.md: CLAUDE.md pulls
// it via the Claude-Code-specific `@STRATEGY.md` import, and grok does not expand
// `@`-imports (it loads each instruction file verbatim). So AGENTS.md now carries
// ONLY the strategy — the delta — and lets grok read the rest of the manual from
// CLAUDE.md. This keeps both harnesses behaviour-identical at ~1/12th the tokens.
//
// AGENTS.md is committed (grok reads it from the checkout), so regenerate it
// whenever STRATEGY.md changes:
//
//   node scripts/gen-agents-md.js          # write AGENTS.md
//   node scripts/gen-agents-md.js --check  # verify it's up to date (CI/parity)
//
// Exit 1 in --check mode if AGENTS.md is stale or missing.

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const strategyPath = path.join(root, 'STRATEGY.md')
const outPath = path.join(root, 'AGENTS.md')

const BANNER = `<!-- AUTO-GENERATED from STRATEGY.md by scripts/gen-agents-md.js. Do not edit by hand.
     Grok (the grok harness) loads BOTH this file and CLAUDE.md as standing
     instructions and reads CLAUDE.md natively, so the full operating manual lives
     in CLAUDE.md — NOT duplicated here. This file carries only STRATEGY.md, which
     CLAUDE.md delivers to Claude Code via the \`@STRATEGY.md\` import that grok does
     not expand. Edit STRATEGY.md and re-run the generator to update it. -->
`

const PREAMBLE = `# Strategy (Grok harness)

Grok already loads Aeon's full operating manual from \`CLAUDE.md\` (how Aeon works,
memory, tools, capability mode, security, output). This file adds only the
operator's strategy below — the north-star \`CLAUDE.md\` references as \`@STRATEGY.md\`,
which grok does not expand. Read it at the start of every task and let it break
ties; absorb it, don't quote it.
`

function build() {
  const strategy = fs.readFileSync(strategyPath, 'utf8').trim()
  return `${BANNER}\n${PREAMBLE}\n${strategy}\n`
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
