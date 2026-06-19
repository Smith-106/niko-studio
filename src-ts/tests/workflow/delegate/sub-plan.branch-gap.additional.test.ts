import { describe, expect, it } from 'vitest';

import { SubPlanDispatcher } from '../../../workflow/delegate/sub-plan.js';

describe('workflow/delegate/sub-plan branch-gap coverage', () => {
  it('ignores missing dependency ids when ordering sequential tasks', () => {
    const dispatcher = new SubPlanDispatcher({} as never);

    const ordered = (dispatcher as any)._orderByDependsOn([
      { id: 'sub-1', task: 'draft', dependsOn: ['missing-subtask'] },
      { id: 'sub-2', task: 'review', dependsOn: ['sub-1'] },
    ]);

    expect(ordered.map((task: { id: string }) => task.id)).toEqual([
      'sub-1',
      'sub-2',
    ]);
  });
});
