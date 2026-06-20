import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { ForeshadowPanel } from '../components/narrative/ForeshadowPanel'
import { QualityScorePanel } from '../components/narrative/QualityScorePanel'
import { BrainstormPanel } from '../components/narrative/BrainstormPanel'
import { StoryBiblePanel } from '../components/story-bible'
import { logger } from '../utils/logger'

interface QualityData {
  overall: number
  dimensions: Record<string, number>
  critical_issues: string[]
  suggestions: string[]
}

interface ForeshadowAlert {
  foreshadow_id: string
  hint: string
  planted_at: number
  current_chapter: number
  chapters_until_due: number
  urgency: 'approaching' | 'due' | 'overdue'
}

interface NowledgeStatus {
  online: boolean
  host: string
  port: number
  pending_conflicts: number
}

export default function WritingWorkspace() {
  const [text, setText] = useState('')
  const [chapter, setChapter] = useState(1)
  const [quality, setQuality] = useState<QualityData | null>(null)
  const [foreshadows, setForeshadows] = useState<ForeshadowAlert[]>([])
  const [nowledgeStatus, setNowledgeStatus] = useState<NowledgeStatus | null>(null)
  const [rightTab, setRightTab] = useState<'quality' | 'foreshadow' | 'brainstorm' | 'storybible'>('quality')
  const [analyzing, setAnalyzing] = useState(false)

  // 加载 Nowledge Mem 状态
  useEffect(() => {
    invoke<NowledgeStatus>('get_nowledge_status').then(setNowledgeStatus).catch((e) => { logger.error('Failed to load Nowledge status:', e) })
  }, [])

  // 分析质量
  const analyze = useCallback(async () => {
    if (text.length < 20) return
    setAnalyzing(true)
    try {
      const report = await invoke<QualityData>('analyze_quality', { text })
      setQuality(report)
    } catch (e) {
      logger.error('Quality analysis failed:', e)
    } finally {
      setAnalyzing(false)
    }
  }, [text])

  // 刷新伏笔
  const refreshForeshadows = useCallback(async () => {
    try {
      const alerts = await invoke<ForeshadowAlert[]>('get_foreshadow_alerts', { chapter })
      setForeshadows(alerts)
    } catch (e) {
      logger.error('Foreshadow refresh failed:', e)
    }
  }, [chapter])

  // 添加伏笔
  const addForeshadow = useCallback(async (hint: string) => {
    try {
      await invoke('add_foreshadow', { hint, plantedChapter: chapter, maxDistance: 50 })
      refreshForeshadows()
    } catch (e) {
      logger.error('Add foreshadow failed:', e)
    }
  }, [chapter, refreshForeshadows])

  // 回收伏笔
  const resolveForeshadow = useCallback(async (id: string) => {
    try {
      await invoke('resolve_foreshadow', { id })
      refreshForeshadows()
    } catch (e) {
      logger.error('Resolve foreshadow failed:', e)
    }
  }, [refreshForeshadows])

  // 同步知识层
  const syncKnowledge = useCallback(async () => {
    try {
      await invoke('sync_from_knowledge_layer')
      const status = await invoke<NowledgeStatus>('get_nowledge_status')
      setNowledgeStatus(status)
    } catch (e) {
      logger.error('Sync knowledge failed:', e)
    }
  }, [])

  return (
    <div className="flex h-screen bg-zinc-900 text-zinc-100">
      {/* 左侧栏 */}
      <aside className="w-56 border-r border-zinc-800 flex flex-col">
        <div className="p-3 border-b border-zinc-800">
          <h1 className="text-sm font-bold text-zinc-200">niko-studio</h1>
          <p className="text-[10px] text-zinc-500">AI 写作工作站</p>
        </div>

        {/* 章节选择 */}
        <div className="p-3 border-b border-zinc-800">
          <label className="text-[10px] text-zinc-500 block mb-1">当前章节</label>
          <div className="flex items-center gap-2">
            <button onClick={() => { const c = Math.max(1, chapter - 1); setChapter(c); invoke('set_current_chapter', { chapter: c }).catch((err) => logger.error('Failed to set current chapter:', err)) }}
              className="w-7 h-7 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 flex items-center justify-center">-</button>
            <span className="text-lg font-mono font-bold w-10 text-center">{chapter}</span>
            <button onClick={() => { const c = chapter + 1; setChapter(c); invoke('set_current_chapter', { chapter: c }).catch((err) => logger.error('Failed to set current chapter:', err)) }}
              className="w-7 h-7 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 flex items-center justify-center">+</button>
          </div>
        </div>

        {/* Nowledge Mem 状态 */}
        <div className="p-3 border-b border-zinc-800">
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2 h-2 rounded-full ${nowledgeStatus?.online ? 'bg-green-500' : 'bg-zinc-600'}`} />
            <span className="text-[10px] text-zinc-500">Nowledge Mem</span>
          </div>
          <button onClick={syncKnowledge}
            className="w-full text-[10px] py-1 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700">
            同步知识层
          </button>
        </div>

        {/* 快捷操作 */}
        <div className="flex-1 p-3 space-y-1.5">
          <button onClick={analyze} disabled={analyzing}
            className="w-full text-xs py-1.5 rounded bg-blue-600/80 hover:bg-blue-600 disabled:opacity-50">
            {analyzing ? '分析中...' : '分析质量'}
          </button>
          <button onClick={() => setRightTab('foreshadow')}
            className="w-full text-xs py-1.5 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700">
            伏笔管理
          </button>
          <button onClick={() => setRightTab('brainstorm')}
            className="w-full text-xs py-1.5 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700">
            头脑风暴
          </button>
          <button onClick={() => setRightTab('storybible')}
            className="w-full text-xs py-1.5 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700">
            Story Bible
          </button>
        </div>

        {/* 伏笔添加 */}
        <div className="p-3 border-t border-zinc-800">
          <input id="foreshadow-input" placeholder="添加伏笔..." className="w-full text-xs bg-zinc-800 rounded px-2 py-1 text-zinc-300 placeholder:text-zinc-600"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const val = (e.target as HTMLInputElement).value.trim()
                if (val) { addForeshadow(val); (e.target as HTMLInputElement).value = '' }
              }
            }} />
        </div>
      </aside>

      {/* 中央编辑区 */}
      <main className="flex-1 flex flex-col">
        <div className="px-6 py-2 border-b border-zinc-800 flex items-center justify-between">
          <span className="text-xs text-zinc-500">第 {chapter} 章 · {text.length} 字</span>
          {quality && <span className={`text-xs font-mono ${quality.overall >= 70 ? 'text-green-400' : quality.overall >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
            质量 {quality.overall}/100
          </span>}
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="开始写作..."
          className="flex-1 bg-transparent text-zinc-200 text-sm leading-relaxed p-6 resize-none outline-none placeholder:text-zinc-700"
        />
      </main>

      {/* 右侧面板 */}
      <aside className="w-72 border-l border-zinc-800 flex flex-col">
        <div className="flex border-b border-zinc-800">
          {(['quality', 'foreshadow', 'brainstorm', 'storybible'] as const).map(tab => (
            <button key={tab} onClick={() => setRightTab(tab)}
              className={`flex-1 py-2 text-[10px] ${rightTab === tab ? 'text-zinc-200 border-b-2 border-blue-500' : 'text-zinc-600'}`}>
              {{ quality: '质量', foreshadow: '伏笔', brainstorm: '风暴', storybible: 'SB' }[tab]}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {rightTab === 'quality' && quality && (
            <QualityScorePanel dimensions={quality.dimensions} overall={quality.overall}
              criticalIssues={quality.critical_issues} suggestions={quality.suggestions} />
          )}
          {rightTab === 'quality' && !quality && (
            <div className="p-3 text-xs text-zinc-600">点击"分析质量"开始</div>
          )}
          {rightTab === 'foreshadow' && (
            <ForeshadowPanel alerts={foreshadows.map(f => ({
              foreshadowId: f.foreshadow_id,
              hint: f.hint,
              plantedAt: f.planted_at,
              currentChapter: f.current_chapter,
              chaptersUntilDue: f.chapters_until_due,
              urgency: f.urgency,
            }))} onResolve={resolveForeshadow} />
          )}
          {rightTab === 'brainstorm' && (
            <BrainstormPanel analyses={[]} onApply={() => {}} />
          )}
          {rightTab === 'storybible' && (
            <StoryBiblePanel novelId="default" />
          )}
        </div>
      </aside>
    </div>
  )
}
