import { describe, expect, it, vi } from 'vitest'

const nodeViewRendererMock = vi.hoisted(() => vi.fn(() => 'math-block-view'))

vi.mock('@tiptap/react', () => ({
  ReactNodeViewRenderer: (...args: unknown[]) => nodeViewRendererMock(...args),
}))

import { MathView } from './MathView'
import { MathBlock } from './MathBlock'

describe('MathBlock', () => {
  it('defines block math attributes, HTML bindings, and node view wiring', () => {
    const extension = MathBlock.configure()
    const attributes = extension.config.addAttributes?.()

    expect(extension.name).toBe('mathBlock')
    expect(extension.config.group).toBe('block')
    expect(extension.config.content).toBe('text*')
    expect(extension.config.atom).toBe(true)
    expect(extension.config.code).toBe(true)
    expect(extension.config.defining).toBe(true)
    expect(attributes?.latex.default).toBe('')
    expect(extension.config.parseHTML?.()).toEqual([
      {
        tag: 'div[data-type="math-block"]',
        preserveWhitespace: 'full',
      },
    ])
    expect(
      extension.config.renderHTML?.call(extension, {
        HTMLAttributes: { class: 'math-shell' },
      }),
    ).toEqual([
      'div',
      {
        class: 'math-shell',
        'data-type': 'math-block',
      },
      0,
    ])

    expect(extension.config.addNodeView?.()).toBe('math-block-view')
    expect(nodeViewRendererMock).toHaveBeenCalledWith(MathView)
  })
})
