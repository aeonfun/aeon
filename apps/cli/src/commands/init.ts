// `aeon init` - one command from "I have the code" to "my agent runs on a
// schedule". Every step CHECKS first and only fixes what is missing, so it is
// safe to re-run at any point (a half-finished init just picks up where it
// stopped). Steps:
//   1. GitHub CLI: installed, signed in, token carries repo + workflow
//   2. Your instance repo: created from the aeonfun/aeon TEMPLATE (not a fork:
//      forks start with Actions disabled), and this folder pointed at it
//   3. gh default repo = your instance (secrets never land on aeonfun/aeon)
//   4. Actions enabled + Actions may open PRs (the default token is left as is)
//   5. GH_GLOBAL from your gh token (only when it has repo + workflow)
//   6. Model: pick a harness and connect one of its credentials (manifest-driven)
//   7. Test connection: run the tiny connect-check skill on GitHub and read the
//      verdict (same lib as the dashboard's "Test connection")
//   8. Telegram (optional): bot token + chat id via a /start deep link
//   9. Summary checklist, then optionally start the dashboard
import { parseArgs } from 'node:util'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { REPO_ROOT } from '../../../dashboard/lib/gh.ts'
import { GH_GLOBAL_SCOPES, captureGithubToken, ghTokenScopes, missingScopes } from '../../../dashboard/lib/github-auth.ts'
import { setSecret } from '../../../dashboard/lib/secrets-catalog.ts'
import { configureAuth } from '../../../dashboard/lib/auth.ts'
import { HARNESS_AUTH } from '../../../dashboard/lib/harness-auth.ts'
import { captureHarnessCreds, driveTtyLogin, setHarnessApiKey } from '../../../dashboard/lib/harness-auth-server.ts'
import { syncHarness } from '../../../dashboard/lib/gateway.ts'
import { parseConfig } from '../../../dashboard/lib/config.ts'
import { HARNESSES, type Harness } from '../../../dashboard/lib/types.ts'
import { loadGateways, loadHarnesses, runnableSecrets, type Credential, type Gateway, type HarnessManifest } from '../manifest.ts'
import { grokLogin, storeGrokKey } from '../grok.ts'
import { createMemoryStore } from '../../../dashboard/lib/connect-store.ts'
import { ConnectCheckMissing, dispatchConnectCheck, readConnectCheck } from '../../../dashboard/lib/connect-check-server.ts'
import { pollConnectCheck, type CheckResult } from '../../../dashboard/lib/connect-check.ts'
import { c, fail, isDryRun, isUpstreamRepo } from '../output.ts'

const USAGE = `aeon init - set up your own Aeon instance, end to end (safe to re-run)

Usage: ./aeon init [options]

Options:
  --name <repo>      Name of your instance repo (default: aeon)
  --private          Create it private (default: public - public repos get
                     free GitHub Actions minutes; private ones spend your plan's)
  --dir <path>       Clone your instance into <path> and continue there,
                     instead of turning this folder into it
  --harness <h>      Preselect the agent: ${HARNESSES.join(' | ')}
  --no-test          Skip the connection test (a tiny skill run on GitHub)
  --no-telegram      Skip the Telegram step
  --no-dashboard     Do not offer to start the dashboard at the end
  -y, --yes          Accept every default (still asks for keys it cannot guess)
  --dry-run          Show what each step would do, change nothing

Each step prints a check (${'✓'}) or what it fixed. Run bin/onboard any time for a
read-only health check.`

const TEMPLATE = 'aeonfun/aeon'

type Status = 'ok' | 'fixed' | 'warn' | 'fail' | 'skip'
interface Row { step: string; status: Status; detail: string }

interface Opts {
  name: string
  private: boolean
  dir?: string
  harness?: string
  test: boolean
  telegram: boolean
  dashboard: boolean
  yes: boolean
}

// --- output -----------------------------------------------------------------
const rows: Row[] = []
const ICON: Record<Status, string> = {
  ok: c.green('✓'), fixed: c.green('✓'), warn: c.yellow('!'), fail: c.red('✗'), skip: c.dim('-'),
}
function report(step: string, status: Status, detail: string, fix?: string) {
  rows.push({ step, status, detail })
  console.log(`  ${ICON[status]} ${detail}`)
  if (fix && status !== 'ok' && status !== 'fixed') console.log(`      ${c.cyan('fix:')} ${fix}`)
}
const heading = (n: number, title: string) => console.log(`\n${c.bold(`${n}. ${title}`)}`)
const note = (s: string) => console.log(c.dim(`     ${s}`))
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// --- prompts ----------------------------------------------------------------
const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY)

async function ask(question: string, def = ''): Promise<string> {
  if (!interactive) return def
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const a = (await rl.question(`  ${question}${def ? c.dim(` [${def}]`) : ''} `)).trim()
    return a || def
  } finally {
    rl.close()
  }
}

// Every confirm guards a change. Without a terminal nobody can answer, so the
// answer is "no" unless --yes said to take the defaults.
async function confirm(opts: Opts, question: string, def = true): Promise<boolean> {
  if (!interactive) return opts.yes ? def : false
  if (opts.yes) return def
  const a = (await ask(`${question} ${c.dim(def ? '[Y/n]' : '[y/N]')}`)).toLowerCase()
  if (!a) return def
  return a.startsWith('y')
}

// Read a key without echoing it. Raw mode, so a pasted key never lands in the
// terminal scrollback; bracketed-paste markers are stripped if the terminal
// sends them.
function askSecret(question: string): Promise<string> {
  if (!interactive) return Promise.resolve('')
  return new Promise((done) => {
    process.stdout.write(`  ${question} `)
    const stdin = process.stdin
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    let buf = ''
    const submit = () => {
      stdin.setRawMode(false)
      stdin.pause()
      stdin.off('data', onData)
      process.stdout.write(buf ? c.dim(' (hidden, received)\n') : '\n')
      done(buf.split('\u001b[200~').join('').split('\u001b[201~').join('').trim())
    }
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') return submit()
        if (ch === '\u0003') { stdin.setRawMode(false); process.stdout.write('\n'); process.exit(130) }
        if (ch === '\u007f' || ch === '\b') { buf = buf.slice(0, -1); continue }
        buf += ch
      }
    }
    stdin.on('data', onData)
  })
}

// --- gh / git helpers -----------------------------------------------------------
interface Run { ok: boolean; out: string; err: string }
function run(cmd: string, args: string[], cwd = REPO_ROOT): Run {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  return { ok: r.status === 0 && !r.error, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() || (r.error?.message ?? '') }
}
const gh = (...args: string[]) => run('gh', args)
const git = (...args: string[]) => run('git', args)
function interactiveRun(cmd: string, args: string[]): boolean {
  const r = spawnSync(cmd, args, { cwd: REPO_ROOT, stdio: 'inherit' })
  return r.status === 0 && !r.error
}

