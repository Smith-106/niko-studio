import { beforeEach, describe, expect, it, vi } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())
const appendWorkspacePayloadMock = vi.hoisted(() => vi.fn())

vi.mock('../core', () => ({
  callApi: callApiMock,
}))

vi.mock('../workspace', () => ({
  appendWorkspacePayload: appendWorkspacePayloadMock,
}))

import {
  createCheckpoint,
  listCheckpoints,
  quickRollbackWorkflow,
  restoreCheckpoint,
} from './checkpoints'

describe('workflow checkpoints api bridge', () => {
  const workspace = { identity: { workspaceId: 'ws-1' } } as any

  beforeEach(() => {
    vi.clearAllMocks()
    appendWorkspacePayloadMock.mockImplementation((payload, currentWorkspace) => ({
      ...payload,
      workspace: currentWorkspace,
    }))
  })

  it('returns transport failures from quick rollback unchanged', async () => {
    callApiMock.mockResolvedValueOnce({
      success: false,
      error: 'gateway offline',
    })

    await expect(
      quickRollbackWorkflow('plan-1', 'cp-1', 'recover draft', workspace),
    ).resolves.toEqual({
      success: false,
      error: 'gateway offline',
    })
  })

  it.each([
    [{ restored: false, error: 'top-level rollback failed' }, 'top-level rollback failed'],
    [{ restored: false, restore: { error: 'checkpoint missing' } }, 'checkpoint missing'],
    [{ restored: false, message: 'restore refused' }, 'restore refused'],
    [{ restored: false }, 'Quick rollback failed.'],
  ])('extracts quick rollback errors from %j', async (payload, expectedError) => {
    callApiMock.mockResolvedValueOnce({
      success: true,
      data: payload,
    })

    await expect(
      quickRollbackWorkflow('plan-2', 'cp-2', undefined, workspace),
    ).resolves.toEqual({
      success: false,
      error: expectedError,
    })
  })

  it('passes through successful quick rollback responses', async () => {
    callApiMock.mockResolvedValueOnce({
      success: true,
      data: {
        restored: true,
        checkpoint_id: 'cp-3',
      },
    })

    const response = await quickRollbackWorkflow('plan-3', 'cp-3', 'restore latest', workspace)

    expect(appendWorkspacePayloadMock).toHaveBeenCalledWith({
      plan_id: 'plan-3',
      checkpoint_id: 'cp-3',
      reason: 'restore latest',
    }, workspace)
    expect(callApiMock).toHaveBeenCalledWith('/workflow/rollback', 'POST', {
      plan_id: 'plan-3',
      checkpoint_id: 'cp-3',
      reason: 'restore latest',
      workspace,
    })
    expect(response).toEqual({
      success: true,
      data: {
        restored: true,
        checkpoint_id: 'cp-3',
      },
    })
  })

  it('creates checkpoints and lists them through workspace-aware payloads', async () => {
    callApiMock.mockResolvedValue({ success: true, data: {} })

    await createCheckpoint('Before revision', true, workspace)
    await listCheckpoints(5, workspace)

    expect(appendWorkspacePayloadMock).toHaveBeenNthCalledWith(1, {
      description: 'Before revision',
      auto_commit: true,
    }, workspace)
    expect(appendWorkspacePayloadMock).toHaveBeenNthCalledWith(2, {
      limit: 5,
    }, workspace)
    expect(callApiMock).toHaveBeenNthCalledWith(1, '/checkpoint/create', 'POST', {
      description: 'Before revision',
      auto_commit: true,
      workspace,
    })
    expect(callApiMock).toHaveBeenNthCalledWith(2, '/checkpoint/list', 'POST', {
      limit: 5,
      workspace,
    })
  })

  it('maps restore checkpoint failures across transport, status, and embedded-error branches', async () => {
    callApiMock
      .mockResolvedValueOnce({
        success: false,
        error: 'restore transport failed',
      })
      .mockResolvedValueOnce({
        success: true,
        data: {},
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          status: 'failed',
          message: 'restore rejected',
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          status: 'ok',
          error: 'checkpoint still busy',
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          status: 'restored',
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          status: 'ok',
        },
      })

    await expect(restoreCheckpoint('cp-10', workspace)).resolves.toEqual({
      success: false,
      error: 'restore transport failed',
    })
    await expect(restoreCheckpoint('cp-11', workspace)).resolves.toEqual({
      success: false,
      error: 'Restore failed.',
    })
    await expect(restoreCheckpoint('cp-12', workspace)).resolves.toEqual({
      success: false,
      error: 'restore rejected',
    })
    await expect(restoreCheckpoint('cp-13', workspace)).resolves.toEqual({
      success: false,
      error: 'checkpoint still busy',
    })
    await expect(restoreCheckpoint('cp-14', workspace)).resolves.toEqual({
      success: true,
      data: { status: 'restored' },
    })
    await expect(restoreCheckpoint('cp-15', workspace)).resolves.toEqual({
      success: true,
      data: { status: 'ok' },
    })
  })
})
