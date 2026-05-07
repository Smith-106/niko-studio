import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WritingDashboard } from './WritingDashboard'

vi.mock('../../api/writing-craft', () => ({
  analyzeWritingCraft: vi.fn(),
}))

import { analyzeWritingCraft } from '../../api/writing-craft'
const mockAnalyze = vi.mocked(analyzeWritingCraft)

const MOCK_RESULT = {
  overallScore: 6.5,
  dimensions: [
    {
      dimension: 'structure' as const,
      label: '结构分析',
      score: 7,
      maxScore: 10,
      evidence: ['三幕结构完整'],
      suggestions: ['加强中段张力'],
      details: {},
    },
    {
      dimension: 'character' as const,
      label: '角色分析',
      score: 6,
      maxScore: 10,
      evidence: ['角色动机明确'],
      suggestions: ['增加内心冲突'],
      details: {},
    },
    {
      dimension: 'suspense' as const,
      label: '悬疑/叙事',
      score: 8,
      maxScore: 10,
      evidence: ['伏笔运用得当'],
      suggestions: [],
      details: {},
    },
    {
      dimension: 'emotion' as const,
      score: 5,
      maxScore: 10,
      label: '情感/描写',
      evidence: [],
      suggestions: ['增加感官描写'],
      details: {},
    },
    {
      dimension: 'dialogue' as const,
      label: '对话分析',
      score: 6,
      maxScore: 10,
      evidence: ['对话推动情节'],
      suggestions: ['增加潜台词'],
      details: {},
    },
    {
      dimension: 'webnovel' as const,
      label: '网文专项',
      score: 7,
      maxScore: 10,
      evidence: ['升级体系清晰'],
      suggestions: [],
      details: {},
    },
  ],
  textLength: 200,
}

describe('WritingDashboard', () => {
  it('renders placeholder when no result', () => {
    render(<WritingDashboard text="some text" visible={true} />)
    expect(screen.getByText('输入文本后点击「开始分析」查看写作质量报告')).toBeTruthy()
  })

  it('returns null when not visible', () => {
    const { container } = render(<WritingDashboard text="text" visible={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('disables analyze button when text is empty', () => {
    render(<WritingDashboard text="" visible={true} />)
    const btn = screen.getByRole('button', { name: '开始分析' })
    expect(btn.disabled).toBe(true)
  })

  it('calls API and renders results', async () => {
    mockAnalyze.mockResolvedValueOnce({
      success: true,
      data: MOCK_RESULT,
    })

    render(<WritingDashboard text="some text" visible={true} />)
    fireEvent.click(screen.getByRole('button', { name: '开始分析' }))

    await waitFor(() => {
      expect(screen.getByText(/综合评分/)).toBeTruthy()
    })

    expect(screen.getByText('结构')).toBeTruthy()
    expect(screen.getByText('角色')).toBeTruthy()
    expect(screen.getByText('悬疑')).toBeTruthy()
    expect(screen.getByText('情感')).toBeTruthy()
    expect(screen.getByText('对话')).toBeTruthy()
    expect(screen.getByText('网文')).toBeTruthy()
  })

  it('renders evidence and suggestions for active tab', async () => {
    mockAnalyze.mockResolvedValueOnce({
      success: true,
      data: MOCK_RESULT,
    })

    render(<WritingDashboard text="text" visible={true} />)
    fireEvent.click(screen.getByRole('button', { name: '开始分析' }))

    await waitFor(() => {
      expect(screen.getByText(/综合评分/)).toBeTruthy()
    })

    expect(screen.getByText('三幕结构完整')).toBeTruthy()
    expect(screen.getByText('加强中段张力')).toBeTruthy()
  })

  it('switches tabs on click', async () => {
    mockAnalyze.mockResolvedValueOnce({
      success: true,
      data: MOCK_RESULT,
    })

    render(<WritingDashboard text="text" visible={true} />)
    fireEvent.click(screen.getByRole('button', { name: '开始分析' }))

    await waitFor(() => {
      expect(screen.getByText(/综合评分/)).toBeTruthy()
    })

    fireEvent.click(screen.getByText('角色'))
    expect(screen.getByText('角色动机明确')).toBeTruthy()
    expect(screen.getByText('增加内心冲突')).toBeTruthy()
  })

  it('shows error on API failure', async () => {
    mockAnalyze.mockResolvedValueOnce({
      success: false,
      error: 'Server error',
    })

    render(<WritingDashboard text="text" visible={true} />)
    fireEvent.click(screen.getByRole('button', { name: '开始分析' }))

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeTruthy()
    })
  })
})
