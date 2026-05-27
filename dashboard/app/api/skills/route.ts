import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { resolve } from 'path'
import { getFileContent, getDirectory, updateFile } from '@/lib/github'
import {
  parseConfig,
  updateSkillInConfig,
  updateModelInConfig,
  updateJsonrenderInConfig,
  removeSkillFromConfig,
} from '@/lib/config'
import { deleteDirectory } from '@/lib/github'
import { parseFrontmatter } from '@/lib/frontmatter'

function getRepoSlug(): string {
  if (process.env.GITHUB_REPO) return process.env.GITHUB_REPO
  try {
    const url = execSync('git remote get-url origin', { stdio: 'pipe', cwd: resolve(process.cwd(), '..') }).toString().trim()
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

    const meta = await Promise.all(
      dirNames.map(async (name) => {
        try {
          const { content } = await getFileContent(`skills/${name}/SKILL.md`)
          const { description, tags } = parseFrontmatter(content)
          return { name, description, tags }
        } catch {
          return { name, description: '', tags: [] as string[] }
        }
      }),
    )

    const skills = dirNames.map(name => {
      const m = meta.find(d => d.name === name)
      return {
        name,
        description: m?.description || '',
        tags: m?.tags || [],
        enabled: config.skills[name]?.enabled ?? false,
        schedule: config.skills[name]?.schedule || '0 12 * * *',
        var: config.skills[name]?.var || '',
        model: config.skills[name]?.model || '',
      }
    })

    const repo = getRepoSlug()
    return NextResponse.json({ skills, model: config.model, gateway: config.gateway, repo, jsonrenderEnabled: config.jsonrenderEnabled })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { name, enabled, schedule, var: skillVar, model, skillModel, jsonrenderEnabled } = await request.json()
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

    if (updated !== content) {
      const msg = model
        ? `chore: set model to ${model}`
        : typeof jsonrenderEnabled === 'boolean'
          ? `chore: ${jsonrenderEnabled ? 'enable' : 'disable'} json-render channel`
          : `chore: update ${name} config`
      await updateFile('aeon.yml', updated, sha, msg)
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { name } = await request.json()
    if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
      return NextResponse.json({ error: 'Invalid skill name' }, { status: 400 })
    }

    await deleteDirectory(`skills/${name}`, `chore: delete ${name} skill`)

    try {
      const { content, sha } = await getFileContent('aeon.yml')
      const updated = removeSkillFromConfig(content, name)
      if (updated !== content) {
        await updateFile('aeon.yml', updated, sha, `chore: remove ${name} from config`)
      }
    } catch { /* config cleanup is best-effort */ }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
