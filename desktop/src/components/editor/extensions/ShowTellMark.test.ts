import { describe, expect, it, vi } from 'vitest'

import { ShowTellMark } from './ShowTellMark'

describe('ShowTellMark', () => {
  it('defines mark attributes, HTML bindings, and commands', () => {
    const extension = ShowTellMark.configure()
    const attributes = extension.config.addAttributes?.()

    expect(attributes?.kind.default).toBe('neutral')

    const plainElement = document.createElement('span')
    expect(attributes?.kind.parseHTML(plainElement)).toBe('neutral')

    const markedElement = document.createElement('span')
    markedElement.setAttribute('data-kind', 'show')
    expect(attributes?.kind.parseHTML(markedElement)).toBe('show')
    expect(attributes?.kind.renderHTML({ kind: 'tell' })).toEqual({ 'data-kind': 'tell' })

    expect(extension.config.parseHTML?.()).toEqual([{ tag: 'span[data-show-tell]' }])
    expect(extension.config.renderHTML?.call(extension, { HTMLAttributes: { 'data-kind': 'neutral' } })).toEqual([
      'span',
      {
        'data-kind': 'neutral',
        'data-show-tell': 'true',
      },
      0,
    ])

    const commands = {
      setMark: vi.fn(() => 'set-result'),
      unsetMark: vi.fn(() => 'unset-result'),
    }
    const markCommands = extension.config.addCommands?.call(extension)

    expect(markCommands?.setShowTell('show')({ commands } as never)).toBe('set-result')
    expect(commands.setMark).toHaveBeenCalledWith('showTell', { kind: 'show' })

    expect(markCommands?.unsetShowTell()({ commands } as never)).toBe('unset-result')
    expect(commands.unsetMark).toHaveBeenCalledWith('showTell')
  })
})
