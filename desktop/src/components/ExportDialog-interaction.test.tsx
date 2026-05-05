import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
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

describe('ExportDialog — keyboard & input interactions', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    onClose.mockClear()
  })

  it('closes on Escape key', async () => {
    render(<ExportDialog editorJson={mockJson} title="Test" onClose={onClose} />)
    await userEvent.setup().keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('allows modifying the filename', async () => {
    const user = userEvent.setup()
    render(<ExportDialog editorJson={mockJson} title="Original" onClose={onClose} />)

    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'NewName')
    expect(input).toHaveValue('NewName')
  })

  it('exports as markdown by default when Export clicked', async () => {
    const user = userEvent.setup()
    const { exportToMarkdown } = await import('../utils/export')
    render(<ExportDialog editorJson={mockJson} title="Doc" onClose={onClose} />)

    await user.click(screen.getByText('Export'))
    expect(exportToMarkdown).toHaveBeenCalledWith(mockJson, 'Doc')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('exports as PDF when PDF format selected', async () => {
    const user = userEvent.setup()
    const { exportToPdf } = await import('../utils/export')
    render(<ExportDialog editorJson={mockJson} title="Doc" onClose={onClose} />)

    await user.click(screen.getByText('PDF'))
    await user.click(screen.getByText('Export'))
    expect(exportToPdf).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('uses "document" as default filename when title is empty', () => {
    render(<ExportDialog editorJson={mockJson} title="" onClose={onClose} />)
    expect(screen.getByRole('textbox')).toHaveValue('document')
  })

  it('has accessible radio inputs for format selection', () => {
    render(<ExportDialog editorJson={mockJson} title="Test" onClose={onClose} />)
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)
    expect(radios[0]).toBeChecked()
  })
})
