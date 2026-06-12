import { describe, expect, it } from 'vitest';

import { normalizeProjectWorkspaceContext } from './workspace-model.js';

describe('project workspace model more branch coverage', () => {
  it('normalizes snake_case conversation ids into chat context and migration notes', () => {
    const workspace = normalizeProjectWorkspaceContext({
      project_id: 'atlas-project',
      conversation_id: 'conversation-snake',
    });

    expect(workspace.identity.projectId).toBe('atlas-project');
    expect(workspace.chat.conversationId).toBe('conversation-snake');
    expect(workspace.compatibility.migratedLegacyFields).toEqual(
      expect.arrayContaining([
        'project_id',
        'conversation_id',
      ]),
    );
  });
});
