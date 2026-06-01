import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MathView } from '../MathView'

// Mock katex — guard against null container (async render after unmount/switch)
vi.mock('katex', () => ({
  default: {
    render: vi.fn((_latex: string, container: HTMLElement | null) => {
      if (container) {
        container.innerHTML = `<span class="katex-mock">${_latex}</span>`
      }
    }),
  },
}))

// Mock @tiptap/react NodeViewWrapper
vi.mock('@tiptap/react', () => ({
  NodeViewWrapper: ({ children, as: Tag, className }: any) => {
    const TagName = Tag || 'div'
    return <TagName className={className}>{children}</TagName>
  },
}))

const mockUpdateAttributes = vi.fn()
const mockDeleteNode = vi.fn()
const mockChain = vi.fn(() => ({
  focus: vi.fn(() => ({
    setTextSelection: vi.fn(() => ({
      run: vi.fn(),
    })),
  })),
}))
const mockEditor = {
  state: {
    selection: {
      $head: { pos: 10 },
    },
  },
  chain: mockChain,
} as any

function createNodeProps(overrides: Record<string, any> = {}) {
  return {
    attrs: { latex: '' },
    type: { name: 'mathInline' },
    ...overrides,
  }
}

const stubProps = {
  editor: mockEditor,
  updateAttributes: mockUpdateAttributes,
  deleteNode: mockDeleteNode,
  selected: false,
  decorationManager: {} as any,
  extension: {} as any,
  getPos: () => 0,
  innerDecorations: {} as any,
  view: {} as any,
} as const

describe('MathView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---------------------------------------------------------------------------
  // isEditing initial state
  // ---------------------------------------------------------------------------

  it('starts in editing mode when latex is empty', () => {
    const node = createNodeProps({ attrs: { latex: '' } })
    render(<MathView node={node} {...stubProps} />)

    expect(screen.getByPlaceholderText('Enter LaTeX...')).toBeInTheDocument()
  })

  it('starts in editing mode when latex is undefined', () => {
    const node = createNodeProps({ attrs: { latex: undefined } })
    render(<MathView node={node} {...stubProps} />)

    expect(screen.getByPlaceholderText('Enter LaTeX...')).toBeInTheDocument()
  })

  it('starts in view mode when latex has content', () => {
    const node = createNodeProps({ attrs: { latex: 'E = mc^2' } })
    render(<MathView node={node} {...stubProps} />)

    // Should render the katex container, not the input
    expect(screen.queryByPlaceholderText('Enter LaTeX...')).not.toBeInTheDocument()
    expect(screen.getByRole('math')).toBeInTheDocument()
  })

  it('starts in view mode when latex has whitespace-only content', () => {
    // Whitespace-only latex is truthy, so isEditing starts as false
    const node = createNodeProps({ attrs: { latex: '   ' } })
    render(<MathView node={node} {...stubProps} />)

    expect(screen.queryByPlaceholderText('Enter LaTeX...')).not.toBeInTheDocument()
    expect(screen.getByRole('math')).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Editing interactions
  // ---------------------------------------------------------------------------

  it('enters editing mode on double click', async () => {
    const node = createNodeProps({ attrs: { latex: 'E = mc^2' } })
    render(<MathView node={node} {...stubProps} />)

    // Initially in view mode
    expect(screen.queryByPlaceholderText('Enter LaTeX...')).not.toBeInTheDocument()

    // Double click to enter editing mode
    const mathContainer = screen.getByRole('math')
    fireEvent.click(mathContainer, { detail: 2 })

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter LaTeX...')).toBeInTheDocument()
    })
  })

  it('updates latex and exits editing on Enter key', async () => {
    const node = createNodeProps({ attrs: { latex: '' } })
    render(<MathView node={node} {...stubProps} />)

    const input = screen.getByPlaceholderText('Enter LaTeX...')
    fireEvent.change(input, { target: { value: 'x^2' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mockUpdateAttributes).toHaveBeenCalledWith({ latex: 'x^2' })
  })

  it('exits editing mode on Escape key without updating', async () => {
    const node = createNodeProps({ attrs: { latex: '' } })
    render(<MathView node={node} {...stubProps} />)

    const input = screen.getByPlaceholderText('Enter LaTeX...')
    fireEvent.keyDown(input, { key: 'Escape' })

    // Should exit editing mode (input disappears)
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Enter LaTeX...')).not.toBeInTheDocument()
    })
  })

  it('deletes node on blur when both node latex and input are empty', async () => {
    const node = createNodeProps({ attrs: { latex: '' } })
    render(<MathView node={node} {...stubProps} />)

    const input = screen.getByPlaceholderText('Enter LaTeX...')
    // Leave input empty and blur
    fireEvent.blur(input)

    expect(mockDeleteNode).toHaveBeenCalled()
  })

  it('does not delete node on blur when input has content', async () => {
    const node = createNodeProps({ attrs: { latex: '' } })
    render(<MathView node={node} {...stubProps} />)

    const input = screen.getByPlaceholderText('Enter LaTeX...')
    fireEvent.change(input, { target: { value: 'x^2' } })
    fireEvent.blur(input)

    expect(mockDeleteNode).not.toHaveBeenCalled()
    expect(mockUpdateAttributes).toHaveBeenCalledWith({ latex: 'x^2' })
  })

  // ---------------------------------------------------------------------------
  // Math block vs inline
  // ---------------------------------------------------------------------------

  it('renders as div for mathBlock type', () => {
    const node = createNodeProps({
      attrs: { latex: 'E = mc^2' },
      type: { name: 'mathBlock' },
    })
    const { container } = render(<MathView node={node} {...stubProps} />)

    const wrapper = container.firstElementChild
    expect(wrapper?.tagName).toBe('DIV')
    expect(wrapper).toHaveClass('math-block-container')
  })

  it('renders as span for mathInline type', () => {
    const node = createNodeProps({
      attrs: { latex: 'E = mc^2' },
      type: { name: 'mathInline' },
    })
    const { container } = render(<MathView node={node} {...stubProps} />)

    const wrapper = container.firstElementChild
    expect(wrapper?.tagName).toBe('SPAN')
    expect(wrapper).toHaveClass('math-inline-container')
  })
})
