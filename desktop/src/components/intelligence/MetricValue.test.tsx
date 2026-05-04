import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MetricValue } from './MetricValue'

describe('MetricValue', () => {
  it('renders numeric value and label', () => {
    render(<MetricValue value={42} label="Total" />)
    expect(screen.getByText('42')).toBeTruthy()
    expect(screen.getByText('Total')).toBeTruthy()
  })

  it('renders string value', () => {
    render(<MetricValue value="35m" label="Avg Duration" />)
    expect(screen.getByText('35m')).toBeTruthy()
  })
})