// owner/repo of a GitHub remote URL (https or ssh), or null.
export function githubSlug(url: string): string | null {
  const m = url.trim().match(/github\.com[:/]+([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/)
  return m ? `${m[1]}/${m[2]}` : null
}

function originSlug(): string | null {
  const r = git('remote', 'get-url', 'origin')
  return r.ok ? githubSlug(r.out) : null
}

// --- steps ------------------------------------------------------------------
async function stepGh(): Promise<string> {
  heading(1, 'GitHub CLI')
  const v = run('gh', ['--version'])
  if (!v.ok) {
    report('gh', 'fail', 'GitHub CLI (gh) is not installed',
      'macOS: brew install gh  |  Linux/Windows: https://github.com/cli/cli#installation  - then re-run ./aeon init')
    finish(false)
  }
  report('gh', 'ok', `gh installed (${v.out.split('\n')[0].replace(/^gh version /, '').split(' ')[0]})`)

  if (!gh('auth', 'status').ok) {
    if (isDryRun()) {
      report('gh auth', 'warn', 'not signed in', 'would run: gh auth login --web -s workflow')
      return ''
    }
    if (!interactive) {
      report('gh auth', 'fail', 'not signed in to GitHub (the browser sign-in needs a terminal)', 'gh auth login --web -s workflow, then re-run ./aeon init')
      finish(false)
    }
    console.log(c.dim('     Signing in to GitHub (a browser window opens; the workflow scope lets Aeon update its own workflows).'))
    if (!interactiveRun('gh', ['auth', 'login', '--web', '-s', 'workflow'])) {
      report('gh auth', 'fail', 'GitHub sign-in did not finish', 'gh auth login --web -s workflow')
      finish(false)
    }
  }
  const login = gh('api', 'user', '-q', '.login').out
  if (!login) {
    report('gh auth', 'fail', 'gh is signed in but cannot read your account', 'gh auth login --web -s workflow')
    finish(false)
  }

  let scopes = ghTokenScopes()
  let missing = scopes ? missingScopes(scopes) : []
  if (scopes && missing.length) {
    const envToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
    if (envToken) {
      report('gh scopes', 'warn', `signed in as ${login}, but the GH_TOKEN in your shell lacks ${missing.join(' + ')}`,
        'unset GH_TOKEN GITHUB_TOKEN, then re-run ./aeon init')
      return login
    }
    if (isDryRun() || !interactive) {
      report('gh scopes', 'warn', `signed in as ${login}; token lacks ${missing.join(' + ')}`,
        `${isDryRun() ? 'would run: ' : ''}gh auth refresh -h github.com -s ${GH_GLOBAL_SCOPES.join(',')}`)
      return login
    }
    console.log(c.dim(`     Adding the ${missing.join(' + ')} scope to your gh login (approve in the browser).`))
    interactiveRun('gh', ['auth', 'refresh', '-h', 'github.com', '-s', GH_GLOBAL_SCOPES.join(',')])
    scopes = ghTokenScopes()
    missing = scopes ? missingScopes(scopes) : []
  }
  if (!scopes) {
    report('gh scopes', 'warn', `signed in as ${login}; token scopes cannot be read (fine-grained token?)`,
      'gh auth login --web -s workflow  (a gh login token works everywhere Aeon needs one)')
  } else if (missing.length) {
    report('gh scopes', 'warn', `signed in as ${login}; token still lacks ${missing.join(' + ')}`,
      `gh auth refresh -h github.com -s ${GH_GLOBAL_SCOPES.join(',')}`)
  } else {
    report('gh scopes', 'ok', `signed in as ${login} (scopes include repo + workflow)`)
  }
  return login
}

// Is `slug` an Aeon repo (has aeon.yml at its root)?
function isAeonRepo(slug: string): boolean {
  return gh('api', `repos/${slug}/contents/aeon.yml`, '--silent').ok
}

async function stepRepo(opts: Opts, login: string): Promise<string> {
  heading(2, 'Your instance repo')
  const here = originSlug()
  if (here && !isUpstreamRepo(here) && existsSync(join(REPO_ROOT, 'aeon.yml'))) {
    report('repo', 'ok', `this folder is your instance: ${here}`)
    if (opts.name !== 'aeon' && !here.endsWith(`/${opts.name}`)) note(`--name ${opts.name} ignored: already inside ${here}`)
    await ensureTracksOrigin(here)
    return here
  }
  if (!login) {
    report('repo', 'fail', 'cannot pick a repo owner without a GitHub login', 'finish step 1, then re-run ./aeon init')
    finish(false)
  }

  const target = `${login}/${opts.name}`
  note(here ? `This folder is a copy of ${here}, the shared template. Your agent needs its own repo.` : 'This folder has no GitHub remote yet.')
  // A renamed/transferred repo answers under its old name too (GitHub
  // redirects), so compare the name GitHub resolves, not the one we asked for:
  // never adopt the template, or anything that redirects to another repo.
  const view = gh('repo', 'view', target, '--json', 'nameWithOwner', '-q', '.nameWithOwner')
  if (isUpstreamRepo(target) || (view.ok && (isUpstreamRepo(view.out) || view.out.toLowerCase() !== target.toLowerCase()))) {
    report('repo', 'fail', `${target} is ${view.ok && view.out.toLowerCase() !== target.toLowerCase() ? `a redirect to ${view.out}` : 'the Aeon template itself'}, not a new instance`,
      './aeon init --name <another-name>  (e.g. --name my-aeon)')
    finish(false)
  }
  // Switching this folder over must not cost any work, so check that BEFORE
  // creating anything on GitHub.
  if (opts.dir) preflightDir(opts.dir)
  else preflightFolder(opts)

  if (view.ok) {
    if (!isAeonRepo(target)) {
      report('repo', 'fail', `${target} already exists and is not an Aeon repo (no aeon.yml)`, './aeon init --name <another-name>')
      finish(false)
    }
    report('repo', 'ok', `found your instance ${target}`)
  } else {
    const vis = opts.private ? 'private' : 'public'
    note(opts.private
      ? 'Private: GitHub Actions minutes come out of your plan (Free includes 2,000/month).'
      : 'Public: GitHub Actions minutes are free. Secrets stay secret either way; pass --private to keep the code private.')
    if (!(await confirm(opts, `Create ${target} (${vis}) from the ${TEMPLATE} template?`))) {
      report('repo', 'fail', interactive ? 'no instance repo' : 'no instance repo (no terminal to confirm; pass --yes to create it)',
        `./aeon init --yes  (or gh repo create ${target} --template ${TEMPLATE} --${vis})`)
      finish(false)
    }
    if (isDryRun()) {
      report('repo', 'skip', `would run: gh repo create ${target} --template ${TEMPLATE} --${vis}`)
      if (opts.dir) report('clone', 'skip', `would clone ${target} into ${resolve(opts.dir)} and continue there`)
      else report('folder', 'skip', `would make ${target} this folder's origin (${here ?? 'no remote'} kept as upstream) and check out its main`)
      return target
    }
    // A template copy, not a fork: forks start with Actions disabled and
    // inherit nothing useful, which is the #1 "my agent never ran" cause.
    const created = gh('repo', 'create', target, '--template', TEMPLATE, `--${vis}`, '--description', 'My Aeon agent')
    if (!created.ok) {
      report('repo', 'fail', `could not create ${target}: ${created.err.split('\n')[0]}`, `gh repo create ${target} --template ${TEMPLATE} --${vis}`)
      finish(false)
    }
    report('repo', 'fixed', `created ${target} from the ${TEMPLATE} template`)
  }

  if (opts.dir) return cloneElsewhere(opts, target)
  return adoptThisFolder(here, target)
}

// GitHub fills a template copy in asynchronously: the repo exists (and clones
// "successfully", empty) a few seconds before its files do. Wait for aeon.yml.
async function waitForContent(target: string): Promise<boolean> {
  for (let i = 0; i < 20; i++) {
    if (i) await sleep(3000)
    if (isAeonRepo(target)) return true
  }
  return false
}

// Clone the instance into --dir and hand over to that checkout's own
// `./aeon init`, which finds itself inside an instance and carries on.
async function cloneElsewhere(opts: Opts, target: string): Promise<never> {
  const dir = resolve(opts.dir!)
  if (isDryRun()) {
    report('clone', 'skip', `would clone ${target} into ${dir} and continue there`)
    finish(true)
  }
  if (!existsSync(join(dir, 'aeon.yml'))) {
    preflightDir(dir)
    const preExisted = existsSync(dir)
    if (!(await waitForContent(target))) {
      report('clone', 'fail', `${target} is still empty (GitHub has not finished copying the template)`, 'wait a minute, then re-run the same ./aeon init command')
      finish(false)
    }
    let cloned = false
    let err = ''
    for (let i = 0; i < 5 && !cloned; i++) {
      if (i) await sleep(3000)
      const r = run('gh', ['repo', 'clone', target, dir], process.cwd())
      cloned = r.ok && existsSync(join(dir, 'aeon.yml'))
      err = r.err.split('\n')[0] || (r.ok ? 'the clone had no aeon.yml' : '')
      // Undo only what this run created: a folder that already existed (empty,
      // per preflightDir) is emptied again, never removed.
      if (!cloned) {
        if (preExisted) for (const f of readdirSync(dir)) rmSync(join(dir, f), { recursive: true, force: true })
        else rmSync(dir, { recursive: true, force: true })
      }
    }
    if (!cloned) {
      report('clone', 'fail', `could not clone ${target}: ${err}`, `gh repo clone ${target} ${dir}`)
      finish(false)
    }
  }
  const launcher = join(dir, 'aeon')
  if (!existsSync(launcher)) {
    report('clone', 'fail', `${dir} has no ./aeon launcher`, `cd ${dir} && git pull, then ./aeon init`)
    finish(false)
  }
  report('clone', 'fixed', `cloned ${target} into ${dir}; continuing there`)
  printSummary()
  const args = ['init', ...(opts.yes ? ['--yes'] : []), ...(opts.harness ? ['--harness', opts.harness] : []),
    ...(opts.test ? [] : ['--no-test']), ...(opts.telegram ? [] : ['--no-telegram']), ...(opts.dashboard ? [] : ['--no-dashboard'])]
  const env = { ...process.env, AEON_REPO_ROOT: dir }
  const r = spawnSync(launcher, args, { cwd: dir, stdio: 'inherit', env })
  if (r.error) {
    console.error(c.red('error: ') + `could not start ${launcher}: ${r.error.message}. Run it yourself: cd ${dir} && ./aeon init`)
    process.exit(1)
  }
  process.exit(r.status ?? 1)
}

// --dir must be a new folder, an empty folder, or an existing Aeon checkout.
// Checked before anything is created on GitHub.
function preflightDir(path: string) {
  const dir = resolve(path)
  if (!existsSync(dir)) return
  if (!statSync(dir).isDirectory()) {
    report('clone', 'fail', `${dir} exists and is not a folder`, 'pick a new or empty folder: ./aeon init --dir <path>')
    finish(false)
  }
  if (!existsSync(join(dir, 'aeon.yml')) && readdirSync(dir).length) {
    report('clone', 'fail', `${dir} exists, is not empty and is not an Aeon checkout`, 'pick a new or empty folder: ./aeon init --dir <path>')
    finish(false)
  }
}

// The checks that make switching this folder over safe: no uncommitted edits
// and no local commits that exist on no remote (any branch).
function preflightFolder(opts: Opts) {
  const dirty = git('status', '--porcelain', '--untracked-files=no')
  if (dirty.out) {
    report('folder', 'fail', 'this folder has uncommitted changes, so it was not switched over',
      `commit or stash them and re-run, or: ./aeon init --dir ../${opts.name}`)
    finish(false)
  }
  const local = git('rev-list', '--count', '--branches', '--not', '--remotes')
  if (local.ok && local.out !== '0') {
    report('folder', 'fail', `this folder has ${local.out} local commit(s) not on any remote, so it was not switched over`,
      `push them somewhere first, or: ./aeon init --dir ../${opts.name}`)
    finish(false)
  }
}

const TEMP_REMOTE = 'aeon-instance'

// Turn this checkout of the template into the operator's instance. Ordered so
// an interruption at any point is safe and resumable: the instance is fetched
// and checked out under a temporary remote FIRST, and the remotes are renamed
// (template -> upstream, instance -> origin) only after that worked. A re-run
// always ends with the branch tracking origin/<branch>.
async function adoptThisFolder(here: string | null, target: string): Promise<string> {
  if (isDryRun()) {
    report('folder', 'skip', `would make ${target} this folder's origin (${here ?? 'no remote'} kept as upstream) and check out its main`)
    return target
  }
  const remotes = () => git('remote').out.split('\n').filter(Boolean)
  if (remotes().includes(TEMP_REMOTE)) git('remote', 'remove', TEMP_REMOTE)
  const url = `https://github.com/${target}.git`
  const add = git('remote', 'add', TEMP_REMOTE, url)
  if (!add.ok) {
    report('folder', 'fail', `could not add the ${TEMP_REMOTE} remote for ${target}: ${add.err.split('\n')[0]}`,
      `git remote remove ${TEMP_REMOTE}, then re-run ./aeon init`)
    finish(false)
  }
  if (!(await waitForContent(target))) {
    report('folder', 'fail', `${target} is still empty (GitHub has not finished copying the template)`, 'wait a minute, then re-run ./aeon init')
    finish(false)
  }
  const branch = gh('repo', 'view', target, '--json', 'defaultBranchRef', '-q', '.defaultBranchRef.name').out || 'main'
  let fetched = false
  for (let i = 0; i < 5 && !fetched; i++) {
    if (i) await sleep(3000)
    fetched = git('fetch', TEMP_REMOTE).ok && git('rev-parse', '--verify', '--quiet', `refs/remotes/${TEMP_REMOTE}/${branch}`).ok
  }
  if (!fetched) {
    report('folder', 'fail', `could not fetch ${target} (${branch})`, 'check your network, then re-run ./aeon init')
    finish(false)
  }
  const co = git('checkout', '-B', branch, `${TEMP_REMOTE}/${branch}`)
  if (!co.ok) {
    report('folder', 'fail', `could not check out ${target}: ${co.err.split('\n')[0]}`, 're-run ./aeon init')
    finish(false)
  }
  // Only now move the remotes. The old origin (the template) becomes upstream;
  // if an upstream already exists it is kept and the template origin dropped.
  if (remotes().includes('origin')) {
    let moved: Run
    let hint = 're-run ./aeon init'
    if (!remotes().includes('upstream')) moved = git('remote', 'rename', 'origin', 'upstream')
    else if (here && isUpstreamRepo(here)) moved = git('remote', 'remove', 'origin')
    else if (remotes().includes('origin-previous')) {
      moved = { ok: false, out: '', err: 'an origin-previous remote already exists' }
      hint = `this folder already has upstream and origin-previous remotes; remove the one you no longer need (git remote remove origin-previous), then re-run ./aeon init`
    } else moved = git('remote', 'rename', 'origin', 'origin-previous')
    if (!moved.ok) {
      report('folder', 'fail', `could not move the old origin remote out of the way: ${moved.err.split('\n')[0]}`, hint)
      finish(false)
    }
  }
  const ren = git('remote', 'rename', TEMP_REMOTE, 'origin')
  if (!ren.ok) {
    report('folder', 'fail', `could not rename the ${TEMP_REMOTE} remote to origin: ${ren.err}`, 're-run ./aeon init')
    finish(false)
  }
  git('branch', `--set-upstream-to=origin/${branch}`, branch)
  const up = git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}').out
  if (up !== `origin/${branch}`) {
    report('folder', 'fail', `${branch} tracks ${up || 'nothing'}, not origin/${branch}`, `git branch --set-upstream-to=origin/${branch} ${branch}`)
    finish(false)
  }
  report('folder', 'fixed', `this folder now tracks ${target}${here ? ` (${here} kept as the upstream remote)` : ''}`)
  return target
}

// Already inside the instance: make sure the current branch tracks origin, not
// the template (what an interrupted switch-over from an older init, or a hand
// setup, can leave behind). Pushes from init go to origin by name regardless.
async function ensureTracksOrigin(slug: string) {
  const cur = git('rev-parse', '--abbrev-ref', 'HEAD').out
  const up = git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}')
  if (up.ok && up.out.startsWith('origin/')) return
  if (!cur || cur === 'HEAD') {
    report('folder', 'warn', 'no branch is checked out (detached HEAD)', 'git checkout main')
    return
  }
  const branch = gh('repo', 'view', slug, '--json', 'defaultBranchRef', '-q', '.defaultBranchRef.name').out || 'main'
  const was = up.ok ? up.out : 'nothing'
  if (cur !== branch) {
    report('folder', 'warn', `you are on ${cur} (tracking ${was}); scheduled runs read ${branch}`, `git checkout ${branch}`)
    return
  }
  if (isDryRun()) {
    report('folder', 'skip', `would point ${branch} at origin/${branch} (now tracking ${was})`)
    return
  }
  if (!git('fetch', 'origin').ok || !git('rev-parse', '--verify', '--quiet', `refs/remotes/origin/${branch}`).ok) {
    report('folder', 'fail', `could not fetch origin/${branch} from ${slug}`, `git fetch origin && git branch --set-upstream-to=origin/${branch} ${branch}`)
    finish(false)
  }
  // A template copy starts a FRESH history, so a branch still on the
  // template's commits shares nothing with origin. Re-pointing @{u} alone
  // would leave this folder on the template; switch to the instance's history
  // instead, but only when that cannot lose work.
  if (!git('merge-base', 'HEAD', `origin/${branch}`).ok) {
    const dirty = git('status', '--porcelain', '--untracked-files=no').out
    const local = git('rev-list', '--count', '--branches', '--not', '--remotes')
    if (dirty || !local.ok || local.out !== '0') {
      report('folder', 'fail', `${branch} has no history in common with ${slug}, and this folder has ${dirty ? 'uncommitted changes' : 'local commits on no remote'}`,
        `save them elsewhere, then: git checkout -B ${branch} origin/${branch}  (or start fresh: ./aeon init --dir ../${slug.split('/')[1]})`)
      finish(false)
    }
    const co = git('checkout', '-B', branch, `origin/${branch}`)
    if (!co.ok) {
      report('folder', 'fail', `could not check out origin/${branch}: ${co.err.split('\n')[0]}`, `git checkout -B ${branch} origin/${branch}`)
      finish(false)
    }
    git('branch', `--set-upstream-to=origin/${branch}`, branch)
    report('folder', 'fixed', `${branch} was still the template's history; switched it to ${slug}'s origin/${branch}`)
    return
  }
  git('branch', `--set-upstream-to=origin/${branch}`, branch)
  report('folder', 'fixed', `${branch} now tracks origin/${branch} (was ${was})`)
}

