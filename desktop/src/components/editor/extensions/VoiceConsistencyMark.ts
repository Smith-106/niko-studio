import { Mark, mergeAttributes } from '@tiptap/core'

export type VoiceConsistencySeverity = 'low' | 'medium' | 'high'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    voiceConsistency: {
      setVoiceConsistency: (severity: VoiceConsistencySeverity) => ReturnType
      unsetVoiceConsistency: () => ReturnType
    }
  }
}

export const VoiceConsistencyMark = Mark.create({
  name: 'voiceConsistency',

  addAttributes() {
    return {
      severity: {
        default: 'low',
        parseHTML: (element) =>
          (element as HTMLElement).getAttribute('data-severity') ?? 'low',
        renderHTML: (attributes) => ({
          'data-severity': attributes.severity,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-voice-consistency]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-voice-consistency': 'true',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setVoiceConsistency:
        (severity) =>
        ({ commands }) => {
          return commands.setMark(this.name, { severity })
        },
      unsetVoiceConsistency:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name)
        },
    }
  },
})
