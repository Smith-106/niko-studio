import { describe, expect, it } from 'vitest';

import { resolveWorkflowSessionRoot } from '../../workflow/engine/persistence';

describe('workflow/engine/persistence additional coverage', () => {
  it('resolves active and archived workflow session roots', () => {
    expect(resolveWorkflowSessionRoot({
      activePath: 'active-root',
      archivedPath: 'archive-root',
      sessionStatus: 'active',
      sessionId: 'session-1',
    }).replace(/\\/g, '/')).toBe('active-root/session-1');

    expect(resolveWorkflowSessionRoot({
      activePath: 'active-root',
      archivedPath: 'archive-root',
      sessionStatus: 'archived',
      sessionId: 'session-2',
    }).replace(/\\/g, '/')).toBe('archive-root/session-2');

    expect(resolveWorkflowSessionRoot({
      activePath: 'active-root',
      archivedPath: 'archive-root',
      sessionStatus: undefined,
      sessionId: 'session-3',
    }).replace(/\\/g, '/')).toBe('active-root/session-3');
  });
});