function stepDefaultRepo(slug: string) {
  heading(3, 'Default repo for gh')
  if (isUpstreamRepo(slug)) {
    report('set-default', 'fail', `refusing to target ${slug}, the shared template`, './aeon init from your own instance')
    finish(false)
  }
  const current = gh('repo', 'set-default', '--view').out
  if (current.toLowerCase() === slug.toLowerCase()) {
    report('set-default', 'ok', `gh default repo is ${slug}`)
    return
  }
  if (isDryRun()) {
    report('set-default', 'skip', `would run: gh repo set-default ${slug}${current ? ` (currently ${current})` : ''}`)
    return
  }
  const r = gh('repo', 'set-default', slug)
  if (!r.ok) {
    report('set-default', 'fail', `could not set the default repo: ${r.err.split('\n')[0]}`, `gh repo set-default ${slug}`)
    finish(false)
  }
  report('set-default', 'fixed', `gh default repo set to ${slug}${current ? ` (was ${current})` : ''} - secrets now land on your repo`)
}

function stepActions(slug: string) {
  heading(4, 'GitHub Actions')
  const settings = `https://github.com/${slug}/settings/actions`
  const perms = gh('api', `repos/${slug}/actions/permissions`)
  const wf = gh('api', `repos/${slug}/actions/permissions/workflow`)
  let p: { enabled?: boolean; allowed_actions?: string } = {}
  let w: { default_workflow_permissions?: string; can_approve_pull_request_reviews?: boolean } = {}
  try { p = JSON.parse(perms.out || '{}') } catch { /* unreadable: treat as unset */ }
  try { w = JSON.parse(wf.out || '{}') } catch { /* unreadable: treat as unset */ }
  // Every aeon workflow declares its own `permissions:`, so the repo's default
  // token (read or write) is left exactly as it is. What a run needs from the
  // repo settings is only: Actions on, and "Allow GitHub Actions to create and
  // approve pull requests" (install-skill ships installs as auto-merged PRs).
  // An operator's allowed_actions choice ('selected' / 'local_only') is kept;
  // 'all' is set only when nothing is set yet.
  const actionsOk = p.enabled === true
  const prOk = w.can_approve_pull_request_reviews === true

  if (actionsOk && prOk) {
    report('actions', 'ok', `Actions enabled (${p.allowed_actions ?? 'default'} actions), workflows may open PRs`)
  } else if (isDryRun()) {
    const todo = [
      ...(actionsOk ? [] : [`enable Actions${p.allowed_actions ? '' : ' (all actions)'}`]),
      ...(prOk ? [] : ['allow Actions to create and approve PRs']),
    ].join(' + ')
    report('actions', 'skip', `would ${todo} (workflow token stays ${w.default_workflow_permissions ?? 'as is'})`)
  } else {
    const a = actionsOk || gh('api', '-X', 'PUT', `repos/${slug}/actions/permissions`, '-F', 'enabled=true',
      ...(p.allowed_actions ? [] : ['-f', 'allowed_actions=all'])).ok
    // The endpoint takes both fields; send the current default token back
    // unchanged so only the PR switch moves.
    const b = prOk || gh('api', '-X', 'PUT', `repos/${slug}/actions/permissions/workflow`,
      ...(w.default_workflow_permissions ? ['-f', `default_workflow_permissions=${w.default_workflow_permissions}`] : []),
      '-F', 'can_approve_pull_request_reviews=true').ok
    const done = [...(actionsOk ? [] : ['enabled Actions']), ...(prOk ? [] : ['allowed Actions to open PRs'])].join(' and ')
    if (a && b) report('actions', 'fixed', `${done} (workflow token left ${w.default_workflow_permissions ?? 'as is'})`)
    else report('actions', 'fail', 'could not change the Actions settings (needs admin on the repo)',
      `open ${settings}: enable Actions and tick "Allow GitHub Actions to create and approve pull requests"`)
  }

  // Forks ship with every workflow disabled ("disabled_fork"), and GitHub
  // disables schedules after 60 idle days. Re-enable only those two states:
  // a workflow the operator turned off by hand stays off.
  const list = gh('api', `repos/${slug}/actions/workflows`, '-q', '.workflows[] | select(.state == "disabled_fork" or .state == "disabled_inactivity") | "\\(.id) \\(.path)"')
  const off = list.ok && list.out ? list.out.split('\n') : []
  if (!off.length) return
  if (isDryRun()) { report('workflows', 'skip', `would enable ${off.length} workflow(s) GitHub left off`); return }
  const failed = off.filter((l) => !gh('api', '-X', 'PUT', `repos/${slug}/actions/workflows/${l.split(' ')[0]}/enable`).ok)
  if (failed.length) report('workflows', 'fail', `${failed.length} workflow(s) still disabled`, `open https://github.com/${slug}/actions and enable them`)
  else report('workflows', 'fixed', `enabled ${off.length} workflow(s) GitHub had left off`)
}

