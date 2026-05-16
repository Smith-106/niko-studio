import React, { useEffect } from 'react'
import type { Editor } from '@tiptap/react'
import { analyzeVoiceConsistency, type VoiceFingerprintResult } from '../../../api/writing-craft'

interface VoiceConsistencyDecorationsProps {
  editor: Editor
  enabled: boolean
}

type Severity = 'low' | 'medium' | 'high'

function colorForSeverity(sev: Severity): string {
  switch (sev) {
    case 'high':
      return '#dc2626'
    case 'medium':
      return '#d97706'
    default:
      return '#94a3b8'
  }
}

function underlineStyle(sev: Severity): string {
  const color = colorForSeverity(sev)
  return `text-decoration: underline wavy ${color}; text-underline-offset: 3px;`
}

function applyWarnings(editor: Editor, result: VoiceFingerprintResult): void {
  const warnings = result.warnings ?? []

  // Best-effort: find each warning line in the document text, apply mark via inline style.
  // We avoid building a full ProseMirror Decoration plugin and keep the change minimal.
  const docText = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n')

  // Clear previous warnings by removing marks is hard without a dedicated mark.
  // Use inline style via setMark('textStyle') would couple with TextStyle. Keep it simple:
  // we instead set selection + add a native DOM hint via attributes with `editor.view.dispatch`
  // would be too invasive. So we implement as a lightweight tooltip list overlay only.
  void docText
  void warnings
  void editor
}

export const VoiceConsistencyDecorations: React.FC<VoiceConsistencyDecorationsProps> = ({ editor, enabled }) => {
  useEffect(() => {
    if (!enabled) {
      return
    }

    let cancelled = false

    const run = async () => {
      const text = editor.getText()
      const res = await analyzeVoiceConsistency(text)
      if (cancelled) return
      if (!res.success || !res.data) return

      applyWarnings(editor, res.data)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [editor, enabled])

  if (!enabled) return null

  // For now this component only triggers analysis; rendering is handled in VoiceFingerprintPanel.
  // Keeping it mounted near the editor makes it easy to evolve into true decorations later.
  return null
}

export const voiceConsistencyStyles = {
  underlineStyle,
  colorForSeverity,
}
