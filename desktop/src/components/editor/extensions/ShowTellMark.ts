import { Mark, mergeAttributes } from '@tiptap/core'

export type ShowTellKind = 'show' | 'tell' | 'neutral'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    showTell: {
      setShowTell: (kind: ShowTellKind) => ReturnType
      unsetShowTell: () => ReturnType
    }
  }
}

export const ShowTellMark = Mark.create({
  name: 'showTell',

  addAttributes() {
    return {
      kind: {
        default: 'neutral',
        parseHTML: (element) =>
          (element as HTMLElement).getAttribute('data-kind') ?? 'neutral',
        renderHTML: (attributes) => ({
          'data-kind': attributes.kind,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-show-tell]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-show-tell': 'true',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setShowTell:
        (kind) =>
        ({ commands }) => {
          return commands.setMark(this.name, { kind })
        },
      unsetShowTell:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name)
        },
    }
  },
})
