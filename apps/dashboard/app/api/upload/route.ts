import { NextResponse } from 'next/server'
import { createFile, getFileContent, updateFile, commitAndPush, withFileLock } from '@/lib/github'
import { errorResponse, syncFields } from '@/lib/http'
import { isRecord, slugify } from '@/lib/utils'
import { deriveSkillName } from '@/lib/skill-upload'
import { addSkillToConfig } from '@/lib/config'
import { setFrontmatterCategory, SKILL_CATEGORIES } from '@/lib/frontmatter'
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

// Validate a single element of an untrusted `files` array. We only require the
// two fields this route actually reads (path, content); extra fields are kept,
// so valid uploads carrying additional metadata still pass.
function isUploadFile(v: unknown): v is UploadFile {
  return isRecord(v) && typeof v.path === 'string' && typeof v.content === 'string'
}

function isSkillFile(path: string): boolean {
  const lower = path.toLowerCase()
  return lower === 'skill.md' || lower.endsWith('/skill.md') || lower.endsWith('.skill')
}

/** Reject path traversal in untrusted upload paths. */
function sanitizeRelativePath(relativePath: string): string | null {
  if (!relativePath || relativePath.startsWith('/') || relativePath.includes('..')) {
    return null
  }
  const parts = relativePath.split('/').filter(p => p && p !== '.')
  if (parts.some(p => p === '..')) return null
  return parts.join('/')
}

function assertSkillDestPath(skillName: string, relativePath: string): string | null {
  const safe = sanitizeRelativePath(relativePath)
  if (!safe) return null
  const dest = `skills/${skillName}/${safe}`
  if (!dest.startsWith(`skills/${skillName}/`)) return null
  return dest
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown
    const rawFiles = isRecord(body) && Array.isArray(body.files) ? body.files : []
    const overrideName = isRecord(body) && typeof body.name === 'string' ? body.name : undefined
    // Optional pack category - injected into the uploaded SKILL.md frontmatter so
    // the skill lands in the right pack. Ignored unless it's a known category.
    const rawCategory = isRecord(body) && typeof body.category === 'string' ? body.category : undefined
    const category = rawCategory && SKILL_CATEGORIES.includes(rawCategory) ? rawCategory : undefined
    // Drop any element that isn't a well-formed { path, content } before it
    // reaches createFile / the secret scanner.
    const files = rawFiles.filter(isUploadFile)

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    // Find SKILL.md or *.skill file
    const hasSkillFile = files.some(f => isSkillFile(f.path))

    if (!hasSkillFile) {
      return NextResponse.json(
        {
          error: 'No SKILL.md or .skill file found.',
        },
        { status: 400 },
      )
    }

    const { name: derivedName, prefix } = deriveSkillName(files)
    const skillName = slugify(overrideName?.trim() ?? '') || derivedName

    if (!skillName) {
      return NextResponse.json(
        {
          error: 'Could not determine skill name. Please provide a name.',
        },
        { status: 400 },
      )
    }

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

      const destPath = assertSkillDestPath(skillName, relativePath)
      if (!destPath) {
        return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
      }

      // Stamp the chosen category onto the skill's SKILL.md frontmatter.
      const content =
        category && relativePath === 'SKILL.md' ? setFrontmatterCategory(file.content, category) : file.content

      await createFile(destPath, content, `feat: upload ${skillName} skill`)
      filesWritten++
    }

    let configUpdated = true
    let configError: string | undefined
    // Locked so this read-modify-write of aeon.yml can't interleave with another
    // request's own unlocked read-modify-write of the same file (see withFileLock).
    const sync = await withFileLock('aeon.yml', async () => {
      try {
        const config = await getFileContent('aeon.yml')
        const updated = addSkillToConfig(config.content, skillName)
        if (updated !== config.content) {
          await updateFile('aeon.yml', updated, config.sha, `chore: add ${skillName} to config`)
        }
      } catch (e: unknown) {
        // The aeon.yml write is a real GitHub-API/file-IO boundary that can throw;
        // the skill files are already on disk, so don't fail the whole upload —
        // but surface it instead of swallowing it silently.
        configUpdated = false
        configError = e instanceof Error ? e.message : 'Failed to update aeon.yml'
        console.error(`upload: failed to add ${skillName} to aeon.yml:`, e)
      }
      return commitAndPush(['aeon.yml', `skills/${skillName}`], `feat: upload ${skillName} skill`)
    })

    // Detect secrets referenced in skill content
    const allContent = files.map(f => f.content).join('\n')
    const detectedSecrets = detectSecretsFromContent(allContent)

    return NextResponse.json({
      name: skillName,
      filesWritten,
      detectedSecrets,
      configUpdated,
      ...(configError ? { configError } : {}),
      ...syncFields(sync),
    })
  } catch (error: unknown) {
    return errorResponse(error, 'Unknown error')
  }
}
