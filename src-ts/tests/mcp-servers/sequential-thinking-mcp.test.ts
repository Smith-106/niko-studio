import { beforeEach, describe, expect, it, vi } from 'vitest'

async function loadModule() {
  vi.resetModules()
  return import('../../mcp-servers/sequential-thinking-mcp')
}

describe('mcp-servers/sequential-thinking-mcp', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('handles default-session thinking, fallback thought types, conclusions, and reset', async () => {
    const mod = await loadModule()

    const first = mod.think({
      content: '梳理默认会话',
      thoughtType: 'mystery',
      metadata: { step: 1 },
    })
    const conclusion = mod.conclude({
      conclusion: '形成结论',
      confidence: 0.7,
    })

    expect(first).toMatchObject({
      content: '梳理默认会话',
      thought_type: 'analysis',
      status: 'active',
      metadata: { step: 1 },
    })
    expect(conclusion).toMatchObject({
      content: '形成结论',
      thought_type: 'conclusion',
      confidence: 0.7,
    })

    expect(mod.getChain()).toHaveLength(2)
    expect(mod.getConclusions()).toHaveLength(1)
    expect(mod.getBestBranch()).toMatchObject({
      id: 'main',
      name: 'Main',
      thoughtCount: 2,
    })
    expect(mod.exportMarkdown()).toContain('# Sequential Thinking Chain')

    const state = mod.getState()
    expect(state).toMatchObject({
      current_branch_id: 'main',
      summary: {
        totalThoughts: 2,
        totalBranches: 1,
        conclusions: 1,
        currentBranch: 'main',
      },
    })

    expect(mod.listSessions()).toContainEqual({
      id: 'default',
      thoughts: 2,
      branches: 1,
    })

    expect(mod.reset()).toEqual({ status: 'reset' })
    expect(mod.getChain()).toEqual([])
    expect(mod.getState()).toMatchObject({
      summary: {
        totalThoughts: 0,
        totalBranches: 1,
        activeThoughts: 0,
        conclusions: 0,
      },
    })
  })

  it('isolates named sessions and supports branch, revise, backtrack, and markdown export flows', async () => {
    const mod = await loadModule()

    const sessionId = 'session-alpha'
    const initial = mod.think({
      content: '建立主线',
      thoughtType: 'initial',
      sessionId,
    })
    const branch = mod.branch({
      name: 'Alternative',
      description: '探索备选方案',
      priority: 3,
      sessionId,
    })

    expect(branch.parentBranchId).toBe('main')
    expect(branch.forkPointId).toBe(initial.id)

    expect(
      mod.switchBranch({
        branchId: branch.id as string,
        sessionId,
      }),
    ).toMatchObject({
      status: 'switched',
      branchId: branch.id,
      currentThoughtId: initial.id,
    })

    const branchThought = mod.think({
      content: '尝试另一种假设',
      thoughtType: 'branch',
      confidence: 0.95,
      sessionId,
    })
    const revised = mod.revise({
      targetThoughtId: branchThought.id as string,
      newContent: '修正后的方案',
      reason: '补充证据',
      sessionId,
    })

    expect(revised).toMatchObject({
      thought_type: 'revision',
      metadata: {
        revises: branchThought.id,
        reason: '补充证据',
      },
    })

    const backtracked = mod.backtrack({
      toThoughtId: branchThought.id as string,
      sessionId,
    })
    expect(backtracked).toMatchObject({
      status: 'backtracked',
      to: branchThought.id,
      currentBranchId: branch.id,
    })

    const best = mod.getBestBranch({ sessionId })
    expect(best).toMatchObject({
      id: branch.id,
      name: 'Alternative',
    })

    const branchChain = mod.getChain({
      branchId: branch.id as string,
      sessionId,
    })
    expect(branchChain.map((item) => item.content)).toEqual([
      '尝试另一种假设',
      '修正后的方案',
      `Backtracked to thought: ${branchThought.id as string}`,
    ])

    const markdown = mod.exportMarkdown({ sessionId })
    expect(markdown).toContain('## Branch: Alternative')
    expect(markdown).toContain('[Revision]')
    expect(markdown).toContain('[Backtrack]')

    const state = mod.getState({ sessionId })
    expect(state).toMatchObject({
      summary: {
        totalThoughts: 4,
        totalBranches: 2,
        currentBranch: branch.id,
      },
    })

    expect(mod.getChain()).toEqual([])
    expect(mod.listSessions()).toContainEqual({
      id: sessionId,
      thoughts: 4,
      branches: 2,
    })
  })

  it('deletes named sessions and reports not_found for unknown sessions', async () => {
    const mod = await loadModule()

    mod.think({
      content: '会被删除的会话',
      sessionId: 'session-delete',
    })

    expect(mod.deleteSession({ sessionId: 'session-delete' })).toEqual({
      status: 'deleted',
      sessionId: 'session-delete',
    })
    expect(mod.deleteSession({ sessionId: 'missing-session' })).toEqual({
      status: 'not_found',
      sessionId: 'missing-session',
    })
    expect(mod.listSessions().some((item) => item.id === 'session-delete')).toBe(false)
  })

  it('uses default branch and conclusion fallbacks in session-scoped flows', async () => {
    const mod = await loadModule()

    const sessionId = 'session-fallbacks'
    mod.think({
      content: '默认分支优先级',
      sessionId,
    })

    const branch = mod.branch({
      name: 'NoPriority',
      description: '省略 priority',
      sessionId,
    })
    const conclusion = mod.conclude({
      conclusion: '省略 confidence',
      sessionId,
    })

    expect(branch).toMatchObject({
      name: 'NoPriority',
      priority: 0,
    })
    expect(conclusion).toMatchObject({
      content: '省略 confidence',
      confidence: 1,
    })
    expect(mod.getConclusions({ sessionId })).toHaveLength(1)
    expect(mod.reset({ sessionId })).toEqual({ status: 'reset' })
    expect(mod.getChain({ sessionId })).toEqual([])
    expect(mod.getState({ sessionId })).toMatchObject({
      summary: {
        totalThoughts: 0,
        totalBranches: 1,
        conclusions: 0,
      },
    })
  })
})
