import { describe, expect, it, vi } from 'vitest'

import { WikilinkMark } from './WikilinkMark'

describe('WikilinkMark', () => {
  it('renders HTML, parses wikilinks, and exposes mark commands', () => {
    const extension = WikilinkMark.configure({
      HTMLAttributes: { 'data-scope': 'editor' },
    })

    expect(extension.config.addOptions?.()).toEqual({
      HTMLAttributes: { 'data-scope': 'editor' },
    })
    expect(extension.config.parseHTML?.()).toEqual([{ tag: 'span[data-wikilink]' }])

    expect(
      extension.config.renderHTML?.call(extension, {
        HTMLAttributes: { 'data-target': 'Hero' },
      }),
    ).toEqual([
      'span',
      {
        'data-scope': 'editor',
        'data-target': 'Hero',
        class: 'wikilink',
        'data-wikilink': '',
      },
      0,
    ])

    const commands = {
      setMark: vi.fn(() => 'set-result'),
      toggleMark: vi.fn(() => 'toggle-result'),
      unsetMark: vi.fn(() => 'unset-result'),
    }
    const markCommands = extension.config.addCommands?.call(extension)

    expect(markCommands?.setWikilink('Target')({ commands } as never)).toBe('set-result')
    expect(commands.setMark).toHaveBeenCalledWith('wikilink', { target: 'Target' })

    expect(markCommands?.toggleWikilink('Target')({ commands } as never)).toBe('toggle-result')
    expect(commands.toggleMark).toHaveBeenCalledWith('wikilink', { target: 'Target' })

    expect(markCommands?.unsetWikilink()({ commands } as never)).toBe('unset-result')
    expect(commands.unsetMark).toHaveBeenCalledWith('wikilink')
  })

  it('creates input and paste rules that capture wikilink targets', () => {
    const extension = WikilinkMark.configure({ HTMLAttributes: {} })
    const type = {
      name: 'wikilink',
      create: vi.fn((attrs) => ({ attrs })),
    }
    const fakeContext = { type }

    const [inputRule] = extension.config.addInputRules?.call(fakeContext as never) ?? []
    const [pasteRule] = extension.config.addPasteRules?.call(fakeContext as never) ?? []

    expect(inputRule.find).toBeInstanceOf(RegExp)
    expect('[[Chapter One]]'.match(inputRule.find)?.[1]).toBe('Chapter One')
    expect(typeof inputRule.handler).toBe('function')
    expect(inputRule.undoable).toBe(true)

    expect(pasteRule.find).toBeInstanceOf(RegExp)
    expect(Array.from('[[Scene]] [[Beat]]'.matchAll(pasteRule.find)).map((match) => match[1])).toEqual([
      'Scene',
      'Beat',
    ])
    expect(typeof pasteRule.handler).toBe('function')

    const tr = {
      delete: vi.fn(),
      addMark: vi.fn(),
      removeStoredMark: vi.fn(),
    }
    const state = {
      tr,
      doc: {
        nodesBetween: vi.fn(),
      },
    }

    const inputMatch = Object.assign(['[[Chapter One]]', 'Chapter One'], {
      index: 0,
      input: '[[Chapter One]]',
    })
    inputRule.handler({
      state,
      range: { from: 0, to: 15 },
      match: inputMatch,
    })

    expect(type.create).toHaveBeenCalledWith({ target: 'Chapter One' })
    expect(tr.addMark).toHaveBeenCalled()
    expect(tr.removeStoredMark).toHaveBeenCalledWith(type)

    tr.delete.mockClear()
    tr.addMark.mockClear()
    tr.removeStoredMark.mockClear()

    const pasteMatch = Object.assign(['[[Scene]]', 'Scene'], {
      index: 0,
      input: '[[Scene]]',
    })
    pasteRule.handler({
      state,
      range: { from: 0, to: 9 },
      match: pasteMatch,
      pasteEvent: {} as ClipboardEvent,
    })

    expect(type.create).toHaveBeenCalledWith({ target: 'Scene' })
    expect(tr.addMark).toHaveBeenCalled()
    expect(tr.removeStoredMark).not.toHaveBeenCalled()
  })

  it('dispatches a custom event when clicking a wikilink and handles missing targets safely', () => {
    const extension = WikilinkMark.configure({ HTMLAttributes: {} })
    const [plugin] = extension.config.addProseMirrorPlugins?.call(extension) ?? []
    const dispatchEvent = vi.fn()
    const view = { dom: { dispatchEvent } }

    const wikilink = document.createElement('span')
    wikilink.className = 'wikilink'
    wikilink.setAttribute('data-target', 'note-1')
    const nestedChild = document.createElement('strong')
    wikilink.appendChild(nestedChild)

    expect(plugin.props.handleClick(view as never, 0, { target: nestedChild } as MouseEvent)).toBe(true)

    const dispatchedEvent = dispatchEvent.mock.calls[0]?.[0] as CustomEvent
    expect(dispatchedEvent.type).toBe('wikilink-click')
    expect(dispatchedEvent.detail).toEqual({ target: 'note-1' })

    dispatchEvent.mockClear()
    wikilink.removeAttribute('data-target')
    expect(plugin.props.handleClick(view as never, 0, { target: wikilink } as MouseEvent)).toBe(true)
    expect(dispatchEvent).not.toHaveBeenCalled()

    const plainText = document.createElement('span')
    expect(plugin.props.handleClick(view as never, 0, { target: plainText } as MouseEvent)).toBe(false)
  })
})
