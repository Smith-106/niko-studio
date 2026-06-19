import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { GraphMinimap } from './GraphMinimap'

function createCanvasContext() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    strokeRect: vi.fn(),
  }
}

function createCyMock(options?: {
  extent?: { x1: number; y1: number; x2: number; y2: number }
  container?: { clientWidth: number; clientHeight: number } | null
}) {
  const listeners = new Map<string, () => void>()
  const cy = {
    extent: vi.fn(() => options?.extent ?? { x1: 0, y1: 0, x2: 100, y2: 200 }),
    nodes: vi.fn(() => [
      { position: () => ({ x: 15, y: 35 }) },
      { position: () => ({ x: 80, y: 160 }) },
    ]),
    zoom: vi.fn(() => 2),
    pan: vi.fn(() => ({ x: -20, y: -40 })),
    container: vi.fn(() => options?.container ?? { clientWidth: 240, clientHeight: 120 }),
    on: vi.fn((event: string, handler: () => void) => {
      listeners.set(event, handler)
    }),
    off: vi.fn(),
  }

  return { cy, listeners }
}

describe('GraphMinimap', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('draws the minimap, responds to viewport events, and unregisters listeners on unmount', () => {
    const context = createCanvasContext()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never)

    const { cy, listeners } = createCyMock()
    const cyRef = { current: cy }
    const { container, unmount } = render(<GraphMinimap cyRef={cyRef} width={180} height={120} />)

    expect(container.querySelector('canvas')).toHaveAttribute('width', '180')
    expect(container.querySelector('canvas')).toHaveAttribute('height', '120')
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 180, 120)
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 180, 120)
    expect(context.arc).toHaveBeenCalledTimes(2)
    expect(context.strokeRect).toHaveBeenCalledTimes(1)
    expect(cy.on).toHaveBeenCalledWith('viewport', expect.any(Function))
    expect(cy.on).toHaveBeenCalledWith('add remove', expect.any(Function))

    listeners.get('viewport')?.()
    listeners.get('add remove')?.()
    expect(context.clearRect).toHaveBeenCalledTimes(3)

    unmount()

    expect(cy.off).toHaveBeenCalledWith('viewport', listeners.get('viewport'))
    expect(cy.off).toHaveBeenCalledWith('add remove', listeners.get('add remove'))
  })

  it('returns early when the graph has no drawable extent', () => {
    const context = createCanvasContext()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never)

    const { cy } = createCyMock({
      extent: { x1: 10, y1: 5, x2: 10, y2: 50 },
    })
    const cyRef = { current: cy }
    render(<GraphMinimap cyRef={cyRef} />)

    expect(context.clearRect).toHaveBeenCalled()
    expect(context.fillRect).toHaveBeenCalled()
    expect(context.arc).not.toHaveBeenCalled()
    expect(context.strokeRect).not.toHaveBeenCalled()
  })
})
