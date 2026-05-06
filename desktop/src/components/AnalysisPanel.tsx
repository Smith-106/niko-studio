import React, { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import type { AnalysisModule } from '../api/intelligence'
import { runCrossChapterConsistency } from '../api/m10-apis'
import { AccordionWrapper, IntelligenceBadge, MetricValue, ProgressBar, SectionHeader } from './intelligence'

interface PanelProps {
  onClose: () => void
}

type TabId = 'character_arc' | 'pacing' | 'consistency' | 'readability'

const TAB_LABELS: Record<TabId, string> = {
  character_arc: '角色弧线',
  pacing: '节奏分析',
  consistency: '一致性检查',
  readability: '可读性评分',
}

const TAB_ICONS: Record<TabId, string> = {
  character_arc: '🎭',
  pacing: '📈',
  consistency: '🔗',
  readability: '📖',
}

export const AnalysisPanel: React.FC<PanelProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<TabId>('character_arc')
  const {
    analysisResults,
    isAnalyzing,
    analysisProgress,
    analysisError,
    startAnalysis,
    loadCachedResult,
    clearAnalysis,
    currentProjectId,
    getChaptersForProject,
  } = useAppStore()

  const chapters = currentProjectId ? getChaptersForProject(currentProjectId) : []
  const [crossChapterResult, setCrossChapterResult] = useState<Record<string, unknown> | null>(null)
  const [crossChapterLoading, setCrossChapterLoading] = useState(false)

  const handleCrossChapterConsistency = useCallback(async () => {
    if (chapters.length < 2) return
    setCrossChapterLoading(true)
    try {
      const chapterData = chapters.map((c, i) => ({
        chapterNumber: i + 1,
        title: c.title || '',
        content: '',
      }))
      const res = await runCrossChapterConsistency({ chapters: chapterData })
      setCrossChapterResult(res.success && res.data ? res.data : null)
    } catch {
      setCrossChapterResult(null)
    } finally {
      setCrossChapterLoading(false)
    }
  }, [chapters])

  useEffect(() => {
    if (currentProjectId) {
      loadCachedResult(currentProjectId, activeTab)
    }
  }, [currentProjectId, activeTab, loadCachedResult])

  const handleAnalyze = useCallback(() => {
    if (!currentProjectId) return
    const chapterIds = chapters.map((c) => c.id)
    startAnalysis(currentProjectId, activeTab as AnalysisModule, chapterIds)
  }, [currentProjectId, activeTab, chapters, startAnalysis])

  const result = analysisResults[activeTab as AnalysisModule]

  return (
    <div
      className="w-[400px] h-full bg-dark-bg-2 border-l border-dark-border text-white flex flex-col"
      role="region"
      aria-label="智能分析"
    >
      <div className="p-4 border-b border-dark-border flex-shrink-0">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-bold uppercase tracking-wider">智能分析</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={clearAnalysis}
              className="text-xs text-gray-400 hover:text-white px-2 py-1"
            >
              清空
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-lg">&times;</button>
          </div>
        </div>
      </div>

      <div className="flex border-b border-dark-border flex-shrink-0">
        {(Object.keys(TAB_LABELS) as TabId[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-1 text-xs text-center transition-colors ${
              activeTab === tab
                ? 'text-primary-cta border-b-2 border-primary-cta'
                : 'text-dark-text-muted hover:text-white'
            }`}
          >
            <span className="block text-base mb-0.5">{TAB_ICONS[tab]}</span>
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <div className="p-4 flex-shrink-0">
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || chapters.length === 0}
          className="w-full py-2 px-4 bg-primary-cta text-white text-sm font-medium rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {isAnalyzing ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⏳</span>
              分析中 ({analysisProgress.processed}/{analysisProgress.total})
            </span>
          ) : (
            `分析 ${chapters.length} 个章节`
          )}
        </button>
        {isAnalyzing && <ProgressBar value={(analysisProgress.processed / Math.max(analysisProgress.total, 1)) * 100} />}
      </div>

      {analysisError && (
        <div className="px-4 py-2 text-xs text-danger-500 bg-danger-500/10">{analysisError}</div>
      )}

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {result ? (
          <AnalysisResultView module={activeTab} result={result} />
        ) : (
          <p className="text-center text-dark-text-muted text-sm">
            {chapters.length === 0 ? '暂无章节可分析' : '点击按钮开始分析'}
          </p>
        )}

        {activeTab === 'consistency' && (
          <div className="mt-4 border-t border-dark-border pt-4">
            <SectionHeader title="跨章一致性检测" />
            <button
              onClick={() => { void handleCrossChapterConsistency() }}
              disabled={crossChapterLoading || chapters.length < 2}
              className="w-full py-2 px-4 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {crossChapterLoading ? '检测中...' : `跨章一致性检测 (${chapters.length} 章)`}
            </button>
            {chapters.length < 2 && (
              <p className="text-xs text-dark-text-muted mt-1">需要至少 2 个章节才能执行跨章检测</p>
            )}
            {crossChapterResult && (
              <div className="mt-3 space-y-2">
                {((crossChapterResult.nameConflicts || []) as Array<Record<string, unknown>>).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-yellow-400 mb-1">命名冲突</p>
                    {((crossChapterResult.nameConflicts || []) as Array<Record<string, unknown>>).map((nc, i) => (
                      <div key={i} className="text-xs text-dark-text-muted bg-dark-card rounded p-2 mb-1">
                        <IntelligenceBadge variant="warning">{String(nc.similarity || '')}</IntelligenceBadge>
                        {' '}{String(nc.name1 || '')} ↔ {String(nc.name2 || '')}
                      </div>
                    ))}
                  </div>
                )}
                {((crossChapterResult.unresolvedThreads || []) as Array<Record<string, unknown>>).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-orange-400 mb-1">未解决线索</p>
                    {((crossChapterResult.unresolvedThreads || []) as Array<Record<string, unknown>>).map((ut, i) => (
                      <div key={i} className="text-xs text-dark-text-muted bg-dark-card rounded p-2 mb-1">
                        第 {String(ut.introducedInChapter || '?')} 章引入: {String(ut.description || '')}
                      </div>
                    ))}
                  </div>
                )}
                {!((crossChapterResult.nameConflicts || []) as unknown[]).length &&
                 !((crossChapterResult.unresolvedThreads || []) as unknown[]).length && (
                  <p className="text-xs text-green-400">未发现跨章一致性问题</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface AnalysisResultViewProps {
  module: TabId
  result: { chaptersAnalyzed: string[]; result: Record<string, unknown>; createdAt: string }
}

const AnalysisResultView: React.FC<AnalysisResultViewProps> = ({ module, result }) => {
  const data = result.result as Record<string, unknown> | undefined
  if (!data) return <p className="text-dark-text-muted text-sm">无分析结果</p>

  const summary = data.summary as string | undefined
  const score = data.score as number | undefined
  const details = data.details as Record<string, unknown>[] | undefined

  return (
    <div className="space-y-4">
      <div>
        <SectionHeader title="分析概览" />
        <div className="flex gap-4">
          <MetricValue
            value={score != null ? `${Math.round(score * 100)}` : '—'}
            label="评分"
          />
          <MetricValue
            value={String(result.chaptersAnalyzed)}
            label="已分析章节"
          />
        </div>
      </div>

      {summary && (
        <div>
          <SectionHeader title="摘要" />
          <p className="text-sm text-dark-text">{summary}</p>
        </div>
      )}

      {details && details.length > 0 && (
        <div>
          <SectionHeader title={`${TAB_LABELS[module]}详情`} />
          <AccordionWrapper
            mode="multi"
            items={details.map((item, i) => ({
              id: `detail-${i}`,
              header: (
                <span className="text-sm font-medium">
                  {(item.title as string) || `条目 ${i + 1}`}
                </span>
              ),
              content: (
                <div className="space-y-1">
                  {(typeof item.description === 'string') && (
                    <p className="text-xs text-dark-text-muted">{item.description}</p>
                  )}
                  {(typeof item.severity === 'string') && (
                    <IntelligenceBadge
                      variant={item.severity === 'high' ? 'danger' : item.severity === 'medium' ? 'warning' : 'success'}
                    >
                      {item.severity}
                    </IntelligenceBadge>
                  )}
                </div>
              ),
            }))}
          />
        </div>
      )}
    </div>
  )
}
