import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { REPO_ROOT } from '@/lib/gh'
import { errorResponse, syncResult } from '@/lib/http'
import { getFileContent, getDirectory, updateFile, commitAndPush } from '@/lib/github'
import {
  parseConfig,
  updateSkillInConfig,
  updateModelInConfig,
  updateJsonrenderInConfig,
  removeSkillFromConfig,
} from '@/lib/config'
import { deleteDirectory } from '@/lib/github'
import { parseFrontmatter } from '@/lib/frontmatter'
import type { Skill } from '@/lib/types'

function getRepoSlug(): string {
  if (process.env.GITHUB_REPO) return process.env.GITHUB_REPO
  try {
    const url = execSync('git remote get-url origin', { stdio: 'pipe', cwd: REPO_ROOT }).toString().trim()
    const m = url.match(/github\.com[/:]([\w.-]+\/[\w.-]+?)(?:\.git)?$/)
    return m ? m[1] : ''
  } catch {
    return ''
  }
}

export async function GET() {
  try {
    const [configResult, skillDirs] = await Promise.all([
      getFileContent('aeon.yml'),
      getDirectory('skills'),
    ])
    const config = parseConfig(configResult.content)
    const dirNames = skillDirs.filter(d => d.type === 'dir').map(d => d.name)

    // Canonical slug → category map from the generated catalog (skills.json).
    // Falls back to 'meta' for any skill not yet in the catalog.
    const categoryBySlug: Record<string, string> = {}
    try {
      const { content: catalogRaw } = await getFileContent('skills.json')
      const catalog = JSON.parse(catalogRaw) as { skills?: Array<{ slug: string; category: string }> }
      for (const s of catalog.skills ?? []) categoryBySlug[s.slug] = s.category
    } catch { /* catalog optional - categories default to meta */ }

    // Canonical slug → pack map from packs.json (the grouping the UI uses).
    // Falls back to 'lab' (the catch-all) for any skill not yet in a pack.
    const packBySlug: Record<string, string> = {}
    try {
      const { content: packsRaw } = await getFileContent('packs.json')
      const packs = JSON.parse(packsRaw) as { packs?: Array<{ key: string; skills?: Array<{ slug: string }> }> }
      for (const p of packs.packs ?? []) for (const s of p.skills ?? []) packBySlug[s.slug] = p.key
    } catch { /* packs.json optional - packs default to lab */ }

    const meta = await Promise.all(
      dirNames.map(async (name) => {
        try {
          const { content } = await getFileContent(`skills/${name}/SKILL.md`)
          const { description, tags, requires, mcp } = parseFrontmatter(content)
          return { name, description, tags, requires, mcp, found: true }
        } catch {
          // No SKILL.md → this is a support/data dir (e.g. skills/security/), not a skill.
          return { name, description: '', tags: [] as string[], requires: [], mcp: [], found: false }
        }
      }),
    )

    const skills: Skill[] = meta
      .filter(m => m.found)
      .map(m => ({
        name: m.name,
        description: m.description,
        tags: m.tags,
        requires: m.requires,
        mcp: m.mcp,
        category: categoryBySlug[m.name] || 'meta',
        pack: packBySlug[m.name] || 'lab',
        enabled: config.skills[m.name]?.enabled ?? false,
        schedule: config.skills[m.name]?.schedule || '0 12 * * *',
        var: config.skills[m.name]?.var || '',
        model: config.skills[m.name]?.model || '',
      }))

    const repo = getRepoSlug()
    return NextResponse.json({ skills, model: config.model, gateway: config.gateway, repo, jsonrenderEnabled: config.jsonrenderEnabled })
  } catch (error: unknown) {
    return errorResponse(error, 'Unknown error')
  }
}

export async function PATCH(request: Request) {
  try {
    const { name, enabled, schedule, var: skillVar, model, skillModel, jsonrenderEnabled } = await request.json() as { name?: string; enabled?: boolean; schedule?: string; var?: string; model?: string; skillModel?: string; jsonrenderEnabled?: boolean }
    const { content, sha } = await getFileContent('aeon.yml')
    let updated = content

    if (typeof jsonrenderEnabled === 'boolean') {
      updated = updateJsonrenderInConfig(updated, jsonrenderEnabled)
    }

    if (typeof model === 'string' && model) {
      updated = updateModelInConfig(updated, model)
    }

    if (name && (typeof enabled === 'boolean' || typeof schedule === 'string' || typeof skillVar === 'string' || typeof skillModel === 'string')) {
      updated = updateSkillInConfig(updated, name, {
        ...(typeof enabled === 'boolean' ? { enabled } : {}),
        ...(typeof schedule === 'string' && schedule ? { schedule } : {}),
        ...(typeof skillVar === 'string' ? { var: skillVar } : {}),
        ...(typeof skillModel === 'string' ? { model: skillModel } : {}),
      })
    }

    let sync: { synced: boolean; reason?: string } = { synced: true }
    if (updated !== content) {
      const msg = model
        ? `chore: set model to ${model}`
        : typeof jsonrenderEnabled === 'boolean'
          ? `chore: ${jsonrenderEnabled ? 'enable' : 'disable'} json-render channel`
          : `chore: update ${name} config`
      await updateFile('aeon.yml', updated, sha, msg)
      sync = commitAndPush(['aeon.yml'], msg)
    }

    return NextResponse.json(syncResult(sync))
  } catch (error: unknown) {
    return errorResponse(error, 'Unknown error')
  }
}

export async function DELETE(request: Request) {
  try {
    const { name } = await request.json() as { name?: string }
    if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
      return NextResponse.json({ error: 'Invalid skill name' }, { status: 400 })
    }

    await deleteDirectory(`skills/${name}`, `chore: delete ${name} skill`)

    let configUpdated = true
    let configError: string | undefined
    try {
      const { content, sha } = await getFileContent('aeon.yml')
      const updated = removeSkillFromConfig(content, name)
      if (updated !== content) {
        await updateFile('aeon.yml', updated, sha, `chore: remove ${name} from config`)
      }
    } catch (e: unknown) {
      // The aeon.yml write is a real GitHub-API/file-IO boundary that can throw;
      // the skill dir is already deleted, so don't fail the request - but surface
      // it instead of swallowing it silently and reporting a clean removal.
      configUpdated = false
      configError = e instanceof Error ? e.message : 'Failed to update aeon.yml'
      console.error(`skills DELETE: failed to remove ${name} from aeon.yml:`, e)
    }

    // One commit for both the removed skill dir and the aeon.yml cleanup.
    const sync = commitAndPush(['aeon.yml', `skills/${name}`], `chore: remove ${name} skill`)

    return NextResponse.json({ ...syncResult(sync), configUpdated, ...(configError ? { configError } : {}) })
  } catch (error: unknown) {
    return errorResponse(error, 'Unknown error')
  }
}