// Secret names on the instance itself (`-R slug`), never on whatever gh would
// infer: in a dry run from a template clone that would be aeonfun/aeon. A repo
// that does not exist yet (dry run before create) simply has none.
function secretNames(slug: string): Set<string> | null {
  const r = gh('secret', 'list', '-R', slug, '--json', 'name', '-q', '.[].name')
  if (r.ok) return new Set(r.out.split('\n').filter(Boolean))
  return isDryRun() ? new Set() : null
}

async function stepGhGlobal(opts: Opts, secrets: Set<string> | null) {
  heading(5, 'GH_GLOBAL (your GitHub token for runs)')
  note('Lets skills read other repos, open PRs and save refreshed logins back as secrets.')
  if (secrets?.has('GH_GLOBAL')) {
    report('GH_GLOBAL', 'ok', 'GH_GLOBAL is set')
    return
  }
  const scopes = ghTokenScopes()
  const missing = scopes ? missingScopes(scopes) : [...GH_GLOBAL_SCOPES]
  if (missing.length) {
    report('GH_GLOBAL', 'warn', `not set; your gh token lacks ${missing.join(' + ')}, so it was not copied`,
      `gh auth refresh -h github.com -s ${GH_GLOBAL_SCOPES.join(',')} && ./aeon auth --github  (or a classic PAT with repo + workflow: ./aeon secrets set GH_GLOBAL --stdin)`)
    return
  }
  note('Good for getting started. GitHub revokes a gh login token after a year unused, or when you have more than 10 for the')
  note('same app and scopes, so for an instance that runs for a long time use a dedicated classic PAT (repo + workflow).')
  if (!(await confirm(opts, 'Store your gh token as GH_GLOBAL now? (scopes: repo, workflow)'))) {
    report('GH_GLOBAL', 'skip', 'GH_GLOBAL not set (optional)', './aeon auth --github')
    return
  }
  if (isDryRun()) { report('GH_GLOBAL', 'skip', 'would copy `gh auth token` into GH_GLOBAL'); return }
  try {
    captureGithubToken()
    report('GH_GLOBAL', 'fixed', 'stored your gh token as GH_GLOBAL')
  } catch (e) {
    report('GH_GLOBAL', 'fail', e instanceof Error ? e.message : 'could not store GH_GLOBAL', './aeon auth --github')
  }
}

