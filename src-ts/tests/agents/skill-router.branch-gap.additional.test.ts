import { afterEach, describe, expect, it } from 'vitest';

import {
  SKILL_REGISTRY,
  TASK_SKILL_MAP,
  SkillRouter,
  type SkillRecommendation,
  type TaskType,
} from '../../agents/skill-router.js';

describe('SkillRouter branch-gap coverage', () => {
  const router = new SkillRouter();

  afterEach(() => {
    delete (TASK_SKILL_MAP as Record<string, SkillRecommendation[]>).__branch_gap_task__;
    if (!SKILL_REGISTRY['novel-chapter']) {
      SKILL_REGISTRY['novel-chapter'] = {
        name: '\u5c0f\u8bf4\u7ae0\u8282',
        description: '\u7ae0\u8282\u7ea7\u5199\u4f5c\u6280\u5de7',
        taskTypes: [],
        keywords: ['\u7ae0\u8282', '\u6bb5\u843d', '\u8282\u594f', '\u627f\u63a5'],
      };
    }
  });

  it('returns empty recommendations for unknown task types and unknown chains', () => {
    expect(router.routeByTaskType('__missing_task__' as TaskType)).toEqual([]);
    expect(router.getSkillChain('__missing_task__' as TaskType)).toEqual([]);
  });

  it('falls back to skill id and empty reason when a task mapping points to an unknown registry entry', () => {
    (TASK_SKILL_MAP as Record<string, [string, number, number][]>).__branch_gap_task__ = [
      ['missing-skill', 0.42, 9],
    ];

    const [recommendation] = router.routeByTaskType('__branch_gap_task__' as TaskType, 1);

    expect(recommendation).toMatchObject({
      skillId: 'missing-skill',
      skillName: 'missing-skill',
      relevance: 0.42,
      reason: '',
      priority: 9,
    });
  });

  it('falls back inside skill chains when a referenced registry entry is missing', () => {
    const originalNovelChapter = SKILL_REGISTRY['novel-chapter'];
    delete SKILL_REGISTRY['novel-chapter'];

    try {
      const chain = router.getSkillChain('chapter_writing' as TaskType);
      const fallback = chain.find((item) => item.skillId === 'novel-chapter');

      expect(fallback).toMatchObject({
        skillId: 'novel-chapter',
        skillName: 'novel-chapter',
        relevance: 1,
        priority: 4,
      });
      expect(fallback?.reason.endsWith(': ')).toBe(true);
    } finally {
      if (originalNovelChapter) {
        SKILL_REGISTRY['novel-chapter'] = originalNovelChapter;
      }
    }
  });
});
