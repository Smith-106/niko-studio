import { afterEach, describe, expect, it, vi } from 'vitest';

const routeMock = vi.fn();
const planMock = vi.fn();
const executeMock = vi.fn();
const quickRollbackMock = vi.fn();
const lifecycleMock = vi.fn();
const createCheckpointMock = vi.fn();
const restoreCheckpointMock = vi.fn();
const listCheckpointsMock = vi.fn();
const bindPlanSessionMock = vi.fn();

vi.mock('../workflow/workflow-engine.js', () => ({
  WorkflowEngine: vi.fn().mockImplementation(() => ({
    route: routeMock,
    plan: planMock,
    execute: executeMock,
    quickRollback: quickRollbackMock,
    lifecycle: lifecycleMock,
    createCheckpoint: createCheckpointMock,
    restoreCheckpoint: restoreCheckpointMock,
    listCheckpoints: listCheckpointsMock,
    bindPlanSession: bindPlanSessionMock,
  })),
}));

describe('workflow service workspace binding', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('binds a workflow session when authoritative workspace context provides one', async () => {
    planMock.mockResolvedValueOnce({ plan_id: 'plan-workspace' });

    const { workflowPlan } = await import('./services/workflow.js');

    const result = await workflowPlan({
      task: '整理章节计划',
      level: 'L3',
      workspace: {
        schemaVersion: '2026-04-08',
        identity: {
          workspaceId: 'atlas-workspace',
          projectId: 'atlas-project',
          projectName: 'atlas-project',
          workspaceRoot: '/tmp/atlas',
        },
        manuscript: {
          manuscriptId: null,
          title: null,
          chapterId: 'chapter-2',
          chapterTitle: null,
          chapterNumber: 2,
        },
        storyBible: {
          storyBibleId: null,
          draftId: 'draft-1',
          version: null,
          storage: 'local-draft',
        },
        knowledge: {
          focusEntityId: 'hero-1',
          graphEntityIds: ['hero-1'],
          memoryEntryIds: [],
        },
        workflow: {
          sessionId: 'workflow-session-1',
          planId: null,
          level: 'L3',
        },
        chat: {
          conversationId: 'conversation-1',
          comparisonEnabled: false,
        },
        compatibility: {
          additiveContract: true,
          migratedLegacyFields: [],
          notes: [],
        },
      },
    });

    expect(bindPlanSessionMock).toHaveBeenCalledWith('plan-workspace', 'workflow-session-1');
    expect(result).toEqual({ plan_id: 'plan-workspace' });
  });
});
