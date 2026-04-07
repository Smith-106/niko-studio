import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { StoryBiblePanel } from './StoryBiblePanel'
import { translations } from '../i18n'
import { useSettingsStore } from '../stores/settingsStore'

vi.mock('../api/client', () => ({
  queryGraph: vi.fn().mockResolvedValue({ success: true, data: [] }),
}))

const zh = translations.zh

describe('StoryBiblePanel', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.getState().updateSettings({ language: 'zh' })
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: vi.fn(() => 'blob:story-bible-draft'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: vi.fn(),
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  it('restores local draft fields and shows the persistence boundary copy', async () => {
    localStorage.setItem('niko.sb-braindump-v1', '本地灵感')
    localStorage.setItem('niko.sb-genres-v1', '奇幻,悬疑')
    localStorage.setItem('niko.sb-synopsis-v1', '本地概要')
    localStorage.setItem('niko.sb-outline-v1', '章节大纲')
    localStorage.setItem('niko.sb-style-v1', 'matchMy')

    const user = userEvent.setup()
    render(<StoryBiblePanel />)

    expect(screen.getByText(zh.storyBiblePersistenceTitle)).toBeInTheDocument()
    expect(screen.getByText(zh.storyBiblePersistenceLocalOnly)).toBeInTheDocument()
    expect(screen.getByText(zh.storyBiblePersistenceGraphRead)).toBeInTheDocument()

    expect(screen.getByDisplayValue('本地灵感')).toBeInTheDocument()
    expect(screen.getAllByText('奇幻').length).toBeGreaterThan(0)
    expect(screen.getAllByText('悬疑').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: zh.storyBibleSynopsis }))
    expect(screen.getByDisplayValue('本地概要')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: zh.storyBibleOutline }))
    expect(screen.getByDisplayValue('章节大纲')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: zh.storyBibleStyleTitle }))
    expect(screen.getByRole('button', { name: new RegExp(`^${zh.storyBibleStyleMatchMy}`) })).toHaveAttribute('aria-pressed', 'true')
  })

  it('exports, imports, and resets only the local draft payload', async () => {
    const user = userEvent.setup()
    render(<StoryBiblePanel />)

    await user.click(screen.getByTitle(zh.storyBibleExportDraft))
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(screen.getByText(zh.storyBibleDraftExported)).toBeInTheDocument()

    const importPayload = {
      version: '1.0',
      kind: 'story-bible-local-draft',
      exportedAt: '2026-04-07T00:00:00.000Z',
      draft: {
        braindump: '导入灵感',
        genres: ['科幻'],
        synopsis: '导入概要',
        outline: '导入大纲',
        style: 'custom',
      },
    }

    const input = screen.getByTestId('story-bible-import-input') as HTMLInputElement
    const file = new File([JSON.stringify(importPayload)], 'story-bible.json', { type: 'application/json' })
    await user.upload(input, file)

    await waitFor(() => {
      expect(screen.getByDisplayValue('导入灵感')).toBeInTheDocument()
    })
    expect(screen.getAllByText('科幻').length).toBeGreaterThan(0)
    expect(screen.getByText(zh.storyBibleDraftImported)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: zh.storyBibleSynopsis }))
    expect(screen.getByDisplayValue('导入概要')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: zh.storyBibleOutline }))
    expect(screen.getByDisplayValue('导入大纲')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: zh.storyBibleStyleTitle }))
    expect(screen.getByRole('button', { name: new RegExp(`^${zh.storyBibleStyleCustom}`) })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByTitle(zh.storyBibleResetDraft))
    await waitFor(() => {
      expect(screen.getByPlaceholderText(zh.storyBibleBraindumpHint)).toHaveValue('')
    })
    expect(screen.getByText(zh.storyBibleDraftReset)).toBeInTheDocument()
    expect(localStorage.getItem('niko.sb-braindump-v1')).toBeNull()
    expect(localStorage.getItem('niko.sb-genres-v1')).toBeNull()
    expect(localStorage.getItem('niko.sb-synopsis-v1')).toBeNull()
    expect(localStorage.getItem('niko.sb-outline-v1')).toBeNull()
    expect(localStorage.getItem('niko.sb-style-v1')).toBeNull()
  })
})
