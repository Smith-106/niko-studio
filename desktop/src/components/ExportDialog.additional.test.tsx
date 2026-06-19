import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JSONContent } from '@tiptap/react'

import { ExportDialog } from './ExportDialog'

const {
  appStoreState,
  resetState,
  useAppStoreMock,
  useExportHistoryMock,
  exportToMarkdownMock,
  exportToHtmlMock,
  exportToPdfMock,
  downloadFileMock,
  generateDocxMock,
  generateProjectDocxMock,
  recordExportMock,
  historyState,
} = vi.hoisted(() => {
  const appStoreState = {
    currentProjectId: null as string | null,
    projectsById: {} as Record<string, { name: string }>,
  }

  const historyState = {
    history: [] as Array<{
      id: string
      exportedAt: number
      format: 'md' | 'html' | 'pdf' | 'docx'
      title: string
      wordCount: number
    }>,
  }

  const recordExportMock = vi.fn()
  const exportToMarkdownMock = vi.fn()
  const exportToHtmlMock = vi.fn()
  const exportToPdfMock = vi.fn()
  const downloadFileMock = vi.fn()
  const generateDocxMock = vi.fn()
  const generateProjectDocxMock = vi.fn()

  const useAppStoreMock = <T,>(selector: (state: typeof appStoreState) => T) =>
    selector(appStoreState)

  const useExportHistoryMock = () => ({
    history: historyState.history,
    recordExport: recordExportMock,
  })

  const resetState = () => {
    appStoreState.currentProjectId = null
    appStoreState.projectsById = {}
    historyState.history = []
    recordExportMock.mockReset()
    exportToMarkdownMock.mockReset()
    exportToHtmlMock.mockReset()
    exportToPdfMock.mockReset()
    downloadFileMock.mockReset()
    generateDocxMock.mockReset()
    generateProjectDocxMock.mockReset()
  }

  return {
    appStoreState,
    resetState,
    useAppStoreMock,
    useExportHistoryMock,
    exportToMarkdownMock,
    exportToHtmlMock,
    exportToPdfMock,
    downloadFileMock,
    generateDocxMock,
    generateProjectDocxMock,
    recordExportMock,
    historyState,
  }
})

vi.mock('../i18n', () => ({
  useI18n: () => ({
    t: {
      exportDialogTitle: 'Export Document',
      exportFilename: 'Filename',
      exportFormat: 'Format',
      exportHistoryTitle: 'Recent Exports',
      exportButton: 'Export',
      exportCancel: 'Cancel',
    },
    language: 'en',
  }),
}))

vi.mock('../hooks/useDialogFocusTrap', () => ({
  useDialogFocusTrap: vi.fn(),
}))

vi.mock('../hooks/useExportHistory', () => ({
  useExportHistory: useExportHistoryMock,
}))

vi.mock('../stores/appStore', () => ({
  useAppStore: useAppStoreMock,
}))

vi.mock('../utils/export', () => ({
  exportToMarkdown: exportToMarkdownMock,
  exportToHtml: exportToHtmlMock,
  exportToPdf: exportToPdfMock,
  downloadFile: downloadFileMock,
}))

vi.mock('../utils/exportDocx', () => ({
  generateDocx: generateDocxMock,
  generateProjectDocx: generateProjectDocxMock,
}))

const mockJson: JSONContent = { type: 'doc', content: [] }

describe('ExportDialog additional coverage', () => {
  beforeEach(() => {
    resetState()
  })

  it('disables project scope when no project is available', () => {
    const { container } = render(
      <ExportDialog editorJson={mockJson} title="Draft" onClose={vi.fn()} />,
    )

    const projectScope = container.querySelector(
      'input[name="export-scope"][value="project"]',
    ) as HTMLInputElement

    expect(projectScope).toBeDisabled()
    expect(screen.queryByText('Recent Exports')).not.toBeInTheDocument()
  })

  it('renders export history and ignores clicks inside the dialog surface', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    historyState.history = [
      {
        id: 'exp-1',
        exportedAt: Date.UTC(2026, 5, 5, 10, 30, 0),
        format: 'html',
        title: 'Alpha Draft',
        wordCount: 100,
      },
    ]

    render(<ExportDialog editorJson={mockJson} title="Draft" onClose={onClose} />)

    expect(screen.getByText('Recent Exports')).toBeInTheDocument()
    expect(screen.getByText('Alpha Draft')).toBeInTheDocument()
    expect(screen.getByText('html')).toBeInTheDocument()

    await user.click(screen.getByRole('dialog'))

    expect(onClose).not.toHaveBeenCalled()
  })

  it('exports the current document as docx and records history', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const blob = new Blob(['docx'])

    generateDocxMock.mockResolvedValue(blob)

    render(<ExportDialog editorJson={mockJson} title="Draft" onClose={onClose} />)

    await user.click(screen.getByText('DOCX'))
    await user.click(screen.getByText('Export'))

    await waitFor(() => {
      expect(generateDocxMock).toHaveBeenCalledWith(mockJson, 'Draft')
    })
    expect(downloadFileMock).toHaveBeenCalledWith(blob, 'Draft.docx')
    expect(recordExportMock).toHaveBeenCalledWith('docx', 'Draft', 0)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('exports the whole project as docx using the current project name', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const blob = new Blob(['project-docx'])

    appStoreState.currentProjectId = 'project-1'
    appStoreState.projectsById = {
      'project-1': { name: 'Novel Project' },
    }
    generateProjectDocxMock.mockResolvedValue(blob)

    const { container } = render(
      <ExportDialog editorJson={mockJson} title="Draft" onClose={onClose} />,
    )

    const projectScope = container.querySelector(
      'input[name="export-scope"][value="project"]',
    ) as HTMLInputElement

    await user.click(projectScope)
    await user.click(screen.getByText('DOCX'))
    await user.click(screen.getByText('Export'))

    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByRole('textbox')).toHaveValue('Novel Project')

    await waitFor(() => {
      expect(generateProjectDocxMock).toHaveBeenCalledWith('project-1', 'Novel Project')
    })
    expect(downloadFileMock).toHaveBeenCalledWith(blob, 'Novel Project.docx')
    expect(recordExportMock).toHaveBeenCalledWith('docx', 'Novel Project', 0)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