function currentHarness(): Harness {
  try {
    const h = parseConfig(readFileSync(join(REPO_ROOT, 'aeon.yml'), 'utf8')).harness
    return (HARNESSES as string[]).includes(h) ? (h as Harness) : 'claude'
  } catch {
    return 'claude'
  }
}

function cliInstalled(bin: string): boolean {
  return !spawnSync(bin, ['--version'], { stdio: 'ignore' }).error
}

// Store a pasted key for `h` under the credential's secret, going through the
// same lib paths the dashboard uses so gateway/harness side effects match.
async function storeKey(h: HarnessManifest, cred: Credential | null, gateway: Gateway | null, key: string): Promise<string> {
  if (gateway) return (await configureAuth({ key, provider: gateway.id })).secret ?? gateway.secrets[0]
  if (!cred) throw new Error('nothing to store')
  if (h.id === 'claude') return (await configureAuth({ key })).secret ?? cred.secret
  if (h.id === 'grok') return (await storeGrokKey(key)).secret
  const spec = HARNESS_AUTH[h.id]
  if (spec?.apiKey && cred.auth_mode === 'native-key' && (spec.apiKey.detect || spec.apiKey.secret === cred.secret)) {
    return setHarnessApiKey(h.id, key).secret
  }
  await setSecret(cred.secret, key)
  return cred.secret
}

