import { getEditorHandle, type EditorSelectionSnapshot } from './editorHandle'

export interface RevisionCopy {
  previewTitle: string
  originalLabel: string
  candidateLabel: string
  replaceLabel: string
  alternativeLabel: string
  undoLabel: string
  replacedMessage: string
  alternativeMessage: string
  insertedMessage: string
  selectionChangedMessage: string
  undoSuccessMessage: string
  undoFailedMessage: string
}

export interface RevisionCandidate {
  sourceText: string
  candidateText: string
  selectionSnapshot: EditorSelectionSnapshot | null
}

export function getRevisionCopy(language: 'zh' | 'en'): RevisionCopy {
  if (language === 'zh') {
    return {
      previewTitle: '修改预览',
      originalLabel: '原文',
      candidateLabel: '建议版本',
      replaceLabel: '替换选区',
      alternativeLabel: '作为备选插入',
      undoLabel: '撤销上次应用',
      replacedMessage: '已替换当前选区。',
      alternativeMessage: '已作为备选插入到原文后。',
      insertedMessage: '已插入到编辑器。',
      selectionChangedMessage: '当前选区已变化，请重新选择后再试。',
      undoSuccessMessage: '已撤销上次应用。',
      undoFailedMessage: '没有可撤销的最近应用。',
    }
  }

  return {
    previewTitle: 'Revision preview',
    originalLabel: 'Original',
    candidateLabel: 'Candidate',
    replaceLabel: 'Replace selection',
    alternativeLabel: 'Insert as alternative',
    undoLabel: 'Undo last apply',
    replacedMessage: 'Replaced the current selection.',
    alternativeMessage: 'Inserted the candidate below the original selection.',
    insertedMessage: 'Inserted into the editor.',
    selectionChangedMessage: 'The current selection changed. Re-select the text and try again.',
    undoSuccessMessage: 'Undid the last apply action.',
    undoFailedMessage: 'There is no recent apply action to undo.',
  }
}

export function captureMatchedSelectionSnapshot(sourceText: string): EditorSelectionSnapshot | null {
  const snapshot = getEditorHandle()?.captureSelectionSnapshot() ?? null
  if (!snapshot) {
    return null
  }

  return snapshot.text.trim() === sourceText.trim() ? snapshot : null
}

export function applyRevisionCandidateToEditor(candidate: RevisionCandidate, copy: RevisionCopy): string | null {
  const handle = getEditorHandle()
  if (!handle) {
    return null
  }

  if (candidate.selectionSnapshot) {
    const replaced = handle.replaceSelectionSnapshot(candidate.selectionSnapshot, candidate.candidateText)
    return replaced ? copy.replacedMessage : copy.selectionChangedMessage
  }

  handle.insertText(candidate.candidateText)
  return copy.insertedMessage
}

export function insertRevisionAlternativeToEditor(candidate: RevisionCandidate, copy: RevisionCopy): string | null {
  const handle = getEditorHandle()
  if (!handle) {
    return null
  }

  if (candidate.selectionSnapshot) {
    const inserted = handle.insertBelowSelectionSnapshot(candidate.selectionSnapshot, candidate.candidateText)
    return inserted ? copy.alternativeMessage : copy.selectionChangedMessage
  }

  handle.insertText(candidate.candidateText)
  return copy.insertedMessage
}

export function undoLastRevisionApplyInEditor(copy: RevisionCopy): string | null {
  const handle = getEditorHandle()
  if (!handle) {
    return null
  }

  const undone = handle.undoLastRevisionApply()
  return undone ? copy.undoSuccessMessage : copy.undoFailedMessage
}
