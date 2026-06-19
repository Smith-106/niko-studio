import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { WorkflowStepsNavigator } from './WorkflowStepsNavigator'

const mockUseI18n = vi.hoisted(() => vi.fn())

vi.mock('../i18n', () => ({
  useI18n: () => mockUseI18n(),
}))

function findStepRoot(text: string): HTMLElement {
  const label = screen.getAllByText(text)[0]
  const stepRoot = label.closest('div[class*="cursor-pointer"]')
  if (!stepRoot) {
    throw new Error(`Unable to find step root for ${text}`)
  }
  return stepRoot as HTMLElement
}

function findStepBubble(text: string): HTMLElement {
  const stepRoot = findStepRoot(text)
  const bubble = stepRoot.querySelector('div[class*="rounded-2xl"]')
  if (!bubble) {
    throw new Error(`Unable to find step bubble for ${text}`)
  }
  return bubble as HTMLElement
}

describe('WorkflowStepsNavigator', () => {
  beforeEach(() => {
    mockUseI18n.mockReturnValue({
      t: {
        sidebarFlowWrite: 'Write Flow',
        sidebarFlowEvaluate: 'Evaluate Flow',
        sidebarFlowRevise: 'Revise Flow',
        sidebarFlowTrack: 'Track Flow',
      },
    })
  })

  it('renders all steps, keeps the progress line hidden by default, and routes clicks to the default panels', () => {
    const onOpenPanel = vi.fn()
    const { container } = render(
      <WorkflowStepsNavigator activeRightPanel="none" onOpenPanel={onOpenPanel} />,
    )

    expect(screen.getByText('写作智慧流')).toBeInTheDocument()
    expect(screen.getAllByText('智能分析 / 深度评估').length).toBeGreaterThan(0)
    expect(screen.getAllByText('指标细分 / 模式诊断').length).toBeGreaterThan(0)
    expect(screen.getAllByText('伏笔梳理 / 角色关系').length).toBeGreaterThan(0)
    expect(screen.getAllByText('叙事可视化 / 会话分析').length).toBeGreaterThan(0)

    const highlightLine = container.querySelector('div[style*="opacity: 0"]')
    expect(highlightLine).toHaveStyle({ width: '0%', opacity: '0' })

    fireEvent.click(findStepRoot('Write Flow'))
    fireEvent.click(findStepRoot('Evaluate Flow'))
    fireEvent.click(findStepRoot('Revise Flow'))
    fireEvent.click(findStepRoot('Track Flow'))

    expect(onOpenPanel).toHaveBeenNthCalledWith(1, 'analysis')
    expect(onOpenPanel).toHaveBeenNthCalledWith(2, 'evaluationDrillDown')
    expect(onOpenPanel).toHaveBeenNthCalledWith(3, 'foreshadowingTracker')
    expect(onOpenPanel).toHaveBeenNthCalledWith(4, 'narrativeVisualization')
  })

  it('marks previous steps as completed and the active step as highlighted for associated panels', () => {
    const { container } = render(
      <WorkflowStepsNavigator activeRightPanel="sessionAnalytics" onOpenPanel={() => {}} />,
    )

    const highlightLine = container.querySelector('div[style*="opacity: 1"]')
    expect(highlightLine).toHaveStyle({ width: '100%', opacity: '1' })

    expect(findStepBubble('Write Flow').className).toContain('bg-emerald-50')
    expect(findStepBubble('Evaluate Flow').className).toContain('bg-emerald-50')
    expect(findStepBubble('Revise Flow').className).toContain('bg-emerald-50')
    expect(findStepBubble('Track Flow').className).toContain('bg-gradient-to-br')
    expect(findStepBubble('Track Flow').className).toContain('rotate-[-4deg]')
  })

  it('falls back to default titles when translations are missing and ignores unknown panels', () => {
    mockUseI18n.mockReturnValue({ t: undefined })

    const { container, unmount } = render(
      <WorkflowStepsNavigator activeRightPanel="mystery-panel" onOpenPanel={() => {}} />,
    )

    expect(screen.getAllByText('写作与评估').length).toBeGreaterThan(0)

    const highlightLine = container.querySelector('div[style*="opacity: 0"]')
    expect(highlightLine).toHaveStyle({ width: '0%', opacity: '0' })

    unmount()

    mockUseI18n.mockReturnValue({
      t: {
        sidebarFlowWrite: '',
      },
    })
    const fallbackView = render(
      <WorkflowStepsNavigator activeRightPanel={undefined} onOpenPanel={() => {}} />,
    )

    expect(screen.getAllByText('写作与评估').length).toBeGreaterThan(0)
    expect(screen.getAllByText('评估与修订').length).toBeGreaterThan(0)
    expect(screen.getAllByText('修订与追踪').length).toBeGreaterThan(0)
    expect(screen.getAllByText('叙事追踪').length).toBeGreaterThan(0)

    fallbackView.unmount()
  })
})
