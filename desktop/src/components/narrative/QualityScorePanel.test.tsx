import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { QualityScorePanel } from './QualityScorePanel'

describe('QualityScorePanel', () => {
  it('renders overall and per-dimension scores with the expected labels, widths, and colors', () => {
    const { container, rerender } = render(
      <QualityScorePanel
        dimensions={{
          hook: 90,
          suspense: 65,
          custom_metric: 35,
        }}
        overall={58}
        criticalIssues={['冲突升级不足']}
        suggestions={['在章节结尾增加未解答的问题']}
      />,
    )

    expect(screen.getByText('质量评分')).toBeInTheDocument()
    expect(screen.getByText('58').className).toContain('text-orange-400')
    expect(screen.getByText('钩子')).toBeInTheDocument()
    expect(screen.getByText('悬疑')).toBeInTheDocument()
    expect(screen.getByText('custom_metric')).toBeInTheDocument()
    expect(screen.getByText('90').className).toContain('text-green-400')
    expect(screen.getByText('65').className).toContain('text-yellow-400')
    expect(screen.getByText('35').className).toContain('text-red-400')
    expect(screen.getByText('关键问题')).toBeInTheDocument()
    expect(screen.getByText('• 冲突升级不足')).toBeInTheDocument()
    expect(screen.getByText('改进建议')).toBeInTheDocument()
    expect(screen.getByText('• 在章节结尾增加未解答的问题')).toBeInTheDocument()

    const bars = Array.from(container.querySelectorAll('.h-full'))
    expect((bars[0] as HTMLDivElement).style.width).toBe('90%')
    expect((bars[1] as HTMLDivElement).style.width).toBe('65%')
    expect((bars[2] as HTMLDivElement).style.width).toBe('35%')

    rerender(
      <QualityScorePanel
        dimensions={{ continuity: 85 }}
        overall={84}
        criticalIssues={[]}
        suggestions={[]}
      />,
    )

    expect(screen.getByText('84').className).toContain('text-green-400')
    expect(screen.queryByText('关键问题')).not.toBeInTheDocument()
    expect(screen.queryByText('改进建议')).not.toBeInTheDocument()
  })
})
