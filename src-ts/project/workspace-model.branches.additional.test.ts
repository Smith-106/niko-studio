import { describe, expect, it } from 'vitest';

import { normalizeProjectWorkspaceContext } from './workspace-model.js';

describe('project workspace model branch coverage', () => {
  it('falls back to the normalized project id for workspace id and project name when explicit names are absent', () => {
    const workspace = normalizeProjectWorkspaceContext({
      projectId: 'Atlas Prime',
      workspaceId: '',
      projectName: '',
    }, {
      fallbackProjectId: 'Ignored Fallback',
    });

    expect(workspace.identity).toMatchObject({
      projectId: 'Atlas Prime',
      workspaceId: 'atlas-prime',
      projectName: 'Atlas Prime',
      workspaceRoot: null,
    });
  });
});
