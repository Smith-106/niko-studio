import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())

vi.mock('../../api/core', () => ({
  callApi: callApiMock,
}))

vi.mock('./SectionHeader', () => ({
  SectionHeader: ({ title }: { title: string }) => <h3>{title}</h3>,
}))

import { PluginPanel } from './PluginPanel'

function listResponse(plugins: Array<Record<string, string>>) {
  return {
    success: true,
    data: {
      plugins,
    },
  }
}

function triggerReactClick(element: HTMLElement) {
  const propsKey = Object.keys(element).find((key) => key.startsWith('__reactProps$'))
  const reactProps = propsKey
    ? ((element as unknown as Record<string, { onClick?: (event: unknown) => void }>)[propsKey] ?? {})
    : {}

  reactProps.onClick?.({} as unknown)
}

describe('PluginPanel', () => {
  beforeEach(() => {
    callApiMock.mockReset()
  })

  it('loads plugins, renders the empty state, and toggles the register guide', async () => {
    const user = userEvent.setup()
    callApiMock.mockResolvedValueOnce(listResponse([]))

    render(<PluginPanel text="一段正文" />)

    await waitFor(() => {
      expect(callApiMock).toHaveBeenCalledWith('/plugins/list', 'GET')
    })
    expect(screen.getByText('暂无已注册的 Plugin')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /注册/ }))
    expect(screen.getByText('通过 API POST /plugins/register 注册自定义 Plugin：')).toBeInTheDocument()
    expect(screen.getByText(/my-plugin/)).toBeInTheDocument()
  })

  it('disables execution for blank text and renders plugin results after execution', async () => {
    const user = userEvent.setup()
    callApiMock
      .mockResolvedValueOnce(
        listResponse([
          {
            id: 'plugin-1',
            name: '悬念检测器',
            version: '1.0.0',
            description: '分析悬念密度',
            dimension: 'suspense',
          },
        ]),
      )
      .mockResolvedValueOnce({
        success: true,
        data: {
          results: [
            {
              score: 7,
              maxScore: 10,
              evidence: ['第 2 段埋下悬念'],
              suggestions: ['结尾再补一个反转'],
            },
          ],
        },
      })

    const { rerender } = render(<PluginPanel text="   " />)

    expect(await screen.findByText('悬念检测器')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '执行' })).toBeDisabled()

    rerender(<PluginPanel text="这是一段需要分析的正文。" />)
    await user.click(screen.getByRole('button', { name: '执行' }))

    await waitFor(() => {
      expect(callApiMock).toHaveBeenCalledWith('/plugins/execute', 'POST', {
        text: '这是一段需要分析的正文。',
        pluginId: 'plugin-1',
      })
    })

    expect(screen.getByText('7/10')).toBeInTheDocument()
    expect(screen.getByText('第 2 段埋下悬念')).toBeInTheDocument()
    expect(screen.getByText('结尾再补一个反转')).toBeInTheDocument()
  })

  it('swallows load and execution errors without crashing', async () => {
    const user = userEvent.setup()
    callApiMock
      .mockRejectedValueOnce(new Error('load failed'))
      .mockResolvedValueOnce(
        listResponse([
          {
            id: 'plugin-1',
            name: '悬念检测器',
            version: '1.0.0',
            description: '分析悬念密度',
            dimension: 'suspense',
          },
        ]),
      )
      .mockRejectedValueOnce(new Error('execute failed'))

    const { unmount } = render(<PluginPanel text="正文" />)

    await waitFor(() => {
      expect(callApiMock).toHaveBeenCalledWith('/plugins/list', 'GET')
    })
    expect(screen.getByText('暂无已注册的 Plugin')).toBeInTheDocument()

    unmount()
    render(<PluginPanel text="另一段正文" />)
    expect(await screen.findByText('悬念检测器')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '执行' }))

    await waitFor(() => {
      expect(callApiMock).toHaveBeenCalledWith('/plugins/execute', 'POST', {
        text: '另一段正文',
        pluginId: 'plugin-1',
      })
    })
    expect(screen.queryByText('7/10')).not.toBeInTheDocument()
  })

  it('returns early when execution is force-triggered for blank text', async () => {
    callApiMock.mockResolvedValueOnce(
      listResponse([
        {
          id: 'plugin-1',
          name: '悬念检测器',
          version: '1.0.0',
          description: '分析悬念密度',
          dimension: 'suspense',
        },
      ]),
    )

    render(<PluginPanel text="   " />)

    const executeButton = await screen.findByRole('button', { name: '执行' })
    ;(executeButton as HTMLButtonElement).disabled = false
    executeButton.removeAttribute('disabled')
    triggerReactClick(executeButton)

    expect(callApiMock).toHaveBeenCalledTimes(1)
    expect(callApiMock).not.toHaveBeenCalledWith('/plugins/execute', 'POST', expect.anything())
  })

  it('renders amber and red score states for lower plugin results', async () => {
    const user = userEvent.setup()
    callApiMock
      .mockResolvedValueOnce(
        listResponse([
          {
            id: 'plugin-1',
            name: '悬念检测器',
            version: '1.0.0',
            description: '分析悬念密度',
            dimension: 'suspense',
          },
        ]),
      )
      .mockResolvedValueOnce({
        success: true,
        data: {
          results: [
            {
              score: 4,
              maxScore: 10,
              evidence: ['中段张力尚可'],
              suggestions: ['补强尾段钩子'],
            },
          ],
        },
      })
      .mockResolvedValueOnce(
        listResponse([
          {
            id: 'plugin-1',
            name: '悬念检测器',
            version: '1.0.0',
            description: '分析悬念密度',
            dimension: 'suspense',
          },
        ]),
      )
      .mockResolvedValueOnce({
        success: true,
        data: {
          results: [
            {
              score: 2,
              maxScore: 10,
              evidence: ['悬念缺失'],
              suggestions: ['尽快补一个冲突点'],
            },
          ],
        },
      })

    const { unmount } = render(<PluginPanel text="第一段正文" />)

    expect(await screen.findByText('悬念检测器')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '执行' }))

    await waitFor(() => {
      expect(screen.getByText('4/10')).toBeInTheDocument()
    })
    expect(screen.getByText('4/10').style.color).toBe('rgb(217, 119, 6)')

    unmount()
    render(<PluginPanel text="第二段正文" />)

    expect(await screen.findByText('悬念检测器')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '执行' }))

    await waitFor(() => {
      expect(screen.getByText('2/10')).toBeInTheDocument()
    })
    expect(screen.getByText('2/10').style.color).toBe('rgb(220, 38, 38)')
  })
})
