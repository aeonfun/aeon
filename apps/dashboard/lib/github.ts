import { readFile, writeFile, readdir, mkdir, rm } from 'fs/promises'
import { join } from 'path'
import { REPO_ROOT } from './gh'

const GITHUB_API = 'https://api.github.com'

// Minimal shapes for the GitHub "Get repository content" REST responses.
interface GitHubContentFile { content: string; sha: string; encoding: string }
interface GitHubContentEntry { name: string; type: 'file' | 'dir' | 'symlink' | 'submodule'; path: string }

export function isLocal() {
  return !process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO
}

function getConfig() {
  const token = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPO
  if (!token || !repo) throw new Error('github.ts: getConfig() requires GITHUB_TOKEN and GITHUB_REPO (non-local mode)')
  return { token, repo }
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

// --- Unified interface: local filesystem or GitHub API ---

export async function getFileContent(path: string): Promise<{ content: string; sha: string }> {
  if (isLocal()) {
    const content = await readFile(join(REPO_ROOT, path), 'utf-8')
    return { content, sha: '' }
  }
  const { token, repo } = getConfig()
  const res = await fetch(`${GITHUB_API}/repos/${repo}/contents/${path}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`GitHub API ${res.status}: failed to read ${path}`)
  const data = (await res.json()) as GitHubContentFile
  return {
    content: Buffer.from(data.content, 'base64').toString('utf-8'),
    sha: data.sha,
  }
}

export async function updateFile(path: string, content: string, sha: string, _message: string): Promise<unknown> {
  if (isLocal()) {
    await writeFile(join(REPO_ROOT, path), content, 'utf-8')
    return { ok: true }
  }
  const { token, repo } = getConfig()
  const res = await fetch(`${GITHUB_API}/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({
      message: _message,
      content: Buffer.from(content).toString('base64'),
      sha,
    }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`GitHub API ${res.status}: failed to update ${path}`)
  return res.json()
}

export async function createFile(path: string, content: string, message: string): Promise<unknown> {
  if (isLocal()) {
    const fullPath = join(REPO_ROOT, path)
    await mkdir(join(fullPath, '..'), { recursive: true })
    await writeFile(fullPath, content, 'utf-8')
    return { ok: true }
  }
  const { token, repo } = getConfig()
  try {
    const existing = await getFileContent(path)
    return updateFile(path, content, existing.sha, message)
  } catch {
    // File doesn't exist — create it
  }
  const res = await fetch(`${GITHUB_API}/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({
      message,
      content: Buffer.from(content).toString('base64'),
    }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`GitHub API ${res.status}: failed to create ${path}`)
  return res.json()
}

export async function getDirectory(path: string): Promise<Array<{ name: string; type: string; path: string }>> {
  if (isLocal()) {
    const fullPath = join(REPO_ROOT, path)
    try {
      const entries = await readdir(fullPath, { withFileTypes: true })
      return entries.map(e => ({
        name: e.name,
        type: e.isDirectory() ? 'dir' : 'file',
        path: join(path, e.name),
      }))
    } catch {
      return []
    }
  }
  const { token, repo } = getConfig()
  const res = await fetch(`${GITHUB_API}/repos/${repo}/contents/${path}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = (await res.json()) as GitHubContentEntry[] | GitHubContentFile
  return Array.isArray(data) ? data : []
}

// --- Remote repo helpers (for importing skills) ---

export async function getRemoteDirectory(remoteRepo: string, path: string): Promise<Array<{ name: string; type: string }>> {
  // Always uses GitHub API (remote repo)
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }
  const url = path
    ? `${GITHUB_API}/repos/${remoteRepo}/contents/${path}`
    : `${GITHUB_API}/repos/${remoteRepo}/contents`
  const res = await fetch(url, { headers, cache: 'no-store' })
  if (!res.ok) return []
  const data = (await res.json()) as GitHubContentEntry[] | GitHubContentFile
  return Array.isArray(data) ? data : []
}

export async function getRemoteFileContent(remoteRepo: string, path: string): Promise<string | null> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }
  const res = await fetch(`${GITHUB_API}/repos/${remoteRepo}/contents/${path}`, {
    headers,
    cache: 'no-store',
  })
  if (!res.ok) return null
  const data = (await res.json()) as GitHubContentFile
  return Buffer.from(data.content, 'base64').toString('utf-8')
}

export async function deleteDirectory(path: string, message: string): Promise<void> {
  if (isLocal()) {
    await rm(join(REPO_ROOT, path), { recursive: true, force: true })
    return
  }
  const { token, repo } = getConfig()
  // GitHub API requires deleting files one by one
  const files = await getDirectory(path)
  for (const file of files) {
    if (file.type === 'dir') {
      await deleteDirectory(`${path}/${file.name}`, message)
    } else {
      const { sha } = await getFileContent(`${path}/${file.name}`)
      const res = await fetch(`${GITHUB_API}/repos/${repo}/contents/${path}/${file.name}`, {
        method: 'DELETE',
        headers: authHeaders(token),
        body: JSON.stringify({ message, sha }),
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`GitHub API ${res.status}: failed to delete ${path}/${file.name}`)
    }
  }
}
