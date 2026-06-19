import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CollapsibleSection } from './CollapsibleSection'

describe('CollapsibleSection', () => {
  it('toggles generated content regions when no explicit content id is provided', () => {
    render(
      <CollapsibleSection
        title="角色设定"
        icon={<span data-testid="section-icon">icon</span>}
        content={<div>内容详情</div>}
      />,
    )

    const toggle = screen.getByRole('button', { name: /角色设定/ })
    const generatedId = toggle.getAttribute('aria-controls')

    expect(generatedId).toBeTruthy()
    expect(screen.queryByText('内容详情')).not.toBeInTheDocument()

    fireEvent.click(toggle)

    expect(screen.getByText('内容详情')).toBeInTheDocument()
    expect(screen.getByText('内容详情').parentElement).toHaveAttribute('id', generatedId)
  })

  it('uses the provided content id and respects the default open state', () => {
    render(
      <CollapsibleSection
        title="世界观"
        icon={<span>icon</span>}
        content={<div>世界观内容</div>}
        defaultOpen={true}
        contentId="canon-world-section"
      />,
    )

    const toggle = screen.getByRole('button', { name: /世界观/ })

    expect(toggle).toHaveAttribute('aria-controls', 'canon-world-section')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('世界观内容').parentElement).toHaveAttribute('id', 'canon-world-section')
  })
})
