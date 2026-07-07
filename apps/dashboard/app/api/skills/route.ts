import { NextResponse } from 'next/server'
import { errorResponse, syncResult } from '@/lib/http'
import { getFileContent, updateFile, commitAndPush } from '@/lib/github'
import {
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
import { getSkills } from '@/lib/skills'

export async function GET() {
  try {
    return NextResponse.json(await getSkills())
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
