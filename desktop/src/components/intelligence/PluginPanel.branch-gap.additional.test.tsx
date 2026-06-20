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

describe('PluginPanel branch-gap coverage', () => {
  beforeEach(() => {
    callApiMock.mockReset()
  })

  it('covers the branch where callApi returns success but no data for plugin list', async () => {
    callApiMock.mockResolvedValueOnce({ success: true, data: undefined })

    render(<PluginPanel text="正文内容" />)

    await waitFor(() => {
      expect(callApiMock).toHaveBeenCalledWith('/plugins/list', 'GET')
    })

    // No plugins should render when data is undefined
    expect(screen.getByText('暂无已注册的 Plugin')).toBeInTheDocument()
  })

  it('covers the branch where callApi returns success:false for plugin list', async () => {
    callApiMock.mockResolvedValueOnce({ success: false })

    render(<PluginPanel text="正文内容" />)

    await waitFor(() => {
      expect(callApiMock).toHaveBeenCalledWith('/plugins/list', 'GET')
    })

    expect(screen.getByText('暂无已注册的 Plugin')).toBeInTheDocument()
  })

  it('covers the branch where plugin execution returns success but no results array', async () => {
    const user = userEvent.setup()

    callApiMock
      .mockResolvedValueOnce(
        listResponse([
          {
            id: 'plugin-1',
            name: '测试插件',
            version: '2.0.0',
            description: '分支覆盖测试',
          },
        ]),
      )
      .mockResolvedValueOnce({
        success: true,
        data: {},
      })

    render(<PluginPanel text="有效正文" />)

    expect(await screen.findByText('测试插件')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '执行' }))

    await waitFor(() => {
      expect(callApiMock).toHaveBeenCalledWith('/plugins/execute', 'POST', {
        text: '有效正文',
        pluginId: 'plugin-1',
      })
    })

    // No result score should be rendered when results are empty
    expect(screen.queryByText(/\d+\/\d+/)).not.toBeInTheDocument()
  })

  it('covers the branch where plugin execution returns success but empty results', async () => {
    const user = userEvent.setup()

    callApiMock
      .mockResolvedValueOnce(
        listResponse([
          {
            id: 'plugin-2',
            name: '空结果插件',
            version: '1.0.0',
            description: '空结果测试',
          },
        ]),
      )
      .mockResolvedValueOnce({
        success: true,
        data: {
          results: [],
        },
      })

    render(<PluginPanel text="有效正文" />)

    expect(await screen.findByText('空结果插件')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '执行' }))

    await waitFor(() => {
      expect(callApiMock).toHaveBeenCalledWith('/plugins/execute', 'POST', {
        text: '有效正文',
        pluginId: 'plugin-2',
      })
    })

    expect(screen.queryByText(/\d+\/\d+/)).not.toBeInTheDocument()
  })

  it('covers the branch where plugin execution fails (success: false)', async () => {
    const user = userEvent.setup()

    callApiMock
      .mockResolvedValueOnce(
        listResponse([
          {
            id: 'plugin-3',
            name: '失败插件',
            version: '1.0.0',
            description: '执行失败测试',
          },
        ]),
      )
      .mockResolvedValueOnce({
        success: false,
        error: 'execution failed',
      })

    render(<PluginPanel text="有效正文" />)

    expect(await screen.findByText('失败插件')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '执行' }))

    await waitFor(() => {
      expect(callApiMock).toHaveBeenCalledWith('/plugins/execute', 'POST', {
        text: '有效正文',
        pluginId: 'plugin-3',
      })
    })

    expect(screen.queryByText(/\d+\/\d+/)).not.toBeInTheDocument()
  })

  it('covers the branch where execute plugin is force-triggered with empty text but bypasses the guard', async () => {
    callApiMock.mockResolvedValueOnce(
      listResponse([
        {
          id: 'plugin-force',
          name: '强制执行插件',
          version: '1.0.0',
          description: '强制执行测试',
        },
      ]),
    )

    render(<PluginPanel text="" />)

    const executeButton = await screen.findByRole('button', { name: '执行' })
    // Force-trigger by bypassing disabled attribute
    triggerReactClick(executeButton)

    // Should not call /plugins/execute because text.trim() is empty
    expect(callApiMock).toHaveBeenCalledTimes(1)
    expect(callApiMock).not.toHaveBeenCalledWith('/plugins/execute', 'POST', expect.anything())
  })

  it('covers the loading state branch where the execute button shows spinner', async () => {
    const user = userEvent.setup()

    // Create a pending promise that won't resolve immediately
    let resolveExecute: (value: unknown) => void
    const executePromise = new Promise((resolve) => {
      resolveExecute = resolve
    })

    callApiMock
      .mockResolvedValueOnce(
        listResponse([
          {
            id: 'plugin-spinner',
            name: '加载中插件',
            version: '1.0.0',
            description: '加载中测试',
          },
        ]),
      )
      .mockReturnValueOnce(executePromise)

    const { unmount } = render(<PluginPanel text="有效正文" />)

    expect(await screen.findByText('加载中插件')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '执行' }))

    // While loading, the button should show a spinner (Loader2)
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()

    // Resolve to clean up
    resolveExecute!({ success: true, data: { results: [{ score: 5, maxScore: 10, evidence: '', suggestions: [] }] } })
    unmount()
  })
})
