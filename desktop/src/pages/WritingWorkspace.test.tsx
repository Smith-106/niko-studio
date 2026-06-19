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

const FORESHADOW_ALERTS = [
  {
    foreshadow_id: 'seed-1',
    hint: '门口的旧钥匙',
    planted_at: 1,
    current_chapter: 2,
    chapters_until_due: 3,
    urgency: 'approaching' as const,
  },
]

describe('WritingWorkspace', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    invokeMock.mockImplementation(async (command: string, payload?: Record<string, unknown>) => {
      if (command === 'get_nowledge_status') {
        return HEALTHY_STATUS
      }
      if (command === 'analyze_quality') {
        return QUALITY_REPORT
      }
      if (command === 'get_foreshadow_alerts') {
        return FORESHADOW_ALERTS
      }
      if (command === 'add_foreshadow') {
        return { ok: true, payload }
      }
      if (command === 'resolve_foreshadow') {
        return { ok: true, payload }
      }
      return { ok: true, payload }
    })
  })

  it('loads runtime state, analyzes text, and drives workspace interactions', async () => {
    render(<WritingWorkspace />)

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('get_nowledge_status')
    })
    expect(screen.getByText('点击"分析质量"开始')).toBeInTheDocument()

    const editor = screen.getByPlaceholderText('开始写作...') as HTMLTextAreaElement
    fireEvent.change(editor, {
      target: { value: '这是一段足够长的测试正文，用来触发质量分析并覆盖工作台流程。' },
    })

    fireEvent.click(screen.getByRole('button', { name: '分析质量' }))
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('analyze_quality', {
        text: '这是一段足够长的测试正文，用来触发质量分析并覆盖工作台流程。',
      })
    })
    expect(screen.getByText('overall:82')).toBeInTheDocument()
    expect(screen.getByText('需要强化冲突')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '+' }))
    expect(screen.getByText(/第 2 章/)).toBeInTheDocument()
    expect(invokeMock).toHaveBeenCalledWith('set_current_chapter', { chapter: 2 })

    fireEvent.click(screen.getByRole('button', { name: '-' }))
    expect(screen.getByText(/第 1 章/)).toBeInTheDocument()
    expect(invokeMock).toHaveBeenCalledWith('set_current_chapter', { chapter: 1 })

    const foreshadowInput = screen.getByPlaceholderText('添加伏笔...')
    fireEvent.keyDown(foreshadowInput, {
      key: 'Enter',
      target: { value: '门口的旧钥匙' },
    })
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('add_foreshadow', {
        hint: '门口的旧钥匙',
        plantedChapter: 1,
        maxDistance: 50,
      })
    })

    fireEvent.click(screen.getByRole('button', { name: '伏笔管理' }))
    await waitFor(() => {
      expect(screen.getByText('门口的旧钥匙')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'resolve-seed-1' }))
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('resolve_foreshadow', { id: 'seed-1' })
    })

    fireEvent.click(screen.getByRole('button', { name: '头脑风暴' }))
    expect(screen.getByText('brainstorm-panel')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Story Bible' }))
    expect(screen.getByText('story-bible:default')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '同步知识层' }))
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('sync_from_knowledge_layer')
    })
  })

  it('handles analysis and sync failures without crashing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'get_nowledge_status') {
        throw new Error('offline')
      }
      if (command === 'analyze_quality') {
        throw new Error('analysis failed')
      }
      if (command === 'sync_from_knowledge_layer') {
        throw new Error('sync failed')
      }
      if (command === 'add_foreshadow') {
        throw new Error('add failed')
      }
      return []
    })

    render(<WritingWorkspace />)

    const editor = screen.getByPlaceholderText('开始写作...')
    fireEvent.change(editor, {
      target: { value: '这是一段足够长的测试正文，用来验证错误路径依然能够收口。' },
    })

    fireEvent.click(screen.getByRole('button', { name: '分析质量' }))
    fireEvent.click(screen.getByRole('button', { name: '同步知识层' }))

    const foreshadowInput = screen.getByPlaceholderText('添加伏笔...')
    fireEvent.keyDown(foreshadowInput, {
      key: 'Enter',
      target: { value: '失败的伏笔' },
    })

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalled()
    })

    expect(screen.getByText('点击"分析质量"开始')).toBeInTheDocument()

    errorSpy.mockRestore()
  })
})