// Run the credential's login flow (no key to paste).
async function runLogin(h: HarnessManifest, cred: Credential): Promise<string> {
  if (h.id === 'claude' || cred.secret === 'CLAUDE_CODE_OAUTH_TOKEN') {
    if (!cliInstalled('claude')) throw new Error(`Claude Code is not installed. Install it: ${h.cli.install}`)
    return (await configureAuth({})).secret ?? cred.secret
  }
  if (h.id === 'grok') return grokLogin().secret
  if (!cliInstalled(h.cli.bin)) throw new Error(`${h.cli.bin} is not installed. Install it: ${h.cli.install}`)
  driveTtyLogin(h.id)
  return captureHarnessCreds(h.id).secret
}

// Point aeon.yml's harness: at `id` (commit + push to origin via the lib).
async function switchHarness(id: string) {
  if (isDryRun()) { report('harness', 'skip', `would set harness: ${id} in aeon.yml`); return }
  try {
    const sync = await syncHarness(id as Harness)
    report('harness', sync.synced ? 'fixed' : 'warn', `aeon.yml now runs ${id}${sync.synced ? ' (pushed)' : ` (saved locally, not pushed: ${sync.reason ?? 'unknown'})`}`,
      sync.synced ? undefined : './aeon sync')
  } catch (e) {
    report('harness', 'fail', `could not set harness: ${e instanceof Error ? e.message : String(e)}`, `./aeon config set harness ${id}`)
  }
}

async function stepModel(opts: Opts, secrets: Set<string> | null) {
  heading(6, 'Model')
  const harnesses = loadHarnesses()
  const gateways = loadGateways()
  const byId = new Map(harnesses.map((h) => [h.id, h]))
  const configured = currentHarness()
  const have = (h: HarnessManifest) => runnableSecrets(h, gateways).find((s) => secrets?.has(s))

  const asked = opts.harness ? byId.get(opts.harness === 'claude-code' ? 'claude' : opts.harness) : undefined
  if (opts.harness && !asked) fail(`unknown harness '${opts.harness}'. One of: ${harnesses.map((h) => h.id).join(', ')}`)

  // Already connected? Then do not run a login again: some captures rotate on
  // every login (grok), so a needless re-login can break a working setup.
  // --harness <h> that is connected only switches aeon.yml to it.
  const ready = asked ?? byId.get(configured)
  const usedBy = ready && have(ready)
  if (ready && usedBy) {
    report('model', 'ok', `${ready.label} is connected (${usedBy})`)
    if (ready.id !== configured) await switchHarness(ready.id)
    if (asked || !(await confirm(opts, 'Connect a different model?', false))) return
  }

  console.log('')
  harnesses.forEach((h, i) => {
    const how = h.credentials.map((cr) => cr.label.replace(/ \(.*\)$/, '')).join(', ')
    console.log(`     ${String(i + 1).padStart(2)}. ${h.label}${h.id === configured ? c.dim(' (current)') : ''} ${c.dim(`- ${how}${h.gateways ? ', or a gateway key' : ''}`)}`)
  })
  note('One OpenRouter key (https://openrouter.ai/settings/keys) works for most of these:')
  note(`${harnesses.filter((h) => h.gateways || h.credentials.some((cr) => cr.secret === 'OPENROUTER_API_KEY')).map((h) => h.id).join(', ')}.`)

  let pick = asked
  if (!pick && !interactive && !isDryRun()) {
    report('model', 'warn', 'no model connected (choosing one needs a terminal)', './aeon init (in a terminal), or ./aeon init --harness <name>')
    return
  }
  if (!pick) {
    const def = String(harnesses.findIndex((h) => h.id === configured) + 1)
    const ans = await ask('Which agent should run your skills?', def)
    pick = harnesses[Number(ans) - 1] ?? byId.get(ans)
  }
  if (!pick) {
    report('model', 'warn', 'no agent picked', './aeon init --harness <name>')
    return
  }
  const h = pick

  // The harness's own credentials (most preferred first), then for claude the
  // gateway keys it can route through.
  const options: { cred: Credential | null; gw: Gateway | null; label: string; how: string; url: string }[] = [
    ...h.credentials.map((cr) => ({ cred: cr, gw: null, label: cr.label, how: cr.aeon_cmd ?? `./aeon secrets set ${cr.secret} --stdin`, url: cr.get_url })),
    ...(h.gateways ? gateways.filter((g) => g.transport !== 'native').map((g) => ({
      cred: null, gw: g, label: `${g.label} gateway key`, how: `./aeon auth --key <key> --provider ${g.id}`, url: g.get_url,
    })) : []),
  ]
  console.log(`\n     ${c.bold(h.label)} can sign in with:`)
  options.forEach((o, i) => console.log(`     ${String(i + 1).padStart(2)}. ${o.label} ${c.dim(`- get one: ${o.url}`)}\n         ${c.dim(o.how)}`))

  const ans = await ask('Which one?', '1')
  const choice = options[Number(ans) - 1]
  if (!choice) {
    report('model', 'warn', `${h.label}: nothing connected`, options[0].how)
    return
  }

  const isLogin = choice.cred !== null && (choice.cred.kind === 'oauth_capture' || (choice.cred.kind === 'oauth_token' && Boolean(choice.cred.login_cmd) && h.id === 'claude'))
  if (isDryRun()) {
    report('model', 'skip', `would ${isLogin ? `run ${choice.cred?.login_cmd}` : 'ask for the key'} and store ${choice.gw?.secrets[0] ?? choice.cred?.secret}${h.id !== configured ? `, then set harness: ${h.id}` : ''}`)
    return
  }
  // Logins open a browser and keys are pasted: both need someone at a terminal.
  if (!interactive) {
    report('model', 'warn', `${h.label}: not connected (${isLogin ? 'the login' : 'pasting a key'} needs a terminal)`, choice.how)
    return
  }

  let stored: string
  try {
    if (isLogin) {
      console.log(c.dim(`     Running ${choice.cred!.login_cmd} - approve in the browser.`))
      stored = await runLogin(h, choice.cred!)
    } else {
      const key = await askSecret(`Paste your ${choice.label}:`)
      if (!key) {
        report('model', 'warn', `${h.label}: no key entered`, choice.how)
        return
      }
      const prefixes = choice.gw ? choice.gw.prefixes : choice.cred?.prefix ? [choice.cred.prefix] : []
      if (prefixes.length && !prefixes.some((p) => key.startsWith(p)) &&
          !(await confirm(opts, `That key does not start with ${prefixes.join(' / ')}. Store it anyway?`, false))) {
        report('model', 'warn', `${h.label}: key not stored`, choice.how)
        return
      }
      stored = await storeKey(h, choice.cred, choice.gw, key)
    }
  } catch (e) {
    report('model', 'fail', `${h.label}: ${e instanceof Error ? e.message : 'connect failed'}`, choice.how)
    return
  }
  report('model', 'fixed', `${h.label} connected (stored as ${stored})`)
  const aux = choice.cred?.aux_secrets
  if (aux?.length && !aux.some((s) => secrets?.has(s))) {
    note(`${choice.cred!.refresh ?? 'This login needs a secrets-write token to stay alive'}: set ${aux.join(' or ')} (step 5).`)
  }
  if (h.id !== configured) await switchHarness(h.id)
}

