import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetadataBadge } from './MetadataBadge'

describe('MetadataBadge', () => {
  it('renders the compact badge with shortened model names and compact suffixes', () => {
    render(
      <MetadataBadge
        mode="auto"
        model="claude-sonnet-4-6"
        confidence={0.72}
        tokenCount={1280}
        violations={2}
      />,
    )

    const modePill = screen.getByText('自动')
    const confidence = screen.getByText('72%')

    expect(modePill.className).toContain('text-blue-400')
    expect(screen.getByText('sonnet-4-6')).toBeInTheDocument()
    expect(confidence.className).toContain('text-green-400')
    expect(screen.getByText('1280t')).toBeInTheDocument()
    expect(screen.getByText('2v')).toBeInTheDocument()
  })

  it('renders medium layout branches and hides optional metadata when absent or zero', () => {
    const { rerender } = render(
      <MetadataBadge mode="guided" model="gpt-4.1-mini" confidence={0.4} size="md" />,
    )

    const guidedMode = screen.getByText('引导')
    const mediumConfidence = screen.getByText('40%')

    expect(guidedMode.className).toContain('text-purple-400')
    expect(screen.getByText('gpt-4.1-mini')).toBeInTheDocument()
    expect(mediumConfidence.className).toContain('text-yellow-400')
    expect(screen.queryByText(/tokens$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/violations$/)).not.toBeInTheDocument()

    rerender(
      <MetadataBadge
        mode="guided"
        model="gemini-2.5-pro"
        confidence={0.39}
        tokenCount={2048}
        violations={0}
        size="md"
      />,
    )

    const lowConfidence = screen.getByText('39%')

    expect(screen.getByText('gemini-2.5-pro')).toBeInTheDocument()
    expect(lowConfidence.className).toContain('text-red-400')
    expect(screen.getByText('2048 tokens')).toBeInTheDocument()
    expect(screen.queryByText('0 violations')).not.toBeInTheDocument()
  })

  it('renders violation counts in the medium layout when present', () => {
    render(
      <MetadataBadge
        mode="guided"
        model="gpt-4.1-mini"
        confidence={0.65}
        tokenCount={512}
        violations={3}
        size="md"
      />,
    )

    expect(screen.getByText('3 violations')).toBeInTheDocument()
  })
})
