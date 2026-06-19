import { beforeEach, describe, expect, it, vi } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())

vi.mock('./core', () => ({
  callApi: callApiMock,
}))

import { executePlugin, listPlugins, registerPlugin } from './plugins'

describe('plugins api', () => {
  beforeEach(() => {
    callApiMock.mockReset()
  })

  it('lists plugins through the list endpoint', async () => {
    callApiMock.mockResolvedValue({ success: true, data: { plugins: [] } })

    await listPlugins()

    expect(callApiMock).toHaveBeenCalledWith('/plugins/list', 'GET')
  })

  it('executes a plugin with text payload', async () => {
    callApiMock.mockResolvedValue({ success: true, data: { results: [] } })

    await executePlugin('plugin-1', 'draft paragraph')

    expect(callApiMock).toHaveBeenCalledWith('/plugins/execute', 'POST', {
      pluginId: 'plugin-1',
      text: 'draft paragraph',
    })
  })

  it('registers plugin manifests directly', async () => {
    const manifest = {
      id: 'plugin-1',
      name: 'Narrative Guard',
      version: '1.0.0',
      description: 'Checks pacing issues',
      dimension: 'pacing',
      rules: [
        {
          keyword: 'pacing',
          score: 0.9,
          evidence: 'slow middle section',
          suggestion: 'tighten chapter transitions',
        },
      ],
    }

    callApiMock.mockResolvedValue({ success: true, data: { id: 'plugin-1', status: 'ok' } })

    await registerPlugin(manifest)

    expect(callApiMock).toHaveBeenCalledWith('/plugins/register', 'POST', manifest)
  })
})
