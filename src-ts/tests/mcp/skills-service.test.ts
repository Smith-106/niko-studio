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
});
