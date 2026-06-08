import { NextResponse } from 'next/server'
import {
  getRemoteDirectory,
  getRemoteFileContent,
  getFileContent,
  createFile,
  updateFile,
  getDirectory,
} from '@/lib/github'
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

        // Add to aeon.yml
        try {
          const config = await getFileContent('aeon.yml')
          const updated = addSkillToConfig(config.content, name)
          if (updated !== config.content) {
            await updateFile('aeon.yml', updated, config.sha, `chore: add ${name} to config`)
          }
        } catch {
          // Config update failed — skill file was still created
        }

        installed.push(name)
      }

      return NextResponse.json({ installed, failed })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
