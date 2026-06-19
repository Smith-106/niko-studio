import { afterEach, describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';

const ORIGINAL_SKILLS_DIR = process.env.NIKO_SKILLS_DIR;

describe('mcp skills service parity', () => {
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

  it('lists and loads real skills from the configured skill directory', async () => {
    process.env.NIKO_SKILLS_DIR = join(process.cwd(), '..', 'skills');

    const { skillsList, skillsLoad } = await import('../../mcp/services/skills.js');
    const listed = await skillsList();
    const loaded = await skillsLoad('novel-chapter');

    expect(listed.some((item) => item.id === 'novel-chapter')).toBe(true);
    expect(loaded).toMatchObject({
      id: 'novel-chapter',
    });
    expect('content' in loaded && loaded.content.length > 0).toBe(true);
  });

  it('matches skills by task type, keywords, and issue text', async () => {
    process.env.NIKO_SKILLS_DIR = join(process.cwd(), '..', 'skills');

    const { skillsMatch } = await import('../../mcp/services/skills.js');
    const matches = await skillsMatch({
      taskType: 'chapter_writing',
      keywords: ['悬念', '反转'],
      issue: '缺乏悬念，反转无力',
    });

    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((item) => item.skill_id === 'novel-chapter')).toBe(true);
    expect(matches.some((item) => item.skill_id === 'suspense-craft')).toBe(true);
    expect(matches.some((item) => item.skill_id === 'misdirection-twist')).toBe(true);
    expect(matches[0]?.relevance).toBeGreaterThan(0);
  });

  it('returns a real skill chain for known task types and empty chain for unknown types', async () => {
    process.env.NIKO_SKILLS_DIR = join(process.cwd(), '..', 'skills');

    const { skillsGetChain } = await import('../../mcp/services/skills.js');
    const chain = await skillsGetChain('chapter_writing');
    const missing = await skillsGetChain('unknown-task');

    expect(chain.map((item) => item.skill_id)).toEqual([
      '22-steps-outline',
      'subtext-dialogue',
      'show-dont-tell',
      'novel-chapter',
    ]);
    expect(chain[0]).toMatchObject({ step: 1 });
    expect(missing).toEqual([]);
  });

  it('returns a bounded error when loading an unknown skill id', async () => {
    process.env.NIKO_SKILLS_DIR = join(process.cwd(), '..', 'skills');

    const { skillsLoad } = await import('../../mcp/services/skills.js');
    const result = await skillsLoad('missing-skill');

    expect(result).toEqual({ error: "Skill 'missing-skill' not found" });
  });

  it('filters listed skills by category-like text across names, descriptions, and keywords', async () => {
    vi.resetModules();
    vi.doMock('../../skills/skill-loader', () => ({
      SkillLoader: class {
        getSummaryDict() {
          return [
            {
              name: 'plot-twist',
              description: 'Handles suspenseful reversals',
              tags: ['suspense'],
              triggers: ['twist'],
            },
            {
              name: 'dialogue-doctor',
              description: 'Polishes character dialogue',
              tags: ['dialogue'],
              triggers: ['voice'],
            },
          ];
        }
      },
    }));

    const { skillsList } = await import('../../mcp/services/skills.js');
    const suspense = await skillsList('suspense');
    const voice = await skillsList('voice');

    expect(suspense).toEqual([
      expect.objectContaining({ id: 'plot-twist' }),
    ]);
    expect(voice).toEqual([
      expect.objectContaining({ id: 'dialogue-doctor' }),
    ]);
  });

  it('dedupes matches by keeping higher relevance and then lower priority', async () => {
    vi.resetModules();
    vi.doMock('../../agents/skill-router', () => ({
      TaskType: {
        CHAPTER_WRITING: 'chapter_writing',
      },
      SkillRouter: class {
        routeByTaskType() {
          return [
            {
              skillId: 'duplicate-skill',
              skillName: 'Duplicate Skill',
              relevance: 0.8,
              reason: 'task type',
              priority: 3,
            },
            {
              skillId: 'unique-skill',
              skillName: 'Unique Skill',
              relevance: 0.7,
              reason: 'task type',
              priority: 2,
            },
          ];
        }

        routeByKeywords() {
          return [
            {
              skillId: 'duplicate-skill',
              skillName: 'Duplicate Skill',
              relevance: 0.9,
              reason: 'keyword',
              priority: 5,
            },
          ];
        }

        routeByIssue() {
          return [
            {
              skillId: 'duplicate-skill',
              skillName: 'Duplicate Skill',
              relevance: 0.9,
              reason: 'issue',
              priority: 1,
            },
          ];
        }

        getSkillChain() {
          return [];
        }
      },
    }));

    const { skillsMatch } = await import('../../mcp/services/skills.js');
    const matches = await skillsMatch({
      taskType: 'chapter_writing',
      keywords: ['twist'],
      issue: 'needs more tension',
    });

    expect(matches).toEqual([
      {
        skill_id: 'duplicate-skill',
        skill_name: 'Duplicate Skill',
        relevance: 0.9,
        reason: 'issue',
        priority: 1,
      },
      {
        skill_id: 'unique-skill',
        skill_name: 'Unique Skill',
        relevance: 0.7,
        reason: 'task type',
        priority: 2,
      },
    ]);
  });

  it('rejects blank skill ids before invoking the loader', async () => {
    process.env.NIKO_SKILLS_DIR = join(process.cwd(), '..', 'skills');

    const { skillsLoad } = await import('../../mcp/services/skills.js');
    const result = await skillsLoad('   ');

    expect(result).toEqual({ error: "Skill '' not found" });
  });
});
