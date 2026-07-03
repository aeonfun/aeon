import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { REPO_ROOT } from '@/lib/gh'
import { errorResponse, syncResult } from '@/lib/http'
import { getFileContent, getDirectory, updateFile, commitAndPush } from '@/lib/github'
import {
  parseConfig,
  updateSkillInConfig,
  updateModelInConfig,
  updateHarnessInConfig,
  updateJsonrenderInConfig,
  removeSkillFromConfig,
} from '@/lib/config'
import { HARNESSES } from '@/lib/types'
import type { Harness } from '@/lib/types'
import { deleteDirectory } from '@/lib/github'
import type { CommitResult } from '@/lib/github'
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
      const { content: catalogRaw } = await getFileContent('catalog/skills.json')
      const catalog = JSON.parse(catalogRaw) as { skills?: Array<{ slug: string; category: string }> }
      for (const s of catalog.skills ?? []) categoryBySlug[s.slug] = s.category
    } catch { /* catalog optional - categories default to meta */ }

    // Canonical slug → pack (key + display name) map from packs.json (the
    // grouping the UI uses). The name lets the roster label community packs
    // (installed from another repo) by their real name. Falls back to 'lab'.
    const packBySlug: Record<string, string> = {}
    const packNameBySlug: Record<string, string> = {}
    try {
      const { content: packsRaw } = await getFileContent('catalog/packs.json')
      const packs = JSON.parse(packsRaw) as { packs?: Array<{ key: string; name?: string; skills?: Array<{ slug: string }> }> }
      for (const p of packs.packs ?? []) for (const s of p.skills ?? []) {
        packBySlug[s.slug] = p.key
        packNameBySlug[s.slug] = p.name ?? p.key
      }
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
        packName: packNameBySlug[m.name] || '',
        enabled: config.skills[m.name]?.enabled ?? false,
        schedule: config.skills[m.name]?.schedule || '0 12 * * *',
        var: config.skills[m.name]?.var || '',
        model: config.skills[m.name]?.model || '',
        harness: config.skills[m.name]?.harness || '',
      }))

    const repo = getRepoSlug()
    return NextResponse.json({ skills, model: config.model, harness: config.harness, gateway: config.gateway, repo, jsonrenderEnabled: config.jsonrenderEnabled })
  } catch (error: unknown) {
    return errorResponse(error, 'Unknown error')
  }
}

export async function PATCH(request: Request) {
  try {
    const { name, enabled, schedule, var: skillVar, model, skillModel, harness, skillHarness, jsonrenderEnabled } = await request.json() as { name?: string; enabled?: boolean; schedule?: string; var?: string; model?: string; skillModel?: string; harness?: string; skillHarness?: string; jsonrenderEnabled?: boolean }
    const { content, sha } = await getFileContent('aeon.yml')
    let updated = content

    if (typeof jsonrenderEnabled === 'boolean') {
      updated = updateJsonrenderInConfig(updated, jsonrenderEnabled)
    }

    if (typeof model === 'string' && model) {
      updated = updateModelInConfig(updated, model)
    }

    // Top-level harness switch (claude | grok). Ignore unknown values.
    if (typeof harness === 'string' && HARNESSES.includes(harness as Harness)) {
      updated = updateHarnessInConfig(updated, harness as Harness)
    }

    if (name && (typeof enabled === 'boolean' || typeof schedule === 'string' || typeof skillVar === 'string' || typeof skillModel === 'string' || typeof skillHarness === 'string')) {
      updated = updateSkillInConfig(updated, name, {
        ...(typeof enabled === 'boolean' ? { enabled } : {}),
        ...(typeof schedule === 'string' && schedule ? { schedule } : {}),
        ...(typeof skillVar === 'string' ? { var: skillVar } : {}),
        ...(typeof skillModel === 'string' ? { model: skillModel } : {}),
        ...(typeof skillHarness === 'string' ? { harness: skillHarness } : {}),
      })
    }

    let sync: CommitResult = { synced: true }
    if (updated !== content) {
      const msg = model
        ? `chore: set model to ${model}`
        : harness
          ? `chore: set harness to ${harness}`
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
