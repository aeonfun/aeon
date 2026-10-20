import { parseFrontmatter } from './frontmatter'
import type { UploadFile } from './types'
import { slugify } from './utils'

function extractSkillName(content: string): string {
  // Slugify the frontmatter name: "Fleet Scorecard" → "fleet-scorecard"
  const { name } = parseFrontmatter(content)
  return slugify(name)
}

function stripSkillExt(name: string): string {
  return name.replace(/\.skill$/i, '')
}

// The skill folder name for an upload, and the path prefix to strip from its
// files. Every source is slugified: a folder like "My Skill" must not become
// skills/My Skill/, a name the rest of Aeon (aeon.yml keys, the scheduler,
// the DELETE route's /^[a-z][a-z0-9-]*$/) does not accept.
export function deriveSkillName(files: UploadFile[]): { name: string; prefix: string } {
  // First try SKILL.md
  const skillFile = files.find(
    f =>
      f.path === 'SKILL.md' ||
      f.path.endsWith('/SKILL.md') ||
      f.path.toLowerCase() === 'skill.md' ||
      f.path.toLowerCase().endsWith('/skill.md'),
  )

  // Then try *.skill files
  const dotSkillFile = !skillFile ? files.find(f => f.path.toLowerCase().endsWith('.skill')) : null

  if (dotSkillFile) {
    const parts = dotSkillFile.path.split('/')
    const fileName = parts[parts.length - 1]
    const name = slugify(stripSkillExt(fileName))

    if (parts.length === 1) {
      // Single file: "my-skill.skill"
      return { name, prefix: '' }
    }
    // In a folder: "folder/my-skill.skill"
    const folderName = slugify(stripSkillExt(parts[0]))
    return { name: folderName || name, prefix: parts.slice(0, -1).join('/') + '/' }
  }

  if (!skillFile) {
    return { name: '', prefix: '' }
  }

  const parts = skillFile.path.split('/')

  // Case 1: "soul/SKILL.md" → name is "soul", prefix is "soul/"
  if (parts.length === 2) {
    const name = slugify(stripSkillExt(parts[0]))
    return { name, prefix: parts[0] + '/' }
  }

  // Case 2: "some/deep/path/soul/SKILL.md" → name is "soul", prefix is "some/deep/path/soul/"
  if (parts.length > 2) {
    const name = slugify(stripSkillExt(parts[parts.length - 2]))
    const prefix = parts.slice(0, -1).join('/') + '/'
    return { name, prefix }
  }

  // Case 3: Just "SKILL.md" (no folder) → extract name from frontmatter
  const fmName = extractSkillName(skillFile.content)
  return { name: fmName, prefix: '' }
}
