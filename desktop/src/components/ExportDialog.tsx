import { useRef, useCallback, useState } from 'react'
import { X, Download, Clock } from 'lucide-react'
import type { JSONContent } from '@tiptap/react'
import { exportToMarkdown, exportToHtml, exportToPdf, downloadFile } from '../utils/export'
import { useI18n } from '../i18n'
import { useDialogFocusTrap } from '../hooks/useDialogFocusTrap'
import { useExportHistory } from '../hooks/useExportHistory'
import { useAppStore } from '../stores/appStore'

// Lazy-loaded docx export — ~150KB, only needed when user exports to docx
async function getDocxExporter() {
  const { generateDocx, generateProjectDocx } = await import('../utils/exportDocx')
  return { generateDocx, generateProjectDocx }
}

type ExportFormat = 'md' | 'html' | 'pdf' | 'docx'
type ExportScope = 'current' | 'project'

interface ExportDialogProps {
  editorJson: JSONContent
  title: string
  onClose: () => void
}

export function ExportDialog({ editorJson, title, onClose }: ExportDialogProps) {
  const { t } = useI18n()
  const { history, recordExport } = useExportHistory()
  const dialogRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [format, setFormat] = useState<ExportFormat>('md')
  const [scope, setScope] = useState<ExportScope>('current')
  const [filename, setFilename] = useState(title || 'document')
  const currentProjectId = useAppStore((s) => s.currentProjectId)
  const projectsById = useAppStore((s) => s.projectsById)
  const currentProjectName = currentProjectId ? projectsById[currentProjectId]?.name : 'project'

  useDialogFocusTrap({
    containerRef: dialogRef,
    onClose,
    initialFocusRef: headingRef,
  })

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  const handleExport = useCallback(async () => {
    const finalFilename = scope === 'project' ? currentProjectName : filename

    switch (format) {
      case 'md':
        exportToMarkdown(editorJson, finalFilename)
        break
      case 'html':
        exportToHtml(editorJson, finalFilename)
        break
      case 'pdf':
        exportToPdf()
        break
      case 'docx': {
        const { generateDocx, generateProjectDocx } = await getDocxExporter()
        if (scope === 'current') {
            const blob = await generateDocx(editorJson, finalFilename)
            downloadFile(blob, `${finalFilename}.docx`)
        } else if (currentProjectId) {
            const blob = await generateProjectDocx(currentProjectId, finalFilename)
            downloadFile(blob, `${finalFilename}.docx`)
        }
        break
      }
    }
    recordExport(format, finalFilename, 0)
    onClose()
  }, [format, scope, editorJson, filename, currentProjectName, currentProjectId, onClose, recordExport])

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        className="bg-white dark:bg-dark-bg rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-dark-border flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-dark-border">
          <h2
            ref={headingRef}
            id="export-dialog-title"
            tabIndex={-1}
            className="text-lg font-bold text-gray-800 dark:text-dark-text"
          >
            {t.exportDialogTitle}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-surface text-gray-400 hover:text-gray-600 dark:hover:text-dark-text transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-dark-text-muted mb-1.5">
              {t.exportFilename}
            </label>
            <input
              type="text"
              value={scope === 'current' ? filename : currentProjectName}
              onChange={(e) => setFilename(e.target.value)}
              disabled={scope === 'project'}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-800 dark:text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 disabled:bg-gray-100 dark:disabled:bg-dark-surface2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-dark-text-muted mb-2">
              导出范围
            </label>
            <div className="flex gap-3">
              {(['current', 'project'] as ExportScope[]).map((s) => (
                <label
                  key={s}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border cursor-pointer text-sm font-medium transition-colors ${
                    scope === s
                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-400'
                      : 'border-gray-200 dark:border-dark-border text-gray-600 dark:text-dark-text-muted hover:border-gray-300 dark:hover:border-dark-border'
                  }`}
                >
                  <input
                    type="radio"
                    name="export-scope"
                    value={s}
                    checked={scope === s}
                    onChange={() => setScope(s)}
                    disabled={format === 'pdf' || !currentProjectId}
                    className="sr-only"
                  />
                  {s === 'current' ? '当前文档' : '整个项目'}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-dark-text-muted mb-2">
              {t.exportFormat}
            </label>
            <div className="flex gap-3">
              {(['md', 'html', 'pdf', 'docx'] as ExportFormat[]).map((f) => (
                <label
                  key={f}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border cursor-pointer text-sm font-medium transition-colors ${
                    format === f
                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-400'
                      : 'border-gray-200 dark:border-dark-border text-gray-600 dark:text-dark-text-muted hover:border-gray-300 dark:hover:border-dark-border'
                  }`}
                >
                  <input
                    type="radio"
                    name="export-format"
                    value={f}
                    checked={format === f}
                    onChange={() => setFormat(f)}
                    className="sr-only"
                  />
                  {f.toUpperCase()}
                </label>
              ))}
            </div>
          </div>

          {history.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-dark-text-muted mb-1.5">
                {t.exportHistoryTitle}
              </label>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {history.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between text-xs text-gray-500 dark:text-dark-text-muted px-2 py-1 rounded bg-gray-50 dark:bg-dark-surface">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-dark-border font-mono text-[10px] uppercase">
                        {entry.format}
                      </span>
                      <span className="truncate max-w-[160px]">{entry.title}</span>
                    </div>
                    <span className="shrink-0">
                      <Clock size={10} className="inline mr-1" />
                      {new Date(entry.exportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-dark-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-dark-text-muted hover:bg-gray-100 dark:hover:bg-dark-surface transition-colors"
          >
            {t.exportCancel}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors shadow-sm"
          >
            <Download size={14} />
            {t.exportButton}
          </button>
        </div>
      </div>
    </div>
  )
}

