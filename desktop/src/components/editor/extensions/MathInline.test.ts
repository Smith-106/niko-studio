import { describe, expect, it, vi } from 'vitest'

const nodeViewRendererMock = vi.hoisted(() => vi.fn(() => 'math-inline-view'))

vi.mock('@tiptap/react', () => ({
  ReactNodeViewRenderer: (...args: unknown[]) => nodeViewRendererMock(...args),
}))

import { MathView } from './MathView'
import { MathInline } from './MathInline'

describe('MathInline', () => {
  it('defines inline math attributes, HTML bindings, and node view wiring', () => {
    const extension = MathInline.configure()
    const attributes = extension.config.addAttributes?.()

    expect(extension.name).toBe('mathInline')
    expect(extension.config.group).toBe('inline')
    expect(extension.config.inline).toBe(true)
    expect(extension.config.atom).toBe(true)
    expect(attributes?.latex.default).toBe('')
    expect(extension.config.parseHTML?.()).toEqual([
      {
        tag: 'span[data-type="math-inline"]',
      },
    ])
    expect(
      extension.config.renderHTML?.call(extension, {
        HTMLAttributes: { class: 'math-inline-shell' },
      }),
    ).toEqual([
      'span',
      {
        class: 'math-inline-shell',
        'data-type': 'math-inline',
      },
    ])

    expect(extension.config.addNodeView?.()).toBe('math-inline-view')
    expect(nodeViewRendererMock).toHaveBeenCalledWith(MathView)
  })
})
