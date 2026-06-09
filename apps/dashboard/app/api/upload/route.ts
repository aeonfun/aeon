import { NextResponse } from 'next/server'
import { createFile, getFileContent, updateFile } from '@/lib/github'
import { addSkillToConfig } from '@/lib/config'
import { parseFrontmatter } from '@/lib/frontmatter'
import type { UploadFile } from '@/lib/types'

function detectSecretsFromContent(content: string): string[] {
  const matches = new Set<string>()
  const re = /\$\{?([A-Z][A-Z0-9_]{2,})\}?/g
  let m
  while ((m = re.exec(content)) !== null) {
    const name = m[1]
    if (/_(API_KEY|KEY|TOKEN|SECRET|WEBHOOK_URL|PASSWORD|CREDENTIALS)$/.test(name)) {
      matches.add(name)
    }
  }
  return [...matches]
}

function extractSkillName(content: string): string {
  // Slugify the frontmatter name: "Fleet Scorecard" → "fleet-scorecard"
  const { name } = parseFrontmatter(content)
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function isSkillFile(path: string): boolean {
  const lower = path.toLowerCase()
  return lower === 'skill.md' || lower.endsWith('/skill.md') || lower.endsWith('.skill')
}

function stripSkillExt(name: string): string {
  return name.replace(/\.skill$/i, '')
}

function deriveSkillName(files: UploadFile[]): { name: string; prefix: string } {
  // First try SKILL.md
  const skillFile = files.find(f =>
    f.path === 'SKILL.md' ||
    f.path.endsWith('/SKILL.md') ||
    f.path.toLowerCase() === 'skill.md' ||
    f.path.toLowerCase().endsWith('/skill.md')
  )

  // Then try *.skill files
  const dotSkillFile = !skillFile ? files.find(f => f.path.toLowerCase().endsWith('.skill')) : null

  if (dotSkillFile) {
    const parts = dotSkillFile.path.split('/')
    const fileName = parts[parts.length - 1]
    const name = stripSkillExt(fileName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    if (parts.length === 1) {
      // Single file: "my-skill.skill"
      return { name, prefix: '' }
    }
    // In a folder: "folder/my-skill.skill"
    const folderName = stripSkillExt(parts[0]).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    return { name: folderName || name, prefix: parts.slice(0, -1).join('/') + '/' }
  }

  if (!skillFile) {
    return { name: '', prefix: '' }
  }

  const parts = skillFile.path.split('/')

  // Case 1: "soul/SKILL.md" → name is "soul", prefix is "soul/"
  if (parts.length === 2) {
    const name = stripSkillExt(parts[0])
    return { name, prefix: parts[0] + '/' }
  }

  // Case 2: "some/deep/path/soul/SKILL.md" → name is "soul", prefix is "some/deep/path/soul/"
  if (parts.length > 2) {
    const name = stripSkillExt(parts[parts.length - 2])
    const prefix = parts.slice(0, -1).join('/') + '/'
    return { name, prefix }
  }

  // Case 3: Just "SKILL.md" (no folder) → extract name from frontmatter
  const fmName = extractSkillName(skillFile.content)
  return { name: fmName, prefix: '' }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { files?: UploadFile[]; name?: string }
    const files = body.files
    const overrideName = body.name

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    // Find SKILL.md or *.skill file
    const hasSkillFile = files.some(f => isSkillFile(f.path))

    if (!hasSkillFile) {
      return NextResponse.json({
        error: 'No SKILL.md or .skill file found.',
      }, { status: 400 })
    }

    const { name: derivedName, prefix } = deriveSkillName(files)
    const skillName = overrideName?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || derivedName

    if (!skillName) {
      return NextResponse.json({
        error: 'Could not determine skill name. Please provide a name.',
      }, { status: 400 })
    }

    // Write all files under skills/<name>/
    let filesWritten = 0
    for (const file of files) {
      // Strip the common prefix (folder containing SKILL.md) from paths
      let relativePath = file.path
      if (prefix && relativePath.startsWith(prefix)) {
        relativePath = relativePath.slice(prefix.length)
      }

      // Skip empty paths or directory-only entries
      if (!relativePath || relativePath.endsWith('/')) continue

      // Rename .skill files to SKILL.md so the system can find them
      if (relativePath.toLowerCase().endsWith('.skill')) {
        relativePath = 'SKILL.md'
      }

      await createFile(
        `skills/${skillName}/${relativePath}`,
        file.content,
        `feat: upload ${skillName} skill`,
      )
      filesWritten++
    }

    // Add to aeon.yml if not already present
    try {
      const config = await getFileContent('aeon.yml')
      const updated = addSkillToConfig(config.content, skillName)
      if (updated !== config.content) {
        await updateFile('aeon.yml', updated, config.sha, `chore: add ${skillName} to config`)
      }
    } catch {
      // Config update failed — skill files were still created
    }

    // Detect secrets referenced in skill content
    const allContent = files.map(f => f.content).join('\n')
    const detectedSecrets = detectSecretsFromContent(allContent)

    return NextResponse.json({ name: skillName, filesWritten, detectedSecrets })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
