import { NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import { resolve } from 'path'
import { readFileSync } from 'fs'
import { REPO_ROOT, ghArgsRepo } from '@/lib/gh'
import { errorResponse } from '@/lib/http'
import type { SkillMetrics, Insight, GhRunJson } from '@/lib/types'

type RunRecord = Pick<GhRunJson, 'name' | 'status' | 'conclusion' | 'createdAt' | 'updatedAt'>

export async function GET() {
  try {
    const out = execFileSync(
      'gh',
      ['run', 'list', ...ghArgsRepo(), '--json', 'name,status,conclusion,createdAt,updatedAt', '--limit', '200'],
      { stdio: 'pipe', cwd: REPO_ROOT, timeout: 30000 },
    ).toString()
    const raw = JSON.parse(out) as RunRecord[]

    // Group by skill name (extract from "skill: <name>" or "skill: <name> (<var>)")
    const bySkill = new Map<string, RunRecord[]>()
    for (const run of raw) {
      const match = run.name.match(/^skill:\s*(\S+)/)
      if (!match) continue
      const skill = match[1]
      if (!bySkill.has(skill)) bySkill.set(skill, [])
      bySkill.get(skill)!.push(run)
    }

    const skills: SkillMetrics[] = []
    for (const [name, runs] of bySkill) {
      const sorted = runs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      const success = sorted.filter(r => r.conclusion === 'success').length
      const failure = sorted.filter(r => r.conclusion === 'failure').length
      const inProgress = sorted.filter(r => r.status === 'in_progress').length
      const total = sorted.length
      const completed = total - inProgress

      let streak = 0
      if (sorted.length > 0) {
        const first = sorted[0].conclusion
        if (first === 'success' || first === 'failure') {
          const dir = first === 'success' ? 1 : -1
          for (const r of sorted) {
            if (r.conclusion === first) streak += dir
            else break
          }
        }
      }

      skills.push({
        name,
        total,
        success,
        failure,
        inProgress,
        // Rate over *completed* runs: a skill whose only runs are in-progress
        // would otherwise divide by zero and render as NaN.
        successRate: completed > 0 ? Math.round((success / completed) * 100) : 0,
        lastRun: sorted[0]?.createdAt || null,
        lastConclusion: sorted[0]?.conclusion || null,
        streak,
      })
    }

    skills.sort((a, b) => b.total - a.total)

    const insights: Insight[] = []
    const now = Date.now()
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000

    for (const s of skills) {
      if (s.total >= 3 && s.successRate < 50) {
        insights.push({
          type: 'warning',
          message: `${s.name} has a ${s.successRate}% success rate (${s.failure} failures out of ${s.total} runs)`,
        })
      }
    }

    for (const s of skills) {
      if (s.streak <= -3) {
        insights.push({
          type: 'warning',
          message: `${s.name} has failed ${Math.abs(s.streak)} times in a row`,
        })
      }
    }

    try {
      const ymlPath = resolve(REPO_ROOT, 'aeon.yml')
      const yml = readFileSync(ymlPath, 'utf-8')
      const enabledSkills: string[] = []
      const lines = yml.split('\n')
      for (const line of lines) {
        // Capture only the inline brace body ([^}]*) so a trailing
        // "# ... enabled:true ..." comment can't trigger a false positive.
        const m = line.match(/^\s+(\S+):\s*\{([^}]*)\}/)
        if (m && /enabled:\s*true/.test(m[2])) enabledSkills.push(m[1])
      }

      for (const skillName of enabledSkills) {
        const metrics = skills.find(s => s.name === skillName)
        if (!metrics) {
          insights.push({
            type: 'info',
            message: `${skillName} is enabled but has no recorded runs`,
          })
        } else if (metrics.lastRun && now - new Date(metrics.lastRun).getTime() > threeDaysMs) {
          const daysAgo = Math.floor((now - new Date(metrics.lastRun).getTime()) / (24 * 60 * 60 * 1000))
          insights.push({
            type: 'info',
            message: `${metrics.name} hasn't run in ${daysAgo} days`,
          })
        }
      }
    } catch {
      // aeon.yml not readable, skip enabled-skill insights
    }

    for (const s of skills) {
      if (s.total >= 5 && s.successRate === 100) {
        insights.push({
          type: 'success',
          message: `${s.name} has a perfect 100% success rate across ${s.total} runs`,
        })
      }
    }

    const totalRuns = skills.reduce((s, sk) => s + sk.total, 0)
    const totalSuccess = skills.reduce((s, sk) => s + sk.success, 0)
    const overallRate = totalRuns > 0 ? Math.round((totalSuccess / totalRuns) * 100) : 0

    return NextResponse.json({
      skills,
      insights,
      summary: {
        totalRuns,
        overallSuccessRate: overallRate,
      },
    })
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to load analytics')
  }
}
