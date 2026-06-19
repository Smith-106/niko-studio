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
  const resolvedContainer =
    options && 'container' in options ? options.container : { clientWidth: 240, clientHeight: 120 }
  const cy = {
    extent: vi.fn(() => options?.extent ?? { x1: 0, y1: 0, x2: 100, y2: 100 }),
    nodes: vi.fn(() => [{ position: () => ({ x: 20, y: 30 }) }]),
    zoom: vi.fn(() => 2),
    pan: vi.fn(() => ({ x: -10, y: -20 })),
    container: vi.fn(() => resolvedContainer),
    on: vi.fn((event: string, handler: () => void) => {
      listeners.set(event, handler)
    }),
    off: vi.fn(),
  }

  return { cy, listeners }
}

describe('GraphMinimap additional coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('skips drawing when no cytoscape instance is available', () => {
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')

    render(<GraphMinimap cyRef={{ current: null }} />)

    expect(getContextSpy).not.toHaveBeenCalled()
  })

  it('returns early when the canvas context cannot be created', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)

    const { cy } = createCyMock()
    render(<GraphMinimap cyRef={{ current: cy }} />)

    expect(cy.on).not.toHaveBeenCalled()
    expect(cy.off).not.toHaveBeenCalled()
  })

  it('draws nodes but skips the viewport rectangle when the container is unavailable', () => {
    const context = createCanvasContext()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never)

    const { cy } = createCyMock({ container: null })
    render(<GraphMinimap cyRef={{ current: cy }} width={120} height={80} />)

    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 120, 80)
    expect(context.arc).toHaveBeenCalledTimes(1)
    expect(context.strokeRect).not.toHaveBeenCalled()
    expect(cy.on).toHaveBeenCalledWith('viewport', expect.any(Function))
    expect(cy.on).toHaveBeenCalledWith('add remove', expect.any(Function))
  })
})
