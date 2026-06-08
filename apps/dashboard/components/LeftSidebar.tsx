'use client'

import { useState } from 'react'
import type { Skill, Run } from '../lib/types'
import { DEPARTMENTS } from '../lib/constants'
import { displayName, initials, getSkillStatus, statusDot } from '../lib/utils'

interface LeftSidebarProps {
  view: 'hq' | 'secrets' | 'strategy' | 'mcp'
  setView: (v: 'hq' | 'secrets' | 'strategy' | 'mcp') => void
  selectedSkill: string | null
  setSelectedSkill: (s: string | null) => void
  skills: Skill[]
  runs: Run[]
  repo: string
  enabledCount: number
  workingCount: number
  onSkillSelect: (name: string) => void
}

export function LeftSidebar({ view, setView, selectedSkill, skills, runs, repo, enabledCount, workingCount, onSkillSelect }: LeftSidebarProps) {
  const [skillSearch, setSkillSearch] = useState('')

  const departments = new Map<string, Skill[]>()
  skills.forEach(s => { const t = s.tags?.[0] || 'meta'; if (!departments.has(t)) departments.set(t, []); departments.get(t)!.push(s) })

  return (
    <div className="w-[240px] border-r border-[rgba(250,250,250,0.10)] flex flex-col shrink-0 bg-aeon-panel">
      {/* Brand */}
      <div className="px-4 py-4 border-b border-[rgba(250,250,250,0.10)]">
        <div className="flex items-center gap-3">
          <span className="brand-dot" aria-hidden="true" />
          <div className="min-w-0">
            <div className="font-display text-lg leading-tight uppercase tracking-tight text-aeon-fg truncate">
              {repo ? repo.split('/').pop() : 'Aeon'} HQ
            </div>
            <div className="text-[10px] text-primary-40 font-mono uppercase tracking-[0.18em]">
              {enabledCount} on duty
              {workingCount > 0 ? <span className="text-eva-orange"> · {workingCount} working</span> : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="px-2 py-2 border-b border-[rgba(250,250,250,0.10)] space-y-0.5">
        {[
          { id: 'hq', label: 'HQ', icon: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z' },
          { id: 'strategy', label: 'Strategy', icon: 'M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5' },
          { id: 'secrets', label: 'Settings', icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z' },
          { id: 'mcp', label: 'MCP', icon: 'M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z' },
        ].map(item => (
          <button key={item.id} onClick={() => { setView(item.id as 'hq' | 'secrets' | 'strategy' | 'mcp'); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-mono uppercase tracking-[0.14em] transition-all ${view === item.id && !selectedSkill ? 'bg-aeon-bg text-aeon-fg border-l-2 border-aeon-red pl-[10px]' : 'text-primary-50 hover:text-primary-100 hover:bg-aeon-bg'}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={item.icon} /></svg>
            {item.label}
          </button>
        ))}
      </div>

      {/* Team roster */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-4 pb-1"><span className="text-label">Team</span></div>
        <div className="px-3 pb-2">
          <input type="text" value={skillSearch} onChange={(e) => setSkillSearch(e.target.value)} placeholder="Search members..." className="w-full bg-aeon-bg text-aeon-fg text-[11px] px-3 py-2 border border-[rgba(250,250,250,0.10)] outline-none font-mono focus:border-aeon-red transition-colors placeholder:text-primary-35" />
        </div>
        {[...departments.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([tag, tagSkills]) => {
          const filtered = skillSearch ? tagSkills.filter(s => displayName(s.name).toLowerCase().includes(skillSearch.toLowerCase()) || s.name.includes(skillSearch.toLowerCase())) : tagSkills
          if (skillSearch && !filtered.length) return null
          const d = DEPARTMENTS[tag] || DEPARTMENTS.meta
          const en = filtered.filter(s => s.enabled).length
          return (
            <div key={tag} className="mb-1">
              <div className="flex items-center gap-2 px-4 py-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                <span className="text-[11px] font-mono text-primary-40 uppercase tracking-[2px] flex-1">{d.label}</span>
                <span className="text-[11px] font-mono text-primary-35">{en}</span>
              </div>
              {filtered.sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name)).map(s => {
                const st = getSkillStatus(s.name, s.enabled, runs)
                const sel = selectedSkill === s.name
                return (
                  <button key={s.name} onClick={() => onSkillSelect(s.name)}
                    className={`w-full flex items-center gap-2.5 px-4 py-2 transition-all text-left ${sel ? 'bg-aeon-bg selected-indicator' : 'hover:bg-aeon-bg'}`}>
                    <div className="w-7 h-7 flex items-center justify-center text-[10px] font-bold shrink-0 text-white" style={{ backgroundColor: s.enabled ? d.color : 'rgba(250,250,250,0.15)' }}>
                      {initials(s.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-primary-100 truncate">{displayName(s.name)}</div>
                      <div className="flex items-center gap-1.5">
                        <div className={statusDot(st.color)} />
                        <span className="text-[10px] text-primary-40 font-mono truncate">{st.label}</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