// --- Test connection --------------------------------------------------------
// The harness aeon.yml runs, if one of its credentials is set on the instance.
function connectedHarness(secrets: Set<string> | null): HarnessManifest | null {
  const h = loadHarnesses().find((x) => x.id === currentHarness())
  return h && runnableSecrets(h, loadGateways()).some((s) => secrets?.has(s)) ? h : null
}

const STATE_TEXT: Record<string, string> = {
  queued: 'waiting for a runner', running: 'running on GitHub', none: 'looking for the run',
}

// Dispatch connect-check on the configured harness and wait for the verdict:
// the run must succeed AND the model must answer (token usage, or the exact
// reply on harnesses that report no usage). A saved key that GitHub rejects
// (a Claude subscription token, typically) fails here instead of on the first
// scheduled run.
async function stepTest(opts: Opts, secrets: Set<string> | null) {
  heading(7, 'Test connection')
  const h = connectedHarness(secrets)
  if (!h) { report('test', 'skip', 'no model connected, nothing to test'); return }
  if (!opts.test) { report('test', 'skip', 'skipped (--no-test)', './aeon init, or Test connection on the dashboard HQ'); return }
  note('Runs the tiny connect-check skill once on GitHub (about 1 to 3 minutes) to prove the model answers.')
  if (!(await confirm(opts, `Test ${h.label} now?`, true))) {
    report('test', 'skip', 'connection not tested', './aeon init, or Test connection on the dashboard HQ')
    return
  }
  if (isDryRun()) { report('test', 'skip', `would run the connect-check skill on ${h.id} and wait for the result`); return }

  const store = createMemoryStore()
  let dispatchId: string
  try {
    dispatchId = (await dispatchConnectCheck(store, h.id)).dispatchId
  } catch (e) {
    if (e instanceof ConnectCheckMissing) {
      report('test', 'warn', 'this instance has no connect-check skill yet, so the model was not tested',
        'update your instance (git pull upstream main, then ./aeon sync), then re-run ./aeon init')
    } else {
      report('test', 'fail', `could not start the test run: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`, 'check that Actions is enabled, then re-run ./aeon init')
    }
    return
  }

  let last = ''
  const progress = (r: CheckResult) => {
    const text = STATE_TEXT[r.state]
    if (!text || text === last) return
    last = text
    if (interactive) process.stdout.write(`\r     ${c.dim(`${text}...`)}\x1b[K`)
    else console.log(c.dim(`     ${text}...`))
  }
  progress({ state: 'queued' })
  const pollMs = Number(process.env.AEON_CONNECT_CHECK_POLL_MS) || 5000
  const result = await pollConnectCheck({
    read: () => readConnectCheck(store, h.id, dispatchId),
    onUpdate: progress,
    sleep: (ms) => sleep(ms).then(() => undefined),
    now: Date.now,
    cancelled: () => false,
    intervalMs: pollMs,
    timeoutMs: Math.max(10 * 60_000, pollMs * 20),
  })
  if (interactive) process.stdout.write('\r\x1b[K')
  if (result.state === 'pass') {
    const tokens = result.usage && result.usage.total > 0 ? ` (${result.usage.total} tokens)` : ''
    report('test', 'ok', `${h.label} answered from GitHub${tokens}`)
    return
  }
  const fix = [result.hint, result.fix ? `then: ${result.fix.cli}` : '', result.runUrl ? `run: ${result.runUrl}` : '']
    .filter(Boolean).join('  ')
  report('test', 'fail', `${h.label} test failed: ${result.reason ?? 'no verdict'}`, fix || './aeon init')
}

// --- Telegram ---------------------------------------------------------------
interface TgUpdate { message?: { text?: string; chat?: { id?: number } } }

