import {
  listLogs, readLog, listTopics, readTopic, listIssues, readIssue,
  searchMemory, readMemoryIndex,
} from '../../../dashboard/lib/memory.ts'
import { emit, table, c, fail } from '../output.ts'

const USAGE = `aeon memory — browse the agent's persistent memory

  aeon memory                     Index (MEMORY.md excerpt + counts)
  aeon memory logs [<date>]       List daily logs, or print one (YYYY-MM-DD)
  aeon memory topics [<slug>]     List topic files, or print one
  aeon memory issues [<id>]       List issue tracker, or print one (ISS-001)
  aeon memory search <query>      Full-text search across all of the above

Options:
  --json     Machine-readable output`

export async function memoryCommand(argv: string[]) {
  const sub = argv[0]
  if (sub === 'help' || argv.includes('-h') || argv.includes('--help')) { console.log(USAGE); return }

  switch (sub) {
    case undefined: return index()
    case 'logs': return logs(argv[1])
    case 'topics': return topics(argv[1])
    case 'issues': return issues(argv[1])
    case 'search': return search(argv.slice(1).filter(a => !a.startsWith('-')).join(' '))
    default: fail(`unknown subcommand: ${sub}\n\n${USAGE}`)
  }
}

async function index() {
  const [mem, t, l, i] = await Promise.all([readMemoryIndex(), listTopics(), listLogs(), listIssues()])
  const data = {
    memory: mem ? { exists: true, size: mem.length } : { exists: false },
    counts: { topics: t.length, logs: l.length, issues: i.length },
    latestLog: l[0]?.date ?? null,
  }
  emit(data, () => {
    console.log(c.dim('topics ') + t.length + c.dim('   logs ') + l.length + c.dim('   issues ') + i.length +
      (l[0] ? c.dim('   latest ') + l[0].date : ''))
    if (mem) { console.log('\n' + c.bold('MEMORY.md')); console.log(mem.trim()) }
    else console.log(c.dim('\n(no MEMORY.md yet)'))
  })
}

async function logs(date?: string) {
  if (date) {
    const log = await readLog(date)
    if (!log) fail(`no log for ${date} (expected YYYY-MM-DD)`)
    return emit(log, () => { console.log(c.bold(log.date)); console.log(log.content.trim()) })
  }
  const all = await listLogs()
  emit(all, () => {
    if (!all.length) { console.log(c.dim('(no logs)')); return }
    table(['DATE', 'SIZE'], all.map(x => [x.date, `${x.size}b`]))
  })
}

async function topics(slug?: string) {
  if (slug) {
    const t = await readTopic(slug)
    if (!t) fail(`no topic: ${slug}`)
    return emit(t, () => { console.log(c.bold(t.slug)); console.log(t.content.trim()) })
  }
  const all = await listTopics()
  emit(all, () => {
    if (!all.length) { console.log(c.dim('(no topics)')); return }
    table(['SLUG', 'SIZE'], all.map(x => [x.slug, `${x.size}b`]))
  })
}

async function issues(id?: string) {
  if (id) {
    const iss = await readIssue(id)
    if (!iss) fail(`no issue: ${id} (expected ISS-NNN)`)
    return emit(iss, () => { console.log(c.bold(iss.id)); console.log(iss.content.trim()) })
  }
  const all = await listIssues()
  emit(all, () => {
    if (!all.length) { console.log(c.dim('(no issues)')); return }
    table(['ID', 'UPDATED'], all.map(x => [x.id, x.updatedAt.slice(0, 10)]))
  })
}

async function search(query: string) {
  if (!query) fail('usage: aeon memory search <query>')
  const hits = await searchMemory(query, { limit: 20 })
  emit(hits, () => {
    if (!hits.length) { console.log(c.dim(`no matches for "${query}"`)); return }
    for (const h of hits) {
      console.log(`${c.cyan(h.source)} ${c.bold(h.ref)}${c.dim(':' + h.lineNumber)}`)
      // The lib marks matched substrings with **…**; render them bold in a TTY.
      console.log('  ' + h.snippet.replace(/\*\*(.+?)\*\*/g, (_, m) => c.yellow(m)).replace(/\n/g, '\n  '))
      console.log()
    }
    console.log(c.dim(`${hits.length} hits`))
  })
}
