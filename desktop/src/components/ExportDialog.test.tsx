import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JSONContent } from '@tiptap/react'
import { ExportDialog } from './ExportDialog'

vi.mock('../i18n', () => ({
  useI18n: () => ({
    t: {
      exportDialogTitle: 'Export Document',
      exportFilename: 'Filename',
      exportFormat: 'Format',
      exportButton: 'Export',
      exportCancel: 'Cancel',
    },
    language: 'en',
  }),
}))

vi.mock('../utils/export', () => ({
  exportToMarkdown: vi.fn(),
  exportToHtml: vi.fn(),
  exportToPdf: vi.fn(),
}))

const mockJson: JSONContent = { type: 'doc', content: [] }

describe('ExportDialog', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    onClose.mockClear()
  })

  it('renders with title, filename input, and format selector', () => {
    render(<ExportDialog editorJson={mockJson} title="My Doc" onClose={onClose} />)

    expect(screen.getByText('Export Document')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('My Doc')
    expect(screen.getByText('MD')).toBeInTheDocument()
    expect(screen.getByText('HTML')).toBeInTheDocument()
    expect(screen.getByText('PDF')).toBeInTheDocument()
  })

  it('closes when cancel button is clicked', async () => {
    const user = userEvent.setup()
    render(<ExportDialog editorJson={mockJson} title="Test" onClose={onClose} />)

    await user.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes when backdrop is clicked', async () => {
    const user = userEvent.setup()
    render(<ExportDialog editorJson={mockJson} title="Test" onClose={onClose} />)

    const backdrop = screen.getByRole('dialog').parentElement!
    await user.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('selects format and triggers export', async () => {
    const user = userEvent.setup()
    const { exportToHtml } = await import('../utils/export')
    render(<ExportDialog editorJson={mockJson} title="Doc" onClose={onClose} />)

    await user.click(screen.getByText('HTML'))
    await user.click(screen.getByText('Export'))

    expect(exportToHtml).toHaveBeenCalledWith(mockJson, 'Doc')
    expect(onClose).toHaveBeenCalledOnce()
  })
})
