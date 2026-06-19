import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AntiPatternWarning } from './AntiPatternWarning'

describe('AntiPatternWarning', () => {
  it('returns null when no metrics are provided', () => {
    const { container } = render(<AntiPatternWarning />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders the high-risk tone when critical issues exist', () => {
    render(<AntiPatternWarning antiPatternHealth={3.5} criticalCount={2} />)

    expect(screen.getByText('反面模式预警 · 高风险')).toBeInTheDocument()
    expect(screen.getByText('当前文本存在明显的结构性写作反模式，建议优先修复。')).toBeInTheDocument()
    expect(screen.getByText('健康度：3.5 / 10')).toBeInTheDocument()
    expect(screen.getByText('严重项：2')).toBeInTheDocument()
  })

  it('renders the warning tone for mid health scores', () => {
    render(<AntiPatternWarning antiPatternHealth={6.4} criticalCount={0} />)

    expect(screen.getByText('反面模式预警 · 需关注')).toBeInTheDocument()
    expect(screen.getByText('已检测到一些潜在反模式，建议在修改时重点复查。')).toBeInTheDocument()
  })

  it('renders the healthy tone for strong scores', () => {
    render(<AntiPatternWarning antiPatternHealth={8.8} criticalCount={0} />)

    expect(screen.getByText('反面模式预警 · 健康')).toBeInTheDocument()
    expect(screen.getByText('当前维度没有明显的高风险反模式，可继续关注细节优化。')).toBeInTheDocument()
  })

  it('falls back missing health values while preserving the risk summary', () => {
    render(<AntiPatternWarning criticalCount={0} />)

    expect(screen.getByText('反面模式预警 · 高风险')).toBeInTheDocument()
    expect(screen.getByText('健康度：— / 10')).toBeInTheDocument()
    expect(screen.getByText('严重项：0')).toBeInTheDocument()
  })

  it('falls back missing critical counts to zero', () => {
    render(<AntiPatternWarning antiPatternHealth={8.8} />)

    expect(screen.getByText('反面模式预警 · 健康')).toBeInTheDocument()
    expect(screen.getByText('严重项：0')).toBeInTheDocument()
  })
})
