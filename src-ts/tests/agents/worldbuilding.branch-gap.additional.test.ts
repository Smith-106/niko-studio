import { describe, expect, it, vi } from 'vitest';

import { WorldbuildingAgent } from '../../agents/worldbuilding';

describe('WorldbuildingAgent branch-gap coverage', () => {
  it('fills missing location fields with safe defaults when building settings', async () => {
    const agent = new WorldbuildingAgent({
      graphEngine: {
        query: vi.fn(),
      } as never,
    });
    vi.spyOn(agent as never, 'queryLocation').mockResolvedValue({
      name: 'Harbor',
    });

    const context = await agent.getContext({
      location: 'Harbor',
    });

    expect(context.locationDetails).toEqual({ name: 'Harbor' });
    expect(context.settings).toEqual([
      {
        category: 'geography',
        name: 'Harbor',
        description: '',
        rules: [],
        relatedLocations: [],
        relatedCharacters: [],
      },
    ]);
  });
});
