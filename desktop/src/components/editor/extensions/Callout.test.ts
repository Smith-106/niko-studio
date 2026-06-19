import { describe, expect, it, vi } from 'vitest'

import { Callout } from './Callout'

describe('Callout', () => {
  it('defines attributes, HTML bindings, and commands', () => {
    const extension = Callout.configure()
    const attributes = extension.config.addAttributes?.()

    expect(attributes?.variant.default).toBe('info')
    expect(extension.config.parseHTML?.()).toEqual([{ tag: 'div[data-type="callout"]' }])
    expect(
      extension.config.renderHTML?.call(extension, {
        HTMLAttributes: { 'data-variant': 'warning' },
      }),
    ).toEqual([
      'div',
      {
        'data-type': 'callout',
        'data-variant': 'warning',
      },
      0,
    ])

    const commands = {
      wrapIn: vi.fn(() => 'wrap-result'),
      toggleWrap: vi.fn(() => 'toggle-result'),
      lift: vi.fn(() => 'lift-result'),
    }
    const nodeCommands = extension.config.addCommands?.call(extension)

    expect(nodeCommands?.setCallout('warning')({ commands } as never)).toBe('wrap-result')
    expect(commands.wrapIn).toHaveBeenCalledWith('callout', { variant: 'warning' })

    expect(nodeCommands?.toggleCallout('tip')({ commands } as never)).toBe('toggle-result')
    expect(commands.toggleWrap).toHaveBeenCalledWith('callout', { variant: 'tip' })

    expect(nodeCommands?.unsetCallout()({ commands } as never)).toBe('lift-result')
    expect(commands.lift).toHaveBeenCalledWith('callout')
  })
})
