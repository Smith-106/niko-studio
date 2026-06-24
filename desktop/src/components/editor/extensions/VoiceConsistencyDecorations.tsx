import React, { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { analyzeVoiceConsistency, type VoiceFingerprintResult } from '../../../api/writing-craft'

interface VoiceConsistencyDecorationsProps {
  editor: Editor
  enabled: boolean
}

export type VoiceConsistencySeverity = 'low' | 'medium' | 'high'

function colorForSeverity(sev: VoiceConsistencySeverity): string {
  switch (sev) {
    case 'high':
      return '#dc2626'
    case 'medium':
      return '#d97706'
    default:
      return '#94a3b8'
  }
}

function underlineStyle(sev: VoiceConsistencySeverity): string {
  const color = colorForSeverity(sev)
  return `text-decoration: underline wavy ${color}; text-underline-offset: 3px;`
}

function applyWarnings(editor: Editor, result: VoiceFingerprintResult): void {
  const warnings = result.warnings ?? []

  // Collect paragraph nodes with their positions and text
  const paragraphNodes: Array<{ pos: number; text: string; nodeSize: number }> = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'paragraph') return
    const raw = node.textContent.trim()
    if (!raw) return
    paragraphNodes.push({ pos, text: raw, nodeSize: node.nodeSize })
  })

  const prevSelection = editor.state.selection

  // Clear previous marks
  if (editor.commands && typeof (editor.commands as unknown as { unsetVoiceConsistency?: unknown }).unsetVoiceConsistency === 'function') {
    ;(editor.commands as unknown as { unsetVoiceConsistency: () => void }).unsetVoiceConsistency()
  }

  // Apply marks for each warning by matching warning.line to paragraph text
  for (const warning of warnings) {
    const targetLine = warning.line.trim()
    if (!targetLine) continue

    for (const para of paragraphNodes) {
      if (para.text.includes(targetLine)) {
        const from = para.pos + 1
        const to = para.pos + para.nodeSize - 1
        if (to <= from) continue

        editor.commands.setTextSelection({ from, to })
        editor.commands.setVoiceConsistency(warning.severity as VoiceConsistencySeverity)
        break
      }
    }
  }

  // Restore previous selection
  editor.commands.setTextSelection({ from: prevSelection.from, to: prevSelection.to })
}

export const VoiceConsistencyDecorations: React.FC<VoiceConsistencyDecorationsProps> = ({ editor, enabled }) => {
  const [analysis, setAnalysis] = useState<VoiceFingerprintResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  useEffect(() => {
    if (!enabled) {
      // Clear marks when disabled
      if (editor.commands && typeof (editor.commands as unknown as { unsetVoiceConsistency?: unknown }).unsetVoiceConsistency === 'function') {
        ;(editor.commands as unknown as { unsetVoiceConsistency: () => void }).unsetVoiceConsistency()
      }
      setAnalysis(null)
      setIsAnalyzing(false)
      return
    }

    let cancelled = false
    setIsAnalyzing(true)

    const run = async () => {
      const text = editor.getText()
      const res = await analyzeVoiceConsistency(text)
      if (cancelled) return
      setIsAnalyzing(false)
      if (!res.success || !res.data) return

      setAnalysis(res.data)
      applyWarnings(editor, res.data)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [editor, enabled])

  if (!enabled) return null

  const warningCount = analysis?.warnings?.length ?? 0

  return (
    <div className="absolute top-2 left-2 translate-y-20 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dark-border bg-white/85 dark:bg-dark-surface2/70 backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colorForSeverity('high') }} />
        <span className="text-[11px] text-dark-text-muted">High</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colorForSeverity('medium') }} />
        <span className="text-[11px] text-dark-text-muted">Medium</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colorForSeverity('low') }} />
        <span className="text-[11px] text-dark-text-muted">Low</span>
      </div>

      {isAnalyzing && (
        <div className="ml-2 text-[11px] text-dark-text-muted">分析中...</div>
      )}

      {!isAnalyzing && analysis && (
        <div className="ml-2 text-[11px] text-dark-text-muted">
          {warningCount > 0 ? `发现 ${warningCount} 处语气偏离` : '语气一致'}
        </div>
      )}
    </div>
  )
}

export const voiceConsistencyStyles = {
  underlineStyle,
  colorForSeverity,
}
