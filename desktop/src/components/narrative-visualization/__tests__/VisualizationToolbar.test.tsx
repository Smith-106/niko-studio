import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { VisualizationToolbar } from '../VisualizationToolbar'

const availableViews = [
  { id: 'timeline' as const, label: 'Timeline' },
  { id: 'tension' as const, label: 'Tension' },
  { id: 'characterGraph' as const, label: 'Character Graph' },
]

describe('VisualizationToolbar', () => {
  it('renders all available view buttons', () => {
    render(
      <VisualizationToolbar
        activeView="timeline"
        availableViews={availableViews}
        onViewChange={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: 'Timeline' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tension' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Character Graph' })).toBeInTheDocument()
  })

  it('marks the active view as pressed', () => {
    render(
      <VisualizationToolbar
        activeView="tension"
        availableViews={availableViews}
        onViewChange={() => {}}
      />,
    )

    const tensionButton = screen.getByRole('button', { name: 'Tension' })
    expect(tensionButton).toHaveAttribute('aria-pressed', 'true')

    const timelineButton = screen.getByRole('button', { name: 'Timeline' })
    expect(timelineButton).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onViewChange when a view button is clicked', () => {
    const onViewChange = vi.fn()

    render(
      <VisualizationToolbar
        activeView="timeline"
        availableViews={availableViews}
        onViewChange={onViewChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Tension' }))
    expect(onViewChange).toHaveBeenCalledWith('tension')
  })

  it('renders zoom controls when onZoomIn, onZoomOut, and onResetZoom are provided', () => {
    render(
      <VisualizationToolbar
        activeView="timeline"
        availableViews={availableViews}
        onViewChange={() => {}}
        zoomScale={1.5}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onResetZoom={() => {}}
      />,
    )

    expect(screen.getByLabelText('Zoom controls')).toBeInTheDocument()
    expect(screen.getByLabelText('Zoom in')).toBeInTheDocument()
    expect(screen.getByLabelText('Zoom out')).toBeInTheDocument()
    expect(screen.getByLabelText('Reset zoom')).toBeInTheDocument()
    expect(screen.getByText('150%')).toBeInTheDocument()
  })

  it('does not render zoom controls when handlers are not provided', () => {
    render(
      <VisualizationToolbar
        activeView="timeline"
        availableViews={availableViews}
        onViewChange={() => {}}
      />,
    )

    expect(screen.queryByLabelText('Zoom controls')).not.toBeInTheDocument()
  })

  it('calls onZoomIn when zoom in button is clicked', () => {
    const onZoomIn = vi.fn()

    render(
      <VisualizationToolbar
        activeView="timeline"
        availableViews={availableViews}
        onViewChange={() => {}}
        onZoomIn={onZoomIn}
        onZoomOut={() => {}}
        onResetZoom={() => {}}
      />,
    )

    fireEvent.click(screen.getByLabelText('Zoom in'))
    expect(onZoomIn).toHaveBeenCalledTimes(1)
  })

  it('calls onZoomOut when zoom out button is clicked', () => {
    const onZoomOut = vi.fn()

    render(
      <VisualizationToolbar
        activeView="timeline"
        availableViews={availableViews}
        onViewChange={() => {}}
        onZoomIn={() => {}}
        onZoomOut={onZoomOut}
        onResetZoom={() => {}}
      />,
    )

    fireEvent.click(screen.getByLabelText('Zoom out'))
    expect(onZoomOut).toHaveBeenCalledTimes(1)
  })

  it('calls onResetZoom when reset button is clicked', () => {
    const onResetZoom = vi.fn()

    render(
      <VisualizationToolbar
        activeView="timeline"
        availableViews={availableViews}
        onViewChange={() => {}}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onResetZoom={onResetZoom}
      />,
    )

    fireEvent.click(screen.getByLabelText('Reset zoom'))
    expect(onResetZoom).toHaveBeenCalledTimes(1)
  })

  it('renders event type filter checkboxes when eventFilters and onToggleEventFilter are provided', () => {
    render(
      <VisualizationToolbar
        activeView="timeline"
        availableViews={availableViews}
        onViewChange={() => {}}
        eventFilters={['conflict', 'warning']}
        onToggleEventFilter={() => {}}
      />,
    )

    expect(screen.getByLabelText('Event type filters')).toBeInTheDocument()
    expect(screen.getByLabelText('Turning Point')).toBeInTheDocument()
    expect(screen.getByLabelText('Conflict')).toBeInTheDocument()
    expect(screen.getByLabelText('Warning')).toBeInTheDocument()
  })

  it('does not render event type filters when handlers are not provided', () => {
    render(
      <VisualizationToolbar
        activeView="timeline"
        availableViews={availableViews}
        onViewChange={() => {}}
      />,
    )

    expect(screen.queryByLabelText('Event type filters')).not.toBeInTheDocument()
  })

  it('checks checkboxes based on eventFilters', () => {
    render(
      <VisualizationToolbar
        activeView="timeline"
        availableViews={availableViews}
        onViewChange={() => {}}
        eventFilters={['conflict']}
        onToggleEventFilter={() => {}}
      />,
    )

    const conflictCheckbox = screen.getByLabelText('Conflict') as HTMLInputElement
    expect(conflictCheckbox.checked).toBe(true)

    const turningPointCheckbox = screen.getByLabelText('Turning Point') as HTMLInputElement
    expect(turningPointCheckbox.checked).toBe(false)
  })

  it('calls onToggleEventFilter when a checkbox is toggled', () => {
    const onToggleEventFilter = vi.fn()

    render(
      <VisualizationToolbar
        activeView="timeline"
        availableViews={availableViews}
        onViewChange={() => {}}
        eventFilters={['conflict']}
        onToggleEventFilter={onToggleEventFilter}
      />,
    )

    fireEvent.click(screen.getByLabelText('Conflict'))
    expect(onToggleEventFilter).toHaveBeenCalledWith('conflict')
  })

  it('does not display zoom percentage when zoomScale is not provided', () => {
    render(
      <VisualizationToolbar
        activeView="timeline"
        availableViews={availableViews}
        onViewChange={() => {}}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onResetZoom={() => {}}
      />,
    )

    // zoomScale is not provided, percentage should not render
    expect(screen.queryByText(/%\$/)).not.toBeInTheDocument()
  })

  it('renders zoom percentage correctly for different zoom levels', () => {
    const { rerender } = render(
      <VisualizationToolbar
        activeView="timeline"
        availableViews={availableViews}
        onViewChange={() => {}}
        zoomScale={2.0}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onResetZoom={() => {}}
      />,
    )

    expect(screen.getByText('200%')).toBeInTheDocument()

    rerender(
      <VisualizationToolbar
        activeView="timeline"
        availableViews={availableViews}
        onViewChange={() => {}}
        zoomScale={0.5}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onResetZoom={() => {}}
      />,
    )

    expect(screen.getByText('50%')).toBeInTheDocument()
  })
})