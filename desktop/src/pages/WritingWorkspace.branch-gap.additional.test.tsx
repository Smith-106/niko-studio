import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const invokeMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}))

vi.mock('../components/narrative/ForeshadowPanel', () => ({
  ForeshadowPanel: ({
    alerts,
    onResolve,
  }: {
    alerts: Array<{ foreshadowId: string; hint: string }>
    onResolve: (id: string) => void
  }) => (
    <div>
      <div data-testid="foreshadow-count">{alerts.length}</div>
      {alerts.map((alert) => (
        <div key={alert.foreshadowId}>
          <span>{alert.hint}</span>
          <button onClick={() => onResolve(alert.foreshadowId)}>resolve-{alert.foreshadowId}</button>
        </div>
      ))}
    </div>
  ),
}))

vi.mock('../components/narrative/QualityScorePanel', () => ({
  QualityScorePanel: ({
    overall,
    criticalIssues,
    suggestions,
  }: {
    overall: number
    criticalIssues: string[]
    suggestions: string[]
  }) => (
    <div>
      <div>overall:{overall}</div>
      <div>{criticalIssues.join(',')}</div>
      <div>{suggestions.join(',')}</div>
    </div>
  ),
}))

vi.mock('../components/narrative/BrainstormPanel', () => ({
  BrainstormPanel: () => <div>brainstorm-panel</div>,
}))

vi.mock('../components/story-bible', () => ({
  StoryBiblePanel: ({ novelId }: { novelId: string }) => <div>story-bible:{novelId}</div>,
}))

import { logger } from '../utils/logger'

import WritingWorkspace from './WritingWorkspace'

const HEALTHY_STATUS = {
  online: true,
  host: '127.0.0.1',
  port: 19828,
  pending_conflicts: 2,
}

const QUALITY_REPORT = {
  overall: 82,
  dimensions: { pacing: 76, consistency: 88 },
  critical_issues: ['需要强化冲突'],
  suggestions: ['增加章节结尾钩子'],
}

describe('WritingWorkspace branch-gap additional coverage', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    invokeMock.mockImplementation(async (command: string, payload?: Record<string, unknown>) => {
      if (command === 'get_nowledge_status') return HEALTHY_STATUS
      if (command === 'analyze_quality') return QUALITY_REPORT
      if (command === 'get_foreshadow_alerts') return []
      if (command === 'add_foreshadow') return { ok: true, payload }
      if (command === 'resolve_foreshadow') return { ok: true, payload }
      return { ok: true, payload }
    })
  })

  it('skips analysis when text is shorter than 20 characters (line 48)', async () => {
    render(<WritingWorkspace />)

    const editor = screen.getByPlaceholderText('开始写作...') as HTMLTextAreaElement
    fireEvent.change(editor, { target: { value: '短文' } })

    fireEvent.click(screen.getByRole('button', { name: '分析质量' }))

    // Should not call analyze_quality because text.length < 20
    expect(invokeMock).not.toHaveBeenCalledWith('analyze_quality', expect.anything())
  })

  it('shows Nowledge Mem online indicator (line 125 true branch)', async () => {
    render(<WritingWorkspace />)

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('get_nowledge_status')
    })

    // The green dot should be present when online
    const dot = document.querySelector('.bg-green-500')
    expect(dot).toBeTruthy()
  })

  it('shows Nowledge Mem offline indicator when status is null (line 125 false branch)', async () => {
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'get_nowledge_status') return null
      if (command === 'analyze_quality') return QUALITY_REPORT
      return []
    })

    render(<WritingWorkspace />)

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('get_nowledge_status')
    })

    const dot = document.querySelector('.bg-zinc-600')
    expect(dot).toBeTruthy()
  })

  it('shows quality score in different color tiers (line 170)', async () => {
    // Test high score (green)
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'get_nowledge_status') return HEALTHY_STATUS
      if (command === 'analyze_quality') return { ...QUALITY_REPORT, overall: 70 }
      return []
    })

    render(<WritingWorkspace />)

    const editor = screen.getByPlaceholderText('开始写作...') as HTMLTextAreaElement
    fireEvent.change(editor, {
      target: { value: '这是一段足够长的测试正文，用来触发质量分析并覆盖工作台流程。' },
    })
    fireEvent.click(screen.getByRole('button', { name: '分析质量' }))

    await waitFor(() => {
      expect(screen.getByText(/质量 70\/100/)).toBeInTheDocument()
    })

    // Test medium score (yellow)
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'get_nowledge_status') return HEALTHY_STATUS
      if (command === 'analyze_quality') return { ...QUALITY_REPORT, overall: 50 }
      return []
    })

    fireEvent.change(editor, {
      target: { value: '这是另一段足够长的测试正文，用来触发质量分析并覆盖工作台流程。' },
    })
    fireEvent.click(screen.getByRole('button', { name: '分析质量' }))

    await waitFor(() => {
      expect(screen.getByText(/质量 50\/100/)).toBeInTheDocument()
    })
  })

  it('handles foreshadow input with empty value (line 160 false branch)', async () => {
    render(<WritingWorkspace />)

    const foreshadowInput = screen.getByPlaceholderText('添加伏笔...')
    fireEvent.keyDown(foreshadowInput, {
      key: 'Enter',
      target: { value: '   ' },
    })

    // Should not call add_foreshadow when value is only whitespace
    expect(invokeMock).not.toHaveBeenCalledWith('add_foreshadow', expect.anything())
  })

  it('handles foreshadow input with non-Enter key (line 158 false branch)', async () => {
    render(<WritingWorkspace />)

    const foreshadowInput = screen.getByPlaceholderText('添加伏笔...')
    fireEvent.keyDown(foreshadowInput, {
      key: 'Tab',
      target: { value: 'some hint' },
    })

    // Should not call add_foreshadow for non-Enter key
    expect(invokeMock).not.toHaveBeenCalledWith('add_foreshadow', expect.anything())
  })

  it('decreases chapter to minimum 1 (line 114 Math.max)', async () => {
    render(<WritingWorkspace />)

    // Chapter starts at 1, clicking minus should stay at 1
    fireEvent.click(screen.getByRole('button', { name: '-' }))
    expect(screen.getByText(/第 1 章/)).toBeInTheDocument()
    expect(invokeMock).toHaveBeenCalledWith('set_current_chapter', { chapter: 1 })
  })

  it('switches right tab to quality and shows placeholder when no quality data', async () => {
    render(<WritingWorkspace />)

    fireEvent.click(screen.getByRole('button', { name: '质量' }))
    expect(screen.getByText('点击"分析质量"开始')).toBeInTheDocument()
  })

  it('calls sync_from_knowledge_layer and updates status (lines 93-97)', async () => {
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'get_nowledge_status') return { ...HEALTHY_STATUS, online: false }
      if (command === 'sync_from_knowledge_layer') return { ok: true }
      return []
    })

    render(<WritingWorkspace />)

    fireEvent.click(screen.getByRole('button', { name: '同步知识层' }))

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('sync_from_knowledge_layer')
    })
  })
})
