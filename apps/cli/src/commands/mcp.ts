import { parseArgs } from 'node:util'
import { getFileContent, saveFile } from '../../../dashboard/lib/github.ts'
import { MCP_CATALOG } from '../../../dashboard/lib/mcp-catalog.ts'
import type { McpServers, McpServer } from '../../../dashboard/lib/types.ts'
import { emit, table, c, fail, isDryRun } from '../output.ts'
import { printSync } from '../mutate.ts'

const USAGE = `aeon mcp — MCP servers wired into skill runs (.mcp.json)

  aeon mcp ls                       List configured servers
  aeon mcp catalog                  List the featured MCP catalog (one-click slugs)
  aeon mcp add <slug>               Add a featured server by catalog slug
  aeon mcp add <name> <url> [--sse] Add a custom HTTP/SSE server
  aeon mcp rm <name>                Remove a server

Options:
  --dry-run   Preview the change to .mcp.json
  --json      Machine-readable output`

async function readServers(): Promise<McpServers> {
  try {
    const { content } = await getFileContent('.mcp.json')
    const parsed = JSON.parse(content) as { mcpServers?: McpServers }
    return parsed.mcpServers ?? {}
  } catch { return {} }
}

async function writeServers(servers: McpServers, message: string) {
  const content = JSON.stringify({ mcpServers: servers }, null, 2) + '\n'
  return saveFile('.mcp.json', content, { updateMsg: message, createMsg: message })
}

export async function mcpCommand(argv: string[]) {
  const sub = argv[0] && !argv[0].startsWith('-') ? argv[0] : 'ls'
  if (sub === 'help' || argv.includes('-h') || argv.includes('--help')) { console.log(USAGE); return }
  switch (sub) {
    case 'ls': return list()
    case 'catalog': return catalog()
    case 'add': return add(argv.slice(1))
    case 'rm': return remove(argv.slice(1))
    default: fail(`unknown subcommand: ${sub}\n\n${USAGE}`)
  }
}

async function list() {
  const servers = await readServers()
  const names = Object.keys(servers)
  emit(servers, () => {
    if (!names.length) { console.log(c.dim('(no servers configured — see `aeon mcp catalog`)')); return }
    table(['NAME', 'TRANSPORT', 'ENDPOINT'], names.map(n => {
      const s = servers[n]
      return [n, s.type || (s.command ? 'stdio' : 'http'), s.url || s.command || '']
    }))
  })
}

function catalog() {
  emit(MCP_CATALOG, () => {
    table(['SLUG', 'NAME', 'URL'], MCP_CATALOG.map(e => [e.slug, e.name, e.url]))
  })
}

async function add(args: string[]) {
  const { values, positionals } = parseArgs({ args, options: {
    sse: { type: 'boolean' }, header: { type: 'string', multiple: true },
  }, allowPositionals: true })

  const servers = await readServers()
  let name: string
  let server: McpServer

  if (positionals.length === 1) {
    // Featured catalog slug.
    const entry = MCP_CATALOG.find(e => e.slug === positionals[0])
    if (!entry) fail(`unknown catalog slug: ${positionals[0]} (see \`aeon mcp catalog\`), or pass <name> <url>`)
    name = entry.slug
    server = { type: entry.transport || 'http', url: entry.url }
    if (entry.authSecret) server.headers = { Authorization: `Bearer \${${entry.authSecret}}` }
  } else if (positionals.length >= 2) {
    name = positionals[0]
    const url = positionals[1]
    try { new URL(url) } catch { fail('url must be a valid URL') }
    server = { type: values.sse ? 'sse' : 'http', url }
    const headers: Record<string, string> = {}
    for (const h of values.header ?? []) {
      const i = h.indexOf(':')
      if (i === -1) fail(`--header must be "Key: Value" (got ${h})`)
      headers[h.slice(0, i).trim()] = h.slice(i + 1).trim()
    }
    if (Object.keys(headers).length) server.headers = headers
  } else {
    return fail('usage: aeon mcp add <slug> | <name> <url> [--sse] [--header "K: V"]')
  }

  const next = { ...servers, [name]: server }
  if (isDryRun()) return emit({ dryRun: true, add: { [name]: server } }, () =>
    console.log(c.yellow('dry-run: ') + `would add server "${name}" → ${server.url}`))
  const sync = await writeServers(next, `chore: add MCP server ${name}`)
  emit({ ok: true, added: name, synced: sync.synced }, () => { console.log(c.green('✓ ') + `added ${name}`); printSync(sync) })
}

async function remove(args: string[]) {
  const name = args.find(a => !a.startsWith('-'))
  if (!name) fail('usage: aeon mcp rm <name>')
  const servers = await readServers()
  if (!(name in servers)) fail(`no such server: ${name}`)
  const next = { ...servers }
  delete next[name]
  if (isDryRun()) return emit({ dryRun: true, remove: name }, () =>
    console.log(c.yellow('dry-run: ') + `would remove server "${name}"`))
  const sync = await writeServers(next, `chore: remove MCP server ${name}`)
  emit({ ok: true, removed: name, synced: sync.synced }, () => { console.log(c.green('✓ ') + `removed ${name}`); printSync(sync) })
}
