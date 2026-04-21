import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ChatAreaStreamStatus } from './ChatAreaStreamStatus'

const defaultProps = {
  recoverStatus: null,
  recoverableCheckpointId: null,
  restoreBeforeSendLabel: 'Restore',
  retryLastSendLabel: 'Retry',
  copyErrorLabel: 'Copy Error',
  errorCategoryLabel: 'Category',
  onRestoreToCheckpoint: vi.fn(),
  onRetryLastSend: vi.fn(),
  onCopyRecoverError: vi.fn().mockResolvedValue(true),
  uploadStatus: null,
}

describe('ChatAreaStreamStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty container when both statuses are null', () => {
    const { container } = render(<ChatAreaStreamStatus {...defaultProps} />)
    // The component renders a div with space-y-2 but no visible children
    expect(container.firstChild).toBeInTheDocument()
    expect(screen.queryByText('Retry')).not.toBeInTheDocument()
  })

  describe('recover status', () => {
    it('renders recover status message', () => {
      render(
        <ChatAreaStreamStatus
          {...defaultProps}
          recoverStatus={{ type: 'success', message: 'Stream recovered' }}
        />,
      )
      expect(screen.getByText('Stream recovered')).toBeInTheDocument()
    })

    it('renders Retry and Copy buttons for error recover status', () => {
      render(
        <ChatAreaStreamStatus
          {...defaultProps}
          recoverStatus={{ type: 'error', message: 'Stream failed' }}
        />,
      )
      expect(screen.getByText('Retry')).toBeInTheDocument()
      expect(screen.getByText('Copy Error')).toBeInTheDocument()
    })

    it('does not render Retry button for non-error recover status', () => {
      render(
        <ChatAreaStreamStatus
          {...defaultProps}
          recoverStatus={{ type: 'success', message: 'OK' }}
        />,
      )
      expect(screen.queryByText('Retry')).not.toBeInTheDocument()
    })

    it('calls onRetryLastSend when Retry is clicked', () => {
      render(
        <ChatAreaStreamStatus
          {...defaultProps}
          recoverStatus={{ type: 'error', message: 'Failed' }}
        />,
      )
      fireEvent.click(screen.getByText('Retry'))
      expect(defaultProps.onRetryLastSend).toHaveBeenCalledOnce()
    })

    it('renders Restore button when recoverableCheckpointId is provided', () => {
      render(
        <ChatAreaStreamStatus
          {...defaultProps}
          recoverStatus={{ type: 'error', message: 'Failed' }}
          recoverableCheckpointId="cp-123"
        />,
      )
      expect(screen.getByText('Restore')).toBeInTheDocument()
    })

    it('does not render Restore button when recoverableCheckpointId is null', () => {
      render(
        <ChatAreaStreamStatus
          {...defaultProps}
          recoverStatus={{ type: 'error', message: 'Failed' }}
          recoverableCheckpointId={null}
        />,
      )
      expect(screen.queryByText('Restore')).not.toBeInTheDocument()
    })

    it('calls onRestoreToCheckpoint when Restore is clicked', () => {
      render(
        <ChatAreaStreamStatus
          {...defaultProps}
          recoverStatus={{ type: 'error', message: 'Failed' }}
          recoverableCheckpointId="cp-456"
        />,
      )
      fireEvent.click(screen.getByText('Restore'))
      expect(defaultProps.onRestoreToCheckpoint).toHaveBeenCalledOnce()
    })

    it('calls onCopyRecoverError when Copy Error is clicked', () => {
      render(
        <ChatAreaStreamStatus
          {...defaultProps}
          recoverStatus={{ type: 'error', message: 'Failed' }}
        />,
      )
      fireEvent.click(screen.getByText('Copy Error'))
      expect(defaultProps.onCopyRecoverError).toHaveBeenCalledOnce()
    })

    it('applies success styling for success recover status', () => {
      const { container } = render(
        <ChatAreaStreamStatus
          {...defaultProps}
          recoverStatus={{ type: 'success', message: 'OK' }}
        />,
      )
      // The status div has the STATUS_CLASS applied directly
      const statusDivs = container.querySelectorAll('div[class*="text-"]')
      const hasSuccess = Array.from(statusDivs).some(
        (div) => div.className.includes('text-success-700'),
      )
      expect(hasSuccess).toBe(true)
    })

    it('applies error styling for error recover status', () => {
      const { container } = render(
        <ChatAreaStreamStatus
          {...defaultProps}
          recoverStatus={{ type: 'error', message: 'Err' }}
        />,
      )
      const statusDivs = container.querySelectorAll('div[class*="text-"]')
      const hasDanger = Array.from(statusDivs).some(
        (div) => div.className.includes('text-danger-700'),
      )
      expect(hasDanger).toBe(true)
    })
  })

  describe('upload status', () => {
    it('renders upload status message', () => {
      render(
        <ChatAreaStreamStatus
          {...defaultProps}
          uploadStatus={{ type: 'info', stage: 'uploading', progress: 50, message: 'Uploading...' }}
        />,
      )
      expect(screen.getByText('Uploading...')).toBeInTheDocument()
    })

    it('displays progress percentage', () => {
      render(
        <ChatAreaStreamStatus
          {...defaultProps}
          uploadStatus={{ type: 'info', stage: 'uploading', progress: 75, message: 'Loading' }}
        />,
      )
      expect(screen.getByText('75%')).toBeInTheDocument()
    })

    it('clamps progress to 0-100 range', () => {
      render(
        <ChatAreaStreamStatus
          {...defaultProps}
          uploadStatus={{ type: 'info', stage: 'uploading', progress: 150, message: 'Over' }}
        />,
      )
      expect(screen.getByText('100%')).toBeInTheDocument()
    })

    it('clamps negative progress to 0', () => {
      render(
        <ChatAreaStreamStatus
          {...defaultProps}
          uploadStatus={{ type: 'info', stage: 'uploading', progress: -10, message: 'Neg' }}
        />,
      )
      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('renders error category when provided', () => {
      render(
        <ChatAreaStreamStatus
          {...defaultProps}
          uploadStatus={{
            type: 'error',
            stage: 'error',
            progress: 100,
            message: 'Upload failed',
            errorCategory: 'format',
          }}
        />,
      )
      expect(screen.getByText(/Category/)).toBeInTheDocument()
      expect(screen.getByText(/format/)).toBeInTheDocument()
    })

    it('does not render error category when not provided', () => {
      render(
        <ChatAreaStreamStatus
          {...defaultProps}
          uploadStatus={{ type: 'success', stage: 'done', progress: 100, message: 'Done' }}
        />,
      )
      expect(screen.queryByText('Category:')).not.toBeInTheDocument()
    })

    it('applies error styling for error upload status', () => {
      const { container } = render(
        <ChatAreaStreamStatus
          {...defaultProps}
          uploadStatus={{ type: 'error', stage: 'error', progress: 0, message: 'Err' }}
        />,
      )
      const statusDivs = container.querySelectorAll('div[class*="text-"]')
      const hasDanger = Array.from(statusDivs).some(
        (div) => div.className.includes('text-danger-700'),
      )
      expect(hasDanger).toBe(true)
    })

    it('renders both recover and upload status simultaneously', () => {
      render(
        <ChatAreaStreamStatus
          {...defaultProps}
          recoverStatus={{ type: 'info', message: 'Recovering...' }}
          uploadStatus={{ type: 'info', stage: 'reading', progress: 30, message: 'Reading file' }}
        />,
      )
      expect(screen.getByText('Recovering...')).toBeInTheDocument()
      expect(screen.getByText('Reading file')).toBeInTheDocument()
    })
  })
})
