'use client'

import { useState } from 'react'
import type { Run, SkillOutput, AnalyticsData } from '../lib/types'
import { timeAgo } from '../lib/utils'
import { SpecNode } from './SpecNode'

interface RightPanelProps {
  runs: Run[]
  outputs: SkillOutput[]
  feedLoading: boolean
  analyticsData: AnalyticsData | null
  onViewRun: (run: Run) => void
  onRefresh: () => void
  onFetchAnalytics: () => void
}

export function RightPanel({ runs, outputs, feedLoading, analyticsData, onViewRun, onRefresh, onFetchAnalytics }: RightPanelProps) {
  const [rightTab, setRightTab] = useState<'feed' | 'runs' | 'analytics'>('feed')
  const [selectedRun, setSelectedRun] = useState<Run | null>(null)
  const [runLogs, setRunLogs] = useState('')
  const [runSummary, setRunSummary] = useState('')
  const [logsLoading, setLogsLoading] = useState(false)
  const [showFullLogs, setShowFullLogs] = useState(false)

  const viewRunLogs = async (run: Run) => {
    setSelectedRun(run); setRunLogs(''); setRunSummary(''); setShowFullLogs(false); setLogsLoading(true); setRightTab('runs')
    try { const r = await fetch(`/api/runs/${run.id}/logs`); if (r.ok) { const d = await r.json(); setRunSummary(d.summary || ''); setRunLogs(d.logs || '') } } catch { setRunLogs('Failed') } finally { setLogsLoading(false) }
  }

  const handleViewRun = (run: Run) => {
    viewRunLogs(run)
    onViewRun(run)
  }

  return (
    <div className="w-[320px] border-l-2 border-[rgba(10,10,10,0.06)] flex flex-col shrink-0 bg-white">
      <div className="h-12 border-b-2 border-[rgba(10,10,10,0.06)] flex items-center px-3 gap-1 shrink-0">
        {(['feed', 'runs', 'analytics'] as const).map(tab => (
          <button key={tab} onClick={() => { setRightTab(tab); if (tab === 'analytics') onFetchAnalytics() }}
            className={`text-[11px] px-2.5 py-1.5 transition-colors font-mono uppercase tracking-[1px] ${rightTab === tab ? 'bg-eva-black text-white' : 'text-primary-40 hover:text-primary-70'}`}>{tab}</button>
        ))}
        <button onClick={onRefresh} className="text-[11px] text-primary-35 hover:text-eva-orange transition-colors ml-auto font-mono">Refresh</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Feed */}
        {rightTab === 'feed' && (
          feedLoading ? <div className="flex justify-center py-12"><div className="w-2 h-2 rounded-full bg-eva-orange animate-pulse" /></div> :
          outputs.length > 0 ? (
          <div className="space-y-3 p-3">
            {outputs.map(o => (
              <div key={o.filename}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[11px] font-mono text-eva-orange">{o.skill}</span>
                  <span className="text-[11px] text-primary-35 font-mono">{timeAgo(o.timestamp)}</span>
                </div>
                {o.spec?.root && o.spec?.elements ? <SpecNode id={o.spec.root} elements={o.spec.elements} /> : null}
              </div>
            ))}
          </div>
          ) : (
          <div>
            {!runs.length ? <div className="px-4 py-12 text-center text-xs text-primary-35 font-mono">No activity yet</div> :
              runs.map(run => (
                <button key={run.id} onClick={() => handleViewRun(run)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 border-b border-[rgba(10,10,10,0.04)] hover:bg-eva-gray transition-colors text-left">
                  <span className={`text-xs ${run.conclusion === 'success' ? 'text-eva-green' : run.conclusion === 'failure' ? 'text-eva-red' : run.status === 'in_progress' ? 'text-eva-orange' : 'text-primary-35'}`}>
                    {run.conclusion === 'success' ? '\u2713' : run.conclusion === 'failure' ? '\u2717' : run.status === 'in_progress' ? '\u25cc' : '\u00b7'}
                  </span>
                  <span className="text-xs text-primary-70 truncate flex-1 font-mono">{run.workflow}</span>
                  <span className="text-[11px] text-primary-35 font-mono tabular-nums">{timeAgo(run.created_at)}</span>
                </button>
              ))}
          </div>
          )
        )}

        {/* Runs */}
        {rightTab === 'runs' && (
          selectedRun ? (
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-2 px-3 py-2.5 border-b-2 border-[rgba(10,10,10,0.06)]">
                <button onClick={() => { setSelectedRun(null); setRunLogs(''); setRunSummary('') }} className="text-primary-40 hover:text-primary-100 text-xs">&larr;</button>
                <span className="font-mono text-xs text-primary-70 truncate flex-1">{selectedRun.workflow}</span>
                <a href={selectedRun.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary-40 font-mono border-2 border-[rgba(10,10,10,0.08)] px-2 py-0.5 hover:border-eva-orange hover:text-eva-orange transition-colors">GitHub</a>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {logsLoading ? <div className="flex justify-center py-8"><div className="w-2 h-2 rounded-full bg-eva-orange animate-pulse" /></div> : (
                  <div className="space-y-3">
                    {runSummary ? (
                      <>
                        <pre className="text-[11px] leading-relaxed font-mono text-primary-70 whitespace-pre-wrap break-words">{runSummary.replace(/\x1b\[[0-9;]*m/g, '').replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z ?/gm, '')}</pre>
                        <button onClick={() => setShowFullLogs(!showFullLogs)} className="text-[11px] text-primary-40 hover:text-eva-orange font-mono transition-colors">{showFullLogs ? '- Hide full logs' : '+ Show full logs'}</button>
                        {showFullLogs && <pre className="text-[11px] font-mono text-primary-50 whitespace-pre-wrap break-words border-t-2 border-[rgba(10,10,10,0.06)] pt-3">{runLogs.replace(/\x1b\[[0-9;]*m/g, '')}</pre>}
                      </>
                    ) : (
                      <pre className="text-[11px] font-mono text-primary-50 whitespace-pre-wrap break-words">{runLogs.replace(/\x1b\[[0-9;]*m/g, '')}</pre>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              {!runs.length ? <div className="px-4 py-12 text-center text-xs text-primary-35 font-mono">No runs</div> :
                runs.map(run => (
                  <button key={run.id} onClick={() => viewRunLogs(run)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 border-b border-[rgba(10,10,10,0.04)] hover:bg-eva-gray transition-colors text-left">
                    <span className={`text-xs ${run.conclusion === 'success' ? 'text-eva-green' : run.conclusion === 'failure' ? 'text-eva-red' : run.status === 'in_progress' ? 'text-eva-orange' : 'text-primary-35'}`}>
                      {run.conclusion === 'success' ? '\u2713' : run.conclusion === 'failure' ? '\u2717' : run.status === 'in_progress' ? '\u25cc' : '\u00b7'}
                    </span>
                    <span className="text-xs text-primary-70 truncate flex-1 font-mono">{run.workflow}</span>
                    <span className="text-[11px] text-primary-35 font-mono tabular-nums">{timeAgo(run.created_at)}</span>
                  </button>
                ))}
            </div>
          )
        )}

        {/* Analytics */}
        {rightTab === 'analytics' && (
          !analyticsData ? <div className="flex justify-center py-12"><div className="w-2 h-2 rounded-full bg-eva-orange animate-pulse" /></div> : (
            <div className="p-3 space-y-4">
              <div className="grid grid-cols-2 gap-[var(--space-xs)]">
                <div className="card-hst p-3"><div className="text-label">Runs</div><div className="font-display text-2xl mt-1">{analyticsData.summary.totalRuns}</div></div>
                <div className="card-hst p-3"><div className="text-label">Success</div><div className={`font-display text-2xl mt-1 ${analyticsData.summary.overallSuccessRate >= 80 ? 'text-eva-green' : analyticsData.summary.overallSuccessRate >= 50 ? 'text-eva-amber' : 'text-eva-red'}`}>{analyticsData.summary.overallSuccessRate}%</div></div>
              </div>
              {analyticsData.insights.length > 0 && (
                <div className="space-y-1.5">
                  {analyticsData.insights.map((ins, i) => (
                    <div key={i} className={`text-[11px] font-mono px-3 py-2 border-2 ${ins.type === 'warning' ? 'text-eva-orange bg-orange-50 border-orange-200' : ins.type === 'success' ? 'text-eva-green bg-green-50 border-green-200' : 'text-blue-600 bg-blue-50 border-blue-200'}`}>{ins.message}</div>
                  ))}
                </div>
              )}
              <div className="space-y-1">
                {analyticsData.skills.map(s => (
                  <div key={s.name} className="flex items-center gap-2 py-1">
                    <span className={`text-xs w-3 text-center ${s.lastConclusion === 'success' ? 'text-eva-green' : s.lastConclusion === 'failure' ? 'text-eva-red' : 'text-primary-35'}`}>
                      {s.lastConclusion === 'success' ? '\u2713' : s.lastConclusion === 'failure' ? '\u2717' : '\u00b7'}
                    </span>
                    <span className="font-mono text-[11px] text-primary-70 w-28 truncate">{s.name}</span>
                    <div className="flex-1 h-2 bg-eva-gray overflow-hidden flex">
                      {s.success > 0 && <div className="bg-eva-green/60 h-full" style={{ width: `${(s.success / Math.max(...analyticsData.skills.map(sk => sk.total), 1)) * 100}%` }} />}
                      {s.failure > 0 && <div className="bg-eva-red/40 h-full" style={{ width: `${(s.failure / Math.max(...analyticsData.skills.map(sk => sk.total), 1)) * 100}%` }} />}
                    </div>
                    <span className={`text-[10px] font-mono tabular-nums w-8 text-right ${s.successRate >= 80 ? 'text-eva-green' : s.successRate >= 50 ? 'text-eva-amber' : 'text-eva-red'}`}>{s.successRate}%</span>
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}
