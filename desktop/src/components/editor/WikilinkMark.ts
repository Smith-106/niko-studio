import { Mark, markInputRule, markPasteRule } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export interface WikilinkMarkOptions {
  HTMLAttributes: Record<string, string>
}

const WIKILINK_REGEX = /\[\[([^\]]+)\]\]/g

export const WikilinkMark = Mark.create<WikilinkMarkOptions>({
  name: 'wikilink',

  addOptions() {
    return { HTMLAttributes: {} }
  },

  parseHTML() {
    return [{ tag: 'span[data-wikilink]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      {
        ...this.options.HTMLAttributes,
        ...HTMLAttributes,
        class: 'wikilink',
        'data-wikilink': '',
      },
      0,
    ]
  },

  addCommands() {
    return {
      setWikilink:
        (target: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, { target })
        },
      toggleWikilink:
        (target: string) =>
        ({ commands }) => {
          return commands.toggleMark(this.name, { target })
        },
      unsetWikilink:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name)
        },
    }
  },

  addInputRules() {
    return [
      markInputRule({
        find: /\[\[([^\]]+)\]\]$/,
        type: this.type,
        getAttributes: (match) => ({ target: match[1] }),
      }),
    ]
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: WIKILINK_REGEX,
        type: this.type,
        getAttributes: (match) => ({ target: match[1] }),
      }),
    ]
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('wikilinkClick'),
        props: {
          handleClick: (view, pos, event) => {
            const target = event.target as HTMLElement
            if (target?.closest('.wikilink')) {
              const wikilinkEl = target.closest('.wikilink') as HTMLElement
              const linkTarget = wikilinkEl.getAttribute('data-target')
              if (linkTarget) {
                // Dispatch custom event for the app to handle
                view.dom.dispatchEvent(
                  new CustomEvent('wikilink-click', {
                    bubbles: true,
                    detail: { target: linkTarget },
                  }),
                )
              }
              return true
            }
            return false
          },
          handleMouseover: (view, pos, event) => {
            const target = event.target as HTMLElement
            if (target?.closest('.wikilink')) {
              const wikilinkEl = target.closest('.wikilink') as HTMLElement
              const linkTarget = wikilinkEl.getAttribute('data-target')
              if (linkTarget) {
                view.dom.dispatchEvent(
                  new CustomEvent('wikilink-hover', {
                    bubbles: true,
                    detail: { target: linkTarget },
                  }),
                )
              }
            }
          },
        },
      }),
    ]
  },
})

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wikilink: {
      setWikilink: (target: string) => ReturnType
      toggleWikilink: (target: string) => ReturnType
      unsetWikilink: () => ReturnType
    }
  }
}
