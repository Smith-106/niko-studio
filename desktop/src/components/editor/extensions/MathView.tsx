import { useEffect, useRef, useState, useCallback } from 'react'
import type { NodeViewProps } from '@tiptap/react'
import { NodeViewWrapper } from '@tiptap/react'
import 'katex/dist/katex.min.css'

export function MathView({ node, editor, updateAttributes, deleteNode }: NodeViewProps) {
  const [isEditing, setIsEditing] = useState(!node.attrs.latex)
  const [inputValue, setInputValue] = useState(node.attrs.latex || '')
  const katexContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const renderKatex = useCallback(async () => {
    if (katexContainerRef.current) {
      const katex = (await import('katex')).default
      katex.render(node.attrs.latex, katexContainerRef.current, {
        throwOnError: false,
        displayMode: node.type.name === 'mathBlock',
      })
    }
  }, [node.attrs.latex, node.type.name])

  useEffect(() => {
    void renderKatex()
  }, [renderKatex])

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
    }
  }, [isEditing])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      updateAttributes({ latex: inputValue })
      setIsEditing(false)
      // Move cursor outside of the node
      const pos = editor.state.selection.$head.pos
      editor.chain().focus().setTextSelection(pos).run()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
    }
  }

  const handleBlur = () => {
    updateAttributes({ latex: inputValue })
    setIsEditing(false)
    if (!node.attrs.latex && !inputValue) {
      deleteNode()
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    if (e.detail === 2) {
      // double click
      setIsEditing(true)
    }
  }

  return (
    <NodeViewWrapper
      as={node.type.name === 'mathBlock' ? 'div' : 'span'}
      className={
        node.type.name === 'mathBlock'
          ? 'math-block-container'
          : 'math-inline-container'
      }
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder="Enter LaTeX..."
          className="math-input"
        />
      ) : (
        <div
          ref={katexContainerRef}
          onClick={handleClick}
          role="math"
          aria-label={node.attrs.latex}
          className="cursor-pointer"
        />
      )}
    </NodeViewWrapper>
  )
}
