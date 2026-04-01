/**
 * Slash Command Extension for TipTap
 *
 * Triggers a callback when user types "/" to show a command menu.
 * Uses a simple input rule + state tracking approach.
 */

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export interface SlashCommandMenuProps {
  query: string
  range: { from: number; to: number }
  clientRect: (() => DOMRect | null) | null
}

export interface SlashCommandOptions {
  onStart: (props: SlashCommandMenuProps) => void
  onUpdate: (props: SlashCommandMenuProps) => void
  onExit: () => void
}

export const SLASH_COMMAND_KEY = new PluginKey('slashCommand')

export const SlashCommandExtension = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      onStart: () => {},
      onUpdate: () => {},
      onExit: () => {},
    }
  },

  addProseMirrorPlugins() {
    const _editor = this.editor
    void _editor
    const { onStart, onUpdate, onExit } = this.options

    return [
      new Plugin({
        key: SLASH_COMMAND_KEY,
        view() {
          return {
            update(view) {
              const { state } = view
              const { selection } = state

              if (!selection.empty) return

              // Get text before cursor in current block
              const $pos = selection.$from
              const textBefore = $pos.parent.textContent.slice(
                0,
                $pos.parentOffset,
              )

              // Match "/" followed by optional query text
              const match = textBefore.match(/\/([^/\s]*)$/)
              if (!match) return

              const query = match[1]
              const slashPos = selection.from - match[0].length
              const range = { from: slashPos, to: selection.from }

              const menuProps: SlashCommandMenuProps = {
                query,
                range,
                clientRect: () => {
                  const c = view.coordsAtPos(selection.from)
                  return {
                    width: 0,
                    height: 0,
                    left: c.left,
                    top: c.top,
                    right: c.left,
                    bottom: c.top,
                    x: c.left,
                    y: c.top,
                    toJSON: () => ({}),
                  }
                },
              }

              // Check if this is the start of slash command or an update
              const prevActive = (this as unknown as { _active?: boolean })._active
              if (!prevActive) {
                ;(this as unknown as { _active?: boolean })._active = true
                onStart(menuProps)
              } else {
                onUpdate(menuProps)
              }
            },

            destroy() {
              onExit()
            },
          }
        },

        props: {
          handleKeyDown(_view, _event) {
            // Allow React component to handle navigation keys
            return false
          },
        },
      }),
    ]
  },
})
