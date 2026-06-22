import { NextResponse } from 'next/server'
import {
  getRemoteDirectory,
  getRemoteFileContent,
  getFileContent,
  createFile,
  updateFile,
  getDirectory,
  commitAndPush,
} from '@/lib/github'
import type { CommitResult } from '@/lib/github'
import { errorResponse, syncFields } from '@/lib/http'
import { addSkillToConfig } from '@/lib/config'
import { parseFrontmatter } from '@/lib/frontmatter'

export async function POST(request: Request) {
  try {
    const { action, repo, skills: skillNames } = await request.json() as { action?: string; repo?: string; skills?: string[] }

    if (!repo) {
      return NextResponse.json({ error: 'repo required' }, { status: 400 })
    }

    if (action === 'list') {
      // Check both root and skills/ subdirectory
      const [rootEntries, skillsEntries] = await Promise.all([
        getRemoteDirectory(repo, ''),
        getRemoteDirectory(repo, 'skills'),
      ])

      const dirs = [
        ...rootEntries.filter(e => e.type === 'dir'),
        ...skillsEntries.filter(e => e.type === 'dir'),
      ]

      const localSkills = await getDirectory('skills')
      const localNames = new Set(localSkills.map(d => d.name))

      const results = await Promise.all(
        dirs.map(async (dir) => {
          const content =
            (await getRemoteFileContent(repo, `${dir.name}/SKILL.md`)) ||
            (await getRemoteFileContent(repo, `skills/${dir.name}/SKILL.md`))
          if (!content) return null
          return {
            name: dir.name,
            description: parseFrontmatter(content).description,
            installed: localNames.has(dir.name),
          }
        }),
      )

      // Deduplicate by name
      const seen = new Set<string>()
      const skills = results.filter((s): s is NonNullable<typeof s> => {
        if (!s || seen.has(s.name)) return false
        seen.add(s.name)
        return true
      })

      return NextResponse.json({ skills })
    }

    if (action === 'install') {
      if (!skillNames) {
        return NextResponse.json({ error: 'skills required' }, { status: 400 })
      }
      const installed: string[] = []
      const failed: string[] = []
      // Skills whose files were created but whose aeon.yml enable step threw.
      // They land on disk but aren't enabled - report them honestly rather than
      // counting them as a clean install.
      const partial: Array<{ name: string; configError: string }> = []
      // Every skill we actually wrote files for, so the commit covers them all.
      const written: string[] = []

      for (const name of skillNames) {
        const content =
          (await getRemoteFileContent(repo, `${name}/SKILL.md`)) ||
          (await getRemoteFileContent(repo, `skills/${name}/SKILL.md`))
        if (!content) {
          failed.push(name)
          continue
        }

        // Create skill file in repo
        await createFile(
          `skills/${name}/SKILL.md`,
          content,
          `feat: import ${name} skill from ${repo}`,
        )
        written.push(name)

        // Add to aeon.yml
        try {
          const config = await getFileContent('aeon.yml')
          const updated = addSkillToConfig(config.content, name)
          if (updated !== config.content) {
            await updateFile('aeon.yml', updated, config.sha, `chore: add ${name} to config`)
          }
          installed.push(name)
        } catch (e: unknown) {
          // The aeon.yml write is a real GitHub-API/file-IO boundary that can
          // throw; the skill file is already created, so keep it - but surface
          // the failure instead of swallowing it and reporting a clean install.
          const configError = e instanceof Error ? e.message : 'Failed to update aeon.yml'
          console.error(`import: failed to add ${name} to aeon.yml:`, e)
          partial.push({ name, configError })
        }
      }

      // Push the new skill dirs + aeon.yml to GitHub in one commit (local mode).
      const sync: CommitResult = written.length
        ? commitAndPush(['aeon.yml', ...written.map(n => `skills/${n}`)], `feat: import ${written.join(', ')}`)
        : { synced: true }

      return NextResponse.json({ installed, partial, failed, ...syncFields(sync) })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: unknown) {
    return errorResponse(error, 'Unknown error')
  }
}