async function tg<T>(token: string, method: string): Promise<{ status: number; ok: boolean; result?: T; description?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`)
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string }
  return { status: res.status, ok: Boolean(body.ok), result: body.result, description: body.description }
}

async function manualChatId(why: string): Promise<string> {
  note(why)
  note('Message @userinfobot on Telegram; it replies with your numeric id.')
  return ask('Paste your chat id (blank to skip):')
}

async function stepTelegram(opts: Opts, secrets: Set<string> | null) {
  heading(8, 'Telegram (optional)')
  if (!opts.telegram) { report('telegram', 'skip', 'skipped (--no-telegram)'); return }
  if (secrets?.has('TELEGRAM_BOT_TOKEN') && secrets.has('TELEGRAM_CHAT_ID')) {
    report('telegram', 'ok', 'TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set')
    return
  }
  if (!interactive) {
    report('telegram', 'skip', 'not set (needs a terminal)', './aeon init (interactive), or set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID with ./aeon secrets set')
    return
  }
  if (!(await confirm(opts, 'Get your agent\'s reports on Telegram?', true))) {
    report('telegram', 'skip', 'Telegram not set up (optional)', './aeon init')
    return
  }
  if (isDryRun()) { report('telegram', 'skip', 'would ask for a bot token, then link your chat with a /start deep link'); return }

  note('In Telegram, message @BotFather, send /newbot, and copy the token it gives you.')
  const token = await askSecret('Bot token:')
  if (!token) { report('telegram', 'skip', 'no bot token entered', './aeon init'); return }
  let me
  try { me = await tg<{ username?: string }>(token, 'getMe') } catch (e) {
    report('telegram', 'fail', `could not reach Telegram: ${e instanceof Error ? e.message : String(e)}`, './aeon init')
    return
  }
  if (!me.ok || !me.result?.username) {
    report('telegram', 'fail', `Telegram rejected that token${me.description ? ` (${me.description})` : ''}`, 'copy the token from @BotFather again and re-run ./aeon init')
    return
  }
  const bot = me.result.username
  try { await setSecret('TELEGRAM_BOT_TOKEN', token) } catch (e) {
    report('telegram', 'fail', `could not save TELEGRAM_BOT_TOKEN: ${e instanceof Error ? e.message : String(e)}`, './aeon secrets set TELEGRAM_BOT_TOKEN --stdin')
    return
  }
  report('telegram', 'fixed', `saved the token for @${bot}`)

  // Link the chat: a one-time nonce in a /start deep link, found by polling
  // getUpdates WITHOUT an offset, so nothing is acknowledged or consumed and
  // the workflow's own poller still sees every message.
  const nonce = randomBytes(6).toString('hex')
  console.log(`\n     Open this link and tap Start:  ${c.cyan(`https://t.me/${bot}?start=${nonce}`)}`)
  let chatId = ''
  const deadline = Date.now() + 180_000
  while (!chatId && Date.now() < deadline) {
    let up
    try { up = await tg<TgUpdate[]>(token, 'getUpdates') } catch { up = null }
    if (up && up.status === 409) {
      chatId = await manualChatId('This bot has a webhook set, so its updates cannot be read here.')
      break
    }
    // Without an offset getUpdates returns at most the 100 oldest pending
    // updates, so a busy bot would hide the /start forever. An offset would
    // confirm (drop) updates the messages.yml poller still needs, so ask instead.
    if ((up?.result?.length ?? 0) >= 100) {
      chatId = await manualChatId('This bot has a backlog of unread updates, so the /start message cannot be picked out here.')
      break
    }
    const hit = up?.result?.find((u) => u.message?.text?.trim() === `/start ${nonce}`)
    if (hit?.message?.chat?.id !== undefined) chatId = String(hit.message.chat.id)
    else await sleep(2000)
  }
  if (!chatId) chatId = await manualChatId('Did not see the /start message within 3 minutes.')
  if (!/^-?\d+$/.test(chatId)) {
    report('telegram', 'warn', 'TELEGRAM_CHAT_ID not set', './aeon secrets set TELEGRAM_CHAT_ID --stdin')
    return
  }
  try {
    await setSecret('TELEGRAM_CHAT_ID', chatId)
    report('telegram', 'fixed', `linked chat ${chatId} - reports will arrive from @${bot}`)
  } catch (e) {
    report('telegram', 'fail', `could not save TELEGRAM_CHAT_ID: ${e instanceof Error ? e.message : String(e)}`, './aeon secrets set TELEGRAM_CHAT_ID --stdin')
  }
}

// --- summary ----------------------------------------------------------------
function printSummary() {
  console.log(`\n${c.bold('Summary')}`)
  for (const r of rows) console.log(`  ${ICON[r.status]} ${r.step.padEnd(12)} ${c.dim(r.detail)}`)
}

// Every exit path: print the checklist, exit 0 only when nothing failed.
function finish(completed: boolean): never {
  printSummary()
  const failed = rows.filter((r) => r.status === 'fail').length
  if (!completed || failed) {
    console.log(`\n${c.yellow('Not finished.')} Fix the ${c.red('✗')} items above, then re-run ${c.bold('./aeon init')} - it skips what is already done.`)
  } else if (isDryRun()) {
    console.log(`\n${c.yellow('Dry run finished:')} nothing was changed. Run ${c.bold('./aeon init')} to do it.`)
  } else if (rows.some((r) => r.status === 'warn')) {
    console.log(`\n${c.yellow('Almost there.')} Fix the ${c.yellow('!')} items above (or re-run ${c.bold('./aeon init')}); ${c.bold('bin/onboard')} re-checks everything.`)
  } else {
    console.log(`\n${c.green('Your agent is set up.')} Skills run on their schedule in GitHub Actions; ${c.bold('bin/onboard')} re-checks everything.`)
  }
  process.exit(failed || !completed ? 1 : 0)
}

export async function initCommand(argv: string[]) {
  if (argv.includes('-h') || argv.includes('--help')) { console.log(USAGE); return }
  let values: { name?: string; private?: boolean; dir?: string; harness?: string; 'no-test'?: boolean; 'no-telegram'?: boolean; 'no-dashboard'?: boolean; yes?: boolean }
  try {
    ;({ values } = parseArgs({ args: argv, options: {
      name: { type: 'string' }, private: { type: 'boolean' }, dir: { type: 'string' }, harness: { type: 'string' },
      'no-test': { type: 'boolean' }, 'no-telegram': { type: 'boolean' }, 'no-dashboard': { type: 'boolean' }, yes: { type: 'boolean', short: 'y' },
    } }))
  } catch (e) { fail(e instanceof Error ? e.message : 'bad arguments') }
  const name = values.name ?? 'aeon'
  if (!/^[A-Za-z0-9._-]+$/.test(name)) fail(`--name must be a plain repo name (got '${name}')`)
  const opts: Opts = {
    name, private: Boolean(values.private), dir: values.dir, harness: values.harness,
    test: !values['no-test'], telegram: !values['no-telegram'], dashboard: !values['no-dashboard'], yes: Boolean(values.yes),
  }

  console.log(c.bold('Aeon setup') + c.dim(`  - each step checks first and only fixes what is missing; safe to re-run${isDryRun() ? ' (dry run: nothing changes)' : ''}`))
  const login = await stepGh()
  const slug = await stepRepo(opts, login)
  stepDefaultRepo(slug)
  // Every write below goes through `gh` (default repo, just set) or git
  // (origin). Both must point at the instance, never the template.
  const origin = originSlug()
  if (!isDryRun() && (!origin || isUpstreamRepo(origin) || origin.toLowerCase() !== slug.toLowerCase())) {
    report('origin', 'fail', `this folder's origin is ${origin ?? 'unset'}, not ${slug}`, `git remote set-url origin https://github.com/${slug}.git`)
    finish(false)
  }
  stepActions(slug)
  const secrets = secretNames(slug)
  if (!secrets) note('Could not list the repo secrets; the steps below will offer to set everything.')
  await stepGhGlobal(opts, secrets)
  await stepModel(opts, secrets)
  await stepTest(opts, secretNames(slug) ?? secrets)
  await stepTelegram(opts, secretNames(slug) ?? secrets)

  const failed = rows.some((r) => r.status === 'fail')
  // --yes means unattended, and the dashboard is a foreground server: never
  // start it implicitly.
  if (!failed && opts.dashboard && interactive && !opts.yes && !isDryRun() &&
      (await confirm(opts, 'Start the dashboard now?', true))) {
    printSummary()
    const r = spawnSync(join(REPO_ROOT, 'aeon'), [], { cwd: REPO_ROOT, stdio: 'inherit' })
    process.exit(r.status ?? 0)
  }
  if (!failed && opts.dashboard) note('Start the dashboard any time with ./aeon')
  finish(true)
}