import React, { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { analyzeShowTell, type ShowTellAnalysisResult } from '../../../api/writing-craft'
import { ShowTellLegend } from '../../intelligence/ShowTellLegend'

interface ShowTellDecorationsProps {
  editor: Editor
  enabled: boolean
}

type SegmentKind = 'show' | 'tell' | 'neutral'

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function kindFromRatio(ratio: number): SegmentKind {
  if (ratio >= 0.6) return 'show'
  if (ratio <= 0.4) return 'tell'
  return 'neutral'
}

function bgForKind(kind: SegmentKind): string {
  switch (kind) {
    case 'show':
      return 'rgba(16, 185, 129, 0.18)'
    case 'tell':
      return 'rgba(239, 68, 68, 0.16)'
    default:
      return 'rgba(148, 163, 184, 0.12)'
  }
}

function applyShowTellMarks(editor: Editor, analysis: ShowTellAnalysisResult): void {
  const heat = analysis.heatMap

  const paragraphNodes: Array<{ pos: number; text: string; nodeSize: number }> = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'paragraph') return
    const raw = node.textContent.trim()
    if (!raw) return
    paragraphNodes.push({ pos, text: raw, nodeSize: node.nodeSize })
  })

  const prevSelection = editor.state.selection

  if (editor.commands && typeof (editor.commands as unknown as { unsetShowTell?: unknown }).unsetShowTell === 'function') {
    ;(editor.commands as unknown as { unsetShowTell: () => void }).unsetShowTell()
  }

  for (let i = 0; i < paragraphNodes.length; i++) {
    const entry = heat[i]
    if (!entry) continue

    const { pos, nodeSize } = paragraphNodes[i]
    const from = pos + 1
    const to = pos + nodeSize - 1
    if (to <= from) continue

    const kind = kindFromRatio(clamp(entry.ratio, 0, 1))
    editor.commands.setTextSelection({ from, to })
    editor.commands.setShowTell(kind)
  }

  editor.commands.setTextSelection({ from: prevSelection.from, to: prevSelection.to })
}

export const ShowTellDecorations: React.FC<ShowTellDecorationsProps> = ({ editor, enabled }) => {
  const [analysis, setAnalysis] = useState<ShowTellAnalysisResult | null>(null)

  const showTellRatio = analysis?.showTellRatio ?? null

  useEffect(() => {
    if (!enabled) {
      if (editor.commands && typeof (editor.commands as unknown as { unsetShowTell?: unknown }).unsetShowTell === 'function') {
        ;(editor.commands as unknown as { unsetShowTell: () => void }).unsetShowTell()
      }
      setAnalysis(null)
      return
    }

    let cancelled = false

    const run = async () => {
      const text = editor.getText()
      const res = await analyzeShowTell(text)
      if (cancelled) return
      if (!res.success || !res.data) return

      setAnalysis(res.data)
      applyShowTellMarks(editor, res.data)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [editor, enabled])

  if (!enabled) return null

  return (
    <div className="absolute top-2 left-2 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dark-border bg-white/85 dark:bg-dark-surface2/70 backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: bgForKind('show') }} />
        <span className="text-[11px] text-dark-text-muted">Show</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: bgForKind('tell') }} />
        <span className="text-[11px] text-dark-text-muted">Tell</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: bgForKind('neutral') }} />
        <span className="text-[11px] text-dark-text-muted">Neutral</span>
      </div>

      <ShowTellLegend result={analysis} />

      {showTellRatio === null && (
        <div className="ml-2 text-[11px] text-dark-text-muted">分析中...</div>
      )}
    </div>
  )
}
