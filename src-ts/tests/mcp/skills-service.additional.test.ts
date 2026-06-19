import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_SKILLS_DIR = process.env.NIKO_SKILLS_DIR;

describe('mcp skills service additional coverage', () => {
  afterEach(() => {
    if (ORIGINAL_SKILLS_DIR === undefined) {
      delete process.env.NIKO_SKILLS_DIR;
    } else {
      process.env.NIKO_SKILLS_DIR = ORIGINAL_SKILLS_DIR;
    }
    vi.doUnmock('../../agents/skill-router');
    vi.doUnmock('../../skills/skill-loader');
    vi.resetModules();
  });

  it('returns an empty chain for a blank task type before building the router', async () => {
    const { skillsGetChain } = await import('../../mcp/services/skills.js');

    await expect(skillsGetChain('')).resolves.toEqual([]);
  });

  it('maps missing summary fields to empty strings and empty keyword arrays', async () => {
    vi.doMock('../../skills/skill-loader', () => ({
      SkillLoader: class {
        getSummaryDict() {
          return [
            {
              name: null,
              description: undefined,
              tags: 'not-an-array',
              triggers: null,
            },
          ];
        }
      },
    }));

    const { skillsList } = await import('../../mcp/services/skills.js');
    const listed = await skillsList();

    expect(listed).toEqual([
      {
        id: '',
        name: '',
        description: '',
        keywords: [],
      },
    ]);
  });

  it('falls back to empty content and metadata when a loader returns sparse payloads', async () => {
    vi.doMock('../../skills/skill-loader', () => ({
      SkillLoader: class {
        loadSkill() {
          return {
            content: null,
            metadata: null,
          };
        }
      },
    }));

    const { skillsLoad } = await import('../../mcp/services/skills.js');
    const loaded = await skillsLoad('sparse-skill');

    expect(loaded).toEqual({
      id: 'sparse-skill',
      content: '',
      metadata: {},
    });
  });
});
