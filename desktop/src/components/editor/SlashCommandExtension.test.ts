import { describe, expect, it, vi } from 'vitest'

import { SLASH_COMMAND_KEY, SlashCommandExtension } from './SlashCommandExtension'

describe('SlashCommandExtension', () => {
  it('exposes the expected plugin key and default callbacks', () => {
    const extension = SlashCommandExtension

    expect(SLASH_COMMAND_KEY.key.startsWith('slashCommand')).toBe(true)
    expect(extension.config.addOptions?.()).toEqual({
      onStart: expect.any(Function),
      onUpdate: expect.any(Function),
      onExit: expect.any(Function),
    })

    const defaults = extension.config.addOptions?.()
    defaults?.onStart({ query: 'draft', range: { from: 1, to: 2 }, clientRect: null })
    defaults?.onUpdate({ query: 'draft', range: { from: 1, to: 2 }, clientRect: null })
    defaults?.onExit()
  })

  it('starts, updates, and exits a slash command session', () => {
    const onStart = vi.fn()
    const onUpdate = vi.fn()
    const onExit = vi.fn()
    const extension = SlashCommandExtension.configure({ onStart, onUpdate, onExit })
    const [plugin] = extension.config.addProseMirrorPlugins?.call(extension) ?? []
    const pluginView = plugin.spec.view()

    expect(plugin.props.handleKeyDown({} as never, {} as KeyboardEvent)).toBe(false)

    const view = {
      state: {
        selection: {
          empty: true,
          from: 10,
          $from: {
            parent: { textContent: 'cast /summon' },
            parentOffset: 12,
          },
        },
      },
      coordsAtPos: vi.fn(() => ({ left: 24, top: 48 })),
    }

    pluginView.update(view as never)
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onUpdate).not.toHaveBeenCalled()

    const startProps = onStart.mock.calls[0]?.[0]
    expect(startProps.query).toBe('summon')
    expect(startProps.range).toEqual({ from: 3, to: 10 })
    expect(startProps.clientRect?.()).toMatchObject({
      left: 24,
      right: 24,
      top: 48,
      bottom: 48,
      x: 24,
      y: 48,
      width: 0,
      height: 0,
    })
    expect(startProps.clientRect?.()?.toJSON()).toEqual({})

    pluginView.update(view as never)
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate.mock.calls[0]?.[0].query).toBe('summon')

    pluginView.destroy()
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('ignores non-empty selections and text that does not end in a slash command', () => {
    const onStart = vi.fn()
    const onUpdate = vi.fn()
    const onExit = vi.fn()
    const extension = SlashCommandExtension.configure({ onStart, onUpdate, onExit })
    const [plugin] = extension.config.addProseMirrorPlugins?.call(extension) ?? []
    const pluginView = plugin.spec.view()

    pluginView.update({
      state: {
        selection: {
          empty: false,
          from: 4,
          $from: {
            parent: { textContent: '/abc' },
            parentOffset: 4,
          },
        },
      },
      coordsAtPos: vi.fn(),
    } as never)

    pluginView.update({
      state: {
        selection: {
          empty: true,
          from: 11,
          $from: {
            parent: { textContent: 'plain words' },
            parentOffset: 11,
          },
        },
      },
      coordsAtPos: vi.fn(),
    } as never)

    expect(onStart).not.toHaveBeenCalled()
    expect(onUpdate).not.toHaveBeenCalled()

    pluginView.destroy()
    expect(onExit).toHaveBeenCalledTimes(1)
  })
})
