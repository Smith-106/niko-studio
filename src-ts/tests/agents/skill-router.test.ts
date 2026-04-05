import { describe, expect, it } from 'vitest';

import {
  getSkillsForIssue,
  getSkillsForTask,
  SkillRouter,
  TaskType,
} from '../../agents/skill-router';

describe('SkillRouter', () => {
  it('routes by task type with stable ordering and priority', () => {
    const router = new SkillRouter();

    const recs = router.routeByTaskType(TaskType.CHAPTER_WRITING, 3);

    expect(recs).toHaveLength(3);
    expect(recs.map((item) => item.skillId)).toEqual([
      'novel-chapter',
      'show-dont-tell',
      'fictional-dream',
    ]);
    expect(recs.map((item) => item.priority)).toEqual([1, 2, 3]);
  });

  it('routes by keywords using overlap relevance and descending order', () => {
    const router = new SkillRouter();

    const recs = router.routeByKeywords(['角色', '对话', '潜台词'], 5);

    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0]!.relevance).toBeGreaterThanOrEqual(recs[recs.length - 1]!.relevance);
    expect(recs.some((item) => item.skillId === 'subtext-dialogue')).toBe(true);
  });

  it('routes by issue text and deduplicates skills across mapped task types', () => {
    const router = new SkillRouter();

    const recs = router.routeByIssue('人物扁平，而且角色弧光不完整');

    expect(recs.length).toBeGreaterThan(0);
    expect(new Set(recs.map((item) => item.skillId)).size).toBe(recs.length);
    expect(recs.some((item) => item.skillId === 'character-forge')).toBe(true);
    expect(recs.some((item) => item.skillId === 'four-selves')).toBe(true);
  });

  it('builds skill chains and convenience helper exports consistently', () => {
    const router = new SkillRouter();

    const chain = router.getSkillChain(TaskType.CHAPTER_WRITING);
    const byTask = getSkillsForTask(TaskType.QUALITY_REVIEW);
    const byIssue = getSkillsForIssue('缺乏悬念，反转无力');

    expect(chain.map((item) => item.skillId)).toEqual([
      '22-steps-outline',
      'subtext-dialogue',
      'show-dont-tell',
      'novel-chapter',
    ]);
    expect(byTask[0]).toMatchObject({
      skillId: 'script-doctor',
      priority: 1,
    });
    expect(byIssue.some((item) => item.skillId === 'suspense-craft')).toBe(true);
    expect(byIssue.some((item) => item.skillId === 'misdirection-twist')).toBe(true);
  });
});
